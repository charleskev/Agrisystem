ALTER TABLE lands
  MODIFY COLUMN size_hectares DECIMAL(12,4) NOT NULL,
  ADD COLUMN boundary_geojson JSON NULL AFTER longitude,
  ADD COLUMN area_square_meters DECIMAL(16,2) NULL AFTER boundary_geojson,
  ADD COLUMN area_acres DECIMAL(12,4) NULL AFTER area_square_meters,
  ADD COLUMN perimeter_meters DECIMAL(14,2) NULL AFTER area_acres,
  ADD COLUMN gps_accuracy_m DECIMAL(8,2) NULL AFTER perimeter_meters,
  ADD COLUMN measurement_quality VARCHAR(30) NULL AFTER gps_accuracy_m,
  ADD COLUMN mapped_at TIMESTAMP NULL AFTER measurement_quality,
  ADD COLUMN municipality VARCHAR(120) NULL AFTER barangay,
  ADD COLUMN province VARCHAR(120) NULL AFTER municipality,
  ADD COLUMN region VARCHAR(120) NULL AFTER province,
  ADD COLUMN notes TEXT NULL AFTER region,
  ADD INDEX idx_lands_mapping (farmer_id, mapped_at);
