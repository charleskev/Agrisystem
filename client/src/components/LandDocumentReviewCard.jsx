import { useState } from "react";
import PrivateFile from "./PrivateFile.jsx";
import { api } from "../services/api.js";

function statusStyle(status) {
  return status === "verified" ? "bg-emerald-50 text-emerald-800" : status === "rejected" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800";
}

function documentType(mime) {
  return mime === "application/pdf" ? "PDF document" : mime === "image/png" ? "PNG image" : mime === "image/jpeg" ? "JPG image" : "Land title / ownership proof";
}

export default function LandDocumentReviewCard({ land, farmerName, token, showMap = false }) {
  const [status, setStatus] = useState(land.ownership_proof_status || "pending");
  const [remarks, setRemarks] = useState(land.ownership_proof_review_notes || "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const mapped = Number.isFinite(Number(land.latitude)) && Number.isFinite(Number(land.longitude));
  const mapUrl = mapped ? `https://www.openstreetmap.org/?mlat=${land.latitude}&mlon=${land.longitude}#map=16/${land.latitude}/${land.longitude}` : null;

  async function saveReview(event) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      await api(`/admin/lands/${land.id}/document-review`, { token, method: "PATCH", body: JSON.stringify({ status, remarks }) });
      setNotice("Document review saved.");
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  }

  return <article className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="font-extrabold text-slate-900">{land.name || "Farm land"}</p><p className="mt-1 text-xs text-slate-500">{farmerName}</p><p className="mt-1 text-slate-600">{land.size_hectares || "—"} hectares · {(land.crop_types || []).join(", ") || "Crop not specified"}</p><p className="mt-1 text-xs text-slate-500">{land.barangay || "Location not set"}{mapped ? ` · ${land.latitude}, ${land.longitude}` : " · No coordinates"}</p></div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusStyle(status)}`}>{status}</span>
    </div>
    {land.ownership_proof_url ? <>
      <dl className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2"><div><dt className="font-semibold text-slate-400">Document type</dt><dd className="mt-1 text-slate-700">{documentType(land.ownership_proof_mime_type)}</dd></div><div><dt className="font-semibold text-slate-400">Uploaded</dt><dd className="mt-1 text-slate-700">{land.ownership_proof_uploaded_at ? new Date(land.ownership_proof_uploaded_at).toLocaleString() : "Date not recorded"}</dd></div>{land.ownership_proof_original_name && <div className="sm:col-span-2"><dt className="font-semibold text-slate-400">Original filename</dt><dd className="mt-1 break-all text-slate-700">{land.ownership_proof_original_name}</dd></div>}</dl>
      <div className="mt-3"><PrivateFile token={token} url={land.ownership_proof_url} mimeType={land.ownership_proof_mime_type || ""} label={`${farmerName || "Farmer"} · ${land.name || "Land title"}`}/></div>
      <form onSubmit={saveReview} className="mt-4 border-t border-slate-100 pt-4"><div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]"><label className="text-xs font-bold text-slate-700">Document status<select value={status} onChange={event => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></label><label className="text-xs font-bold text-slate-700">Review notes<textarea value={remarks} onChange={event => setRemarks(event.target.value)} maxLength="2000" rows="2" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Optional notes for the review record"/></label></div><div className="mt-3 flex flex-wrap items-center gap-3"><button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Save document review"}</button>{notice && <span role="status" className="text-xs font-semibold text-emerald-800">{notice}</span>}{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</div></form>
    </> : <p className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">No land title or ownership document was uploaded for this farm.</p>}
    {showMap && mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold text-sky-700">Open map →</a>}
  </article>;
}
