ALTER TABLE password_reset_codes
  MODIFY expires_at TIMESTAMP NOT NULL,
  ADD COLUMN request_ip_hash CHAR(64) NULL AFTER attempts,
  ADD COLUMN verified_at TIMESTAMP NULL AFTER request_ip_hash,
  ADD COLUMN reset_token_hash CHAR(64) NULL AFTER verified_at,
  ADD COLUMN reset_token_expires_at TIMESTAMP NULL AFTER reset_token_hash,
  ADD INDEX idx_password_reset_ip_created (request_ip_hash, created_at),
  ADD INDEX idx_password_reset_token (reset_token_hash, reset_token_expires_at);

CREATE TABLE staff_notification_preferences (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notify_new_reports BOOLEAN NOT NULL DEFAULT TRUE,
  notify_severe_reports BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_sms_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_sms_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE sms_request_limits (
  limit_key CHAR(64) PRIMARY KEY,
  last_requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  window_started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sms_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  recipient_user_id BIGINT UNSIGNED NULL,
  recipient_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(40) NOT NULL,
  report_id BIGINT UNSIGNED NULL,
  event_key VARCHAR(120) NULL,
  provider_message_id VARCHAR(80) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  failure_code VARCHAR(80) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sms_log_user FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_sms_log_report FOREIGN KEY (report_id) REFERENCES damage_reports(id) ON DELETE SET NULL,
  UNIQUE KEY uq_sms_event_recipient (event_key, recipient_number),
  INDEX idx_sms_status_created (status, created_at)
);
