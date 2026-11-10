import bcrypt from "bcrypt";
import { pool } from "../src/config/db.js";

const fullName = String(process.env.INITIAL_ADMIN_NAME || "").trim();
const contactNumber = String(process.env.INITIAL_ADMIN_PHONE || "").replace(/\D/g, "");
const email = String(process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase() || null;
const password = String(process.env.INITIAL_ADMIN_PASSWORD || "");

function validateInput() {
  if (fullName.length < 2 || fullName.length > 150) throw new Error("INITIAL_ADMIN_NAME must contain 2–150 characters.");
  if (!/^09\d{9}$/.test(contactNumber)) throw new Error("INITIAL_ADMIN_PHONE must be a Philippine mobile number in 09XXXXXXXXX format.");
  if (password.length < 8 || password.length > 128) throw new Error("INITIAL_ADMIN_PASSWORD must contain 8–128 characters.");
  if (email && (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))) throw new Error("INITIAL_ADMIN_EMAIL must be a valid email address or blank.");
}

let connection;
try {
  validateInput();
  connection = await pool.getConnection();
  await connection.beginTransaction();

  const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1 FOR UPDATE");
  if (admins.length) {
    await connection.rollback();
    console.log("An administrator already exists. No account was changed.");
  } else {
    const [existingUsers] = await connection.query("SELECT id, role FROM users WHERE contact_number = ? LIMIT 1 FOR UPDATE", [contactNumber]);
    if (existingUsers.length) throw new Error(`That phone number is already registered as ${existingUsers[0].role}. No account was changed.`);

    if (email) {
      const [matchingEmails] = await connection.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1 FOR UPDATE", [email]);
      if (matchingEmails.length) throw new Error("That email is already registered. Use a different email or leave INITIAL_ADMIN_EMAIL blank.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await connection.query(
      "INSERT INTO users (full_name, contact_number, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 'admin', 1)",
      [fullName, contactNumber, email, passwordHash]
    );
    await connection.commit();
    console.log(`Created the first administrator account for ${contactNumber}. Sign in through the Vercel app.`);
  }
} catch (error) {
  if (connection) await connection.rollback().catch(() => {});
  console.error(`Admin setup failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  connection?.release();
  await pool.end();
}
