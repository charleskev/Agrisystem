import { useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";

let scriptPromise;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      scriptPromise = undefined;
      reject(new Error("Google Sign-In could not be loaded. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function clearFlow(flow) {
  if (!flow) return;
  clearTimeout(flow.timeout);
  clearTimeout(flow.returnTimeout);
  window.removeEventListener("blur", flow.onBlur);
  window.removeEventListener("focus", flow.onFocus);
  document.removeEventListener("visibilitychange", flow.onVisibilityChange);
}

export default function GoogleSignInButton({ purpose = "login", onLogin, onProfile, onError }) {
  const hostRef = useRef(null);
  const latestPropsRef = useRef({ purpose, onLogin, onProfile, onError });
  const flowRef = useRef(null);
  const mountedRef = useRef(false);
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [status, setStatus] = useState("");

  latestPropsRef.current = { purpose, onLogin, onProfile, onError };

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    api("/auth/google/config")
      .then(value => { if (active) setConfig(value); })
      .catch(error => { if (active) setConfigError(error.message); })
      .finally(() => { if (active) setConfigLoading(false); });
    return () => {
      active = false;
      mountedRef.current = false;
      clearFlow(flowRef.current);
      flowRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!config?.enabled || !config.clientId || !host) return undefined;
    let active = true;
    let renderedWidth = 0;

    function beginFlow() {
      if (flowRef.current) return;
      const flow = { credentialReceived: false, leftPage: false };
      flowRef.current = flow;
      latestPropsRef.current.onError?.("");
      if (mountedRef.current) {
        setGoogleLoading(true);
        setStatus("Waiting for Google sign-in…");
      }

      const cancelIfReturned = () => {
        if (!flow.leftPage || flow.credentialReceived || flowRef.current !== flow) return;
        clearTimeout(flow.returnTimeout);
        flow.returnTimeout = setTimeout(() => {
          if (flowRef.current !== flow || flow.credentialReceived) return;
          clearFlow(flow);
          flowRef.current = null;
          if (mountedRef.current) {
            setGoogleLoading(false);
            setStatus("Google sign-in was cancelled. Select Continue with Google to try again.");
          }
        }, 900);
      };
      flow.onBlur = () => { flow.leftPage = true; };
      flow.onFocus = cancelIfReturned;
      flow.onVisibilityChange = () => {
        if (document.visibilityState === "hidden") flow.leftPage = true;
        else cancelIfReturned();
      };
      window.addEventListener("blur", flow.onBlur);
      window.addEventListener("focus", flow.onFocus);
      document.addEventListener("visibilitychange", flow.onVisibilityChange);
      flow.timeout = setTimeout(() => {
        if (flowRef.current !== flow || flow.credentialReceived) return;
        clearFlow(flow);
        flowRef.current = null;
        if (mountedRef.current) {
          setGoogleLoading(false);
          setStatus("Google sign-in timed out. Please try again.");
        }
      }, 120_000);
    }

    async function handleCredential(response) {
      const flow = flowRef.current;
      if (!response?.credential) {
        clearFlow(flow);
        flowRef.current = null;
        if (mountedRef.current) {
          setGoogleLoading(false);
          setStatus("Google sign-in was cancelled. Select Continue with Google to try again.");
        }
        return;
      }
      if (flow) {
        flow.credentialReceived = true;
        clearTimeout(flow.returnTimeout);
      }
      if (mountedRef.current) setStatus("Verifying your Google account…");

      try {
        const current = latestPropsRef.current;
        const result = await api(current.purpose === "login" ? "/auth/google/login" : "/auth/google/profile", {
          method: "POST",
          body: JSON.stringify({ credential: response.credential })
        });
        if (current.purpose === "login") current.onLogin?.(result);
        else current.onProfile?.(result.profile);
        if (mountedRef.current && current.purpose !== "login") setStatus("Google profile loaded.");
      } catch (error) {
        latestPropsRef.current.onError?.(error.message);
        if (mountedRef.current) setStatus("");
      } finally {
        clearFlow(flow);
        flowRef.current = null;
        if (mountedRef.current) setGoogleLoading(false);
      }
    }

    loadGoogleScript().then(() => {
      if (!active || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: config.clientId, callback: handleCredential });

      const render = () => {
        if (!active || !hostRef.current) return;
        const width = Math.max(200, Math.min(400, Math.floor(hostRef.current.clientWidth || 320)));
        if (width === renderedWidth) return;
        renderedWidth = width;
        hostRef.current.replaceChildren();
        window.google.accounts.id.renderButton(hostRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: latestPropsRef.current.purpose === "login" ? "continue_with" : "signup_with",
          shape: "rectangular",
          width,
          click_listener: beginFlow
        });
      };

      render();
      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(render);
        observer.observe(host);
        host.__agrisystemGoogleObserver = observer;
      } else {
        window.addEventListener("resize", render);
        host.__agrisystemGoogleResize = render;
      }
    }).catch(error => {
      if (!active) return;
      setConfigError(error.message);
    });

    return () => {
      active = false;
      host.__agrisystemGoogleObserver?.disconnect();
      delete host.__agrisystemGoogleObserver;
      if (host.__agrisystemGoogleResize) window.removeEventListener("resize", host.__agrisystemGoogleResize);
      delete host.__agrisystemGoogleResize;
      host.replaceChildren();
    };
  }, [config]);

  if (configLoading) return <p role="status" className="text-center text-xs text-slate-500">Preparing Google Sign-In…</p>;
  if (configError) return <p role="status" className="text-center text-xs leading-5 text-slate-500">Google Sign-In is unavailable: {configError}</p>;
  if (!config?.enabled) return <p className="text-center text-xs leading-5 text-slate-500">Google Sign-In is unavailable until MAO configures its Google OAuth Client ID.</p>;

  return <div className="space-y-1.5" aria-busy={googleLoading}>
    <div ref={hostRef} className="flex w-full justify-center" aria-label="Continue with Google" />
    {googleLoading && <p role="status" aria-live="polite" className="text-center text-xs text-slate-500">{status}</p>}
    {!googleLoading && status && <p role="status" aria-live="polite" className="text-center text-xs leading-5 text-slate-500">{status}</p>}
  </div>;
}
