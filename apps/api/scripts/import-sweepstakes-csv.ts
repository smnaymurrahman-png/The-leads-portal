/**
 * One-shot import of a sweepstakes CSV into the production database.
 *
 * CSV columns expected: first_name, last_name, email, address, city, state,
 *                       zip, ip_address, gender, phone
 *
 * Run with:
 *   pnpm --filter @leads-portal/api exec ts-node --transpile-only \
 *     scripts/import-sweepstakes-csv.ts <path-to-csv>
 *
 * Idempotent — rows with a duplicate submission_id are silently skipped.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { LeadState, LeadType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SWEEPSTAKES_LANDING_PAGE_ID = '1247305e-2654-468b-aa56-b1f811338d24';

function generatePublicLeadId(): string {
  return 'SWEEP-' + randomBytes(4).toString('hex').toUpperCase();
}

/** Normalise a raw 10-digit US phone to E.164. Returns null if unparseable. */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return digits.length > 0 ? raw : null;
}

/** Minimal RFC4180 CSV parser — returns array of header-keyed objects. */
async function parseCsvFile(filePath: string): Promise<Record<string, string>[]> {
  const lines: string[] = [];
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    lines.push(line);
  }
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        fields.push(field.trim()); field = '';
      } else {
        field += c;
      }
    }
    fields.push(field.trim());
    return fields;
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1)
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const values = parseRow(l);
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('✖  DATABASE_URL is not set.');
    process.exit(1);
  }

  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('✖  Usage: ts-node scripts/import-sweepstakes-csv.ts <path-to-csv>');
    process.exit(1);
  }

  const page = await prisma.landingPage.findUnique({ where: { id: SWEEPSTAKES_LANDING_PAGE_ID } });
  if (!page) {
    console.error('✖  Sweepstakes landing page not found. Run prisma:seed first.');
    process.exit(1);
  }

  const rows = await parseCsvFile(csvPath);
  console.log(`\nParsed ${rows.length} rows from ${csvPath}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const submissionId = `csv-sweeps-${String(i + 1).padStart(5, '0')}-${row.email?.slice(0, 8) ?? 'x'}`;

    const existing = await prisma.lead.findUnique({ where: { submission_id: submissionId } });
    if (existing) {
      skipped++;
      continue;
    }

    const firstName = (row['first_name'] ?? '').trim();
    const lastName  = (row['last_name']  ?? '').trim();
    const fullName  = [firstName, lastName].filter(Boolean).join(' ') || null;
    const phone     = normalisePhone(row['phone'] ?? '');

    try {
      await prisma.lead.create({
        data: {
          public_lead_id:  generatePublicLeadId(),
          submission_id:   submissionId,
          landing_page_id: SWEEPSTAKES_LANDING_PAGE_ID,
          lead_type:       LeadType.SWEEPSTAKES,
          full_name:       fullName,
          email:           row['email']   || null,
          phone:           phone,
          address:         row['address'] || null,
          state:           row['state']   || null,
          zip:             row['zip']     || null,
          country:         'US',
          consent_ip:      row['ip_address'] || null,
          qualification: {
            city:       row['city']       || null,
            gender:     row['gender']     || null,
            ip_address: row['ip_address'] || null,
          },
          lead_state: LeadState.VALID,
          captured_at: new Date(Date.now() - i * 60_000), // stagger by 1 min each
        },
      });
      created++;
      console.log(`  ✔  ${String(i + 1).padStart(3)}  ${fullName ?? '—'}  (${row['state'] ?? '?'})`);
    } catch (err) {
      failed++;
      console.error(`  ✖  ${String(i + 1).padStart(3)}  ${fullName ?? '—'}  ${(err as Error).message}`);
    }
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped, ${failed} failed.\n`);
}

main()
  .catch((e) => { console.error('✖  Import failed:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
