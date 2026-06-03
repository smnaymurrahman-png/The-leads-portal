<?php
/**
 * WPForms adapter.
 *
 * Hook: `wpforms_process_complete` — `( $fields, $entry, $form_data, $entry_id )`.
 * https://wpforms.com/developers/wpforms_process_complete/
 */
defined( 'ABSPATH' ) || exit;

class LPB_Adapter_WPForms extends LPB_Adapter {

	protected function slug() {
		return 'wpforms';
	}

	public function register_hooks() {
		add_action( 'wpforms_process_complete', array( $this, 'on_submit' ), 20, 4 );
	}

	public function on_submit( $wp_fields, $entry, $form_data, $entry_id ) {
		if ( ! is_array( $wp_fields ) || ! is_array( $form_data ) ) {
			return;
		}
		$form_id       = isset( $form_data['id'] ) ? (string) $form_data['id'] : '';
		$submission_id = 'wpf-' . $form_id . '-' . ( $entry_id ? (string) $entry_id : uniqid() );

		// $wp_fields shape: [ '0' => ['name'=>'…','value'=>'…','id'=>0,…], … ]
		$fields = array();
		foreach ( $wp_fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$label = isset( $field['name'] ) ? $field['name'] : ( 'field_' . ( $field['id'] ?? '' ) );
			$key   = sanitize_key( $label );
			$value = isset( $field['value'] ) ? $field['value'] : '';
			$fields[ $key ] = $value;
		}

		$source_url = isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '';

		$this->dispatch( $form_id, $submission_id, $fields, $source_url );
	}
}
