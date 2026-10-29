ALTER TABLE crop_detections
  ADD COLUMN submission_fingerprint CHAR(64) NULL AFTER validation_status,
  ADD UNIQUE INDEX uq_crop_detections_farmer_fingerprint (farmer_id, submission_fingerprint);
