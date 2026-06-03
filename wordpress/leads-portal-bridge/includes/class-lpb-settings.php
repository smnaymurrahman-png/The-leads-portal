<?php
/**
 * LPB_Settings — admin UI.
 *
 * Two screens:
 *   "Leads Portal → Endpoints"      — CRUD of (form → portal endpoint) bindings.
 *   "Leads Portal → Delivery Log"   — last 100 attempts, success/failure counts.
 *
 * All POSTs go through admin-post.php with a nonce + capability check, then
 * redirect back to the listing — no form re-submission on refresh.
 */
defined( 'ABSPATH' ) || exit;

class LPB_Settings {

	private static $instance = null;
	const CAP    = 'manage_options';
	const SLUG   = 'leads-portal-bridge';
	const ACTION = 'lpb_save_endpoint';

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function boot() {
		add_action( 'admin_menu',                              array( $this, 'register_menu' ) );
		add_action( 'admin_post_' . self::ACTION,              array( $this, 'handle_save' ) );
		add_action( 'admin_post_lpb_delete_endpoint',          array( $this, 'handle_delete' ) );
		add_action( 'admin_post_lpb_test_endpoint',            array( $this, 'handle_test' ) );
		add_action( 'admin_enqueue_scripts',                   array( $this, 'enqueue_assets' ) );
	}

	public function register_menu() {
		add_menu_page(
			__( 'Leads Portal', 'leads-portal-bridge' ),
			__( 'Leads Portal', 'leads-portal-bridge' ),
			self::CAP,
			self::SLUG,
			array( $this, 'render_endpoints_page' ),
			'dashicons-megaphone',
			81
		);
		add_submenu_page(
			self::SLUG,
			__( 'Endpoints', 'leads-portal-bridge' ),
			__( 'Endpoints', 'leads-portal-bridge' ),
			self::CAP,
			self::SLUG,
			array( $this, 'render_endpoints_page' )
		);
		add_submenu_page(
			self::SLUG,
			__( 'Delivery Log', 'leads-portal-bridge' ),
			__( 'Delivery Log', 'leads-portal-bridge' ),
			self::CAP,
			self::SLUG . '-log',
			array( $this, 'render_log_page' )
		);
	}

	public function enqueue_assets( $hook ) {
		if ( false === strpos( (string) $hook, self::SLUG ) ) {
			return;
		}
		wp_enqueue_style(
			'lpb-admin',
			LPB_PLUGIN_URL . 'admin/css/admin.css',
			array(),
			LPB_VERSION
		);
	}

	// ── Endpoints screen ───────────────────────────────────────────────────────

	public function render_endpoints_page() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'leads-portal-bridge' ) );
		}
		$action_param = isset( $_GET['action'] ) ? sanitize_key( wp_unslash( $_GET['action'] ) ) : '';
		$edit_id      = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;

		if ( 'edit' === $action_param || 'new' === $action_param ) {
			$row = $edit_id ? LPB_DB::get_endpoint( $edit_id ) : null;
			$this->render_endpoint_form( $row );
			return;
		}

		$this->render_endpoint_list();
	}

	private function render_endpoint_list() {
		$rows    = LPB_DB::list_endpoints();
		$plugins = LPB_Plugin::supported_form_plugins();
		$new_url = admin_url( 'admin.php?page=' . self::SLUG . '&action=new' );

		$this->maybe_render_admin_notice();
		?>
		<div class="wrap lpb-wrap">
			<h1 class="wp-heading-inline"><?php esc_html_e( 'Leads Portal — Endpoints', 'leads-portal-bridge' ); ?></h1>
			<a href="<?php echo esc_url( $new_url ); ?>" class="page-title-action"><?php esc_html_e( 'Add endpoint', 'leads-portal-bridge' ); ?></a>
			<p class="description">
				<?php esc_html_e( 'Each row binds a WordPress form to a single landing page in the Leads Portal. The portal admin creates the landing page first, then pastes the resulting URL + secret here.', 'leads-portal-bridge' ); ?>
			</p>

			<table class="widefat striped lpb-endpoints">
				<thead>
					<tr>
						<th><?php esc_html_e( 'Label', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Form plugin', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Form ID', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Intake URL', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Status', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Actions', 'leads-portal-bridge' ); ?></th>
					</tr>
				</thead>
				<tbody>
				<?php if ( empty( $rows ) ) : ?>
					<tr><td colspan="6" class="lpb-empty">
						<?php esc_html_e( 'No endpoints yet. Click "Add endpoint" to bind your first form.', 'leads-portal-bridge' ); ?>
					</td></tr>
				<?php else : foreach ( $rows as $row ) : ?>
					<tr>
						<td><strong><?php echo esc_html( $row->label ); ?></strong></td>
						<td><?php echo esc_html( $plugins[ $row->form_plugin ] ?? $row->form_plugin ); ?></td>
						<td><code><?php echo esc_html( $row->form_id ); ?></code></td>
						<td class="lpb-url"><code><?php echo esc_html( $this->mask_url( $row->intake_url ) ); ?></code></td>
						<td>
							<?php if ( (int) $row->active === 1 ) : ?>
								<span class="lpb-pill lpb-pill-ok"><?php esc_html_e( 'Active', 'leads-portal-bridge' ); ?></span>
							<?php else : ?>
								<span class="lpb-pill lpb-pill-off"><?php esc_html_e( 'Paused', 'leads-portal-bridge' ); ?></span>
							<?php endif; ?>
						</td>
						<td class="lpb-actions">
							<a href="<?php echo esc_url( admin_url( 'admin.php?page=' . self::SLUG . '&action=edit&id=' . (int) $row->id ) ); ?>">
								<?php esc_html_e( 'Edit', 'leads-portal-bridge' ); ?>
							</a> ·
							<?php
							$test_url = wp_nonce_url(
								admin_url( 'admin-post.php?action=lpb_test_endpoint&id=' . (int) $row->id ),
								'lpb_test_endpoint_' . (int) $row->id
							);
							$del_url  = wp_nonce_url(
								admin_url( 'admin-post.php?action=lpb_delete_endpoint&id=' . (int) $row->id ),
								'lpb_delete_endpoint_' . (int) $row->id
							);
							?>
							<a href="<?php echo esc_url( $test_url ); ?>"><?php esc_html_e( 'Send test', 'leads-portal-bridge' ); ?></a> ·
							<a href="<?php echo esc_url( $del_url ); ?>" class="lpb-danger" onclick="return confirm('<?php echo esc_js( __( 'Delete this endpoint?', 'leads-portal-bridge' ) ); ?>')"><?php esc_html_e( 'Delete', 'leads-portal-bridge' ); ?></a>
						</td>
					</tr>
				<?php endforeach; endif; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	private function render_endpoint_form( $row ) {
		$is_edit = $row && (int) $row->id > 0;
		$plugins = LPB_Plugin::supported_form_plugins();
		?>
		<div class="wrap lpb-wrap">
			<h1><?php echo $is_edit
				? esc_html__( 'Edit endpoint', 'leads-portal-bridge' )
				: esc_html__( 'New endpoint', 'leads-portal-bridge' ); ?></h1>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="lpb-form">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::ACTION ); ?>" />
				<input type="hidden" name="id"     value="<?php echo (int) ( $row->id ?? 0 ); ?>" />
				<?php wp_nonce_field( self::ACTION ); ?>

				<table class="form-table" role="presentation">
					<tr>
						<th><label for="lpb-label"><?php esc_html_e( 'Label', 'leads-portal-bridge' ); ?></label></th>
						<td>
							<input type="text" id="lpb-label" name="label" class="regular-text" required
								value="<?php echo esc_attr( $row->label ?? '' ); ?>" placeholder="Solar — Phoenix LP" />
							<p class="description"><?php esc_html_e( 'Friendly name. Only shown in this admin screen.', 'leads-portal-bridge' ); ?></p>
						</td>
					</tr>
					<tr>
						<th><label for="lpb-url"><?php esc_html_e( 'Intake URL', 'leads-portal-bridge' ); ?></label></th>
						<td>
							<input type="url" id="lpb-url" name="intake_url" class="large-text code" required
								value="<?php echo esc_attr( $row->intake_url ?? '' ); ?>"
								placeholder="https://api.leadsportal.com/api/intake/&lt;landing-page-uuid&gt;/lead" />
							<p class="description"><?php esc_html_e( 'Copy from the Leads Portal admin → Landing pages.', 'leads-portal-bridge' ); ?></p>
						</td>
					</tr>
					<tr>
						<th><label for="lpb-secret"><?php esc_html_e( 'Intake secret', 'leads-portal-bridge' ); ?></label></th>
						<td>
							<input type="password" id="lpb-secret" name="intake_secret" class="regular-text" autocomplete="new-password" <?php echo $is_edit ? '' : 'required'; ?>
								value="<?php echo esc_attr( $row->intake_secret ?? '' ); ?>" />
							<p class="description">
								<?php esc_html_e( 'The HMAC secret shown by the portal. Used to sign every request. Stored in your WordPress database.', 'leads-portal-bridge' ); ?>
								<?php if ( $is_edit ) : ?>
									<br><?php esc_html_e( 'Leave unchanged to keep the current secret.', 'leads-portal-bridge' ); ?>
								<?php endif; ?>
							</p>
						</td>
					</tr>
					<tr>
						<th><label for="lpb-plugin"><?php esc_html_e( 'Form plugin', 'leads-portal-bridge' ); ?></label></th>
						<td>
							<select id="lpb-plugin" name="form_plugin" required>
								<?php foreach ( $plugins as $slug => $name ) : ?>
									<option value="<?php echo esc_attr( $slug ); ?>"
										<?php selected( ( $row->form_plugin ?? '' ), $slug ); ?>>
										<?php echo esc_html( $name ); ?>
									</option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
					<tr>
						<th><label for="lpb-form-id"><?php esc_html_e( 'Form ID', 'leads-portal-bridge' ); ?></label></th>
						<td>
							<input type="text" id="lpb-form-id" name="form_id" class="regular-text" required
								value="<?php echo esc_attr( $row->form_id ?? '' ); ?>" placeholder="1" />
							<p class="description">
								<?php esc_html_e( 'The form\'s numeric ID in its own admin screen (Gravity Forms / WPForms / Fluent Forms). For CF7 use the post ID; for Elementor use the form name slug.', 'leads-portal-bridge' ); ?>
							</p>
						</td>
					</tr>
					<tr>
						<th><?php esc_html_e( 'Status', 'leads-portal-bridge' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="active" value="1"
									<?php checked( ! $row || (int) $row->active === 1 ); ?> />
								<?php esc_html_e( 'Active — forward submissions to the portal.', 'leads-portal-bridge' ); ?>
							</label>
						</td>
					</tr>
				</table>

				<p>
					<button type="submit" class="button button-primary">
						<?php echo $is_edit
							? esc_html__( 'Save changes', 'leads-portal-bridge' )
							: esc_html__( 'Add endpoint',  'leads-portal-bridge' ); ?>
					</button>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ); ?>" class="button button-secondary">
						<?php esc_html_e( 'Cancel', 'leads-portal-bridge' ); ?>
					</a>
				</p>
			</form>
		</div>
		<?php
	}

	// ── Delivery log screen ────────────────────────────────────────────────────

	public function render_log_page() {
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'leads-portal-bridge' ) );
		}
		$rows      = LPB_DB::recent_log_rows( 0, 100 );
		$endpoints = array();
		foreach ( LPB_DB::list_endpoints() as $e ) {
			$endpoints[ (int) $e->id ] = $e;
		}
		?>
		<div class="wrap lpb-wrap">
			<h1><?php esc_html_e( 'Leads Portal — Delivery log', 'leads-portal-bridge' ); ?></h1>
			<p class="description">
				<?php esc_html_e( 'Last 100 deliveries. Older rows are pruned automatically.', 'leads-portal-bridge' ); ?>
			</p>
			<table class="widefat striped lpb-log">
				<thead>
					<tr>
						<th><?php esc_html_e( 'When', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Endpoint', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Submission ID', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Status', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Outcome', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Duration', 'leads-portal-bridge' ); ?></th>
						<th><?php esc_html_e( 'Response', 'leads-portal-bridge' ); ?></th>
					</tr>
				</thead>
				<tbody>
				<?php if ( empty( $rows ) ) : ?>
					<tr><td colspan="7" class="lpb-empty"><?php esc_html_e( 'No deliveries yet.', 'leads-portal-bridge' ); ?></td></tr>
				<?php else : foreach ( $rows as $row ) : ?>
					<tr>
						<td><?php echo esc_html( $row->created_at ); ?> UTC</td>
						<td><?php echo esc_html( $endpoints[ (int) $row->endpoint_id ]->label ?? '#' . $row->endpoint_id ); ?></td>
						<td><code><?php echo esc_html( $row->submission_id ); ?></code></td>
						<td><?php echo $row->status_code ? (int) $row->status_code : '—'; ?></td>
						<td><span class="lpb-pill lpb-pill-<?php echo esc_attr( $this->outcome_class( $row->outcome ) ); ?>"><?php echo esc_html( $row->outcome ); ?></span></td>
						<td><?php echo $row->duration_ms ? esc_html( $row->duration_ms . ' ms' ) : '—'; ?></td>
						<td class="lpb-response"><code><?php echo esc_html( mb_substr( (string) $row->response_body, 0, 200 ) ); ?></code></td>
					</tr>
				<?php endforeach; endif; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	// ── Form handlers ──────────────────────────────────────────────────────────

	public function handle_save() {
		check_admin_referer( self::ACTION );
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'Forbidden', 'leads-portal-bridge' ) );
		}
		$id   = isset( $_POST['id'] ) ? (int) $_POST['id'] : 0;
		$data = array(
			'label'         => sanitize_text_field( wp_unslash( $_POST['label'] ?? '' ) ),
			'intake_url'    => esc_url_raw( wp_unslash( $_POST['intake_url'] ?? '' ) ),
			'form_plugin'   => sanitize_key( wp_unslash( $_POST['form_plugin'] ?? '' ) ),
			'form_id'       => sanitize_text_field( wp_unslash( $_POST['form_id'] ?? '' ) ),
			'active'        => ! empty( $_POST['active'] ),
		);
		// Preserve the existing secret when the edit form's secret box is empty.
		$incoming_secret = (string) wp_unslash( $_POST['intake_secret'] ?? '' );
		if ( '' !== $incoming_secret ) {
			$data['intake_secret'] = $incoming_secret;
		} elseif ( $id ) {
			$existing = LPB_DB::get_endpoint( $id );
			$data['intake_secret'] = $existing ? $existing->intake_secret : '';
		} else {
			$this->redirect_with( 'error', 'missing_secret' );
		}

		LPB_DB::upsert_endpoint( $data, $id );
		$this->redirect_with( 'updated', $id ? 'saved' : 'created' );
	}

	public function handle_delete() {
		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		check_admin_referer( 'lpb_delete_endpoint_' . $id );
		if ( ! current_user_can( self::CAP ) || ! $id ) {
			wp_die( esc_html__( 'Forbidden', 'leads-portal-bridge' ) );
		}
		LPB_DB::delete_endpoint( $id );
		$this->redirect_with( 'updated', 'deleted' );
	}

	public function handle_test() {
		$id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0;
		check_admin_referer( 'lpb_test_endpoint_' . $id );
		if ( ! current_user_can( self::CAP ) || ! $id ) {
			wp_die( esc_html__( 'Forbidden', 'leads-portal-bridge' ) );
		}
		$endpoint = LPB_DB::get_endpoint( $id );
		if ( ! $endpoint ) {
			$this->redirect_with( 'error', 'not_found' );
		}
		$payload = array(
			'submission_id' => 'lpb-test-' . wp_generate_uuid4(),
			'source_url'    => home_url( '/' ),
			'data'          => array(
				'full_name' => 'Bridge Test',
				'email'     => 'bridge-test+' . time() . '@example.com',
				'phone'     => '+1 415 555 0100',
				'zip'       => '94103',
				'state'     => 'CA',
			),
			'consent'       => array(
				'text' => 'Sent from the WordPress plugin\'s "Send test" button.',
				'ip'   => self::client_ip(),
			),
		);
		$result = LPB_Client::send( $endpoint, $payload );
		$this->redirect_with(
			$result['outcome'] === 'success' || $result['outcome'] === 'deduped' ? 'updated' : 'error',
			'test_' . $result['outcome']
		);
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	private function redirect_with( $kind, $code ) {
		$url = admin_url( 'admin.php?page=' . self::SLUG . '&' . $kind . '=' . rawurlencode( $code ) );
		wp_safe_redirect( $url );
		exit;
	}

	private function maybe_render_admin_notice() {
		$updated = isset( $_GET['updated'] ) ? sanitize_key( wp_unslash( $_GET['updated'] ) ) : '';
		$error   = isset( $_GET['error'] )   ? sanitize_key( wp_unslash( $_GET['error'] ) )   : '';

		$msgs = array(
			'created'        => array( 'success', __( 'Endpoint created.',           'leads-portal-bridge' ) ),
			'saved'          => array( 'success', __( 'Endpoint updated.',           'leads-portal-bridge' ) ),
			'deleted'        => array( 'success', __( 'Endpoint deleted.',           'leads-portal-bridge' ) ),
			'test_success'   => array( 'success', __( 'Test delivery succeeded.',    'leads-portal-bridge' ) ),
			'test_deduped'   => array( 'info',    __( 'Test delivery succeeded — portal recognised it as a duplicate.', 'leads-portal-bridge' ) ),
		);
		$errors = array(
			'missing_secret'        => __( 'A new endpoint needs an intake secret.',                    'leads-portal-bridge' ),
			'not_found'             => __( 'Endpoint not found.',                                       'leads-portal-bridge' ),
			'test_client_error'     => __( 'Test delivery failed: portal rejected the payload (4xx).',  'leads-portal-bridge' ),
			'test_transient_error'  => __( 'Test delivery failed temporarily (5xx). Queued for retry.', 'leads-portal-bridge' ),
			'test_network_error'    => __( 'Test delivery failed: network error reaching the portal.',  'leads-portal-bridge' ),
		);
		if ( $updated && isset( $msgs[ $updated ] ) ) {
			printf( '<div class="notice notice-%s is-dismissible"><p>%s</p></div>', esc_attr( $msgs[ $updated ][0] ), esc_html( $msgs[ $updated ][1] ) );
		}
		if ( $error && isset( $errors[ $error ] ) ) {
			printf( '<div class="notice notice-error is-dismissible"><p>%s</p></div>', esc_html( $errors[ $error ] ) );
		}
	}

	private function mask_url( $url ) {
		// Truncate the UUID so it fits in the table column.
		if ( preg_match( '#/intake/([0-9a-f-]{8,})/lead#i', (string) $url, $m ) ) {
			$short = substr( $m[1], 0, 8 ) . '…' . substr( $m[1], -4 );
			return str_replace( $m[1], $short, $url );
		}
		return $url;
	}

	private function outcome_class( $outcome ) {
		switch ( $outcome ) {
			case 'success':   return 'ok';
			case 'deduped':   return 'info';
			case 'client_error': return 'err';
			default:          return 'warn';
		}
	}

	private static function client_ip() {
		foreach ( array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ) as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				$value = sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) );
				if ( false !== strpos( $value, ',' ) ) {
					$value = trim( explode( ',', $value )[0] );
				}
				return $value;
			}
		}
		return '';
	}
}
