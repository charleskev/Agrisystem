import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

export function googleClientId() { return String(process.env.GOOGLE_CLIENT_ID || "").trim(); }
export function isGoogleSignInConfigured() { return Boolean(googleClientId()); }

export async function verifyGoogleIdToken(credential) {
  if (!isGoogleSignInConfigured()) {
    const error = new Error("Google Sign-In is not configured. Add GOOGLE_CLIENT_ID on the server.");
    error.status = 503;
    throw error;
  }
  if (typeof credential !== "string" || credential.length > 16_384) {
    const error = new Error("Google sign-in could not be verified. Please try again.");
    error.status = 401;
    throw error;
  }
  try {
    // verifyIdToken checks Google's signature, issuer, expiry, and this client ID audience.
    const ticket = await client.verifyIdToken({ idToken: credential, audience: googleClientId() });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      const error = new Error("Google did not provide a verified account identity.");
      error.status = 401;
      throw error;
    }
    return {
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      hostedDomain: payload.hd || null,
      fullName: payload.name || payload.given_name || "Google user"
    };
  } catch (error) {
    if (error.status) throw error;
    const invalidToken = new Error("Google sign-in could not be verified. Please try again.");
    invalidToken.status = 401;
    throw invalidToken;
  }
}
