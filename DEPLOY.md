# Leads Portal — Deploy Runbook

Backend (NestJS) + PostgreSQL on **Railway**; frontend (Next.js) on **Vercel**.
Staging and production are **separate Railway projects and separate Vercel
projects** — never shared. Each carries its own secrets.

---

## 1. Provision PostgreSQL (Railway)

1. Create a Railway project (one for `staging`, one for `production`).
2. **+ New → Database → PostgreSQL.**
3. The plugin exposes `DATABASE_URL`; reference it from the API service as
   `${{ Postgres.DATABASE_URL }}` (no copy-paste).

## 2. Deploy the backend — Railway

1. **+ New → GitHub Repo**, pick this repo.
2. **Settings → Root Directory:** `apps/api`
3. **Build command:**
   ```
   pnpm install --frozen-lockfile && pnpm --filter @leads-portal/shared build && pnpm --filter @leads-portal/api build
   ```
4. **Start command** (runs pending migrations, then boots):
   ```
   pnpm --filter @leads-portal/api exec prisma migrate deploy && pnpm --filter @leads-portal/api start:prod
   ```
5. **Variables** — set every key from `apps/api/.env.example`
   (see `apps/api/.env.staging.example` for the staging shape):
   `NODE_ENV=production`, `DATABASE_URL=${{ Postgres.DATABASE_URL }}`,
   `FRONTEND_URL`, `BACKEND_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
   `ENCRYPTION_KEY`, `INTAKE_HMAC_SECRET`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `LEAD_DEDUP_WINDOW_DAYS`.
   Generate each secret fresh per environment: `openssl rand -base64 32`.
6. Deploy. Verify: `GET https://<api-host>/api/health` → `{"status":"ok",...}`.
7. **Seed once** (first deploy only), from a Railway shell or locally with the
   prod `DATABASE_URL`: `pnpm --filter @leads-portal/api prisma:seed`.

> The API validates its environment at boot — a missing/invalid variable aborts
> startup with a clear error.

## 3. Deploy the frontend — Vercel

1. **Add New → Project**, import this repo.
2. **Root Directory:** `apps/web` (Vercel auto-detects Next.js + the pnpm
   workspace, so `@leads-portal/shared` builds with it).
3. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://<api-host>/api`
   - `JWT_SECRET` = the **same value** as the API's `JWT_SECRET`
     (server-side only — used by `proxy.ts` to verify the session cookie).
4. Deploy.
5. Back on Railway, set the API's `FRONTEND_URL` to the Vercel domain so CORS
   and the Socket.IO gateway accept the browser app; redeploy the API.

## 4. Stripe webhook

In the Stripe Dashboard (test mode for staging, live for prod):
**Developers → Webhooks → Add endpoint** →
`https://<api-host>/api/payments/stripe/webhook`, events `invoice.paid`,
`invoice.payment_failed`, `invoice.voided`. Copy the signing secret into the
API's `STRIPE_WEBHOOK_SECRET` and redeploy.

## 5. Staging vs production

| | Staging | Production |
|---|---|---|
| Railway project | `leads-portal-staging` | `leads-portal-prod` |
| Vercel project | `leads-portal-web-staging` | `leads-portal-web` |
| Stripe | **test** keys | **live** keys |
| Secrets | unique | unique (never reused from staging) |
| Promotion | deploy `main` here first; smoke-test | deploy after staging passes |

---

## Go-live checklist

- [ ] Production Railway + Vercel projects created; all env vars set.
- [ ] `prisma migrate deploy` ran clean; `prisma:seed` run once.
- [ ] `GET /api/health` returns `ok` (database `ok`).
- [ ] Swap **Stripe to live keys** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`);
      re-create the webhook endpoint against the live Stripe account.
- [ ] Rotate all dev/staging secrets — fresh `JWT_SECRET`, `ENCRYPTION_KEY`,
      `INTAKE_HMAC_SECRET` for production.
- [ ] Create the real landing pages (`POST /landing-pages`); give each its own
      `intake_secret`. Configure each **WordPress form** to POST to
      `https://<api-host>/api/intake/<landingPageId>/lead` with the
      `X-Intake-Signature` HMAC header keyed by that page's `intake_secret`.
- [ ] **Enable Solar first:** keep other lead types paused —
      `PUT /api/distribution/lead-types/SWEEPSTAKES {"paused":true}` (and
      `PAYDAY`, `HOMEOWNER`). Confirm Solar intake → distribution → delivery.
- [ ] **Then enable Sweepstakes:** once Solar is stable,
      `PUT /api/distribution/lead-types/SWEEPSTAKES {"paused":false}`.
- [ ] Run `pnpm --filter @leads-portal/api rbac:audit` — confirm every route's
      access is intentional.
- [ ] Wire an error monitor at the hook in `src/common/all-exceptions.filter.ts`.
- [ ] Confirm rate limits are active (auth `10/min`, intake `60/min` per IP).

## Hardening summary (Phase 10)

- **Rate limiting** — `POST /auth/login` (10/min/IP), `POST /intake/:id/lead`
  (60/min/IP) via `@nestjs/throttler`.
- **Secrets** — all from env, validated at boot; stored API keys are
  AES-256-GCM encrypted at rest (`ENCRYPTION_KEY`).
- **Observability** — request logging interceptor + a global exception filter
  with a single error-monitoring hook point.
- **RBAC** — `pnpm --filter @leads-portal/api rbac:audit` lists every route and
  its required roles.
