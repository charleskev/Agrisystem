ALTER TABLE lands
  ADD COLUMN ownership_proof_mime_type VARCHAR(100) NULL AFTER ownership_proof_file,
  ADD COLUMN ownership_proof_original_name VARCHAR(255) NULL AFTER ownership_proof_mime_type,
  ADD COLUMN ownership_proof_uploaded_at TIMESTAMP NULL AFTER ownership_proof_original_name,
  ADD COLUMN ownership_proof_status VARCHAR(30) NOT NULL DEFAULT 'pending' AFTER ownership_proof_uploaded_at,
  ADD COLUMN ownership_proof_reviewed_by BIGINT UNSIGNED NULL AFTER ownership_proof_status,
  ADD COLUMN ownership_proof_reviewed_at TIMESTAMP NULL AFTER ownership_proof_reviewed_by,
  ADD COLUMN ownership_proof_review_notes TEXT NULL AFTER ownership_proof_reviewed_at,
  ADD CONSTRAINT fk_lands_ownership_proof_reviewer FOREIGN KEY (ownership_proof_reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

UPDATE lands
SET ownership_proof_uploaded_at = created_at,
    ownership_proof_mime_type = CASE
      WHEN LOWER(ownership_proof_file) LIKE '%.pdf' THEN 'application/pdf'
      WHEN LOWER(ownership_proof_file) LIKE '%.png' THEN 'image/png'
      WHEN LOWER(ownership_proof_file) LIKE '%.webp' THEN 'image/webp'
      ELSE 'image/jpeg'
    END
WHERE ownership_proof_file IS NOT NULL AND ownership_proof_file <> '';

ALTER TABLE report_photos
  ADD COLUMN mime_type VARCHAR(100) NULL AFTER file_url,
  ADD COLUMN original_name VARCHAR(255) NULL AFTER mime_type;

UPDATE report_photos
SET mime_type = CASE
      WHEN LOWER(file_url) LIKE '%.pdf' THEN 'application/pdf'
      WHEN LOWER(file_url) LIKE '%.png' THEN 'image/png'
      WHEN LOWER(file_url) LIKE '%.webp' THEN 'image/webp'
      ELSE 'image/jpeg'
    END
WHERE mime_type IS NULL;
