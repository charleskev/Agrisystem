import { createHash } from "crypto";
import fs from "fs/promises";
import { getFarmerByUserId } from "../models/farmerModel.js";
import { listLandsByFarmer } from "../models/landModel.js";
import { getCropDetection } from "../models/cropDetectionModel.js";
import { createReport, findReportByFingerprint, listReports, reviewReport } from "../models/reportModel.js";
import { publishRealtimeUpdate } from "../services/realtimeService.js";
import { queueDamageReportSms } from "../services/reportSmsService.js";

export async function myReports(req, res, next) {
  try { const profile = await getFarmerByUserId(req.user.id); res.json({ reports: profile ? await listReports({ farmerId: profile.id }) : [] }); } catch (error) { next(error); }
}
export async function submitReport(req, res, next) {
  const uploadedFiles = req.files || [];
  const discardUploads = () => Promise.all(uploadedFiles.map(file => fs.unlink(file.path).catch(() => {})));
  try {
    const profile = await getFarmerByUserId(req.user.id);
    if (!profile || profile.registration_status !== "approved") { await discardUploads(); return res.status(403).json({ message: "Only approved farmers can submit a damage report." }); }
    const cropDetectionId = String(req.body.cropDetectionId || "").trim();
    const detection = cropDetectionId ? await getCropDetection(profile.id, cropDetectionId) : null;
    if (cropDetectionId && !detection) { await discardUploads(); return res.status(422).json({ message: "The selected crop scan is not in your detection history." }); }
    const lands = await listLandsByFarmer(profile.id);
    const linkedLandId = detection?.land_id || req.body.landId;
    const land = lands.find(item => String(item.id) === String(linkedLandId));
    if (!land) { await discardUploads(); return res.status(422).json({ message: detection ? "Choose one of your registered farms for this scan; it has no saved farm link." : "Choose one of your registered lands." }); }
    if (detection?.land_id && req.body.landId && String(detection.land_id) !== String(req.body.landId)) { await discardUploads(); return res.status(422).json({ message: "The selected farm does not match the farm linked to this crop scan." }); }
    req.body.landId = String(land.id);
    const invalid = async message => { await discardUploads(); return res.status(422).json({ message }); };
    if (!uploadedFiles.length && !detection) return res.status(422).json({ message: "Upload a farm photo or link a saved crop detection photo." });
    if (!String(req.body.confirmedPlant || "").trim()) return invalid("Select the affected crop.");
    if (!String(req.body.confirmedDamageType || "").trim()) return invalid("Select the damage type.");
    if (!["Low", "Moderate", "High", "Critical"].includes(req.body.reportedSeverity)) return invalid("Select the observed damage severity.");
    const occurredAt = String(req.body.incidentOccurredAt || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(occurredAt) || Number.isNaN(Date.parse(occurredAt))) return invalid("Enter a valid date and time for the incident.");
    if (!String(req.body.farmerNotes || "").trim()) return invalid("Describe the incident for MAO Staff.");
    if (String(req.body.farmerNotes).trim().length > 4000) return invalid("Keep the incident description to 4,000 characters or fewer.");
    req.body.incidentOccurredAt = occurredAt.replace("T", " ") + ":00";
    const imageHashes = await Promise.all(uploadedFiles.map(async file => createHash("sha256").update(await fs.readFile(file.path)).digest("hex")));
    const sourceIdentity = detection ? `detection:${detection.id}` : imageHashes.sort().join(":");
    const submissionFingerprint = createHash("sha256").update(`${profile.id}:${land.id}:${sourceIdentity}:${occurredAt}`).digest("hex");
    const duplicate = await findReportByFingerprint(profile.id, submissionFingerprint);
    if (duplicate) {
      await Promise.all(uploadedFiles.map(file => fs.unlink(file.path).catch(() => {})));
      return res.status(409).json({ message: `This same farm image was already submitted as report #${duplicate.id}. Open My Reports to avoid duplicate submissions.` });
    }
    const capturedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    const photos = uploadedFiles.map(file => ({ fileUrl: `/uploads/${file.filename}`, latitude: req.body.latitude, longitude: req.body.longitude, capturedAt }));
    if (detection) photos.unshift({ fileUrl: detection.image_file, latitude: req.body.latitude, longitude: req.body.longitude, capturedAt: detection.created_at });
    const analysis = detection?.analysis || null;
    const report = await createReport({ ...req.body, landId: land.id, farmerId: profile.id, cropDetectionId: detection?.id || null, aiPlant: detection?.crop_name || req.body.aiPlant, aiDamageType: analysis?.possibleDamageType || req.body.aiDamageType, aiConfidenceNotes: detection ? `${Math.round(Number(detection.confidence || 0) * 100)}% crop identification confidence` : req.body.aiConfidenceNotes, aiAnalysis: analysis || req.body.aiAnalysis, confirmedPlant: req.body.confirmedPlant, confirmedDamageType: req.body.confirmedDamageType, photos, submissionFingerprint });
    queueDamageReportSms(report);
    publishRealtimeUpdate("report.created");
    res.status(201).json({ report });
  } catch (error) { await discardUploads(); next(error); }
}
export async function reports(req, res, next) { try { res.json({ reports: await listReports(req.query) }); } catch (error) { next(error); } }
export async function review(req, res, next) {
  try {
    const { status: requestedStatus, confirmedPlant, confirmedDamageType, rejectionReason, staffRemarks, actionsTaken } = req.body;
    if (!["pending", "reviewing", "resolved", "verified", "rejected"].includes(requestedStatus)) return res.status(422).json({ message: "Status must be Pending, Reviewing, Resolved, or Rejected." });
    if ([staffRemarks, actionsTaken, rejectionReason].some(value => value != null && String(value).length > 4000)) return res.status(422).json({ message: "Staff remarks and action notes must be 4,000 characters or fewer." });
    const status = requestedStatus === "verified" ? "resolved" : requestedStatus;
    const report = await reviewReport(req.params.id, status, req.user.id, { confirmedPlant, confirmedDamageType, rejectionReason, staffRemarks, actionsTaken });
    if (!report) return res.status(404).json({ message: "Report was not found." });
    publishRealtimeUpdate("report.reviewed");
    res.json({ report });
  } catch (error) { next(error); }
}
