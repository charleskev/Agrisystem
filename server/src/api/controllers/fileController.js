import fs from "fs/promises";
import path from "path";
import { pool } from "../../config/db.js";
import { filePathFromUploadReference } from "../../config/uploads.js";
import { detectEvidenceMime, isCompleteEvidence } from "../services/fileType.js";

const staffRoles = new Set(["staff", "technician", "admin"]);

function safeName(value, fallback) {
  const name = path.basename(String(value || fallback)).replace(/[\u0000-\u001f\u007f"\\/]/g, "_").slice(0, 180);
  return name || fallback;
}

async function sendFile(req, res, reference, storedMime, originalName) {
  const fullPath = filePathFromUploadReference(reference);
  if (!fullPath) return res.status(404).json({ message: "This uploaded file is no longer available." });
  let content;
  try { content = await fs.readFile(fullPath); }
  catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return res.status(404).json({ message: "The uploaded file is missing from storage. Ask the farmer to upload it again." });
    throw error;
  }
  const actualMime = detectEvidenceMime(content);
  if (!actualMime || !isCompleteEvidence(content, actualMime) || (storedMime && storedMime !== actualMime)) return res.status(422).json({ message: "This uploaded file is damaged or incomplete. Ask the farmer to upload a valid JPG, PNG, or PDF again." });
  const download = req.query.download === "1";
  const filename = safeName(originalName, `farmer-document${actualMime === "application/pdf" ? ".pdf" : actualMime === "image/png" ? ".png" : actualMime === "image/webp" ? ".webp" : ".jpg"}`);
  res.set({
    "Content-Type": actualMime,
    "Content-Length": String(content.length),
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  return res.send(content);
}

function canReadFarmer(req, profileUserId) {
  return staffRoles.has(req.user.role) || (req.user.role === "farmer" && String(req.user.id) === String(profileUserId));
}

export async function landDocument(req, res, next) {
  try {
    const [rows] = await pool.query("SELECT l.ownership_proof_file AS file_reference, l.ownership_proof_mime_type AS mime_type, l.ownership_proof_original_name AS original_name, fp.user_id FROM lands l JOIN farmer_profiles fp ON fp.id = l.farmer_id WHERE l.id = ?", [req.params.id]);
    const land = rows[0];
    if (!land || !land.file_reference) return res.status(404).json({ message: "No land document is saved for this farm." });
    if (!canReadFarmer(req, land.user_id)) return res.status(403).json({ message: "You do not have permission to view this farmer's document." });
    return await sendFile(req, res, land.file_reference, land.mime_type, land.original_name);
  } catch (error) { next(error); }
}

export async function reportAttachment(req, res, next) {
  try {
    const [rows] = await pool.query("SELECT rp.file_url AS file_reference, rp.mime_type, rp.original_name, dr.farmer_id, fp.user_id FROM report_photos rp JOIN damage_reports dr ON dr.id = rp.damage_report_id JOIN farmer_profiles fp ON fp.id = dr.farmer_id WHERE rp.id = ? AND dr.id = ?", [req.params.attachmentId, req.params.reportId]);
    const attachment = rows[0];
    if (!attachment) return res.status(404).json({ message: "This report attachment was not found." });
    if (!canReadFarmer(req, attachment.user_id)) return res.status(403).json({ message: "You do not have permission to view this farmer's report." });
    return await sendFile(req, res, attachment.file_reference, attachment.mime_type, attachment.original_name);
  } catch (error) { next(error); }
}

export async function cropDetectionImage(req, res, next) {
  try {
    const [rows] = await pool.query("SELECT d.image_file AS file_reference, d.image_mime_type AS mime_type, d.farmer_id, fp.user_id FROM crop_detections d JOIN farmer_profiles fp ON fp.id = d.farmer_id WHERE d.id = ?", [req.params.id]);
    const detection = rows[0];
    if (!detection) return res.status(404).json({ message: "This saved crop image was not found." });
    if (!canReadFarmer(req, detection.user_id)) return res.status(403).json({ message: "You do not have permission to view this farmer's crop image." });
    return await sendFile(req, res, detection.file_reference, detection.mime_type, null);
  } catch (error) { next(error); }
}

export async function farmerProfilePhoto(req, res, next) {
  try {
    const [rows] = await pool.query("SELECT profile_photo_file AS file_reference, user_id FROM farmer_profiles WHERE id = ?", [req.params.id]);
    const profile = rows[0];
    if (!profile || !profile.file_reference) return res.status(404).json({ message: "No profile photo is saved for this farmer." });
    if (!canReadFarmer(req, profile.user_id)) return res.status(403).json({ message: "You do not have permission to view this farmer's photo." });
    return await sendFile(req, res, profile.file_reference, null, null);
  } catch (error) { next(error); }
}
