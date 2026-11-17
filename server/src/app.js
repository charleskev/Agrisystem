import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./api/routes/authRoutes.js";
import farmerRoutes from "./api/routes/farmerRoutes.js";
import reportRoutes from "./api/routes/reportRoutes.js";
import fileRoutes from "./api/routes/fileRoutes.js";
import notificationRoutes from "./api/routes/notificationRoutes.js";
import dashboardRoutes from "./api/routes/dashboardRoutes.js";
import adminRoutes from "./api/routes/adminRoutes.js";
import weatherRoutes from "./api/routes/weatherRoutes.js";
import visionRoutes from "./api/routes/visionRoutes.js";
import cropDetectionRoutes from "./api/routes/cropDetectionRoutes.js";
import realtimeRoutes from "./api/routes/realtimeRoutes.js";
import { pool } from "./config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const port = Number(process.env.PORT) || 4000;
function normalizeOrigin(value) {
  try { return new URL(value).origin; } catch { return ""; }
}
const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const allowedClientOrigins = new Set([
  ...(process.env.CLIENT_ORIGIN || (isProduction ? "" : "http://localhost:5173"))
    .split(",")
    .map(origin => normalizeOrigin(origin.trim()))
    .filter(Boolean),
  // Capacitor serves its bundled Android app from this secure WebView origin.
  normalizeOrigin("https://localhost"),
  normalizeOrigin("capacitor://localhost")
]);
function isLocalDevelopmentOrigin(origin) {
  if (isProduction) return false;
  try {
    const hostname = new URL(origin).hostname;
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
  } catch { return false; }
}
const clientDistPath = path.resolve(__dirname, "../../client/dist");

app.use(cors({ origin(origin, callback) {
  const normalizedOrigin = normalizeOrigin(origin || "");
  if (!origin || allowedClientOrigins.has(normalizedOrigin) || isLocalDevelopmentOrigin(normalizedOrigin)) return callback(null, true);
  return callback(Object.assign(new Error("Origin is not allowed by CORS."), { status: 403, code: "CORS_ORIGIN_DENIED", requestOrigin: origin }));
} }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ status: "ok", database: "connected" }); }
  catch (error) { res.status(503).json({ status: "degraded", database: "unavailable", message: "MySQL is not available. Start MySQL and run the database migration." }); }
});
app.use("/api/auth", authRoutes);
app.use("/api/farmers", farmerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/vision", visionRoutes);
app.use("/api/crop-detections", cropDetectionRoutes);
app.use("/api/realtime", realtimeRoutes);
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    const wantsPage = req.method === "GET" && req.accepts("html");
    if (wantsPage) return res.sendFile(path.join(clientDistPath, "index.html"));
    next();
  });
}
app.use((_req, res) => res.status(404).json({ message: "API endpoint not found." }));
app.use((error, _req, res, _next) => {
  if (error.code === "CORS_ORIGIN_DENIED") {
    console.warn(`[CORS] Blocked origin ${error.requestOrigin || "(unknown)"}. Configure CLIENT_ORIGIN for this frontend.`);
    return res.status(403).json({ message: "This frontend origin is not allowed. Configure CLIENT_ORIGIN on the API server." });
  }
  console.error(error);
  if (error.name === "MulterError") return res.status(422).json({ message: error.message });
  if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") return res.status(503).json({ message: "Database connection failed. Start MySQL, then run npm run migrate in the server folder." });
  if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_DB_ERROR") return res.status(503).json({ message: "Database tables are not ready. Run npm run migrate in the server folder." });
  const status = error.status || (error.code === "23505" || error.code === "ER_DUP_ENTRY" ? 409 : 500);
  const message = error.code === "23505" || error.code === "ER_DUP_ENTRY" ? "That record already exists." : error.message || "Something went wrong.";
  res.status(status).json({ message });
});

app.listen(port, () => console.log(`AgriSystem API running at http://localhost:${port}`));
