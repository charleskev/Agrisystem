import { pool } from "../../config/db.js";

export async function getLand(id) {
  const [rows] = await pool.query("SELECT id, name, latitude, longitude, mapped_at FROM lands WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function saveWeatherSnapshot(landId, weather) {
  const summary = [weather.weather?.[0]?.description, weather.main?.temp != null ? `${Math.round(weather.main.temp)}°C` : null].filter(Boolean).join(", ");
  const [result] = await pool.query("INSERT INTO weather_snapshots (land_id, condition_summary, forecast_data) VALUES (?, ?, ?)", [landId, summary || "No weather condition returned", JSON.stringify(weather)]);
  const [rows] = await pool.query("SELECT * FROM weather_snapshots WHERE id = ?", [result.insertId]);
  return rows[0];
}
