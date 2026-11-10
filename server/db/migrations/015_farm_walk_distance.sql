ALTER TABLE lands
  ADD COLUMN walking_distance_meters DECIMAL(14,2) NULL AFTER perimeter_meters;

ALTER TABLE land_boundary_measurements
  ADD COLUMN walking_distance_meters DECIMAL(14,2) NULL AFTER perimeter_meters;
