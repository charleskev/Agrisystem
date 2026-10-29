import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import multer from "multer";
import { detect, history, remove, status } from "../controllers/cropDetectionController.js";
import { authenticate, allowRoles } from "../middleware/auth.js";

const routeDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(routeDirectory, "../../../uploads/crop-detections");
fs.mkdirSync(uploadDirectory, { recursive: true });
const extensionFor = mimeType => ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[mimeType] || ".jpg");
const upload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, callback) => callback(null, uploadDirectory), filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${extensionFor(file.mimetype)}`) }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

const router = Router();
router.use(authenticate, allowRoles("farmer"));
router.get("/status", status);
router.get("/", history);
router.post("/", upload.single("photo"), detect);
router.delete("/:id", remove);
export default router;
