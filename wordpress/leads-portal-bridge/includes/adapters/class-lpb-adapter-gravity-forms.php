<?php
/**
 * Gravity Forms adapter.
 *
 * Hook: `gform_after_submission` — fires once GF has fully persisted the entry.
 * https://docs.gravityforms.com/gform_after_submission/
 */
defined( 'ABSPATH' ) || exit;

class LPB_Adapter_Gravity_Forms extends LPB_Adapter {

	protected function slug() {
		return 'gravity_forms';
	}

	public function register_hooks() {
		add_action( 'gform_after_submission', array( $this, 'on_submit' ), 20, 2 );
	}

	public function on_submit( $entry, $form ) {
		if ( ! is_array( $entry ) || ! is_array( $form ) ) {
			return;
		}
		$form_id       = isset( $form['id'] ) ? (string) $form['id'] : '';
		$submission_id = 'gf-' . $form_id . '-' . ( isset( $entry['id'] ) ? (string) $entry['id'] : uniqid() );

		// Build a key→value map. GF stores fields by numeric ID; we prefer the
		// admin label so the portal admin can map "Email Address" → email.
		$fields = array();
		foreach ( $form['fields'] as $field ) {
			$id    = isset( $field['id'] ) ? (string) $field['id'] : '';
			$label = isset( $field['adminLabel'] ) && '' !== $field['adminLabel']
				? $field['adminLabel']
				: ( isset( $field['label'] ) ? $field['label'] : $id );
			$key   = sanitize_key( $label );
			if ( '' === $key ) {
				$key = 'field_' . $id;
			}
			// Composite fields (name, address) store multiple values keyed "1.3", "1.6".
			$value = isset( $entry[ $id ] ) ? $entry[ $id ] : null;
			if ( null === $value || '' === $value ) {
				// Try concatenating any sub-inputs.
				$parts = array();
				foreach ( $entry as $entry_key => $entry_value ) {
					if ( 0 === strpos( (string) $entry_key, $id . '.' ) && '' !== $entry_value ) {
						$parts[] = $entry_value;
					}
				}
				if ( $parts ) {
					$value = implode( ' ', $parts );
				}
			}
			$fields[ $key ] = $value;
		}

		$source_url = isset( $entry['source_url'] ) ? (string) $entry['source_url'] : '';

		// Consent: any field flagged isRequired + type "consent" in GF surfaces a
		// "consent_<id>" entry plus the agreed text.
		$consent = array();
		foreach ( $form['fields'] as $field ) {
			if ( isset( $field['type'] ) && 'consent' === $field['type'] && ! empty( $entry[ $field['id'] . '.1' ] ) ) {
				$consent = array(
					'text' => isset( $field['checkboxLabel'] ) ? wp_strip_all_tags( $field['checkboxLabel'] ) : '',
					'ip'   => self::client_ip(),
				);
				break;
			}
		}

		$this->dispatch( $form_id, $submission_id, $fields, $source_url, $consent );
	}
}
