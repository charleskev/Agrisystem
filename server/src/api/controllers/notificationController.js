import { getFarmerByUserId, listFarmers } from "../models/farmerModel.js";
import { createNotifications, listNotifications, listSentNotifications, markRead } from "../models/notificationModel.js";
import { sendFarmerNotificationSms } from "../services/smsService.js";
import { sendFarmerNotificationEmails } from "../services/emailService.js";
import { publishRealtimeUpdate } from "../services/realtimeService.js";

const normalizeBarangay = value => String(value || "").trim().toLowerCase().replace(/^barangay\s+/, "").replace("bagumbayan", "bagong bayan").replace("santa cruz", "sta. cruz").replace("orcunoma", "orconuma").replace("polusahi", "pulosahi").replace("masagui", "masaguisi");

export async function mine(req, res, next) {
  try { const profile = await getFarmerByUserId(req.user.id); res.json({ notifications: profile ? await listNotifications(profile.id) : [] }); } catch (error) { next(error); }
}
export async function sent(req, res, next) {
  try { res.json({ announcements: await listSentNotifications(req.user.id) }); } catch (error) { next(error); }
}
export async function recipients(req, res, next) {
  try {
    const farmers = await listFarmers("approved");
    res.json({ recipients: farmers.map(({ id, full_name, barangay }) => ({ id, full_name, barangay })) });
  } catch (error) { next(error); }
}
export async function send(req, res, next) {
  try {
    const { farmerId, barangay, message, type, recipientMode = "individual" } = req.body;
    if (!message || !['benefit', 'alert'].includes(type) || !['individual', 'barangay', 'all'].includes(recipientMode)) return res.status(422).json({ message: "Choose recipients, notification type, and message." });
    const approvedFarmers = await listFarmers("approved");
    let recipients = [];
    if (recipientMode === "individual") recipients = approvedFarmers.filter(farmer => String(farmer.id) === String(farmerId));
    if (recipientMode === "barangay") recipients = approvedFarmers.filter(farmer => normalizeBarangay(farmer.barangay) === normalizeBarangay(barangay));
    if (recipientMode === "all") recipients = approvedFarmers;
    if (!recipients.length) return res.status(422).json({ message: "No approved farmers match the selected recipients." });
    const count = await createNotifications({ farmerIds: recipients.map(farmer => farmer.id), message, type, createdBy: req.user.id });
    publishRealtimeUpdate("notification.created");
    let sms = { status: "not_configured", recipients: 0 };
    try { sms = await sendFarmerNotificationSms(recipients, message); } catch { sms = { status: "failed", recipients: 0 }; }
    let email = { status: "not_configured", recipients: 0 };
    try { email = await sendFarmerNotificationEmails(recipients, message, type); } catch { email = { status: "failed", recipients: 0 }; }
    const smsMessage = ["accepted", "sent_to_network", "queued"].includes(sms.status) ? ` SMS accepted by the provider for ${sms.recipients} registered mobile number${sms.recipients === 1 ? "" : "s"}; delivery is not confirmed.` : sms.status === "not_configured" ? " Dashboard notifications were sent; SMS delivery is not configured yet." : sms.status === "no_valid_numbers" ? " Dashboard notifications were sent; no valid Philippine mobile number was available for SMS." : " Dashboard notifications were sent; the SMS gateway could not accept this batch.";
    const emailMessage = email.status === "sent" ? ` Email sent to ${email.recipients} registered Gmail/email address${email.recipients === 1 ? "" : "es"}.` : email.status === "not_configured" ? " Email delivery is not configured yet." : email.status === "no_email" ? " No recipient email address was available." : " Some or all email deliveries failed.";
    res.status(201).json({ count, sms, email, message: `Notification sent to ${count} approved farmer${count === 1 ? "" : "s"}.${smsMessage}${emailMessage}` });
  } catch (error) { next(error); }
}
export async function read(req, res, next) {
  try {
    const profile = await getFarmerByUserId(req.user.id);
    const notification = profile && await markRead(req.params.id, profile.id);
    if (!notification) return res.status(404).json({ message: "Notification was not found." });
    publishRealtimeUpdate("notification.read");
    res.json({ notification });
  } catch (error) { next(error); }
}
