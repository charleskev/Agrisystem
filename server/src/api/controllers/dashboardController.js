import { pool } from "../../config/db.js";
import { listReports } from "../models/reportModel.js";

export async function overview(req, res, next) {
  try {
    const [[summaryRows], [damageByCategory], [severityDistribution], reports] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(status IN ('pending','reviewing')), 0) AS pending_reports, COALESCE(SUM(status IN ('resolved','verified')), 0) AS verified_reports, COALESCE(SUM(status = 'pending'), 0) AS pending_status_reports, COALESCE(SUM(status = 'reviewing'), 0) AS under_review_reports, COALESCE(SUM(status IN ('resolved','verified')), 0) AS resolved_reports, (SELECT COUNT(*) FROM farmer_profiles) AS total_farmers, (SELECT COUNT(*) FROM lands) AS total_farms, COALESCE(SUM(ai_scan_at IS NOT NULL), 0) AS total_scans, COUNT(DISTINCT CASE WHEN COALESCE(confirmed_damage_type, ai_detected_damage_type) IS NOT NULL THEN land_id END) AS farms_with_damage, COUNT(*) AS total_reports FROM damage_reports"),
      pool.query("SELECT COALESCE(confirmed_damage_type, ai_detected_damage_type, 'Not assessed') AS label, COUNT(*) AS total FROM damage_reports GROUP BY label ORDER BY total DESC, label ASC"),
      pool.query("SELECT COALESCE(ai_damage_severity, reported_severity, 'Not assessed') AS label, COUNT(*) AS total FROM damage_reports GROUP BY label ORDER BY FIELD(label, 'Critical', 'High', 'Moderate', 'Low', 'Unknown', 'Not assessed')"),
      listReports({ status: req.query.status })
    ]);
    res.json({ summary: summaryRows[0], damageByCategory, severityDistribution, reports });
  } catch (error) { next(error); }
}
