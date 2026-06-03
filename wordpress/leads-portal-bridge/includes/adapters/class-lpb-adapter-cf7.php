<?php
/**
 * Contact Form 7 adapter.
 *
 * Hook: `wpcf7_mail_sent` — `( $contact_form )`. Runs after CF7 has finished
 * processing the submission. We pull fields out of `WPCF7_Submission::get_instance()`.
 *
 * https://contactform7.com/2017/02/19/how-to-use-actions/
 */
defined( 'ABSPATH' ) || exit;

class LPB_Adapter_CF7 extends LPB_Adapter {

	protected function slug() {
		return 'cf7';
	}

	public function register_hooks() {
		add_action( 'wpcf7_mail_sent', array( $this, 'on_submit' ), 20, 1 );
	}

	public function on_submit( $contact_form ) {
		if ( ! class_exists( 'WPCF7_Submission' ) ) {
			return;
		}
		$submission = WPCF7_Submission::get_instance();
		if ( ! $submission ) {
			return;
		}

		$form_id       = method_exists( $contact_form, 'id' ) ? (string) $contact_form->id() : '';
		$posted        = $submission->get_posted_data();
		$submission_id = 'cf7-' . $form_id . '-' . md5( wp_json_encode( $posted ) . microtime() );

		$fields = is_array( $posted ) ? $posted : array();

		$source_url = method_exists( $submission, 'get_meta' )
			? (string) $submission->get_meta( 'url' )
			: ( isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '' );

		$this->dispatch( $form_id, $submission_id, $fields, $source_url );
	}
}
