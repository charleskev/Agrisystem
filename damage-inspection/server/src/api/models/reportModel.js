import { pool } from "../../config/db.js";

const damageTypes = new Set(["Flood", "Drought", "Typhoon / strong wind", "Pest infestation", "Plant disease", "Nutrient deficiency", "Animal damage", "Fire", "Soil erosion", "Landslide", "Other", "No obvious damage detected", "Unknown"]);
const damageSeverities = new Set(["Low", "Moderate", "High", "Critical", "Unknown"]);

function parseJson(value, fallback) {
  try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed ?? fallback; } catch { return fallback; }
}
function cleanText(value, fallback = "", limit = 240) {
  const result = String(value || "").trim().slice(0, limit);
  return result || fallback;
}
function cleanTextList(value, limit = 6, itemLimit = 180) {
  return Array.isArray(value) ? value.slice(0, limit).map(item => cleanText(item, "", itemLimit)).filter(Boolean) : [];
}
function cleanSceneObjects(value) {
  const objects = parseJson(value, []);
  if (!Array.isArray(objects)) return [];
  return objects.slice(0, 10).map(item => ({ label: String(item?.class || item?.label || "unknown").slice(0, 80), confidence: Number(Number(item?.score || item?.confidence || 0).toFixed(3)) })).filter(item => item.label !== "unknown");
}
function cleanRegions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map(item => {
    const box = Array.isArray(item?.box) ? item.box.map(Number) : [];
    if (box.length !== 4 || !box.every(Number.isFinite)) return null;
    return { label: cleanText(item.label, "Visible damage", 80), confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)), box };
  }).filter(Boolean);
}
function cleanAnalysis(value) {
  const source = parseJson(value, null);
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const damageType = damageTypes.has(source.possibleDamageType) ? source.possibleDamageType : "Unknown";
  const severity = damageType !== "Unknown" && damageType !== "No obvious damage detected" && damageSeverities.has(source.damageSeverity) ? source.damageSeverity : "Unknown";
  const confidence = Math.max(0, Math.min(1, Number(source.confidence) || 0));
  const damageConfidence = Math.max(0, Math.min(1, Number(source.damageConfidence) || 0));
  return {
    cropOrPlant: cleanText(source.cropOrPlant, "Unknown", 120),
    category: cleanText(source.category, "unknown", 60),
    imageSummary: cleanText(source.imageSummary, "No clear image summary was returned.", 300),
    possibleDamageType: damageType,
    damageSeverity: severity,
    confidence,
    damageConfidence,
    affectedAreaEstimate: cleanText(source.affectedAreaEstimate, "Not measurable from this image", 180),
    affectedPlantCount: cleanText(source.affectedPlantCount, "Not measurable from this image", 120),
    damageEvidence: cleanTextList(source.damageEvidence),
    possibleCauses: cleanTextList(source.possibleCauses, 4, 160),
    recommendedActions: cleanTextList(source.recommendedActions, 5),
    preventionRecovery: cleanTextList(source.preventionRecovery, 5),
    visibleSymptoms: cleanTextList(source.visibleSymptoms, 8, 140),
    weedsPestsProblems: cleanTextList(source.weedsPestsProblems, 8, 160),
    damageRegions: cleanRegions(source.damageRegions),
    boundingBoxes: cleanRegions(source.boundingBoxes),
    reportRecommendation: cleanText(source.reportRecommendation, "Confirm the report with MAO Staff.", 220),
    reportSuggestion: cleanText(source.reportSuggestion, "Confirm the crop and damage labels before submitting.", 260),
    urgency: cleanText(source.urgency, "unknown", 30),
    imageQuality: cleanText(source.imageQuality, "Not recorded", 180),
    modelName: cleanText(source.modelName, "", 120),
  };
}

export async function findReportByFingerprint(farmerId, submissionFingerprint) {
  if (!submissionFingerprint) return null;
  const [rows] = await pool.query("SELECT id, created_at FROM damage_reports WHERE farmer_id = ? AND submission_fingerprint = ? LIMIT 1", [farmerId, submissionFingerprint]);
  return rows[0] || null;
}

export async function createReport({ landId, farmerId, cropDetectionId, incidentBarangay, incidentOccurredAt, reportedSeverity, reportedAffectedArea, aiPlant, aiDamageType, aiConfidenceNotes, aiAnalysis, confirmedPlant, confirmedDamageType, farmerNotes, cameraSceneObjects, photos, submissionFingerprint }) {
  const connection = await pool.getConnection();
  const sceneObjects = cleanSceneObjects(cameraSceneObjects);
  const analysis = cleanAnalysis(aiAnalysis);
  const analysisJson = analysis ? JSON.stringify(analysis) : null;
  const detectedPlant = cleanText(aiPlant || analysis?.cropOrPlant, "", 120) || null;
  const detectedDamage = cleanText(aiDamageType || analysis?.possibleDamageType, "", 120);
  const savedDamage = detectedDamage && detectedDamage !== "Unknown" ? detectedDamage : null;
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO damage_reports (land_id, crop_detection_id, farmer_id, incident_barangay, incident_occurred_at, ai_detected_plant, ai_detected_damage_type, ai_damage_severity, ai_damage_confidence, ai_affected_area_estimate, ai_affected_plant_count, ai_confidence_notes, ai_analysis, ai_scan_at, camera_scene_objects, confirmed_plant, confirmed_damage_type, reported_severity, reported_affected_area, farmer_notes, submission_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [landId, cropDetectionId || null, farmerId, incidentBarangay || null, incidentOccurredAt || null, detectedPlant, savedDamage, analysis?.damageSeverity === "Unknown" ? null : analysis?.damageSeverity || null, analysis ? analysis.damageConfidence : null, analysis?.affectedAreaEstimate || null, analysis?.affectedPlantCount || null, aiConfidenceNotes || null, analysisJson, analysis ? new Date() : null, sceneObjects.length ? JSON.stringify(sceneObjects) : null, confirmedPlant || null, confirmedDamageType || null, ["Low", "Moderate", "High", "Critical"].includes(reportedSeverity) ? reportedSeverity : null, cleanText(reportedAffectedArea, "", 180) || null, farmerNotes || null, submissionFingerprint || null]
    );
    for (const photo of photos || []) {
      const [photoResult] = await connection.query("INSERT INTO report_photos (damage_report_id, file_url, latitude, longitude, captured_at) VALUES (?, ?, ?, ?, ?)", [result.insertId, photo.fileUrl, photo.latitude || null, photo.longitude || null, photo.capturedAt || null]);
      if (confirmedPlant && confirmedDamageType) await connection.query("INSERT INTO damage_training_samples (report_id, report_photo_id, crop_type, damage_type, scene_objects) VALUES (?, ?, ?, ?, ?)", [result.insertId, photoResult.insertId, confirmedPlant, confirmedDamageType, sceneObjects.length ? JSON.stringify(sceneObjects) : null]);
    }
    await connection.commit();
    const [rows] = await connection.query("SELECT * FROM damage_reports WHERE id = ?", [result.insertId]);
    return rows[0];
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export async function listReports({ farmerId, status, barangay, cropType, damageType, severity, from, to, landId } = {}) {
  const clauses = [], values = [], add = (sql, value) => { clauses.push(sql); values.push(value); };
  if (farmerId) add("dr.farmer_id = ?", farmerId);
  if (status) add("dr.status = ?", status);
  if (barangay) add("COALESCE(NULLIF(dr.incident_barangay, ''), l.barangay) = ?", barangay);
  if (cropType) add("JSON_CONTAINS(l.crop_types, JSON_QUOTE(?))", cropType);
  if (damageType) add("COALESCE(dr.confirmed_damage_type, dr.ai_detected_damage_type) = ?", damageType);
  if (severity) add("dr.ai_damage_severity = ?", severity);
  if (from) add("dr.created_at >= ?", from);
  if (to) add("dr.created_at <= ?", to);
  if (landId) add("dr.land_id = ?", landId);
  const [reports] = await pool.query(`SELECT dr.*, l.name AS land_name, l.size_hectares AS mapped_farm_area_hectares, l.area_square_meters AS mapped_farm_area_square_meters, l.area_acres AS mapped_farm_area_acres, l.boundary_geojson, l.perimeter_meters AS farm_perimeter_meters, l.measurement_quality, COALESCE(NULLIF(dr.incident_barangay, ''), l.barangay) AS barangay, l.latitude, l.longitude, l.crop_types, u.full_name AS farmer_name, u.contact_number FROM damage_reports dr JOIN lands l ON l.id = dr.land_id JOIN farmer_profiles fp ON fp.id = dr.farmer_id JOIN users u ON u.id = fp.user_id ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY dr.created_at DESC`, values);
  if (!reports.length) return [];
  const ids = reports.map(report => report.id);
  const [photos, samples, history, scans] = await Promise.all([
    pool.query(`SELECT id, damage_report_id, file_url AS fileUrl, latitude, longitude, captured_at AS capturedAt FROM report_photos WHERE damage_report_id IN (${ids.map(() => "?").join(",")})`, ids).then(([rows]) => rows),
    pool.query(`SELECT id, report_id, report_photo_id, crop_type, damage_type, scene_objects, label_status FROM damage_training_samples WHERE report_id IN (${ids.map(() => "?").join(",")})`, ids).then(([rows]) => rows),
    pool.query(`SELECT h.*, u.full_name AS staff_name FROM damage_report_review_history h LEFT JOIN users u ON u.id = h.staff_user_id WHERE h.report_id IN (${ids.map(() => "?").join(",")}) ORDER BY h.created_at DESC, h.id DESC`, ids).then(([rows]) => rows),
    pool.query(`SELECT d.id, d.land_id, d.crop_name, d.scientific_name, d.confidence, d.image_file, d.analysis_json, d.created_at FROM crop_detections d JOIN damage_reports dr ON dr.crop_detection_id = d.id WHERE dr.id IN (${ids.map(() => "?").join(",")})`, ids).then(([rows]) => rows)
  ]);
  return reports.map(report => {
    const scan = scans.find(item => String(item.id) === String(report.crop_detection_id));
    return { ...report, crop_types: parseJson(report.crop_types, []), boundary_geojson: parseJson(report.boundary_geojson, null), camera_scene_objects: cleanSceneObjects(report.camera_scene_objects), ai_analysis: cleanAnalysis(report.ai_analysis), crop_detection: scan ? { ...scan, analysis: parseJson(scan.analysis_json, null), image_url: scan.image_file } : null, photos: photos.filter(photo => String(photo.damage_report_id) === String(report.id)), review_history: history.filter(item => String(item.report_id) === String(report.id)), trainingSamples: samples.filter(sample => String(sample.report_id) === String(report.id)).map(sample => ({ ...sample, scene_objects: cleanSceneObjects(sample.scene_objects) })) };
  });
}

export async function reviewReport(id, status, reviewerId, { confirmedPlant, confirmedDamageType, rejectionReason, staffRemarks, actionsTaken } = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query("UPDATE damage_reports SET status = ?, reviewed_by = ?, reviewed_at = NOW(), confirmed_plant = COALESCE(?, confirmed_plant), confirmed_damage_type = COALESCE(?, confirmed_damage_type), rejection_reason = ?, staff_remarks = COALESCE(?, staff_remarks), actions_taken = COALESCE(?, actions_taken) WHERE id = ?", [status, reviewerId, confirmedPlant || null, confirmedDamageType || null, status === "rejected" ? rejectionReason || null : null, staffRemarks || null, actionsTaken || null, id]);
    if (!result.affectedRows) { await connection.rollback(); return null; }
    await connection.query("INSERT INTO damage_report_review_history (report_id, staff_user_id, status, remarks, actions_taken) VALUES (?, ?, ?, ?, ?)", [id, reviewerId, status, staffRemarks || rejectionReason || null, actionsTaken || null]);
    if (["resolved", "verified", "rejected"].includes(status)) await connection.query("UPDATE damage_training_samples SET label_status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE report_id = ?", [status === "rejected" ? "rejected" : "approved", reviewerId, id]);
    await connection.commit();
    const [rows] = await connection.query("SELECT * FROM damage_reports WHERE id = ?", [id]);
    return rows[0];
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
