<?php
/**
 * LPB_Client — POSTs a signed payload to the Leads Portal API.
 *
 * Failure handling:
 *   - Network / 5xx / 408 / 429 → enqueue for the cron retry (exponential backoff,
 *     max attempts from the `lpb_max_retries` option).
 *   - 4xx other than 408/429 → log as `client_error`. NOT retried, because the
 *     same payload will keep failing (validation error, unknown landing page,
 *     bad signature). Surfaced in the admin log so a human can act on it.
 *   - 2xx → log success.
 *
 * Idempotency:
 *   We never resend the same submission_id without the API knowing it's the
 *   same submission — the API dedupes on `submission_id`. The portal returns
 *   `{ idempotent: true }` on a duplicate, which we log as `deduped`.
 */
defined( 'ABSPATH' ) || exit;

class LPB_Client {

	/** Synchronously delivers a payload. Returns ['outcome' => string, …]. */
	public static function send( $endpoint, array $payload ) {
		$body    = wp_json_encode( $payload );
		$sig     = LPB_Signer::header_value( $body, $endpoint->intake_secret );
		$timeout = (int) get_option( 'lpb_default_timeout', 5 );
		$started = microtime( true );

		$response = wp_remote_post(
			$endpoint->intake_url,
			array(
				'method'      => 'POST',
				'timeout'     => $timeout,
				'redirection' => 0,
				'blocking'    => true,
				'headers'     => array(
					'Content-Type'           => 'application/json',
					'Accept'                 => 'application/json',
					LPB_Signer::HEADER       => $sig,
					'X-LPB-Plugin-Version'   => LPB_VERSION,
				),
				'body'        => $body,
			)
		);

		$duration_ms = (int) ( ( microtime( true ) - $started ) * 1000 );

		if ( is_wp_error( $response ) ) {
			$message = $response->get_error_message();
			LPB_DB::log( $endpoint->id, $payload['submission_id'], null, 'network_error', $duration_ms, $message );
			self::enqueue_retry( $endpoint, $payload, $body, $message );
			return array( 'outcome' => 'network_error', 'error' => $message );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$resp   = (string) wp_remote_retrieve_body( $response );

		if ( $status >= 200 && $status < 300 ) {
			$decoded   = json_decode( $resp, true );
			$idempotent = is_array( $decoded ) && ! empty( $decoded['idempotent'] );
			$outcome   = $idempotent ? 'deduped' : 'success';
			LPB_DB::log( $endpoint->id, $payload['submission_id'], $status, $outcome, $duration_ms, $resp );
			return array( 'outcome' => $outcome, 'status' => $status, 'body' => $decoded );
		}

		// 5xx / 408 / 429 → retry.
		if ( $status >= 500 || 408 === $status || 429 === $status ) {
			LPB_DB::log( $endpoint->id, $payload['submission_id'], $status, 'transient_error', $duration_ms, $resp );
			self::enqueue_retry( $endpoint, $payload, $body, "HTTP {$status}" );
			return array( 'outcome' => 'transient_error', 'status' => $status, 'body' => $resp );
		}

		// 4xx other → terminal failure, no retry.
		LPB_DB::log( $endpoint->id, $payload['submission_id'], $status, 'client_error', $duration_ms, $resp );
		return array( 'outcome' => 'client_error', 'status' => $status, 'body' => $resp );
	}

	/** First-attempt backoff: 30s. Subsequent retries handled by the cron. */
	private static function enqueue_retry( $endpoint, array $payload, $body, $error ) {
		LPB_DB::enqueue( $endpoint->id, $payload['submission_id'], $body, $error, 30 );
	}

	/**
	 * Drains due rows from the retry queue. Called every 5 minutes by cron.
	 * Exponential backoff: 30s, 2m, 10m, 1h, 6h, then give up.
	 */
	public static function drain_queue() {
		$max = (int) get_option( 'lpb_max_retries', 5 );
		$rows = LPB_DB::due_queue_rows( 25 );
		foreach ( $rows as $row ) {
			$endpoint = LPB_DB::get_endpoint( $row->endpoint_id );
			if ( ! $endpoint ) {
				LPB_DB::dequeue( $row->id );
				continue;
			}
			$payload = json_decode( $row->payload, true );
			if ( ! is_array( $payload ) ) {
				LPB_DB::dequeue( $row->id );
				continue;
			}

			$result = self::send( $endpoint, $payload );
			$ok = in_array( $result['outcome'], array( 'success', 'deduped', 'client_error' ), true );
			if ( $ok ) {
				LPB_DB::dequeue( $row->id );
				continue;
			}

			$attempts = (int) $row->attempts + 1;
			if ( $attempts >= $max ) {
				// Give up; the log still has the history.
				LPB_DB::dequeue( $row->id );
				continue;
			}
			$delay = self::backoff_seconds( $attempts );
			LPB_DB::reschedule( $row->id, $attempts, $delay, $result['error'] ?? ( 'HTTP ' . ( $result['status'] ?? 0 ) ) );
		}
		LPB_DB::purge_old_log_rows();
	}

	/** Backoff schedule (after the first 30s in-line attempt). */
	private static function backoff_seconds( $attempts ) {
		$schedule = array( 30, 120, 600, 3600, 21600 ); // 30s, 2m, 10m, 1h, 6h
		$i = min( $attempts, count( $schedule ) ) - 1;
		return $schedule[ max( 0, $i ) ];
	}
}
