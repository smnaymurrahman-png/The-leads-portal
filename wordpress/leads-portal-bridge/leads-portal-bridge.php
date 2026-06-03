<?php
/**
 * Plugin Name:       Leads Portal Bridge
 * Plugin URI:        https://leadsportal.example.com
 * Description:       Forwards form submissions from WordPress to the Leads Portal API as HMAC-signed webhooks. Supports Gravity Forms, WPForms, Fluent Forms, Contact Form 7, and Elementor Forms.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Leads Portal
 * License:           Proprietary
 * Text Domain:       leads-portal-bridge
 *
 * Architecture (one class per file, autoloaded from /includes):
 *   LPB_Plugin     — singleton bootstrap; registers hooks, menu, cron
 *   LPB_DB         — custom tables (endpoints / queue / log), schema versioning
 *   LPB_Signer     — HMAC-SHA256 over the raw request body
 *   LPB_Client     — HTTP POST with retries + failed-row enqueue
 *   LPB_Settings   — admin UI: endpoints CRUD, status panel, log viewer
 *   LPB_Adapter    — abstract base for form-plugin integrations
 *   LPB_Adapter_*  — concrete adapters (Gravity Forms / WPForms / …)
 *
 * Data flow:
 *   1. Form plugin fires its "submitted" hook.
 *   2. Adapter resolves the endpoint by (plugin slug, form id).
 *   3. Adapter builds a canonical payload { submission_id, source_url, data, consent }.
 *   4. LPB_Client signs the JSON body with LPB_Signer and POSTs to the portal.
 *   5. Non-2xx + transient errors enqueue the row for the 5-minute retry cron.
 */

defined( 'ABSPATH' ) || exit;

define( 'LPB_VERSION',     '0.1.0' );
define( 'LPB_PLUGIN_FILE', __FILE__ );
define( 'LPB_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'LPB_PLUGIN_URL',  plugin_dir_url(  __FILE__ ) );
define( 'LPB_DB_VERSION',  '1' );

// ── Autoloader ───────────────────────────────────────────────────────────────
spl_autoload_register(
	static function ( $class ) {
		if ( strpos( $class, 'LPB_' ) !== 0 ) {
			return;
		}
		// LPB_Adapter_Gravity_Forms → adapters/class-lpb-adapter-gravity-forms.php
		// LPB_Signer                → class-lpb-signer.php
		$slug = strtolower( str_replace( '_', '-', $class ) );
		$paths = array(
			LPB_PLUGIN_DIR . 'includes/adapters/class-' . $slug . '.php',
			LPB_PLUGIN_DIR . 'includes/class-' . $slug . '.php',
		);
		foreach ( $paths as $path ) {
			if ( file_exists( $path ) ) {
				require_once $path;
				return;
			}
		}
	}
);

// ── Lifecycle hooks ──────────────────────────────────────────────────────────
register_activation_hook(   __FILE__, array( 'LPB_DB', 'install' ) );
register_deactivation_hook( __FILE__, array( 'LPB_Plugin', 'on_deactivate' ) );

// ── Boot ─────────────────────────────────────────────────────────────────────
add_action(
	'plugins_loaded',
	static function () {
		LPB_Plugin::instance()->boot();
	}
);
