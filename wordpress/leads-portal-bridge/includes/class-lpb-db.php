<?php
/**
 * LPB_DB — custom tables for endpoints, retry queue, and delivery log.
 *
 * Why three tables, not one:
 *   - `lpb_endpoints` is the small, hand-edited config table (one row per
 *      WordPress form ↔ landing page binding).
 *   - `lpb_queue` is a fast-changing work queue — failed POSTs land here and
 *     the cron drains it.
 *   - `lpb_log` is append-only history kept for ~14 days so the admin can
 *     answer "did the lead deliver?".
 */
defined( 'ABSPATH' ) || exit;

class LPB_DB {

	/** Returns the prefixed table name for the given suffix. */
	public static function table( $suffix ) {
		global $wpdb;
		return $wpdb->prefix . 'lpb_' . $suffix;
	}

	/** Called from register_activation_hook — creates tables and seeds options. */
	public static function install() {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();

		$endpoints = self::table( 'endpoints' );
		$queue     = self::table( 'queue' );
		$log       = self::table( 'log' );

		dbDelta(
			"CREATE TABLE {$endpoints} (
				id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				label           VARCHAR(190) NOT NULL,
				intake_url      VARCHAR(500) NOT NULL,
				intake_secret   VARCHAR(255) NOT NULL,
				form_plugin     VARCHAR(40)  NOT NULL,
				form_id         VARCHAR(60)  NOT NULL,
				active          TINYINT(1)   NOT NULL DEFAULT 1,
				created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				UNIQUE KEY plugin_form (form_plugin, form_id)
			) {$charset_collate};"
		);

		dbDelta(
			"CREATE TABLE {$queue} (
				id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				endpoint_id     BIGINT UNSIGNED NOT NULL,
				submission_id   VARCHAR(120) NOT NULL,
				payload         LONGTEXT NOT NULL,
				attempts        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
				next_attempt_at DATETIME NOT NULL,
				last_error      TEXT NULL,
				created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				KEY due (next_attempt_at),
				UNIQUE KEY uniq_sub (endpoint_id, submission_id)
			) {$charset_collate};"
		);

		dbDelta(
			"CREATE TABLE {$log} (
				id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				endpoint_id     BIGINT UNSIGNED NOT NULL,
				submission_id   VARCHAR(120) NOT NULL,
				status_code     SMALLINT UNSIGNED NULL,
				outcome         VARCHAR(20) NOT NULL,
				duration_ms     INT UNSIGNED NULL,
				response_body   TEXT NULL,
				created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				KEY endpoint_time (endpoint_id, created_at),
				KEY by_submission (submission_id)
			) {$charset_collate};"
		);

		update_option( 'lpb_db_version',      LPB_DB_VERSION );
		add_option(    'lpb_default_timeout', 5 );  // seconds
		add_option(    'lpb_max_retries',     5 );  // total attempts
		add_option(    'lpb_log_retention',   14 ); // days

		// Schedule the retry cron (every 5 minutes).
		if ( ! wp_next_scheduled( 'lpb_retry_queue' ) ) {
			wp_schedule_event( time() + 60, 'lpb_5min', 'lpb_retry_queue' );
		}
	}

	// ── Endpoints CRUD ─────────────────────────────────────────────────────────

	public static function list_endpoints() {
		global $wpdb;
		$table = self::table( 'endpoints' );
		return $wpdb->get_results( "SELECT * FROM {$table} ORDER BY label ASC" ); // phpcs:ignore WordPress.DB
	}

	public static function get_endpoint( $id ) {
		global $wpdb;
		$table = self::table( 'endpoints' );
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", (int) $id ) ); // phpcs:ignore WordPress.DB
	}

	/** Resolves the endpoint for a given (form plugin, form id) tuple. */
	public static function find_endpoint( $form_plugin, $form_id ) {
		global $wpdb;
		$table = self::table( 'endpoints' );
		return $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE form_plugin = %s AND form_id = %s AND active = 1 LIMIT 1",
				$form_plugin,
				(string) $form_id
			)
		); // phpcs:ignore WordPress.DB
	}

	public static function upsert_endpoint( $data, $id = 0 ) {
		global $wpdb;
		$table = self::table( 'endpoints' );
		$row   = array(
			'label'         => sanitize_text_field( $data['label'] ?? '' ),
			'intake_url'    => esc_url_raw( $data['intake_url'] ?? '' ),
			'intake_secret' => (string) ( $data['intake_secret'] ?? '' ),
			'form_plugin'   => sanitize_key(  $data['form_plugin'] ?? '' ),
			'form_id'       => sanitize_text_field( (string) ( $data['form_id'] ?? '' ) ),
			'active'        => ! empty( $data['active'] ) ? 1 : 0,
		);
		if ( $id ) {
			$wpdb->update( $table, $row, array( 'id' => (int) $id ) );
			return (int) $id;
		}
		$wpdb->insert( $table, $row );
		return (int) $wpdb->insert_id;
	}

	public static function delete_endpoint( $id ) {
		global $wpdb;
		$wpdb->delete( self::table( 'endpoints' ), array( 'id' => (int) $id ) );
	}

	// ── Queue ──────────────────────────────────────────────────────────────────

	/** Enqueues a failed POST for later retry. Idempotent on (endpoint, submission). */
	public static function enqueue( $endpoint_id, $submission_id, $payload, $error, $delay_seconds ) {
		global $wpdb;
		$table = self::table( 'queue' );
		$now   = current_time( 'mysql', true );
		$next  = gmdate( 'Y-m-d H:i:s', time() + max( 0, (int) $delay_seconds ) );
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (endpoint_id, submission_id, payload, attempts, next_attempt_at, last_error, created_at)
				 VALUES (%d, %s, %s, 1, %s, %s, %s)
				 ON DUPLICATE KEY UPDATE
					attempts        = attempts + 1,
					next_attempt_at = VALUES(next_attempt_at),
					last_error      = VALUES(last_error)",
				(int) $endpoint_id,
				$submission_id,
				$payload,
				$next,
				(string) $error,
				$now
			)
		); // phpcs:ignore WordPress.DB
	}

	/** Returns up to $limit due queue rows. */
	public static function due_queue_rows( $limit = 25 ) {
		global $wpdb;
		$table = self::table( 'queue' );
		$now   = current_time( 'mysql', true );
		return $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE next_attempt_at <= %s ORDER BY next_attempt_at ASC LIMIT %d", $now, (int) $limit )
		); // phpcs:ignore WordPress.DB
	}

	public static function dequeue( $id ) {
		global $wpdb;
		$wpdb->delete( self::table( 'queue' ), array( 'id' => (int) $id ) );
	}

	public static function reschedule( $id, $attempts, $delay_seconds, $error ) {
		global $wpdb;
		$wpdb->update(
			self::table( 'queue' ),
			array(
				'attempts'        => (int) $attempts,
				'next_attempt_at' => gmdate( 'Y-m-d H:i:s', time() + (int) $delay_seconds ),
				'last_error'      => (string) $error,
			),
			array( 'id' => (int) $id )
		);
	}

	// ── Log ────────────────────────────────────────────────────────────────────

	public static function log( $endpoint_id, $submission_id, $status_code, $outcome, $duration_ms, $response_body ) {
		global $wpdb;
		$wpdb->insert(
			self::table( 'log' ),
			array(
				'endpoint_id'   => (int) $endpoint_id,
				'submission_id' => (string) $submission_id,
				'status_code'   => is_null( $status_code ) ? null : (int) $status_code,
				'outcome'       => (string) $outcome,
				'duration_ms'   => is_null( $duration_ms ) ? null : (int) $duration_ms,
				'response_body' => is_string( $response_body ) ? mb_substr( $response_body, 0, 2000 ) : null,
			)
		);
	}

	public static function recent_log_rows( $endpoint_id = 0, $limit = 50 ) {
		global $wpdb;
		$table = self::table( 'log' );
		if ( $endpoint_id ) {
			return $wpdb->get_results(
				$wpdb->prepare( "SELECT * FROM {$table} WHERE endpoint_id = %d ORDER BY id DESC LIMIT %d", (int) $endpoint_id, (int) $limit )
			); // phpcs:ignore WordPress.DB
		}
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} ORDER BY id DESC LIMIT %d", (int) $limit ) ); // phpcs:ignore WordPress.DB
	}

	/** Trims log rows older than the configured retention. Called by cron. */
	public static function purge_old_log_rows() {
		global $wpdb;
		$days  = (int) get_option( 'lpb_log_retention', 14 );
		$table = self::table( 'log' );
		$cut   = gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", $cut ) ); // phpcs:ignore WordPress.DB
	}
}
