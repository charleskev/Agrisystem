import { pool } from "../../config/db.js";
export async function findUserByContact(contactNumber) { const [rows] = await pool.query("SELECT * FROM users WHERE contact_number = ?", [contactNumber]); return rows[0] || null; }
export async function findUserByEmail(email) { const [rows] = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [String(email || "").trim()]); return rows[0] || null; }
export async function findUserByGoogleSubject(subject) { const [rows] = await pool.query("SELECT * FROM users WHERE google_sub = ? LIMIT 1", [subject]); return rows[0] || null; }
export async function linkGoogleSubject(userId, subject) { const [result] = await pool.query("UPDATE users SET google_sub = ? WHERE id = ? AND google_sub IS NULL", [subject, userId]); return result.affectedRows === 1; }
export async function findUserById(id) { const [rows] = await pool.query("SELECT id, full_name, contact_number, email, role, is_active, created_at FROM users WHERE id = ?", [id]); return rows[0] || null; }
export async function createUser({ fullName, contactNumber, email, passwordHash, role = "farmer" }, db = pool) { const [result] = await db.query("INSERT INTO users (full_name, contact_number, email, password_hash, role) VALUES (?, ?, ?, ?, ?)", [fullName, contactNumber, email || null, passwordHash, role]); return { id: result.insertId, full_name: fullName, contact_number: contactNumber, email: email || null, role }; }
export async function listUsers(role) {
  if (role === "farmer") {
    const [rows] = await pool.query("SELECT u.id, u.full_name, u.contact_number, u.email, u.role, u.is_active, u.created_at, fp.id AS farmer_profile_id, fp.barangay, fp.registration_status, COUNT(l.id) AS land_count FROM users u LEFT JOIN farmer_profiles fp ON fp.user_id = u.id LEFT JOIN lands l ON l.farmer_id = fp.id WHERE u.role = 'farmer' GROUP BY u.id, fp.id ORDER BY u.created_at DESC");
    return rows;
  }
  const [rows] = await pool.query("SELECT id, full_name, contact_number, email, role, is_active, created_at FROM users ORDER BY created_at DESC");
  return rows;
}
export async function updateUserAdministration(id, { role, isActive }) { const fields = [], values = []; if (role !== undefined) { fields.push("role = ?"); values.push(role); } if (isActive !== undefined) { fields.push("is_active = ?"); values.push(isActive ? 1 : 0); } if (!fields.length) return findUserById(id); values.push(id); const [result] = await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values); return result.affectedRows ? findUserById(id) : null; }
export async function updateUserPassword(id, passwordHash) { await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]); }
