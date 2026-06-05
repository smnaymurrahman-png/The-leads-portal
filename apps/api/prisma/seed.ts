/**
 * Database seed — Leads Portal.
 *
 * Inserts a minimal but coherent dataset for local development:
 *   1 super admin · 1 admin · 1 agent
 *   2 clients (both owned by the agent)
 *   2 campaigns · 2 landing pages (solar + sweepstakes)
 *   sample lead prices (stored in `settings`)
 *
 * The script is idempotent — re-running it will not create duplicates.
 *
 * Run with:  pnpm --filter @leads-portal/api prisma:seed
 */
import {
  CampaignAdsType,
  LandingStatus,
  LeadType,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { seedLeadTypeColumns } from './lead-type-columns';

const prisma = new PrismaClient();

/** Shared development password for every seeded account. CHANGE IN PRODUCTION. */
const DEFAULT_PASSWORD = 'Password123!';

/** Create a campaign only if one with the same name does not already exist. */
async function ensureCampaign(name: string, data: Omit<Prisma.CampaignUncheckedCreateInput, 'name'>) {
  const existing = await prisma.campaign.findFirst({ where: { name } });
  return existing ?? prisma.campaign.create({ data: { name, ...data } });
}

/** Create a landing page only if one with the same name does not already exist. */
async function ensureLandingPage(
  name: string,
  data: Omit<Prisma.LandingPageUncheckedCreateInput, 'name'>,
) {
  const existing = await prisma.landingPage.findFirst({ where: { name } });
  return existing ?? prisma.landingPage.create({ data: { name, ...data } });
}

async function main(): Promise<void> {
  const password_hash = await hash(DEFAULT_PASSWORD, 10);

  // ── Internal staff ──────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { work_email: 'superadmin@leadsportal.test' },
    update: {},
    create: {
      role: Role.SUPER_ADMIN,
      full_name: 'Sara Superadmin',
      work_email: 'superadmin@leadsportal.test',
      phone: '+15550000001',
      password_hash,
      designation: 'Founder',
      employee_id: 'EMP-0001',
    },
  });

  const admin = await prisma.user.upsert({
    where: { work_email: 'admin@leadsportal.test' },
    update: {},
    create: {
      role: Role.ADMIN,
      full_name: 'Adam Admin',
      work_email: 'admin@leadsportal.test',
      phone: '+15550000002',
      password_hash,
      designation: 'Operations Manager',
      employee_id: 'EMP-0002',
    },
  });

  const agent = await prisma.user.upsert({
    where: { work_email: 'agent@leadsportal.test' },
    update: {},
    create: {
      role: Role.AGENT,
      full_name: 'Aria Agent',
      work_email: 'agent@leadsportal.test',
      phone: '+15550000003',
      password_hash,
      designation: 'Account Executive',
      employee_id: 'EMP-0003',
    },
  });

  // ── Clients (buyers), both owned by the agent ───────────────────────────
  const client1 = await prisma.client.upsert({
    where: { email: 'buyer1@acmesolar.test' },
    update: {},
    create: {
      agent_id: agent.id,
      full_name: 'Carlos Client',
      business_name: 'Acme Solar Co.',
      email: 'buyer1@acmesolar.test',
      phone: '+15551110001',
      address: '100 Sunbeam Ave, Phoenix, AZ',
      password_hash,
    },
  });

  const client2 = await prisma.client.upsert({
    where: { email: 'buyer2@luckydraw.test' },
    update: {},
    create: {
      agent_id: agent.id,
      full_name: 'Dana Client',
      business_name: 'Lucky Draw Marketing',
      email: 'buyer2@luckydraw.test',
      phone: '+15551110002',
      address: '200 Jackpot Blvd, Las Vegas, NV',
      password_hash,
    },
  });

  // ── Campaigns ───────────────────────────────────────────────────────────
  await ensureCampaign('Solar Spring Push', {
    details: 'Q2 solar lead-generation push across AZ / NV / CA.',
    ads_type: CampaignAdsType.FACEBOOK,
    production_link: 'https://ads.example.com/solar-spring',
    budget: '15000.00',
    day_count: 60,
    created_by: admin.id,
  });

  await ensureCampaign('Sweepstakes Summer Blast', {
    details: 'Summer sweepstakes acquisition funnel.',
    ads_type: CampaignAdsType.GOOGLE,
    production_link: 'https://ads.example.com/sweeps-summer',
    budget: '8000.00',
    day_count: 45,
    created_by: admin.id,
  });

  // ── Landing pages ───────────────────────────────────────────────────────
  // Fixed IDs + intake secrets so the Phase 4 intake webhook can be tested
  // with a copy-pasteable signed curl. Rotate the secrets outside dev.
  await ensureLandingPage('Solar — Free Quote', {
    id: '00000000-0000-4000-8000-000000000001',
    lead_type: LeadType.SOLAR,
    web_link: 'https://lp.example.com/solar-free-quote',
    status: LandingStatus.PUBLISHED,
    field_map: { full_name: 'name', email: 'email', phone: 'phone', zip: 'postal_code' },
    intake_secret: 'solar_dev_intake_secret_change_me',
  });

  await ensureLandingPage('Sweepstakes — $1,000 Giveaway', {
    id: '00000000-0000-4000-8000-000000000002',
    lead_type: LeadType.SWEEPSTAKES,
    web_link: 'https://lp.example.com/sweeps-1000',
    status: LandingStatus.PUBLISHED,
    field_map: { full_name: 'name', email: 'email', phone: 'phone' },
    intake_secret: 'sweeps_dev_intake_secret_change_me',
  });

  // ── Sample lead prices (settings) ───────────────────────────────────────
  // Stored as a flat list of { lead_type, delivery_mode, unit_price } — the
  // shape the pricing module reads and writes.
  const leadPrices = [
    { lead_type: 'SOLAR', delivery_mode: 'EXCLUSIVE', unit_price: 45 },
    { lead_type: 'SOLAR', delivery_mode: 'SHARED', unit_price: 18 },
    { lead_type: 'SWEEPSTAKES', delivery_mode: 'EXCLUSIVE', unit_price: 12 },
    { lead_type: 'SWEEPSTAKES', delivery_mode: 'SHARED', unit_price: 5 },
    { lead_type: 'PAYDAY', delivery_mode: 'EXCLUSIVE', unit_price: 30 },
    { lead_type: 'PAYDAY', delivery_mode: 'SHARED', unit_price: 12 },
    { lead_type: 'HOMEOWNER', delivery_mode: 'EXCLUSIVE', unit_price: 40 },
    { lead_type: 'HOMEOWNER', delivery_mode: 'SHARED', unit_price: 16 },
  ];
  await prisma.setting.upsert({
    where: { key: 'lead_prices' },
    update: { value: leadPrices },
    create: {
      key: 'lead_prices',
      description: 'Per-lead pricing (USD) by lead type and delivery mode.',
      value: leadPrices,
    },
  });

  // ── Suppression list (lets the intake "suppressed" path be tested) ──────
  const suppressionEntries = [
    { email: 'suppressed@example.com', reason: 'Consumer opt-out' },
    { phone: '+14155550000', reason: 'Do-not-contact request' },
  ];
  for (const entry of suppressionEntries) {
    const exists = await prisma.suppressionList.findFirst({
      where: { email: entry.email ?? undefined, phone: entry.phone ?? undefined },
    });
    if (!exists) {
      await prisma.suppressionList.create({ data: entry });
    }
  }

  // ── Leads-sheet column schemas (one row per visible column per LeadType) ──
  await seedLeadTypeColumns(prisma);

  /* eslint-disable no-console */
  console.log('✔ Seed complete');
  console.log(`  staff:    ${superAdmin.work_email}, ${admin.work_email}, ${agent.work_email}`);
  console.log(`  clients:  ${client1.email}, ${client2.email}`);
  console.log('  campaigns + landing pages + lead_prices setting created');
  console.log('  suppression list: suppressed@example.com, +14155550000');
  console.log('  solar landing page id: 00000000-0000-4000-8000-000000000001');
  console.log('  solar intake secret:   solar_dev_intake_secret_change_me');
  console.log(`  password for every seeded account: ${DEFAULT_PASSWORD}`);
  /* eslint-enable no-console */
}

main()
  .catch((error) => {
    console.error('✖ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
