ALTER TABLE damage_reports
  ADD COLUMN ai_damage_severity VARCHAR(30) NULL AFTER ai_detected_damage_type,
  ADD COLUMN ai_damage_confidence DECIMAL(5,4) NULL AFTER ai_damage_severity,
  ADD COLUMN ai_affected_area_estimate VARCHAR(180) NULL AFTER ai_damage_confidence,
  ADD COLUMN ai_affected_plant_count VARCHAR(120) NULL AFTER ai_affected_area_estimate,
  ADD COLUMN ai_analysis JSON NULL AFTER ai_confidence_notes,
  ADD COLUMN ai_scan_at TIMESTAMP NULL AFTER ai_analysis,
  ADD COLUMN submission_fingerprint CHAR(64) NULL AFTER rejection_reason,
  ADD INDEX idx_reports_damage_severity (ai_detected_damage_type, ai_damage_severity),
  ADD UNIQUE INDEX uq_reports_farmer_fingerprint (farmer_id, submission_fingerprint);
