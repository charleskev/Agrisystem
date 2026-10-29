CREATE TABLE land_boundary_measurements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  land_id BIGINT UNSIGNED NOT NULL,
  boundary_geojson JSON NOT NULL,
  area_square_meters DECIMAL(16,2) NOT NULL,
  area_hectares DECIMAL(12,4) NOT NULL,
  area_acres DECIMAL(12,4) NOT NULL,
  perimeter_meters DECIMAL(14,2) NOT NULL,
  gps_accuracy_m DECIMAL(8,2) NULL,
  measurement_quality VARCHAR(30) NOT NULL,
  measured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (land_id) REFERENCES lands(id) ON DELETE CASCADE,
  INDEX idx_land_measurements_history (land_id, measured_at)
);
