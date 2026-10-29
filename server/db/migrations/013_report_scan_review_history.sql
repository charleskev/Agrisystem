ALTER TABLE damage_reports
  ADD COLUMN crop_detection_id BIGINT UNSIGNED NULL AFTER land_id,
  ADD COLUMN staff_remarks TEXT NULL AFTER rejection_reason,
  ADD COLUMN actions_taken TEXT NULL AFTER staff_remarks,
  ADD INDEX idx_reports_crop_detection (crop_detection_id),
  ADD CONSTRAINT fk_reports_crop_detection FOREIGN KEY (crop_detection_id) REFERENCES crop_detections(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS damage_report_review_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT UNSIGNED NOT NULL,
  staff_user_id BIGINT UNSIGNED NULL,
  status VARCHAR(30) NOT NULL,
  remarks TEXT NULL,
  actions_taken TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_report_review_history_report_created (report_id, created_at),
  CONSTRAINT fk_report_review_history_report FOREIGN KEY (report_id) REFERENCES damage_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_review_history_staff FOREIGN KEY (staff_user_id) REFERENCES users(id) ON DELETE SET NULL
);
