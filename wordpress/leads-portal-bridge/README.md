# Leads Portal Bridge — WordPress plugin

Forwards form submissions from WordPress to the Leads Portal API as **HMAC-signed
webhooks**. Drop this plugin into each WordPress landing-page site (Solar,
Sweepstakes, Payday, Homeowner, …). One install can serve any number of forms.

Supported form plugins:

- Gravity Forms
- WPForms
- Fluent Forms
- Contact Form 7
- Elementor Forms (Pro)

## How it works

1. The Leads Portal admin creates a **Landing Page** in the portal and
   gets back a unique **Intake URL** and **Intake Secret**.
2. The WP site owner installs this plugin, opens **Leads Portal → Endpoints**
   in wp-admin, clicks **Add endpoint**, pastes the URL + secret, and binds
   it to one form (e.g. `Gravity Forms` form id `3`).
3. When the form is submitted, the plugin:
   - builds a canonical JSON payload,
   - signs the body with `HMAC-SHA256(intake_secret, body)`,
   - POSTs to the portal with header `X-Intake-Signature: sha256=<hex>`,
   - logs the result, and if it failed transiently, queues it for retry.
4. The portal validates the signature, normalises field names via its
   `field_map`, runs the lead through its validation pipeline, and
   responds with `200 OK` + the new `public_lead_id`.

## Install

1. Zip the `leads-portal-bridge/` folder.
2. WordPress → **Plugins → Add New → Upload Plugin** → choose the zip → activate.
3. **Leads Portal → Endpoints → Add endpoint**.

Alternative: copy the folder directly into `wp-content/plugins/` then activate.

## Wire diagram

```
WordPress form          this plugin               Leads Portal API
─────────────────       ──────────────────        ─────────────────────
form submit  ────────►  adapter::on_submit  ───►  POST /api/intake/<id>/lead
                        signer (HMAC-SHA256)      ↳ verifies signature
                        client (POST + retry)     ↳ field_map → canonical
                        DB log                    ↳ pipeline → VALID/REJECTED
                                                  ↳ enters distribution
```

## Configuration UI

`Leads Portal → Endpoints` lists every WP form ↔ portal landing-page binding.
Each row has:

| Field            | Notes                                                                    |
|------------------|--------------------------------------------------------------------------|
| **Label**        | Friendly name for this binding (only shown here).                        |
| **Intake URL**   | Full URL from the portal — e.g. `https://api.leadsportal.com/api/intake/<uuid>/lead`. |
| **Intake secret**| HMAC secret from the portal. Stored in the WP DB. Editable to rotate.    |
| **Form plugin**  | Which WP form plugin captures this lead.                                 |
| **Form ID**      | Numeric ID (Gravity Forms / WPForms / Fluent Forms / CF7) or slug (Elementor). |
| **Active**       | Pause delivery without deleting the binding.                             |

Per-row actions: **Edit**, **Send test** (delivers a synthetic submission and
shows the result), **Delete**.

## Delivery log

`Leads Portal → Delivery Log` shows the last 100 attempts:

- timestamp (UTC)
- which endpoint
- submission ID
- HTTP status code
- outcome: `success` / `deduped` / `transient_error` / `client_error` / `network_error`
- duration in ms
- a short slice of the API response body

Older rows are pruned by the same 5-minute cron that drains the retry queue.

## Retry behaviour

| Error class                            | Treatment                                |
|----------------------------------------|------------------------------------------|
| 2xx                                    | Log as `success` (or `deduped`).         |
| 4xx (except 408, 429)                  | Log as `client_error`. **No retry** — the same payload will keep failing. |
| 5xx, 408, 429                          | Log + enqueue. Cron retries with backoff: 30s → 2m → 10m → 1h → 6h. |
| Network error / timeout                | Same as 5xx.                             |
| Failed `max_retries` times             | Dropped from the queue. History remains in the log. |

The WP option `lpb_max_retries` (default 5) caps the total attempts.

## Wire protocol — for reference

Every request the plugin sends:

```
POST <intake_url>  HTTP/1.1
Content-Type: application/json
Accept: application/json
X-Intake-Signature: sha256=<hex>
X-LPB-Plugin-Version: 0.1.0

{
  "submission_id": "gf-3-1294",
  "source_url": "https://solar.example.com/lp/phoenix",
  "data": {
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1 415 555 0100",
    "zip": "94103",
    "monthly_bill": "$220-300"
  },
  "consent": {
    "text": "I agree to be contacted by phone, SMS, and email.",
    "ip": "73.45.12.88"
  }
}
```

Signature:

```
sha256-hex( HMAC-SHA256( intake_secret, raw_request_body ) )
```

## Security notes

- The intake secret is stored in the WordPress database (`wp_lpb_endpoints.intake_secret`).
  Anyone with database access can read it — protect your DB.
- HMAC verification is the **only** authentication on the portal side. Treat
  the secret like an API key. **Rotate it from the portal** if the WP site is
  ever compromised; paste the new value into the endpoint here.
- The current API does **not** include a timestamp in the signed payload, so a
  captured request could in theory be replayed. The portal still dedupes by
  `submission_id`, so a replay produces no new lead — it just returns
  `{ idempotent: true }`. A timestamp-signed variant is a planned upgrade.
- The plugin never writes secrets to the WP debug log.

## Translations

`text-domain: leads-portal-bridge`. Strings are wrapped in `__()` / `_e()` /
`esc_html__()`. Drop a `leads-portal-bridge-<locale>.mo` into `wp-content/languages/plugins/`
to translate.

## Uninstall

Deactivating the plugin only unschedules the cron — your endpoints and log are kept
in case you reactivate. **Deleting** the plugin from the Plugins screen drops the
three custom tables (`wp_lpb_endpoints`, `wp_lpb_queue`, `wp_lpb_log`) and removes
the plugin's options.
