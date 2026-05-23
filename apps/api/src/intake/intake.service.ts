import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type LandingPage,
  type Lead,
  LeadState,
  Prisma,
  RejectReason,
} from '@prisma/client';
import { isEmail } from 'class-validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { EnvironmentVariables } from '../config/env.validation';
import { LEAD_VALID, type LeadValidEvent } from '../events/lead-events';
import { PrismaService } from '../prisma/prisma.service';
import { DeliverabilityService } from './deliverability.service';
import type { IntakeLeadDto } from './dto/intake-lead.dto';
import { verifySignature } from './signature.util';

/** Assumed dialing region for phone numbers that arrive without a + prefix. */
const DEFAULT_REGION = 'US';

/** Canonical lead columns that a landing page's field_map can populate. */
const CANONICAL_FIELDS = [
  'full_name',
  'email',
  'phone',
  'address',
  'country',
  'state',
  'zip',
] as const;

type CanonicalField = (typeof CANONICAL_FIELDS)[number];
type Normalised = Partial<Record<CanonicalField, string>>;

interface Verdict {
  state: LeadState;
  reason: RejectReason | null;
  /** E.164 phone when format validation succeeded. */
  phone?: string;
}

export interface IntakeResult {
  leadId: string;
  publicLeadId: string;
  state: LeadState;
  rejectReason: RejectReason | null;
  /** True when this was a retried webhook and no new lead was created. */
  idempotent: boolean;
}

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly deliverability: DeliverabilityService,
    private readonly events: EventEmitter2,
  ) {}

  async ingest(
    landingPageId: string,
    rawBody: Buffer | undefined,
    signature: string | undefined,
    dto: IntakeLeadDto,
  ): Promise<IntakeResult> {
    const page = await this.prisma.landingPage.findUnique({ where: { id: landingPageId } });
    if (!page) {
      throw new NotFoundException('Landing page not found');
    }

    // HMAC is the only authentication for this public webhook.
    if (!rawBody || !verifySignature(rawBody, signature, page.intake_secret)) {
      throw new UnauthorizedException('Invalid or missing intake signature');
    }

    // Step 0 — idempotency: a retried webhook must not create a second lead.
    const existing = await this.prisma.lead.findUnique({
      where: { submission_id: dto.submission_id },
    });
    if (existing) {
      return this.toResult(existing, true);
    }

    const fields = this.normalise(page, dto.data);
    const verdict = await this.evaluate(fields);
    const lead = await this.persist(page, dto, fields, verdict);

    // A VALID lead enters the distribution engine (DistributionService listens).
    if (lead.lead_state === LeadState.VALID) {
      this.events.emit(LEAD_VALID, { leadId: lead.id } satisfies LeadValidEvent);
    }
    return this.toResult(lead, false);
  }

  /** Maps the raw WordPress fields onto canonical lead columns via field_map. */
  private normalise(page: LandingPage, data: Record<string, unknown>): Normalised {
    const fieldMap = (page.field_map ?? {}) as Record<string, unknown>;
    const out: Normalised = {};

    for (const field of CANONICAL_FIELDS) {
      // field_map shape: { canonicalField: "wordpressFieldName" }.
      // Fall back to an identity mapping when the field is not mapped.
      const sourceKey = typeof fieldMap[field] === 'string' ? (fieldMap[field] as string) : field;
      const value = data[sourceKey];
      if (typeof value === 'string' && value.trim() !== '') {
        out[field] = value.trim();
      } else if (typeof value === 'number') {
        out[field] = String(value);
      }
    }

    if (out.email) {
      out.email = out.email.toLowerCase();
    }
    return out;
  }

  /** Runs the validation pipeline and returns the resulting lead state. */
  private async evaluate(fields: Normalised): Promise<Verdict> {
    // (1) required fields
    if (!fields.full_name || !fields.email || !fields.phone) {
      return { state: LeadState.REJECTED, reason: RejectReason.INVALID_FORMAT };
    }

    // (2) format — email + phone (libphonenumber)
    if (!isEmail(fields.email)) {
      return { state: LeadState.REJECTED, reason: RejectReason.INVALID_FORMAT };
    }
    const parsedPhone = parsePhoneNumberFromString(fields.phone, DEFAULT_REGION);
    if (!parsedPhone || !parsedPhone.isValid()) {
      return { state: LeadState.REJECTED, reason: RejectReason.INVALID_FORMAT };
    }
    const phone = parsedPhone.number; // E.164

    // (2b) deliverability — STUB, see DeliverabilityService
    const deliverability = await this.deliverability.check(fields.email, phone);
    if (!deliverability.deliverable) {
      return { state: LeadState.REJECTED, reason: RejectReason.UNDELIVERABLE, phone };
    }

    // (3) deduplication — same phone/email on a live lead within the window
    if (await this.isDuplicate(phone, fields.email)) {
      return { state: LeadState.REJECTED, reason: RejectReason.DUPLICATE, phone };
    }

    // (4) suppression — phone/email on the suppression list
    if (await this.isSuppressed(phone, fields.email)) {
      return { state: LeadState.REJECTED, reason: RejectReason.SUPPRESSED, phone };
    }

    return { state: LeadState.VALID, reason: null, phone };
  }

  /** A non-rejected lead with the same phone or email within the dedup window. */
  private async isDuplicate(phone: string, email: string): Promise<boolean> {
    const windowDays = this.config.get('LEAD_DEDUP_WINDOW_DAYS', { infer: true });
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const match = await this.prisma.lead.findFirst({
      where: {
        captured_at: { gte: since },
        lead_state: { not: LeadState.REJECTED },
        OR: [{ phone }, { email }],
      },
      select: { id: true },
    });
    return match !== null;
  }

  private async isSuppressed(phone: string, email: string): Promise<boolean> {
    const match = await this.prisma.suppressionList.findFirst({
      where: { OR: [{ phone }, { email }] },
      select: { id: true },
    });
    return match !== null;
  }

  /** Persists the lead. Handles a concurrent-retry race via the unique key. */
  private async persist(
    page: LandingPage,
    dto: IntakeLeadDto,
    fields: Normalised,
    verdict: Verdict,
  ): Promise<Lead> {
    const consent = dto.consent;
    try {
      return await this.prisma.lead.create({
        data: {
          public_lead_id: this.generatePublicLeadId(),
          submission_id: dto.submission_id,
          landing_page: { connect: { id: page.id } },
          lead_type: page.lead_type,
          source_url: dto.source_url,
          full_name: fields.full_name,
          phone: verdict.phone ?? fields.phone,
          email: fields.email,
          address: fields.address,
          country: fields.country,
          state: fields.state,
          zip: fields.zip,
          qualification: dto.data as Prisma.InputJsonValue,
          consent_text: consent?.text,
          consent_ip: consent?.ip,
          consent_at: consent?.text ? new Date() : null,
          lead_state: verdict.state,
          reject_reason: verdict.reason,
        },
      });
    } catch (error) {
      // Idempotency race: a concurrent request inserted the same submission_id.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.lead.findUnique({
          where: { submission_id: dto.submission_id },
        });
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  private generatePublicLeadId(): string {
    return `LD-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private toResult(lead: Lead, idempotent: boolean): IntakeResult {
    return {
      leadId: lead.id,
      publicLeadId: lead.public_lead_id,
      state: lead.lead_state,
      rejectReason: lead.reject_reason,
      idempotent,
    };
  }
}
