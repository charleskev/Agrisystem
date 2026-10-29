import { pool } from "../../config/db.js";

function json(value) {
  if (value == null || typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    confidence: row.confidence == null ? null : Number(row.confidence),
    detected_crops: json(row.detected_crops) || [],
    bounding_boxes: json(row.bounding_boxes) || [],
    possible_issues: json(row.possible_issues) || [],
    recommendations: json(row.recommendations) || [],
    analysis: json(row.analysis_json),
    image_url: row.image_file,
  };
}

export async function createCropDetection(values, db = pool) {
  const [result] = await db.query(`
    INSERT INTO crop_detections
      (farmer_id, land_id, image_file, image_mime_type, crop_name, scientific_name, detected_crops, confidence, bounding_boxes, growth_stage, health_status, possible_issues, recommendations, analysis_json, model_name, model_version, validation_status, submission_fingerprint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    values.farmerId, values.landId || null, values.imageFile, values.imageMimeType,
    values.cropName || "Unknown Crop", values.scientificName || null, JSON.stringify(values.detectedCrops || []),
    values.confidence == null ? null : values.confidence, JSON.stringify(values.boundingBoxes || []),
    values.growthStage || null, values.healthStatus || null, JSON.stringify(values.possibleIssues || []),
    JSON.stringify(values.recommendations || []), JSON.stringify(values.analysis || null), values.modelName || null,
    values.modelVersion || null, values.validationStatus || "not_validated", values.submissionFingerprint || null,
  ]);
  return getCropDetection(values.farmerId, result.insertId, db);
}

export async function findCropDetectionByFingerprint(farmerId, submissionFingerprint, db = pool) {
  if (!submissionFingerprint) return null;
  const [rows] = await db.query(`
    SELECT d.*, l.name AS land_name, l.barangay AS land_barangay, l.size_hectares AS land_size_hectares
    FROM crop_detections d
    LEFT JOIN lands l ON l.id = d.land_id
    WHERE d.farmer_id = ? AND d.submission_fingerprint = ?
    LIMIT 1
  `, [farmerId, submissionFingerprint]);
  return hydrate(rows[0]);
}

export async function getCropDetection(farmerId, id, db = pool) {
  const [rows] = await db.query(`
    SELECT d.*, l.name AS land_name, l.barangay AS land_barangay, l.size_hectares AS land_size_hectares
    FROM crop_detections d
    LEFT JOIN lands l ON l.id = d.land_id
    WHERE d.farmer_id = ? AND d.id = ?
  `, [farmerId, id]);
  return hydrate(rows[0]);
}

export async function listCropDetections(farmerId, search = "") {
  const value = `%${String(search || "").trim()}%`;
  const [rows] = await pool.query(`
    SELECT d.*, l.name AS land_name, l.barangay AS land_barangay, l.size_hectares AS land_size_hectares
    FROM crop_detections d
    LEFT JOIN lands l ON l.id = d.land_id
    WHERE d.farmer_id = ?
      AND (d.crop_name LIKE ? OR d.scientific_name LIKE ? OR l.name LIKE ? OR l.barangay LIKE ?)
    ORDER BY d.created_at DESC, d.id DESC
  `, [farmerId, value, value, value, value]);
  return rows.map(hydrate);
}

export async function deleteCropDetection(farmerId, id) {
  const detection = await getCropDetection(farmerId, id);
  if (!detection) return null;
  await pool.query("DELETE FROM crop_detections WHERE farmer_id = ? AND id = ?", [farmerId, id]);
  return detection;
}
