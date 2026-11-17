import { useEffect, useRef } from "react";
import { apiUrl } from "../services/api.js";

// Uses an authenticated SSE stream for instant updates and a quiet fallback
// refresh in case the device temporarily loses the event connection.
export default function useRealtimeRefresh(token, refresh) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    let controller;
    let reconnectTimer;
    let lastRefresh = 0;
    const refreshNow = () => {
      if (Date.now() - lastRefresh < 600) return;
      lastRefresh = Date.now();
      refreshRef.current(true);
    };
    const connect = async () => {
      controller = new AbortController();
      try {
        const response = await fetch(apiUrl("/realtime/events"), { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok || !response.body) throw new Error("Realtime connection unavailable");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (active) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop() || "";
          messages.forEach(message => { if (message.includes("event: update")) refreshNow(); });
        }
      } catch (error) {
        if (error.name !== "AbortError") { /* Fallback interval keeps the page current. */ }
      }
      if (active) reconnectTimer = window.setTimeout(connect, 3_000);
    };
    connect();
    const fallback = window.setInterval(refreshNow, 30_000);
    const onFocus = () => refreshNow();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      controller?.abort();
      window.clearTimeout(reconnectTimer);
      window.clearInterval(fallback);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);
}
