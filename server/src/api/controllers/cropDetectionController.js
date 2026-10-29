import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getFarmerByUserId } from "../models/farmerModel.js";
import { listLandsByFarmer } from "../models/landModel.js";
import { createCropDetection, deleteCropDetection, findCropDetectionByFingerprint, listCropDetections } from "../models/cropDetectionModel.js";
import { cropInformation, farmInformation } from "../services/cropKnowledge.js";
import { identifyCropDamage, visionProviderStatus } from "../services/visionService.js";

const apiDirectory = path.dirname(fileURLToPath(import.meta.url));
const cropUploadsDirectory = path.resolve(apiDirectory, "../../../uploads/crop-detections");
const cropConfidenceThreshold = 0.7;
const analysisCacheLifetimeMs = 10 * 60 * 1000;
const inFlightScans = new Map();
const analyzedButUnsaved = new Map();

function detectionError(message, status = 503, code = "CROP_DETECTION_ERROR") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function primaryCrop(analysis) {
  if (!analysis || analysis.needsClearerImage || analysis.isPlantDetected === false || !analysis.cropOrPlant || /^unknown( crop)?$/i.test(analysis.cropOrPlant)) return { cropName: "Unknown Crop", scientificName: null };
  const finding = analysis.identifiedCrops?.find(item => item.englishName?.toLowerCase() === analysis.cropOrPlant.toLowerCase()) || analysis.identifiedCrops?.find(item => Number(item.confidence) >= cropConfidenceThreshold);
  return { cropName: analysis.cropOrPlant, scientificName: (analysis.scientificName || finding?.scientificName) && (analysis.scientificName || finding?.scientificName) !== "Not confirmed" ? (analysis.scientificName || finding.scientificName) : null };
}

function responseFor({ detection, analysis, cropInfo, farmInfo, provider }) {
  return { detection, analysis, cropInfo, farmInfo, provider, modelUsed: analysis?.modelName || provider.model, confidenceThreshold: cropConfidenceThreshold };
}

function resultFor({ detection, analysis, farmer, land, provider }) {
  const savedAnalysis = analysis || detection.analysis;
  const cropFinding = savedAnalysis?.identifiedCrops?.find(item => item.englishName?.toLowerCase() === detection.crop_name?.toLowerCase());
  return responseFor({
    detection,
    analysis: savedAnalysis,
    cropInfo: cropInformation(detection.crop_name, cropFinding || savedAnalysis || {}),
    farmInfo: farmInformation({ farmer, land, cropName: detection.crop_name }),
    provider,
  });
}

function fingerprintFor({ farmerId, landId, image }) {
  return crypto.createHash("sha256").update(`${farmerId}:${landId || "none"}:`).update(image).digest("hex");
}

function getCachedAnalysis(fingerprint) {
  const cached = analyzedButUnsaved.get(fingerprint);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) { analyzedButUnsaved.delete(fingerprint); return null; }
  return cached.analysis;
}

function cacheAnalysis(fingerprint, analysis) {
  analyzedButUnsaved.set(fingerprint, { analysis, expiresAt: Date.now() + analysisCacheLifetimeMs });
}

async function removeUploadedFile(file) {
  if (!file?.filename) return;
  await fs.unlink(path.join(cropUploadsDirectory, path.basename(file.filename))).catch(() => {});
}

export async function status(_req, res) {
  res.json({ provider: visionProviderStatus(), confidenceThreshold: cropConfidenceThreshold });
}

export async function detect(req, res, next) {
  try {
    if (!req.file) return res.status(422).json({ message: "Capture or upload a JPG, PNG, or WebP crop photo before detection." });
    const farmer = await getFarmerByUserId(req.user.id);
    if (!farmer) { await removeUploadedFile(req.file); return res.status(404).json({ message: "A farmer profile is required before crop detection can be saved." }); }
    const lands = await listLandsByFarmer(farmer.id);
    const land = lands.find(item => String(item.id) === String(req.body.landId));
    if (req.body.landId && !land) { await removeUploadedFile(req.file); return res.status(422).json({ message: "The selected land is not in your farm profile." }); }

    const provider = visionProviderStatus();
    if (!provider.configured) { await removeUploadedFile(req.file); return res.status(503).json({ message: "AI crop analysis is not configured. Add a valid GEMINI_API_KEY on the server, restart the server, then try again. This photo was not saved." }); }

    const imageBuffer = await fs.readFile(req.file.path);
    const submissionFingerprint = fingerprintFor({ farmerId: farmer.id, landId: land?.id, image: imageBuffer });
    const existing = await findCropDetectionByFingerprint(farmer.id, submissionFingerprint);
    if (existing) {
      await removeUploadedFile(req.file);
      return res.status(200).json(resultFor({ detection: existing, farmer, land, provider }));
    }

    const activeJob = inFlightScans.get(submissionFingerprint);
    if (activeJob) {
      await removeUploadedFile(req.file);
      return res.status(200).json(await activeJob);
    }

    const job = (async () => {
      const landContext = land ? { landName: land.name, cropTypes: land.crop_types } : {};
      const analysis = getCachedAnalysis(submissionFingerprint) || await identifyCropDamage(imageBuffer, req.file.mimetype, landContext);
      if (!analysis) throw detectionError("Gemini did not return a usable crop analysis. This photo was not saved; try again with a clear crop image.", 502, "GEMINI_EMPTY_ANALYSIS");
      cacheAnalysis(submissionFingerprint, analysis);
      const crop = primaryCrop(analysis);
      const imageFile = `/uploads/crop-detections/${req.file.filename}`;
      let detection;
      try {
        detection = await createCropDetection({
          farmerId: farmer.id, landId: land?.id, imageFile, imageMimeType: req.file.mimetype,
          cropName: crop.cropName, scientificName: crop.scientificName,
          detectedCrops: analysis.identifiedCrops || [], confidence: analysis.confidence,
          boundingBoxes: analysis.boundingBoxes || [], growthStage: analysis.growthStage || null,
          healthStatus: analysis.healthStatus || null, possibleIssues: analysis.weedsPestsProblems || [],
          recommendations: [analysis.reportRecommendation, ...(farmInformation({ farmer, land, cropName: crop.cropName }).recommendations || [])].filter(Boolean),
          analysis, modelName: analysis.modelName || provider.model, modelVersion: analysis.modelName || provider.model,
          validationStatus: "foundation_model_not_crop_validated", submissionFingerprint,
        });
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          const duplicate = await findCropDetectionByFingerprint(farmer.id, submissionFingerprint);
          if (duplicate) { analyzedButUnsaved.delete(submissionFingerprint); return resultFor({ detection: duplicate, farmer, land, provider }); }
        }
        throw detectionError("The crop was analyzed, but its record could not be saved. Click Detect again to save the same photo without repeating analysis.", 503, "CROP_DETECTION_SAVE_FAILED");
      }
      analyzedButUnsaved.delete(submissionFingerprint);
      return resultFor({ detection, analysis, farmer, land, provider });
    })();

    inFlightScans.set(submissionFingerprint, job);
    try {
      const result = await job;
      res.status(201).json(result);
    } finally {
      if (inFlightScans.get(submissionFingerprint) === job) inFlightScans.delete(submissionFingerprint);
    }
  } catch (error) {
    await removeUploadedFile(req.file);
    next(error);
  }
}

export async function history(req, res, next) {
  try {
    const farmer = await getFarmerByUserId(req.user.id);
    if (!farmer) return res.status(404).json({ message: "A farmer profile was not found." });
    res.json({ detections: await listCropDetections(farmer.id, req.query.search) });
  } catch (error) { next(error); }
}

export async function remove(req, res, next) {
  try {
    const farmer = await getFarmerByUserId(req.user.id);
    if (!farmer) return res.status(404).json({ message: "A farmer profile was not found." });
    const detection = await deleteCropDetection(farmer.id, req.params.id);
    if (!detection) return res.status(404).json({ message: "Detection record was not found." });
    await fs.unlink(path.join(cropUploadsDirectory, path.basename(detection.image_file))).catch(() => {});
    res.json({ deletedId: detection.id });
  } catch (error) { next(error); }
}
