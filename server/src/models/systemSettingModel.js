import { pool } from "../config/db.js";

export async function isMaintenanceMode() {
  try {
    const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'maintenance_mode' LIMIT 1");
    return rows[0]?.setting_value === "true";
  } catch (error) {
    // Older installations may not have applied the admin controls migration yet.
    if (error.code === "ER_NO_SUCH_TABLE") return false;
    throw error;
  }
}
