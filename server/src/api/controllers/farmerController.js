import { getFarmerByProfileId, getFarmerByUserId, listFarmers, updateRegistration } from "../models/farmerModel.js";
import { createLand, deleteLand, listLandMeasurements, listLandsByFarmer, updateLand } from "../models/landModel.js";
import { publishRealtimeUpdate } from "../services/realtimeService.js";
import { measureFarmBoundary } from "../services/farmGeometry.js";
import { listCropDetections } from "../models/cropDetectionModel.js";
import { listReports } from "../models/reportModel.js";

function mappingFromBody(body) {
  const raw = body.boundaryGeojson || body.boundary;
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === "string") { try { parsed = JSON.parse(raw); } catch { throw Object.assign(new Error("Farm boundary data is not valid JSON."), { status: 422 }); } }
  const measured = measureFarmBoundary(parsed);
  const accuracy = body.gpsAccuracyM === "" || body.gpsAccuracyM == null ? null : Number(body.gpsAccuracyM);
  if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 500)) throw Object.assign(new Error("GPS accuracy must be between 0 and 500 meters."), { status: 422 });
  return { ...measured, gpsAccuracyM: accuracy, quality: accuracy == null ? "manual" : accuracy <= 10 ? "good" : accuracy <= 20 ? "fair" : "low" };
}

function cropTypesFromBody(value) { return Array.isArray(value) ? value : String(value || "").split(",").map(item => item.trim()).filter(Boolean); }

export async function myProfile(req, res, next) {
  try { const profile = await getFarmerByUserId(req.user.id); res.json({ profile, lands: profile ? await listLandsByFarmer(profile.id) : [] }); } catch (error) { next(error); }
}
export async function addLand(req, res, next) {
  try {
    const profile = await getFarmerByUserId(req.user.id);
    if (!profile) return res.status(404).json({ message: "Farmer profile was not found." });
    const mapping = mappingFromBody(req.body);
    const land = await createLand({ ...req.body, farmerId: profile.id, cropTypes: cropTypesFromBody(req.body.cropTypes), ...(mapping ? { mapping, latitude: mapping.latitude, longitude: mapping.longitude, sizeHectares: mapping.areaHectares } : {}), ownershipProofFile: req.file ? `/uploads/${req.file.filename}` : null });
    publishRealtimeUpdate("land.created");
    res.status(201).json({ land });
  } catch (error) { next(error); }
}
export async function editLand(req, res, next) {
  try {
    const profile = await getFarmerByUserId(req.user.id);
    if (!profile) return res.status(404).json({ message: "Farmer profile was not found." });
    const current = (await listLandsByFarmer(profile.id)).find(item => String(item.id) === String(req.params.id));
    if (!current) return res.status(404).json({ message: "Land record was not found for your account." });
    const mapping = mappingFromBody(req.body);
    if (!mapping) return res.status(422).json({ message: "Add a valid measured or manually placed farm boundary before saving." });
    const land = await updateLand(profile.id, current.id, {
      name: req.body.name ?? current.name, address: req.body.address ?? current.address,
      barangay: req.body.barangay ?? current.barangay, municipality: req.body.municipality ?? current.municipality,
      province: req.body.province ?? current.province, region: req.body.region ?? current.region,
      cropTypes: req.body.cropTypes === undefined ? current.crop_types : cropTypesFromBody(req.body.cropTypes),
      notes: req.body.notes ?? current.notes, mapping,
    });
    publishRealtimeUpdate("land.updated");
    res.json({ land });
  } catch (error) { next(error); }
}
export async function removeLand(req, res, next) {
  try {
    const profile = await getFarmerByUserId(req.user.id);
    if (!profile) return res.status(404).json({ message: "Farmer profile was not found." });
    const removed = await deleteLand(profile.id, req.params.id);
    if (!removed) return res.status(404).json({ message: "Land record was not found for your account." });
    publishRealtimeUpdate("land.deleted");
    res.json({ message: "Land record deleted." });
  } catch (error) {
    if (["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"].includes(error.code)) return res.status(409).json({ message: "This land is linked to a damage report and cannot be deleted. You can still edit or remap it." });
    next(error);
  }
}
export async function landMeasurementHistory(req, res, next) {
  try {
    const profile = await getFarmerByUserId(req.user.id);
    if (!profile) return res.status(404).json({ message: "Farmer profile was not found." });
    const measurements = await listLandMeasurements(profile.id, req.params.id);
    if (!measurements.length) {
      const landExists = (await listLandsByFarmer(profile.id)).some(item => String(item.id) === String(req.params.id));
      if (!landExists) return res.status(404).json({ message: "Land record was not found for your account." });
    }
    res.json({ measurements });
  } catch (error) { next(error); }
}
export async function registrations(req, res, next) { try { res.json({ farmers: await listFarmers(req.query.status) }); } catch (error) { next(error); } }
export async function farmerDirectoryDetail(req, res, next) {
  try {
    const farmer = await getFarmerByProfileId(req.params.id);
    if (!farmer) return res.status(404).json({ message: "Farmer account was not found." });
    const [lands, detections, reports] = await Promise.all([listLandsByFarmer(farmer.id), listCropDetections(farmer.id), listReports({ farmerId: farmer.id })]);
    res.json({ farmer, lands, detections, reports });
  } catch (error) { next(error); }
}
export async function reviewRegistration(req, res, next) {
  try {
    const { status, notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(422).json({ message: "Status must be approved or rejected." });
    const farmer = await updateRegistration(req.params.id, status, req.user.id, notes);
    if (!farmer) return res.status(404).json({ message: "Registration was not found." });
    publishRealtimeUpdate("registration.reviewed");
    res.json({ farmer });
  } catch (error) { next(error); }
}
