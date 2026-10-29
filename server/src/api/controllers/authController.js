import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db.js";
import { createFarmerProfile } from "../models/farmerModel.js";
import { createLand } from "../models/landModel.js";
import { createUser, findUserByContact, findUserByEmail, updateUserPassword } from "../models/userModel.js";
import { isSmsConfigured, sendPasswordResetCode } from "../services/smsService.js";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { googleClientId, isGoogleSignInConfigured, verifyGoogleIdToken } from "../services/googleIdentityService.js";
import { publishRealtimeUpdate } from "../services/realtimeService.js";
import { isMaintenanceMode } from "../../models/systemSettingModel.js";

function tokenFor(user) { return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" }); }
const normalizeContact = value => String(value || "").replace(/\D/g, "");
const normalizePhilippineContact = value => { const digits = normalizeContact(value); return /^639\d{9}$/.test(digits) ? `0${digits.slice(2)}` : digits; };
const normalizeEmail = value => String(value || "").trim().toLowerCase();
const isEmail = value => /^\S+@\S+\.\S+$/.test(normalizeEmail(value));
const resetSecret = () => process.env.JWT_SECRET || "agrisystem-development-reset-secret-change-me";
const secureHash = value => createHmac("sha256", resetSecret()).update(String(value)).digest("hex");
// Registration only needs a provisional land pin. Farmers can set a precise
// farm coordinate later from My Profile & Land using their device GPS.
const bongabongCenter = { latitude: 12.7517, longitude: 121.4869 };

export async function register(req, res, next) {
  let client;
  try {
    if (await isMaintenanceMode()) return res.status(503).json({ message: "AgriSystem is temporarily in maintenance mode. New registrations are paused." });
    const { fullName, email, password, address, barangay, landName, landAddress, landBarangay, sizeHectares, cropTypes } = req.body;
    const contactNumber = normalizeContact(req.body.contactNumber);
    if (!fullName || !contactNumber || !email || !password || !address || !landName || !sizeHectares || !cropTypes) return res.status(422).json({ message: "Complete your account, Gmail address, and first land details before registering." });
    if (!/^09\d{9}$/.test(contactNumber)) return res.status(422).json({ message: "Enter an active Philippine mobile number in the format 09XXXXXXXXX. This number can be used for sign-in and SMS password recovery." });
    if (!isEmail(email)) return res.status(422).json({ message: "Enter a valid Gmail or email address." });
    if (!Number.isFinite(Number(sizeHectares))) return res.status(422).json({ message: "Enter a valid land size." });
    if (!req.files?.profilePhoto?.[0] || !req.files?.ownershipProof?.[0]) return res.status(422).json({ message: "A profile photo and a photo of the land title or ownership proof are required." });
    if (await findUserByContact(contactNumber)) return res.status(409).json({ message: "That contact number is already registered." });
    if (await findUserByEmail(email)) return res.status(409).json({ message: "That email address is already registered." });
    client = await pool.getConnection();
    await client.beginTransaction();
    const user = await createUser({ fullName, contactNumber, email: normalizeEmail(email), passwordHash: await bcrypt.hash(password, 12) }, client);
    const profile = await createFarmerProfile({ userId: user.id, address, barangay, profilePhoto: `/uploads/${req.files.profilePhoto[0].filename}` }, client);
    const land = await createLand({ farmerId: profile.id, name: landName, address: landAddress || address, barangay: landBarangay || barangay, latitude: bongabongCenter.latitude, longitude: bongabongCenter.longitude, sizeHectares, cropTypes: String(cropTypes).split(",").map(item => item.trim()).filter(Boolean), ownershipProofFile: `/uploads/${req.files.ownershipProof[0].filename}` }, client);
    await client.commit();
    publishRealtimeUpdate("registration.created");
    res.status(201).json({ message: "Farmer account created successfully. Please sign in using your Gmail address or mobile number. Your application will remain pending until MAO Staff review it.", user: { id: user.id, full_name: user.full_name, contact_number: user.contact_number, email: user.email, role: user.role }, profile, land });
  } catch (error) {
    if (client) await client.rollback().catch(() => {});
    next(error);
  } finally { client?.release(); }
}

export async function login(req, res, next) {
  try {
    const { password } = req.body;
    const loginId = String(req.body.loginId || req.body.contactNumber || "");
    const user = isEmail(loginId) ? await findUserByEmail(loginId) : await findUserByContact(normalizeContact(loginId));
    // Compatibility for the one initial-admin setup session that received the
    // terminal Enter key as part of its hidden password. This lets that admin
    // sign in once with the intended password and keeps normal logins unchanged.
    const suppliedPassword = String(password || "");
    const matchesNormalPassword = user && await bcrypt.compare(suppliedPassword, user.password_hash);
    const legacyPasswordVariants = [`${suppliedPassword}\n`, `${suppliedPassword}\r`, `${suppliedPassword}\r\n`];
    const matchesLegacyInitialAdminPassword = user && !matchesNormalPassword && user.role === "admin" && (await Promise.all(legacyPasswordVariants.map(value => bcrypt.compare(value, user.password_hash)))).some(Boolean);
    const matchesPassword = matchesNormalPassword || matchesLegacyInitialAdminPassword;
    if (!user || !matchesPassword) return res.status(401).json({ message: "Invalid email/mobile number or password." });
    if (matchesLegacyInitialAdminPassword) await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(suppliedPassword, 12), user.id]);
    if (!user.is_active) return res.status(403).json({ message: "This account has been disabled." });
    if (user.role !== "admin" && await isMaintenanceMode()) return res.status(503).json({ message: "AgriSystem is temporarily in maintenance mode. Please try again later." });
    res.json({ token: tokenFor(user), user: { id: user.id, fullName: user.full_name, role: user.role, contactNumber: user.contact_number } });
  } catch (error) { next(error); }
}

export async function requestPasswordReset(req, res, next) {
  try {
    const phone = normalizePhilippineContact(req.body.contactNumber || req.body.loginId || "");
    if (!/^09\d{9}$/.test(phone)) return res.status(422).json({ message: "Enter a valid registered Philippine mobile number." });
    const ipKey = secureHash(`ip:${req.ip || req.socket.remoteAddress || "unknown"}`);
    const phoneKey = secureHash(`phone:${phone}`);
    const [limits] = await pool.query("SELECT limit_key, request_count, last_requested_at FROM sms_request_limits WHERE limit_key IN (?, ?)", [ipKey, phoneKey]);
    if (limits.some(row => Number(row.request_count) >= 5 || Date.now() - new Date(row.last_requested_at).getTime() < 60_000)) return res.status(429).json({ message: "Please wait before requesting another verification code." });
    for (const key of [ipKey, phoneKey]) await pool.query("INSERT INTO sms_request_limits (limit_key, last_requested_at, request_count, window_started_at) VALUES (?, NOW(), 1, NOW()) ON DUPLICATE KEY UPDATE request_count = IF(window_started_at < DATE_SUB(NOW(), INTERVAL 1 HOUR), 1, request_count + 1), window_started_at = IF(window_started_at < DATE_SUB(NOW(), INTERVAL 1 HOUR), NOW(), window_started_at), last_requested_at = NOW()", [key]);
    const generic = { message: "If that account is registered, a verification code has been sent." };
    if (!isSmsConfigured()) return res.status(503).json({ message: "SMS recovery is temporarily unavailable. Please contact the Municipal Agriculture Office." });
    const user = await findUserByContact(phone);
    if (!user || !user.is_active || user.role !== "farmer") return res.json(generic);
    const code = String(randomInt(100000, 1_000_000));
    const connection = await pool.getConnection();
    let insertedId;
    try {
      await connection.beginTransaction();
      await connection.query("UPDATE password_reset_codes SET consumed_at = NOW() WHERE user_id = ? AND consumed_at IS NULL", [user.id]);
      const [result] = await connection.query("INSERT INTO password_reset_codes (user_id, code_hash, expires_at, request_ip_hash) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), ?)", [user.id, secureHash(code), ipKey]);
      insertedId = result.insertId;
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    try {
      const delivery = await sendPasswordResetCode(user.contact_number, code);
      await pool.query("INSERT INTO sms_logs (recipient_user_id, recipient_number, message_type, provider_message_id, status) VALUES (?, ?, 'password_reset', ?, ?)", [user.id, phone, delivery.messageId, delivery.status]);
    } catch (error) {
      await pool.query("UPDATE password_reset_codes SET consumed_at = NOW() WHERE id = ?", [insertedId]);
      await pool.query("INSERT INTO sms_logs (recipient_user_id, recipient_number, message_type, status, failure_code) VALUES (?, ?, 'password_reset', 'failed', ?)", [user.id, phone, error.code || "PROVIDER_ERROR"]);
      // Keep the response identical for registered and unregistered numbers.
      return res.json(generic);
    }
    res.json(generic);
  } catch (error) { next(error); }
}

export async function verifyPasswordReset(req, res, next) {
  try {
    const phone = normalizePhilippineContact(req.body.contactNumber || "");
    const code = String(req.body.code || "");
    if (!/^09\d{9}$/.test(phone) || !/^\d{6}$/.test(code)) return res.status(422).json({ message: "Enter the registered mobile number and six-digit code." });
    const user = await findUserByContact(phone);
    const [rows] = user ? await pool.query("SELECT * FROM password_reset_codes WHERE user_id = ? AND consumed_at IS NULL AND expires_at > NOW() AND attempts < 5 ORDER BY created_at DESC LIMIT 1", [user.id]) : [[]];
    const reset = rows[0];
    const candidate = Buffer.from(secureHash(code));
    const expected = Buffer.from(reset?.code_hash || secureHash(randomBytes(32).toString("hex")));
    const valid = Boolean(user && reset && timingSafeEqual(candidate, expected));
    if (!valid) {
      if (reset) await pool.query("UPDATE password_reset_codes SET attempts = attempts + 1, consumed_at = IF(attempts + 1 >= 5, NOW(), consumed_at) WHERE id = ?", [reset.id]);
      return res.status(422).json({ message: "The reset code is invalid, expired, or has already been used." });
    }
    const token = randomBytes(32).toString("base64url");
    await pool.query("UPDATE password_reset_codes SET verified_at = NOW(), reset_token_hash = ?, reset_token_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ? AND consumed_at IS NULL", [secureHash(token), reset.id]);
    res.json({ resetToken: token, message: "Code verified. Choose a new password." });
  } catch (error) { next(error); }
}

export async function confirmPasswordReset(req, res, next) {
  let connection;
  try {
    const token = String(req.body.resetToken || "");
    const password = String(req.body.password || "");
    if (token.length < 40 || password.length < 8 || password.length > 128) return res.status(422).json({ message: "Enter a valid reset session and a password between 8 and 128 characters." });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT id, user_id FROM password_reset_codes WHERE reset_token_hash = ? AND verified_at IS NOT NULL AND reset_token_expires_at > NOW() AND consumed_at IS NULL FOR UPDATE", [secureHash(token)]);
    if (!rows.length) { await connection.rollback(); return res.status(422).json({ message: "The reset session is invalid or expired. Request a new code." }); }
    await connection.query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(password, 12), rows[0].user_id]);
    await connection.query("UPDATE password_reset_codes SET consumed_at = NOW(), reset_token_hash = NULL WHERE id = ?", [rows[0].id]);
    await connection.commit();
    res.json({ message: "Password reset complete. You can now sign in." });
  } catch (error) { if (connection) await connection.rollback().catch(() => {}); next(error); }
  finally { connection?.release(); }
}

export function googleSignInConfig(_req, res) { res.json({ enabled: isGoogleSignInConfigured(), clientId: googleClientId() || null }); }

export async function googleLogin(req, res, next) {
  try {
    const identity = await verifyGoogleIdToken(req.body.credential);
    const user = await findUserByEmail(identity.email);
    if (!user) return res.status(404).json({ message: "No AgriSystem account is registered with this Google email. Create a farmer account first." });
    if (!user.is_active) return res.status(403).json({ message: "This account has been disabled." });
    if (user.role !== "admin" && await isMaintenanceMode()) return res.status(503).json({ message: "AgriSystem is temporarily in maintenance mode. Please try again later." });
    res.json({ token: tokenFor(user), user: { id: user.id, fullName: user.full_name, role: user.role, contactNumber: user.contact_number } });
  } catch (error) { next(error); }
}

export async function googleProfile(req, res, next) {
  try { res.json({ profile: await verifyGoogleIdToken(req.body.credential) }); } catch (error) { next(error); }
}

export async function currentUser(req, res) { res.json({ user: req.user }); }
