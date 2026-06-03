<?php
/**
 * Fluent Forms adapter.
 *
 * Hook: `fluentform/submission_inserted` — `( $entry_id, $form_data, $form )`.
 * https://developers.fluentforms.com/hooks/actions.html
 */
defined( 'ABSPATH' ) || exit;

class LPB_Adapter_Fluent_Forms extends LPB_Adapter {

	protected function slug() {
		return 'fluent_forms';
	}

	public function register_hooks() {
		add_action( 'fluentform/submission_inserted', array( $this, 'on_submit' ), 20, 3 );
		// Older Fluent Forms versions used the underscore-separated event name.
		add_action( 'fluentform_submission_inserted', array( $this, 'on_submit' ), 20, 3 );
	}

	public function on_submit( $entry_id, $form_data, $form ) {
		$form_id       = is_object( $form ) && isset( $form->id ) ? (string) $form->id : '';
		$submission_id = 'ff-' . $form_id . '-' . (string) $entry_id;

		// Fluent Forms ships a flat key→value array.
		$fields = is_array( $form_data ) ? $form_data : array();
		$fields = array_filter(
			$fields,
			static function ( $k ) {
				// Drop internal keys (_fluentform_*, __* etc.).
				return 0 !== strpos( (string) $k, '_' );
			},
			ARRAY_FILTER_USE_KEY
		);

		$source_url = isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '';

		$this->dispatch( $form_id, $submission_id, $fields, $source_url );
	}
}
