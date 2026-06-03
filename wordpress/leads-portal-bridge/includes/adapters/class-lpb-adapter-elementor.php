<?php
/**
 * Elementor Forms adapter (Elementor Pro).
 *
 * Hook: `elementor_pro/forms/new_record` — `( $record, $ajax_handler )`.
 * https://developers.elementor.com/docs/hooks/form-submission/
 */
defined( 'ABSPATH' ) || exit;

class LPB_Adapter_Elementor extends LPB_Adapter {

	protected function slug() {
		return 'elementor';
	}

	public function register_hooks() {
		add_action( 'elementor_pro/forms/new_record', array( $this, 'on_submit' ), 20, 2 );
	}

	public function on_submit( $record, $ajax_handler ) {
		if ( ! is_object( $record ) || ! method_exists( $record, 'get' ) ) {
			return;
		}
		$form_name = (string) $record->get_form_settings( 'form_name' );
		$form_id   = (string) $record->get_form_settings( 'id' );
		$form_id   = $form_id ?: sanitize_key( $form_name );

		$raw = $record->get( 'fields' );
		$fields = array();
		if ( is_array( $raw ) ) {
			foreach ( $raw as $key => $field ) {
				$label = isset( $field['title'] ) && '' !== $field['title'] ? $field['title'] : $key;
				$fields[ sanitize_key( $label ) ] = isset( $field['value'] ) ? $field['value'] : '';
			}
		}

		$submission_id = 'el-' . $form_id . '-' . md5( wp_json_encode( $fields ) . microtime() );
		$source_url    = isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '';

		$this->dispatch( $form_id, $submission_id, $fields, $source_url );
	}
}
