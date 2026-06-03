<?php
/**
 * LPB_Plugin — singleton that wires the plugin into WordPress.
 *
 * Responsibilities:
 *   - Adds the "5 minutes" cron interval and binds the queue drainer to it.
 *   - Instantiates each form-plugin adapter (Gravity Forms, WPForms, …);
 *     adapters self-detect whether their target plugin is active.
 *   - Loads the admin Settings UI inside wp-admin.
 */
defined( 'ABSPATH' ) || exit;

class LPB_Plugin {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function boot() {
		// Custom cron interval — WP only ships hourly/twicedaily/daily.
		add_filter(
			'cron_schedules',
			static function ( $schedules ) {
				$schedules['lpb_5min'] = array(
					'interval' => 5 * MINUTE_IN_SECONDS,
					'display'  => __( 'Every 5 minutes (Leads Portal)', 'leads-portal-bridge' ),
				);
				return $schedules;
			}
		);

		// Cron worker — drain the retry queue.
		add_action( 'lpb_retry_queue', array( 'LPB_Client', 'drain_queue' ) );

		// Admin UI.
		if ( is_admin() ) {
			LPB_Settings::instance()->boot();
		}

		// Self-upgrade DB schema if version drifts.
		if ( get_option( 'lpb_db_version' ) !== LPB_DB_VERSION ) {
			LPB_DB::install();
		}

		// Register all form-plugin adapters. Each adapter is a no-op when its
		// target form plugin isn't active, so it's safe to register them all.
		$this->register_adapters();
	}

	private function register_adapters() {
		$adapters = array(
			'LPB_Adapter_Gravity_Forms',
			'LPB_Adapter_WPForms',
			'LPB_Adapter_Fluent_Forms',
			'LPB_Adapter_CF7',
			'LPB_Adapter_Elementor',
			'LPB_Adapter_Jet_Form_Builder',
		);
		foreach ( $adapters as $class ) {
			if ( class_exists( $class ) ) {
				/** @var LPB_Adapter $adapter */
				$adapter = new $class();
				$adapter->register_hooks();
			}
		}
	}

	public static function on_deactivate() {
		$ts = wp_next_scheduled( 'lpb_retry_queue' );
		if ( $ts ) {
			wp_unschedule_event( $ts, 'lpb_retry_queue' );
		}
	}

	/**
	 * The set of supported form plugins — used by the Settings page to
	 * populate the "When this form is submitted" picker.
	 */
	public static function supported_form_plugins() {
		return array(
			'gravity_forms'    => 'Gravity Forms',
			'wpforms'          => 'WPForms',
			'fluent_forms'     => 'Fluent Forms',
			'cf7'              => 'Contact Form 7',
			'elementor'        => 'Elementor Forms',
			'jet_form_builder' => 'JetFormBuilder',
		);
	}
}
