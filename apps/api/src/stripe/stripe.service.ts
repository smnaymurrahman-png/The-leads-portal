import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
// `stripe` is published with `export =`, so `import = require` is needed to
// get the constructor, the instance type, and the `Stripe.*` type namespace.
import Stripe = require('stripe');

/**
 * Thin wrapper around the Stripe SDK. `client` is the configured Stripe
 * instance; `webhookSecret` is used to verify inbound webhook signatures.
 */
/** The constructed Stripe SDK client instance. */
export type StripeClient = InstanceType<typeof Stripe>;

@Injectable()
export class StripeService {
  readonly client: StripeClient;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {
    // No network call here — just constructs the client from the secret key.
    this.client = new Stripe(config.get('STRIPE_SECRET_KEY', { infer: true }));
  }

  get webhookSecret(): string {
    return this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
  }
}
