<?php
/**
 * Fires when the site administrator deletes the plugin from the WP admin UI.
 * Drops all custom tables and removes plugin options. Does NOT run on
 * deactivation — only on full uninstall, so a temporary deactivation never
 * destroys data.
 */
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

// Drop our tables.
$tables = array( 'lpb_endpoints', 'lpb_queue', 'lpb_log' );
foreach ( $tables as $t ) {
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}{$t}" ); // phpcs:ignore WordPress.DB
}

// Remove options.
delete_option( 'lpb_db_version' );
delete_option( 'lpb_default_timeout' );
delete_option( 'lpb_max_retries' );

// Clear scheduled cron.
$timestamp = wp_next_scheduled( 'lpb_retry_queue' );
if ( $timestamp ) {
	wp_unschedule_event( $timestamp, 'lpb_retry_queue' );
}
