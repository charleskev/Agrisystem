ALTER TABLE damage_reports
  ADD COLUMN incident_occurred_at DATETIME NULL AFTER incident_barangay,
  ADD COLUMN reported_severity VARCHAR(30) NULL AFTER confirmed_damage_type,
  ADD COLUMN reported_affected_area VARCHAR(180) NULL AFTER reported_severity,
  ADD INDEX idx_reports_reported_severity (reported_severity, created_at);
