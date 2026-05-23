# Leads Portal

Multi-vertical lead-generation management and live distribution platform.

- **Web** — Next.js (App Router, TypeScript), role-based dashboards → Vercel
- **API** — NestJS (TypeScript), modular → Railway
- **Database** — PostgreSQL on Railway, via Prisma ORM
- **Shared** — TypeScript types/enums shared by web and API

## Repository layout

```
leads-portal/
├── apps/
│   ├── api/        NestJS backend  (@leads-portal/api)
│   └── web/        Next.js frontend (@leads-portal/web)
├── packages/
│   └── shared/     Shared types & enums (@leads-portal/shared)
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)
- A PostgreSQL database (Railway)

## Setup

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Build the shared package (api & web import its compiled output)
pnpm --filter @leads-portal/shared build

# 3. Configure the API environment
cp apps/api/.env.example apps/api/.env
#   → set DATABASE_URL to your Railway Postgres connection string
#   → set JWT_SECRET / INTAKE_HMAC_SECRET (openssl rand -base64 32)
#   → set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET (test keys are fine for dev)

# 4. Configure the web environment
cp apps/web/.env.example apps/web/.env.local

# 5. Generate the Prisma client
pnpm --filter @leads-portal/api exec prisma generate
```

> The API validates its environment at boot (`apps/api/src/config/env.validation.ts`).
> If any variable is missing or malformed the process exits immediately with a clear error.

## Running locally

Both apps run from the repo root. Run them together, or each on its own.

### Backend — NestJS API

```bash
pnpm dev:api        # nest start --watch  → http://localhost:4000/api
```

- Reads secrets from `apps/api/.env` (`DATABASE_URL`, `JWT_SECRET`, `STRIPE_*`, …).
- Health check: `curl http://localhost:4000/api/health`

### Frontend — Next.js web app

```bash
pnpm dev:web        # next dev            → http://localhost:3000
```

- App Router + Tailwind CSS. Reads `NEXT_PUBLIC_API_URL` from `apps/web/.env.local`.
- Route groups under `apps/web/src/app/`: `(auth)`, `(super-admin)`, `(admin)`,
  `(agent)`, `(client)` — placeholder pages today, real dashboards in Phase 7.

### Both at once

```bash
pnpm dev            # runs api + web in parallel
```

## Deployment

| Component  | Platform | Notes |
|------------|----------|-------|
| Database   | Railway  | PostgreSQL plugin; copy its connection URL into `DATABASE_URL`. |
| Backend    | Railway  | NestJS service deployed from `apps/api`. |
| Frontend   | Vercel   | Next.js project with root directory `apps/web`. |

### Database + Backend → Railway

1. Create a Railway project and add the **PostgreSQL** plugin.
2. Add a service from this repo; set the **root directory** to `apps/api`.
3. Build / start commands:
   - Build: `pnpm install && pnpm --filter @leads-portal/shared build && pnpm --filter @leads-portal/api build`
   - Start: `pnpm --filter @leads-portal/api exec prisma migrate deploy && pnpm --filter @leads-portal/api start:prod`
4. Set service variables: `DATABASE_URL` (reference the Postgres plugin),
   `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INTAKE_HMAC_SECRET`,
   `FRONTEND_URL` (the Vercel URL), `BACKEND_URL` (the Railway URL), `NODE_ENV=production`.

### Frontend → Vercel

1. Import the repo into Vercel; set the **root directory** to `apps/web`.
2. Vercel auto-detects Next.js. The build picks up the pnpm workspace,
   so `@leads-portal/shared` builds with it.
3. Set the environment variable `NEXT_PUBLIC_API_URL` to the Railway API URL,
   including the `/api` prefix — e.g. `https://your-api.up.railway.app/api`.
4. After the first deploy, set `FRONTEND_URL` on the Railway service to the
   Vercel domain so CORS allows the browser app.

## Verifying Phase 1

```bash
# Database connectivity (standalone)
pnpm --filter @leads-portal/api db:check        # → ✔ Database connection OK

# API health (with the API running)
curl http://localhost:4000/api/health           # → {"status":"ok","checks":{"database":"ok"}}
curl http://localhost:4000/api/health/live      # → {"status":"ok",...}

# Web health page (with both running)
open http://localhost:3000/health               # → "API: OK", database: ok
```

## Phase roadmap

| Phase | Scope |
|-------|-------|
| 1 ✅  | Monorepo skeleton, health endpoints, Prisma connection |
| 2     | Auth + RBAC (JWT, 4 roles, route guards) |
| 3     | Lead intake (HMAC webhook + validation pipeline) |
| 4     | Orders + Stripe (approve-then-pay) |
| 5     | Distribution engine (order-queue matching) |
| 6     | Real-time delivery + replacements |
| 7     | Role-based dashboards + deploy config |
