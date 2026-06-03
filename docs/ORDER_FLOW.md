# Order & payment flow (off-platform, agent-mediated)

Stripe was removed. Payments happen entirely off-platform via WhatsApp: the
**agent** collects funds and uploads a screenshot, the **admin** verifies and
accepts, the order goes live.

## Diagram

```
┌──────────┐                                                     ┌───────────────┐
│  CLIENT  │   1. POST /api/orders                               │     CLIENT    │
│ (portal) │ ─────────────────────────────────────────────────►  │      DB       │
└──────────┘                                                     │ status=AWAIT…│
                                                                 └───────┬───────┘
                                                                         │ 2. auto-visible
                                                                         ▼
                                                          ┌──────────────────────┐
                                                          │  AGENT (owning)      │
                                                          │  "Pending payment"   │
                                                          │  queue               │
                                                          └──────────┬───────────┘
                                                                     │
                  3. Agent ↔ Client on WhatsApp                      │
                  Client sends payment screenshot ◄──────────────────┤
                                                                     │
                                                                     │ 4. POST /api/orders/:id/payment-proof
                                                                     │    (multipart: file + payment_method/ref/note)
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │ status=PROOF_SUBMIT…│
                                                          │ payment_*  filled    │
                                                          │ file under UPLOAD_DIR│
                                                          └──────────┬───────────┘
                                                                     │ 5. socket: order.proof_submitted
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │  ADMIN / SUPER_ADMIN │
                                                          │  "Pending verify"    │
                                                          │  queue + viewer      │
                                                          └──────────┬───────────┘
                                                                     │
                          6. Admin opens screenshot, verifies amount │
                                                                     ▼
                                              ┌─────────────────────────────────┐
                                              │ POST /api/orders/:id/accept      │
                                              │   → status=ACTIVE                │
                                              │   → Transaction(CHARGE,SUCCESS)  │
                                              │   → Invoice PDF generated        │
                                              │   → event ORDER_ACCEPTED         │
                                              └─────────────────────────────────┘
                                                                     │
                                                                     ▼
                                                            DISTRIBUTION QUEUE
```

## State machine

```
       create                upload                 accept
DRAFT ─────────► AWAITING_PAYMENT ────► PROOF_SUBMITTED ──────► ACTIVE
                       │                       │                  │
                       │ cancel                │ reject           │ first lead
                       │                       │                  ▼
                       ▼                       ▼              FULFILLING
                  CANCELLED                REJECTED               │
                                                                  │ qty_remaining = 0
                                                                  ▼
                                                              COMPLETED
```

`PAUSED` is reachable from `ACTIVE` / `FULFILLING` (admin pauses); resume goes
back to `FULFILLING` or `ACTIVE` based on remaining quantity.

## Roles + permissions

| Action | CLIENT | AGENT (owning) | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| Create order | ✅ | ❌ | ❌ | ❌ |
| List own / scoped | ✅ own | ✅ own clients' | ✅ all | ✅ all |
| Upload payment proof | ❌ | ✅ (`AWAITING_PAYMENT` only) | ❌ | ❌ |
| Cancel | ❌ | ✅ (`AWAITING_PAYMENT` only) | ✅ any non-terminal | ✅ any non-terminal |
| Accept | ❌ | ❌ | ✅ (`PROOF_SUBMITTED`) | ✅ (`PROOF_SUBMITTED`) |
| Reject | ❌ | ❌ | ✅ (`AWAITING_*` / `PROOF_*`) | ✅ same |
| View payment screenshot | ✅ own | ✅ own clients' | ✅ | ✅ |
| Download invoice PDF | ✅ own | ✅ own clients' | ✅ | ✅ |

Backend re-checks the role on every endpoint via the global `JwtAuthGuard` +
`RolesGuard` + `OwnershipService`. Frontend hints are advisory only.

## API endpoints

```
POST   /api/orders                                CLIENT                — create
GET    /api/orders                                CLIENT/AGENT/ADMIN/SU — role-scoped list
GET    /api/orders/:id                            CLIENT/AGENT/ADMIN/SU — role-scoped detail

POST   /api/orders/:id/payment-proof              AGENT                 — multipart upload
GET    /api/orders/:id/payment-proof-url          CLIENT/AGENT/ADMIN/SU — signed URL for the screenshot
GET    /api/orders/:id/payment-proof?token=…      Public (token-auth)   — streams the file

POST   /api/orders/:id/cancel                     AGENT/ADMIN/SU        — cancel uncollected / any
POST   /api/orders/:id/accept                     ADMIN/SU              — verify & activate
POST   /api/orders/:id/reject                     ADMIN/SU              — reject with note

GET    /api/invoices                              CLIENT/AGENT/ADMIN/SU — role-scoped list
GET    /api/invoices/:id                          CLIENT/AGENT/ADMIN/SU — detail
GET    /api/invoices/:id/pdf-url                  CLIENT/AGENT/ADMIN/SU — signed URL
GET    /api/invoices/:id/pdf?token=…              Public (token-auth)   — streams the PDF
```

### Upload contract — `POST /api/orders/:id/payment-proof`

`Content-Type: multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | binary | ✅ | jpeg / png / webp / pdf, ≤ `UPLOAD_MAX_MB` (default 10 MB) |
| `payment_method` | enum | ❌ | `BANK_TRANSFER` / `MOBILE_WALLET` / `CASH` / `CHECK` / `OTHER` |
| `payment_reference` | string | ❌ | txn id / sender name / last 4 |
| `payment_note` | string | ❌ | free-form |

Response: the updated `Order` row with `status: PROOF_SUBMITTED` and all the
`payment_*` columns filled.

## File storage (Railway volume)

| Setting | Default (dev) | Production (Railway) |
|---|---|---|
| `UPLOAD_DIR` | `./uploads` (gitignored) | `/var/lib/leads-portal/uploads` (volume mount) |
| `UPLOAD_MAX_MB` | `10` | `10` |
| `UPLOAD_TOKEN_TTL_SECONDS` | `600` | `600` |
| `UPLOAD_SIGNING_SECRET` | dev secret | `openssl rand -base64 32` |

Layout under `UPLOAD_DIR`:

```
payment-proofs/
  2026-05/                         # bucket per year-month
    a1b2…f9e8.jpg                  # 16-byte random + extension
    …
invoices/
  2026-05/
    8d4e…7c2a.pdf
```

The DB stores the **relative path** in `Order.payment_screenshot_path` and
`Invoice.pdf_path`. The actual filenames are random; the original filename is
kept in `Order.payment_screenshot_filename`. SHA-256 of the upload bytes is
stored in `Order.payment_screenshot_sha256` (handy for forensics — same
sender reusing the same screenshot across orders shows up immediately).

## Signed-URL token

Browsers can't easily send JWTs with `<img src>` / `<embed src>`. Solution:
the API returns a short-lived signed token (HMAC over
`intent|resourceId|principalId|exp`) and the actual file is served from a
`@Public()` endpoint that verifies the token. Default validity 10 min,
configurable via `UPLOAD_TOKEN_TTL_SECONDS`.

`intent` is bound (`payment_proof` vs `invoice_pdf`) so a payment-proof token
can't be replayed to fetch an invoice.

## Real-time hooks

The `OrdersService` emits four lifecycle events; the realtime gateway
forwards them to the relevant principals over Socket.IO.

| Event | Receivers | Socket message |
|---|---|---|
| `ORDER_PROOF_SUBMITTED` | client, all admins | `order.status_changed` (client), `order.proof_submitted` (admins) |
| `ORDER_ACCEPTED` | client, owning agent | `order.status_changed` |
| `ORDER_REJECTED` | client, owning agent | `order.status_changed` |
| `ORDER_CANCELLED` | client, owning agent | `order.status_changed` |

Admins join a shared `role:admin` Socket.IO room on connect (see
`RealtimeGateway`).

## Database migration

After `DATABASE_URL` is in place:

```bash
pnpm --filter @leads-portal/api exec prisma migrate dev --name remove-stripe-add-payment-proof
```

The migration:
- drops `OrderStatus.INVOICED`, `OrderStatus.PAID`, `OrderStatus.PAYMENT_FAILED`, `OrderStatus.ACCEPTED`
- adds `OrderStatus.AWAITING_PAYMENT`, `OrderStatus.PROOF_SUBMITTED`
- adds `PaymentMethod` enum
- drops `Order.stripe_invoice_id`, `Order.stripe_payment_link`, `Client.stripe_customer_id`, `Transaction.stripe_payment_id`
- adds `Order.payment_*`, `Order.cancelled_*` columns
- adds `Invoice.issued_by`, renames `Invoice.pdf_url` → `Invoice.pdf_path`
- adds `Transaction.payment_method`, `Transaction.payment_reference`, `Transaction.recorded_by`

## Worth knowing

- **Off-platform refunds.** If a refund is needed it's handled off-platform
  by the agent (same WhatsApp loop, in reverse). The system records it as a
  `Transaction(type=REFUND, status=SUCCEEDED)`. The Order's status changes to
  `CANCELLED` when admin cancels. There's no automated refund endpoint
  because there's no payment processor to call.
- **Invoice idempotency.** `accept` allocates the invoice number after the
  status update. If PDF generation fails, the order is still ACTIVE — the
  admin can re-trigger invoice generation later (TODO endpoint:
  `POST /api/invoices/regenerate/:order_id`).
- **Replay protection.** The signed-URL HMAC is over
  `intent|resourceId|principalId|exp`, so even a leaked URL stops working in
  ≤ 10 min and can only be used for the exact resource it was issued for.
