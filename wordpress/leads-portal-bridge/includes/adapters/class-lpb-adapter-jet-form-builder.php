<?php
/**
 * JetFormBuilder adapter.
 *
 * Hook: `jet-form-builder/form-handler/after-send` — fires after JFB has run
 * its own action chain (notifications, post inserts, redirects). One hook
 * fires for the whole form regardless of how many pages it spans — JFB
 * accumulates all step inputs into a single request.
 *
 * https://jetformbuilder.com/help/hooks/
 *
 * The Form ID configured in the plugin's Endpoint settings is the JFB form's
 * post ID (visible in wp-admin → JetFormBuilder → All Forms).
 */
defined( 'ABSPATH' ) || exit;

class LPB_Adapter_Jet_Form_Builder extends LPB_Adapter {

	/** Internal JFB keys we don't want to forward to the portal. */
	const INTERNAL_PREFIXES = array( '_jet_', 'jet_engine_', '_wpnonce' );
	const INTERNAL_EXACT    = array( '__form_id', '__page_id', '_jet_engine_booking_form_id', 'nonce' );

	protected function slug() {
		return 'jet_form_builder';
	}

	public function register_hooks() {
		// Modern JFB (3.x+) — fires once the form's full action chain succeeds.
		add_action( 'jet-form-builder/form-handler/after-send', array( $this, 'on_after_send' ), 20, 1 );
	}

	public function on_after_send( $handler ) {
		if ( ! is_object( $handler ) ) {
			return;
		}

		// Form ID — the JFB form's post ID. Defensive: different JFB releases
		// expose it via slightly different members / methods.
		$form_id = '';
		if ( isset( $handler->form_id ) ) {
			$form_id = (string) $handler->form_id;
		} elseif ( method_exists( $handler, 'get_form_id' ) ) {
			$form_id = (string) $handler->get_form_id();
		}
		if ( '' === $form_id ) {
			return;
		}

		// Request payload — all step inputs merged into one assoc array.
		$request = array();
		if ( isset( $handler->request_data ) && is_array( $handler->request_data ) ) {
			$request = $handler->request_data;
		} elseif ( method_exists( $handler, 'get_request' ) ) {
			$request = (array) $handler->get_request();
		}

		$fields = $this->filter_internal_keys( $request );

		// Stable submission_id: JFB doesn't expose its own entry id at this
		// hook, so we derive one from form_id + payload hash + ms timestamp.
		$submission_id = 'jfb-' . $form_id . '-' . hash( 'sha1', wp_json_encode( $fields ) . microtime() );

		// Source URL: the landing page the visitor submitted from.
		$source_url = '';
		foreach ( array( 'refer', 'referrer', 'source_url' ) as $prop ) {
			if ( isset( $handler->{$prop} ) && is_string( $handler->{$prop} ) && '' !== $handler->{$prop} ) {
				$source_url = $handler->{$prop};
				break;
			}
		}
		if ( '' === $source_url && ! empty( $_SERVER['HTTP_REFERER'] ) ) {
			$source_url = esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) );
		}

		$this->dispatch( $form_id, $submission_id, $fields, $source_url );
	}

	/** Drops nonces, internal JFB control keys, and empty pieces of multi-page state. */
	private function filter_internal_keys( array $request ) {
		$out = array();
		foreach ( $request as $k => $v ) {
			$key = (string) $k;
			if ( in_array( $key, self::INTERNAL_EXACT, true ) ) {
				continue;
			}
			$skip = false;
			foreach ( self::INTERNAL_PREFIXES as $prefix ) {
				if ( 0 === strpos( $key, $prefix ) ) {
					$skip = true;
					break;
				}
			}
			if ( $skip ) {
				continue;
			}
			$out[ sanitize_key( $key ) ] = $v;
		}
		return $out;
	}
}
