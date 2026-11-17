import multer from "multer";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import { uploadsDirectory } from "../../config/uploads.js";
import { detectEvidenceMime, isCompleteEvidence } from "../services/fileType.js";

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDirectory),
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${extensionFor(file.mimetype)}`)
});

const allowedTypes = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["application/pdf", ".pdf"]]);
function extensionFor(mimeType) { return allowedTypes.get(String(mimeType).toLowerCase()) || ".bin"; }
function validateMime(file, callback, allowPdf = true) {
  const mime = String(file.mimetype || "").toLowerCase();
  if (!allowedTypes.has(mime) || (!allowPdf && mime === "application/pdf")) return callback(Object.assign(new Error(allowPdf ? "Only JPG, JPEG, PNG, and PDF files are accepted." : "Only JPG, JPEG, and PNG profile photos are accepted."), { status: 422 }));
  callback(null, true);
}

async function removeFiles(files) { await Promise.all(files.map(file => fs.unlink(file.path).catch(() => {}))); }

export async function validateUploadedEvidence(req, res, next) {
  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : req.file ? [req.file] : [];
  try {
    for (const file of files) {
      const content = await fs.readFile(file.path);
      const actualMime = detectEvidenceMime(content);
      const allowPdf = file.fieldname !== "profilePhoto";
      if (!actualMime || actualMime !== String(file.mimetype || "").toLowerCase() || !isCompleteEvidence(content, actualMime) || (!allowPdf && actualMime === "application/pdf")) {
        await removeFiles(files);
        return res.status(422).json({ message: "The uploaded file is incomplete or does not match a supported JPG, PNG, or PDF document. Choose a valid file and try again." });
      }
      file.safeOriginalName = path.basename(String(file.originalname || "document").replace(/[\u0000-\u001f\u007f]/g, "")).slice(0, 180) || "document";
    }
    next();
  } catch (error) { await removeFiles(files); next(error); }
}

const limits = { fileSize: 8 * 1024 * 1024, files: 5 };
export const uploadReportPhotos = multer({ storage, fileFilter: (_req, file, callback) => validateMime(file, callback), limits }).array("photos", 5);
export const uploadOwnershipProof = multer({ storage, fileFilter: (_req, file, callback) => validateMime(file, callback), limits: { ...limits, files: 1 } }).single("ownershipProof");
export const uploadRegistrationDocuments = multer({ storage, fileFilter: (_req, file, callback) => validateMime(file, callback, file.fieldname !== "profilePhoto"), limits: { ...limits, files: 2 } }).fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "ownershipProof", maxCount: 1 },
]);
