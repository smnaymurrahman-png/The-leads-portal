<?php
/**
 * LPB_Signer — HMAC-SHA256 over the raw request body.
 *
 * Matches `apps/api/src/intake/signature.util.ts` on the portal side:
 *
 *   signature = HMAC_SHA256(intake_secret, raw_body)            // bytes
 *   header    = "sha256=" + hex(signature)                       // sent to API
 *
 * The API accepts either "sha256=<hex>" or "<hex>" — we always send the
 * prefixed form, which is the Stripe/GitHub convention and lets us version the
 * hash function later if needed.
 */
defined( 'ABSPATH' ) || exit;

class LPB_Signer {

	const HEADER = 'X-Intake-Signature';

	/**
	 * Returns the value for the X-Intake-Signature header.
	 *
	 * @param string $body   Exact bytes that will be sent as the request body.
	 * @param string $secret The endpoint's intake_secret (hex from the portal).
	 */
	public static function header_value( $body, $secret ) {
		$hex = hash_hmac( 'sha256', (string) $body, (string) $secret );
		return 'sha256=' . $hex;
	}
}
