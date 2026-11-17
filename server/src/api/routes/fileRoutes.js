import { Router } from "express";
import { cropDetectionImage, farmerProfilePhoto, landDocument, reportAttachment } from "../controllers/fileController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);
router.get("/lands/:id/ownership-proof", landDocument);
router.get("/reports/:reportId/attachments/:attachmentId", reportAttachment);
router.get("/crop-detections/:id/image", cropDetectionImage);
router.get("/farmers/:id/profile-photo", farmerProfilePhoto);
export default router;
