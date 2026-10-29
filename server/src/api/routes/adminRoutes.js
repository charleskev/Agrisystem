import { Router } from "express";
import { farmerDirectoryDetail, registrations, reviewRegistration } from "../controllers/farmerController.js";
import { listFarmers } from "../models/farmerModel.js";
import { listUsers, updateUserAdministration } from "../models/userModel.js";
import { pool } from "../../config/db.js";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { publishRealtimeUpdate } from "../services/realtimeService.js";
import { getNewReviewCounts, markReviewItemsSeen } from "../models/reviewIndicatorModel.js";
import bcrypt from "bcrypt";
const router = Router();
const parseJsonValue = (value, fallback) => { if (value == null || typeof value === "object") return value ?? fallback; try { return JSON.parse(value); } catch { return fallback; } };
router.use(authenticate, allowRoles("admin", "staff"));
router.get("/registrations", registrations);
router.get("/review-indicators", async (req, res, next) => { try { res.json(await getNewReviewCounts(req.user.id)); } catch (error) { next(error); } });
router.post("/review-indicators/:type/mark-seen", async (req, res, next) => { try { const counts = await markReviewItemsSeen(req.user.id, req.params.type); if (!counts) return res.status(422).json({ message: "Unknown review queue." }); res.json({ counts }); } catch (error) { next(error); } });
router.get("/registrations/:id", farmerDirectoryDetail);
router.patch("/registrations/:id", reviewRegistration);
router.get("/farmers", async (_req, res, next) => { try { res.json({ farmers: await listFarmers("approved") }); } catch (error) { next(error); } });
router.get("/farm-activity", async (_req, res, next) => { try {
  const [farms] = await pool.query(`SELECT l.id, l.farmer_id, l.name, l.address, l.barangay, l.municipality, l.province, l.latitude, l.longitude, l.crop_types, l.size_hectares, l.area_square_meters, l.area_acres, l.perimeter_meters, l.boundary_geojson, l.measurement_quality, l.gps_accuracy_m, l.created_at, u.full_name AS farmer_name, u.contact_number, fp.registration_status, (SELECT COUNT(*) FROM crop_detections d WHERE d.land_id = l.id) AS scan_count, (SELECT COUNT(*) FROM damage_reports dr WHERE dr.land_id = l.id) AS report_count FROM lands l JOIN farmer_profiles fp ON fp.id = l.farmer_id JOIN users u ON u.id = fp.user_id ORDER BY u.full_name, l.name, l.id`);
  res.json({ farms: farms.map(farm => ({ ...farm, crop_types: parseJsonValue(farm.crop_types, []), boundary_geojson: parseJsonValue(farm.boundary_geojson, null) })) });
} catch (error) { next(error); } });
router.get("/farmers/:id", farmerDirectoryDetail);
router.get("/users", async (req, res, next) => { try { res.json({ users: await listUsers(req.user.role === "admin" ? req.query.role : "farmer") }); } catch (error) { next(error); } });
router.get("/system-summary", allowRoles("admin"), async (_req, res, next) => { try { const [[counts], [roles], [registrations], [recentReports]] = await Promise.all([pool.query("SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM farmer_profiles) AS farmers, (SELECT COUNT(*) FROM lands) AS lands, (SELECT COUNT(*) FROM damage_reports) AS reports, (SELECT COUNT(*) FROM damage_reports WHERE status = 'pending') AS pending_reports"), pool.query("SELECT role, COUNT(*) AS total FROM users GROUP BY role"), pool.query("SELECT registration_status AS status, COUNT(*) AS total FROM farmer_profiles GROUP BY registration_status"), pool.query("SELECT status, COUNT(*) AS total FROM damage_reports GROUP BY status")]); res.json({ counts, roles, registrations, reports: recentReports }); } catch (error) { next(error); } });
router.patch("/users/:id", allowRoles("admin"), async (req, res, next) => { try { const { role, isActive } = req.body; if (role === undefined && isActive === undefined) return res.status(422).json({ message: "Choose an account role or status to update." }); if (String(req.params.id) === String(req.user.id) && isActive === false) return res.status(422).json({ message: "You cannot disable your own account." }); if (String(req.params.id) === String(req.user.id) && role !== undefined && role !== "admin") return res.status(422).json({ message: "You cannot remove your own administrator role." }); if (role !== undefined && !["farmer", "staff", "technician", "admin"].includes(role)) return res.status(422).json({ message: "Choose a valid account role." }); if (isActive !== undefined && typeof isActive !== "boolean") return res.status(422).json({ message: "Account status must be true or false." }); const user = await updateUserAdministration(req.params.id, { role, isActive }); if (!user) return res.status(404).json({ message: "User was not found." }); await pool.query("INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, details) VALUES (?, 'user.access_updated', 'user', ?, ?)", [req.user.id, String(req.params.id), JSON.stringify({ ...(role === undefined ? {} : { role }), ...(isActive === undefined ? {} : { is_active: isActive }) })]); publishRealtimeUpdate("user.updated"); res.json({ user }); } catch (error) { next(error); } });
router.post("/staff", allowRoles("admin"), async (req, res, next) => { try {
  const fullName = String(req.body.fullName || "").trim();
  const contactNumber = String(req.body.contactNumber || "").replace(/\D/g, "");
  const email = String(req.body.email || "").trim().toLowerCase() || null;
  const password = String(req.body.password || "");
  const role = req.body.role || "staff";
  if (fullName.length < 2 || !/^09\d{9}$/.test(contactNumber) || password.length < 8 || !["staff", "technician", "admin"].includes(role)) return res.status(422).json({ message: "Enter a name, a valid 09 mobile number, a password of at least 8 characters, and a valid admin or staff role." });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return res.status(422).json({ message: "Enter a valid email address." });
  const [existing] = await pool.query("SELECT id FROM users WHERE contact_number = ? OR (email IS NOT NULL AND LOWER(email) = LOWER(?))", [contactNumber, email || ""]);
  if (existing.length) return res.status(409).json({ message: "That mobile number or email is already in use." });
  const [result] = await pool.query("INSERT INTO users (full_name, contact_number, email, password_hash, role) VALUES (?, ?, ?, ?, ?)", [fullName, contactNumber, email, await bcrypt.hash(password, 12), role]);
  await pool.query("INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, details) VALUES (?, ?, 'user', ?, ?)", [req.user.id, `${role}.account_created`, String(result.insertId), JSON.stringify({ full_name: fullName, role })]);
  publishRealtimeUpdate("user.updated");
  res.status(201).json({ user: { id: result.insertId, full_name: fullName, contact_number: contactNumber, email, role, is_active: 1 } });
} catch (error) { next(error); } });
router.get("/logs", allowRoles("admin"), async (req, res, next) => { try {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const [logs] = await pool.query("SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at, u.full_name AS actor_name, u.email AS actor_email FROM admin_audit_logs l LEFT JOIN users u ON u.id = l.actor_id ORDER BY l.created_at DESC, l.id DESC LIMIT ?", [limit]);
  res.json({ logs });
} catch (error) { next(error); } });
router.get("/settings", allowRoles("admin"), async (_req, res, next) => { try { const [rows] = await pool.query("SELECT setting_key, setting_value FROM system_settings"); res.json({ settings: Object.fromEntries(rows.map(row => [row.setting_key, row.setting_value])) }); } catch (error) { next(error); } });
router.get("/sms-preferences", allowRoles("admin"), async (_req, res, next) => { try {
  const [staff] = await pool.query("SELECT u.id, u.full_name, u.contact_number, u.role, COALESCE(p.sms_enabled, 1) AS sms_enabled, COALESCE(p.notify_new_reports, 1) AS notify_new_reports, COALESCE(p.notify_severe_reports, 1) AS notify_severe_reports FROM users u LEFT JOIN staff_notification_preferences p ON p.user_id = u.id WHERE u.role IN ('staff','technician','admin') ORDER BY u.full_name");
  res.json({ staff });
} catch (error) { next(error); } });
router.put("/sms-preferences", allowRoles("admin"), async (req, res, next) => { try {
  if (!Array.isArray(req.body.staff)) return res.status(422).json({ message: "Provide staff notification settings." });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of req.body.staff) {
      const id = Number(item.id);
      const number = String(item.contactNumber || "").replace(/\D/g, "");
      if (!Number.isSafeInteger(id) || !/^09\d{9}$/.test(number) || [item.smsEnabled, item.notifyNewReports, item.notifySevereReports].some(value => typeof value !== "boolean")) throw Object.assign(new Error("Each staff member needs a valid 09 mobile number and notification preferences."), { status: 422 });
      const [result] = await connection.query("UPDATE users SET contact_number = ? WHERE id = ? AND role IN ('staff','technician','admin')", [number, id]);
      if (!result.affectedRows) { const [[exists]] = await connection.query("SELECT id FROM users WHERE id = ? AND role IN ('staff','technician','admin')", [id]); if (!exists) throw Object.assign(new Error("A staff account was not found."), { status: 404 }); }
      await connection.query("INSERT INTO staff_notification_preferences (user_id, sms_enabled, notify_new_reports, notify_severe_reports, updated_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE sms_enabled = VALUES(sms_enabled), notify_new_reports = VALUES(notify_new_reports), notify_severe_reports = VALUES(notify_severe_reports), updated_by = VALUES(updated_by)", [id, item.smsEnabled, item.notifyNewReports, item.notifySevereReports, req.user.id]);
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  await pool.query("INSERT INTO admin_audit_logs (actor_id, action, target_type, details) VALUES (?, 'staff.sms_preferences_updated', 'staff', ?)", [req.user.id, JSON.stringify({ count: req.body.staff.length })]);
  res.json({ message: "Staff SMS preferences saved." });
} catch (error) { next(error); } });
router.put("/settings", allowRoles("admin"), async (req, res, next) => { try {
  const { office_name, support_email, maintenance_mode } = req.body;
  if (typeof office_name !== "string" || !office_name.trim() || office_name.length > 150 || typeof support_email !== "string" || (support_email && !/^\S+@\S+\.\S+$/.test(support_email)) || typeof maintenance_mode !== "boolean") return res.status(422).json({ message: "Provide a valid office name, support email, and maintenance mode setting." });
  const settings = { office_name: office_name.trim(), support_email: support_email.trim(), maintenance_mode: String(maintenance_mode) };
  for (const [key, value] of Object.entries(settings)) await pool.query("INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)", [key, value, req.user.id]);
  await pool.query("INSERT INTO admin_audit_logs (actor_id, action, target_type, details) VALUES (?, 'system.settings_updated', 'system', ?)", [req.user.id, JSON.stringify({ office_name: settings.office_name, maintenance_mode })]);
  res.json({ settings });
} catch (error) { next(error); } });
export default router;
