import { Injectable } from '@nestjs/common';

export interface DeliverabilityResult {
  deliverable: boolean;
  reason?: string;
}

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  STUB — basic deliverability check.                                      │
 * │                                                                          │
 * │  Right now this always reports the contact as deliverable. Wire it to a   │
 * │  real validation provider before production, e.g.:                       │
 * │    - email:  ZeroBounce / NeverBounce / Kickbox                          │
 * │    - phone:  Twilio Lookup / Telnyx Number Lookup                        │
 * │                                                                          │
 * │  Return `{ deliverable: false, reason }` and the lead is rejected with    │
 * │  reject_reason = UNDELIVERABLE by the intake pipeline.                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
@Injectable()
export class DeliverabilityService {
  async check(email: string, phoneE164: string): Promise<DeliverabilityResult> {
    // TODO(integration): replace this stub with a real provider call.
    void email;
    void phoneE164;
    return { deliverable: true };
  }
}
