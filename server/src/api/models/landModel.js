import { pool } from "../../config/db.js";

const parseJson = value => {
  if (value == null || typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
};
const hydrate = land => ({ ...land, crop_types: parseJson(land.crop_types) || [], boundary_geojson: parseJson(land.boundary_geojson) });

async function recordMeasurement(db, landId, mapping) {
  if (!mapping) return;
  await db.query(
    "INSERT INTO land_boundary_measurements (land_id, boundary_geojson, area_square_meters, area_hectares, area_acres, perimeter_meters, gps_accuracy_m, measurement_quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [landId, JSON.stringify(mapping.boundaryGeojson), mapping.areaSquareMeters, mapping.areaHectares, mapping.areaAcres, mapping.perimeterMeters, mapping.gpsAccuracyM, mapping.quality]
  );
}

export async function createLand({ farmerId, name, address, barangay, municipality, province, region, latitude, longitude, sizeHectares, cropTypes, ownershipProofFile, mapping, notes }, db = pool) {
  const connection = db === pool ? await pool.getConnection() : null;
  const query = connection || db;
  try {
    if (connection) await connection.beginTransaction();
    const [result] = await query.query(
      "INSERT INTO lands (farmer_id, name, address, barangay, municipality, province, region, latitude, longitude, size_hectares, crop_types, ownership_proof_file, boundary_geojson, area_square_meters, area_acres, perimeter_meters, gps_accuracy_m, measurement_quality, mapped_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [farmerId, name || null, address || null, barangay || null, municipality || null, province || null, region || null, latitude, longitude, sizeHectares, JSON.stringify(cropTypes || []), ownershipProofFile || null, mapping ? JSON.stringify(mapping.boundaryGeojson) : null, mapping?.areaSquareMeters ?? null, mapping?.areaAcres ?? null, mapping?.perimeterMeters ?? null, mapping?.gpsAccuracyM ?? null, mapping?.quality ?? null, mapping ? new Date() : null, notes || null]
    );
    await recordMeasurement(query, result.insertId, mapping);
    const [rows] = await query.query("SELECT * FROM lands WHERE id = ?", [result.insertId]);
    if (connection) await connection.commit();
    return hydrate(rows[0]);
  } catch (error) { if (connection) await connection.rollback(); throw error; }
  finally { connection?.release(); }
}

export async function listLandsByFarmer(farmerId) {
  const [rows] = await pool.query("SELECT * FROM lands WHERE farmer_id = ? ORDER BY created_at DESC", [farmerId]);
  return rows.map(hydrate);
}

export async function updateLand(farmerId, landId, { name, address, barangay, municipality, province, region, cropTypes, notes, mapping }, db = pool) {
  const connection = db === pool ? await pool.getConnection() : null;
  const query = connection || db;
  try {
    if (connection) await connection.beginTransaction();
    const [result] = await query.query(
      "UPDATE lands SET name = ?, address = ?, barangay = ?, municipality = ?, province = ?, region = ?, crop_types = ?, notes = ?, latitude = ?, longitude = ?, size_hectares = ?, boundary_geojson = ?, area_square_meters = ?, area_acres = ?, perimeter_meters = ?, gps_accuracy_m = ?, measurement_quality = ?, mapped_at = NOW() WHERE id = ? AND farmer_id = ?",
      [name || null, address || null, barangay || null, municipality || null, province || null, region || null, JSON.stringify(cropTypes || []), notes || null, mapping.latitude, mapping.longitude, mapping.areaHectares, JSON.stringify(mapping.boundaryGeojson), mapping.areaSquareMeters, mapping.areaAcres, mapping.perimeterMeters, mapping.gpsAccuracyM, mapping.quality, landId, farmerId]
    );
    if (!result.affectedRows) { if (connection) await connection.rollback(); return null; }
    await recordMeasurement(query, landId, mapping);
    const [rows] = await query.query("SELECT * FROM lands WHERE id = ? AND farmer_id = ?", [landId, farmerId]);
    if (connection) await connection.commit();
    return hydrate(rows[0]);
  } catch (error) { if (connection) await connection.rollback(); throw error; }
  finally { connection?.release(); }
}

export async function deleteLand(farmerId, landId, db = pool) {
  const [result] = await db.query("DELETE FROM lands WHERE id = ? AND farmer_id = ?", [landId, farmerId]);
  return result.affectedRows > 0;
}

export async function listLandMeasurements(farmerId, landId, db = pool) {
  const [rows] = await db.query(
    "SELECT m.* FROM land_boundary_measurements m JOIN lands l ON l.id = m.land_id WHERE l.farmer_id = ? AND l.id = ? ORDER BY m.measured_at DESC",
    [farmerId, landId]
  );
  return rows.map(row => ({ ...row, boundary_geojson: parseJson(row.boundary_geojson) }));
}
