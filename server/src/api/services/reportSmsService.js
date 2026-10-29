import { pool } from "../../config/db.js";
import { normalizePhilippineMobile, sendSms } from "./smsService.js";

async function notify(report, messageType) {
  const [staff] = await pool.query(
    `SELECT u.id, u.contact_number FROM users u LEFT JOIN staff_notification_preferences p ON p.user_id = u.id WHERE u.role IN ('staff','technician','admin') AND u.is_active = 1 AND COALESCE(p.sms_enabled, 1) = 1 AND (p.user_id IS NULL OR COALESCE(p.${messageType === "damage_report_severe" ? "notify_severe_reports" : "notify_new_reports"}, 1) = 1)`
  );
  for (const person of staff) {
    const recipient = normalizePhilippineMobile(person.contact_number);
    if (!recipient) continue;
    const eventKey = `report:${report.id}:${messageType}:${recipient}`;
    const [insert] = await pool.query(
      "INSERT IGNORE INTO sms_logs (recipient_user_id, recipient_number, message_type, report_id, event_key, status) VALUES (?, ?, ?, ?, ?, 'pending')",
      [person.id, recipient, messageType, report.id, eventKey]
    );
    if (!insert.affectedRows) continue;
    const text = messageType === "damage_report_severe"
        ? `AgriSystem MAO: ${report.reported_severity || report.ai_damage_severity} farm damage alert. Report #${report.id}. Review in the MAO portal.`
        : `AgriSystem MAO: New farm damage report #${report.id}. Review in the MAO portal.`;
    let attempt = 0;
    while (attempt < 2) {
      attempt += 1;
      try {
        const [result] = await sendSms(recipient, text);
        await pool.query("UPDATE sms_logs SET status = ?, provider_message_id = ?, attempts = ? WHERE id = ?", [result.status, result.messageId, attempt, insert.insertId]);
        break;
      } catch (error) {
        const transient = ["TIMEOUT", "PROVIDER_UNAVAILABLE"].includes(error.code);
        if (attempt === 1 && transient) { await new Promise(resolve => setTimeout(resolve, 1500)); continue; }
        await pool.query("UPDATE sms_logs SET status = 'failed', failure_code = ?, attempts = ? WHERE id = ?", [error.code || "PROVIDER_ERROR", attempt, insert.insertId]);
        break;
      }
    }
  }
}

export function queueDamageReportSms(report) {
  // This work starts only after the report transaction has committed. Provider
  // latency and failures do not delay the report response or roll it back.
  setImmediate(() => {
    notify(report, "damage_report_new").catch(() => {});
    if (["High", "Critical"].includes(report.reported_severity || report.ai_damage_severity)) {
      notify(report, "damage_report_severe").catch(() => {});
    }
  });
}
