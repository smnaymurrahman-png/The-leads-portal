<?php
/**
 * LPB_Adapter — base class for form-plugin integrations.
 *
 * A concrete adapter is a thin shim that:
 *   1. Hooks the target plugin's "submission complete" action.
 *   2. Extracts a flat key→value array of the user-submitted fields.
 *   3. Resolves the endpoint by (plugin slug, form id) and dispatches.
 *
 * The Leads Portal API does the field mapping (raw WP field name → canonical
 * lead column) using each landing page's `field_map`. The plugin therefore
 * doesn't need to know anything about the lead schema — it just forwards
 * whatever the form captured.
 */
defined( 'ABSPATH' ) || exit;

abstract class LPB_Adapter {

	/** Short slug stored in the endpoints table (e.g. "gravity_forms"). */
	abstract protected function slug();

	/** Called from LPB_Plugin::boot — bind the form plugin's hook here. */
	abstract public function register_hooks();

	/**
	 * Fires the signed POST to the portal. Adapters call this from their hook.
	 *
	 * @param string|int $form_id      Form ID as the source plugin sees it.
	 * @param string     $submission_id Stable unique ID for this entry.
	 * @param array      $fields        Raw form field key→value pairs.
	 * @param string     $source_url    The WP URL the form was submitted from.
	 * @param array      $consent       Optional ['text' => string, 'ip' => string].
	 */
	protected function dispatch( $form_id, $submission_id, array $fields, $source_url, array $consent = array() ) {
		$endpoint = LPB_DB::find_endpoint( $this->slug(), (string) $form_id );
		if ( ! $endpoint ) {
			// No endpoint configured for this form — silent no-op so the
			// plugin can sit on a WP site without breaking unrelated forms.
			return;
		}

		$payload = array(
			'submission_id' => (string) $submission_id,
			'source_url'    => $source_url ?: self::referer_url(),
			'data'          => $this->normalise_field_keys( $fields ),
		);
		if ( ! empty( $consent['text'] ) ) {
			$payload['consent'] = array(
				'text' => (string) $consent['text'],
				'ip'   => isset( $consent['ip'] ) ? (string) $consent['ip'] : self::client_ip(),
			);
		}

		// Fire-and-forget from the user's perspective. send() blocks for the
		// HTTP round-trip (timeout default 5s), so a slow API doesn't hold
		// the form's "thanks" page longer than that.
		LPB_Client::send( $endpoint, $payload );
	}

	/** Flattens scalar arrays and trims strings. Drops nulls. */
	protected function normalise_field_keys( array $fields ) {
		$out = array();
		foreach ( $fields as $k => $v ) {
			if ( null === $v ) {
				continue;
			}
			if ( is_array( $v ) ) {
				$v = implode( ', ', array_map( 'strval', $v ) );
			}
			$v = is_string( $v ) ? trim( $v ) : (string) $v;
			if ( '' !== $v ) {
				$out[ (string) $k ] = $v;
			}
		}
		return $out;
	}

	/** HTTP referer as a fallback for source_url — the public landing page URL. */
	protected static function referer_url() {
		if ( ! empty( $_SERVER['HTTP_REFERER'] ) ) {
			return esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) );
		}
		return home_url( '/' );
	}

	/** Best-effort client IP, respecting the standard proxy headers. */
	protected static function client_ip() {
		foreach ( array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ) as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				$value = sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) );
				// X-Forwarded-For can be a comma list — first value is the original client.
				if ( false !== strpos( $value, ',' ) ) {
					$value = trim( explode( ',', $value )[0] );
				}
				return $value;
			}
		}
		return '';
	}
}
