=== Leads Portal Bridge ===
Contributors: leadsportal
Tags: leads, webhook, gravity forms, wpforms, fluent forms
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 0.1.0
License: Proprietary

Forwards WordPress form submissions to the Leads Portal API as HMAC-signed webhooks.

== Description ==

Forwards form submissions from WordPress to the Leads Portal API as HMAC-signed webhooks.
Supports Gravity Forms, WPForms, Fluent Forms, Contact Form 7, and Elementor Forms.

Features:

* HMAC-SHA256 signed delivery (matches the portal's `X-Intake-Signature` scheme).
* Per-form binding — one WP site can feed multiple landing pages.
* Automatic retry of transient failures (5xx / 408 / 429 / network).
* In-WP delivery log with status, duration, and response preview.
* "Send test" button for verifying a binding without a real form submission.

See README.md inside the plugin folder for the full documentation, the wire
protocol, and the security notes.

== Installation ==

1. Upload the `leads-portal-bridge/` folder to `/wp-content/plugins/`.
2. Activate the plugin.
3. In wp-admin go to **Leads Portal → Endpoints**, click **Add endpoint**, and paste the URL + secret you got from the Leads Portal admin.

== Changelog ==

= 0.1.0 =
* Initial release.
