const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

function networkMessage(error) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return "The request took too long. Check your connection and try again.";
  return "Cannot reach the AgriSystem server. Keep the backend running, check your connection, then try again.";
}

export async function api(path, { token, ...options } = {}) {
  const isFormData = options.body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
    });
  } catch (error) {
    throw new Error(networkMessage(error));
  }
  const raw = await response.text();
  let result = {};
  if (raw) {
    try { result = JSON.parse(raw); }
    catch {
      if (!response.ok) throw new Error("The server returned an unexpected response. Check that the AgriSystem backend is running and the API URL is configured correctly.");
      throw new Error("The server returned an unreadable response. Please try again.");
    }
  }
  if (!response.ok) throw new Error(result.message || (response.status === 401 ? "Your session is invalid or expired. Please sign in again." : "Request failed."));
  return result;
}
