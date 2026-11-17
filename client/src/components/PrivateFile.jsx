import { useEffect, useState } from "react";
import { apiUrl } from "../services/api.js";

export async function fetchPrivateFile(url, token) {
  let response;
  try {
    response = await fetch(apiUrl(url), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error("Could not reach the file server. Check your connection and try again.");
  }
  if (!response.ok) {
    let message = "This file could not be opened. Refresh the page and try again.";
    try { message = (await response.json()).message || message; } catch { /* response may not contain JSON */ }
    throw new Error(message);
  }
  return {
    blob: await response.blob(),
    mimeType: response.headers.get("content-type")?.split(";")[0] || "application/octet-stream",
    filename: parseFilename(response.headers.get("content-disposition")),
  };
}

function parseFilename(disposition) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) { try { return decodeURIComponent(encoded); } catch { /* use the plain filename */ } }
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1] || "farmer-file";
}

export default function PrivateFile({ token, url, label = "document", mimeType: expectedMime = "", variant = "actions", thumbnailClass = "" }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setLoading(true);
    setError("");
    setFile(null);
    if (!url) { setLoading(false); setError("No uploaded file is attached to this record."); return undefined; }
    fetchPrivateFile(url, token).then(result => {
      if (!active) return;
      objectUrl = URL.createObjectURL(result.blob);
      setFile({ ...result, objectUrl });
    }).catch(loadError => { if (active) setError(loadError.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, token]);

  const actualMime = file?.mimeType || expectedMime;
  const isImage = actualMime.startsWith("image/");
  function download(event) {
    event?.stopPropagation();
    if (!file) return;
    const link = document.createElement("a");
    link.href = file.objectUrl;
    link.download = file.filename || label.replace(/\s+/g, "-");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return <div className="min-w-0">
    {variant === "thumbnail" ? <button type="button" disabled={!file} onClick={() => setOpen(true)} aria-label={`View ${label}`} className={`group relative flex min-h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left disabled:cursor-wait ${thumbnailClass}`}>
      {loading ? <span className="animate-pulse text-xs text-slate-500">Loading file…</span> : error ? <span className="px-2 text-center text-[11px] font-semibold text-red-700">File unavailable</span> : isImage ? <img src={file.objectUrl} alt={label} className="h-full w-full object-cover"/> : <span className="px-3 text-center text-xs font-extrabold text-slate-600">PDF<br/>View document</span>}
    </button> : <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={!file} onClick={() => setOpen(true)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60">{loading ? "Loading document…" : "View document"}</button>
      <button type="button" disabled={!file} onClick={download} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">Download document</button>
    </div>}
    {error && <p role="alert" className="mt-2 text-xs leading-5 text-red-700">{error}</p>}
    {open && file && <div className="fixed inset-0 z-[1200] overflow-y-auto bg-slate-950/70 p-3 sm:p-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-label={label} className="mx-auto my-3 flex max-h-[94vh] max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:my-6"><header className="flex items-center justify-between gap-3 border-b border-slate-200 p-4"><div className="min-w-0"><p className="truncate font-bold text-slate-900">{label}</p><p className="mt-1 truncate text-xs text-slate-500">{file.filename}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={download} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Download</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Close</button></div></header><div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">{isImage ? <img src={file.objectUrl} alt={label} className="mx-auto max-h-[78vh] max-w-full rounded-lg object-contain"/> : actualMime === "application/pdf" ? <iframe title={label} src={file.objectUrl} className="h-[78vh] w-full rounded-lg bg-white"/> : <p className="rounded-lg bg-white p-5 text-sm text-slate-700">This file type cannot be previewed here. Download the original file to open it.</p>}</div></section></div>}
  </div>;
}
