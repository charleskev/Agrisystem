function toPhilippineMobile(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return digits;
  return null;
}

export function normalizePhilippineMobile(value) { return toPhilippineMobile(value); }
export function isSmsConfigured() { return Boolean(process.env.SEMAPHORE_API_KEY); }

export async function sendSms(number, message, { otp = false, code } = {}) {
  const recipients = String(number || "").split(",").map(toPhilippineMobile);
  if (!recipients.length || recipients.some(recipient => !recipient) || (otp && recipients.length !== 1)) throw Object.assign(new Error("Invalid Philippine mobile number."), { code: "INVALID_NUMBER" });
  if (!isSmsConfigured()) throw Object.assign(new Error("SMS is not configured on the server."), { code: "NOT_CONFIGURED" });
  const body = new URLSearchParams({ apikey: process.env.SEMAPHORE_API_KEY, number: recipients.join(","), message: String(message).slice(0, 459) });
  if (otp && code) body.set("code", String(code));
  // Sender names are accepted by Semaphore only when registered and approved on the account.
  if (process.env.SEMAPHORE_SENDER_NAME) body.set("sendername", process.env.SEMAPHORE_SENDER_NAME);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(`https://api.semaphore.co/api/v4/${otp ? "otp" : "messages"}`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: controller.signal,
    });
  } catch (error) {
    throw Object.assign(new Error(error.name === "AbortError" ? "SMS provider timed out." : "SMS provider is unavailable."), { code: error.name === "AbortError" ? "TIMEOUT" : "PROVIDER_UNAVAILABLE" });
  } finally { clearTimeout(timeout); }
  let data;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || !Array.isArray(data) || !data.length || data.some(item => String(item.status || "").toLowerCase() === "failed")) {
    const status = response.status === 429 ? "RATE_LIMITED" : "PROVIDER_REJECTED";
    throw Object.assign(new Error("Semaphore did not accept the SMS request."), { code: status });
  }
  return data.map(item => ({ messageId: item.message_id ? String(item.message_id) : null, status: String(item.status || "Pending").toLowerCase() === "sent" ? "sent_to_network" : "accepted" }));
}

export async function sendPasswordResetCode(contactNumber, code) {
  const results = await sendSms(contactNumber, "AgriSystem password reset code: {otp}. Expires in 5 minutes. Do not share it.", { otp: true, code });
  return results[0];
}

export async function sendFarmerNotificationSms(farmers, message) {
  if (!isSmsConfigured()) return { status: "not_configured", recipients: 0 };
  const recipients = [...new Set(farmers.map(farmer => toPhilippineMobile(farmer.contact_number)).filter(Boolean))];
  if (!recipients.length) return { status: "no_valid_numbers", recipients: 0 };
  const results = await sendSms(recipients.join(","), `AgriSystem MAO: ${String(message).trim()}`);
  return { status: results.some(item => item.status === "accepted") ? "accepted" : "sent_to_network", recipients: recipients.length };
}
