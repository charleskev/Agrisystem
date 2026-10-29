import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { api } from "../services/api.js";

const confidence = value => value == null ? "Not available" : `${Math.round(Number(value) * 100)}%`;
const dateTime = value => value ? new Date(value).toLocaleString() : "Not available";
const maxAnalysisPhotoBytes = 8 * 1024 * 1024;
const maxAnalysisPhotoDimension = 1440;

function loadPhoto(file) {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(source); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("The selected image could not be read.")); };
    image.src = source;
  });
}

async function optimizePhotoForAnalysis(file) {
  const image = await loadPhoto(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxAnalysisPhotoDimension / Math.max(originalWidth, originalHeight));
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(originalWidth * scale));
  canvas.height = Math.max(1, Math.round(originalHeight * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .88));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "crop-photo"}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

function Notice({ children, tone = "info" }) {
  const tones = { info: "border-sky-200 bg-sky-50 text-sky-950", warning: "border-amber-200 bg-amber-50 text-amber-950", error: "border-red-200 bg-red-50 text-red-800" };
  return <p className={`mt-4 rounded-xl border p-3 text-sm leading-6 ${tones[tone]}`}>{children}</p>;
}

function Empty({ children }) { return <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{children}</p>; }

function PhotoWithBoxes({ preview, boxes = [] }) {
  return <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl bg-slate-950">
    <img src={preview} alt="Crop selected for detection" className="block max-h-[30rem] max-w-full object-contain" />
    {boxes.map((item, index) => {
      const [yMin, xMin, yMax, xMax] = item.box || [];
      if (![yMin, xMin, yMax, xMax].every(Number.isFinite)) return null;
      return <div key={`${item.label}-${index}`} className="absolute border-2 border-lime-300 shadow-[0_0_0_1px_rgba(0,0,0,.45)]" style={{ left: `${xMin / 10}%`, top: `${yMin / 10}%`, width: `${(xMax - xMin) / 10}%`, height: `${(yMax - yMin) / 10}%` }}>
        <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-lime-300 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-950">{item.label} {confidence(item.confidence)}</span>
      </div>;
    })}
  </div>;
}

function DetailCard({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold leading-5 text-slate-800">{value || "Not confirmed"}</p></div>;
}

function DetectionResult({ result, preview, onScanAnother, onSubmitDamage }) {
  if (!result) return null;
  const { detection, analysis, cropInfo, farmInfo, confidenceThreshold } = result;
  const cropIsUnknown = detection.crop_name === "Unknown Crop";
  const identificationScore = analysis?.confidenceScore ?? Math.round(Number(detection.confidence || 0) * 100);
  return <section className="mt-6 space-y-5">
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-700">Detection result</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-extrabold text-slate-950">{detection.crop_name}</h2><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-sm font-extrabold ${cropIsUnknown || analysis?.identificationUncertain ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{identificationScore}% identification confidence</span><button type="button" onClick={() => onSubmitDamage?.(detection, analysis)} className="rounded-xl bg-amber-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-amber-800">Submit Damage Report</button>{onScanAnother && <button type="button" onClick={onScanAnother} className="rounded-xl border border-emerald-700 px-3 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-50">{analysis?.needsClearerImage ? "Retake or upload another photo" : "Scan another crop"}</button>}</div></div></div>
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,.72fr)] sm:p-6"><div><PhotoWithBoxes preview={preview} boxes={analysis?.boundingBoxes || []} />{analysis?.boundingBoxes?.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-500">Boxes are approximate model localization only. They are shown only for high-confidence objects.</p>}</div><div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1"><DetailCard label="Scientific name" value={detection.scientific_name || cropInfo?.scientificName}/><DetailCard label="Growth stage" value={analysis?.growthStage || detection.growth_stage}/><DetailCard label="Visible condition" value={analysis?.healthStatus || detection.health_status}/><DetailCard label="Possible issue" value={analysis?.possibleDamageType || "Unknown"}/><DetailCard label="Image quality" value={analysis?.imageQuality || "AI was not available"}/><DetailCard label="Farm record" value={detection.land_name || farmInfo?.landName || "No land selected"}/></div></div>
      {cropIsUnknown && <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 sm:mx-6"><b>{analysis?.needsClearerImage ? "A clearer photo is needed." : "The plant could not be identified safely."}</b> Show more of one plant in focus with good light, including leaves, stem, and any flowers or fruit, then retake or upload another photo.</div>}
      {!cropIsUnknown && analysis?.identificationUncertain && <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 sm:mx-6"><b>Likely identification; please verify.</b> The common crop name is based on visible clues, but the exact species is uncertain. {analysis.identificationReason || "Review the visible evidence below."}</div>}
    </article>

    {analysis && <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-extrabold text-slate-950">Plant identification and visible evidence</h2><p className="mt-1 text-sm text-slate-600">Plant identity is assessed separately from visible symptoms. Confirm any pest, disease, or nutrient diagnosis with MAO before treatment.</p>{analysis.plantType && <p className="mt-3 text-sm text-slate-700"><b>Plant type:</b> {analysis.plantType}</p>}{analysis.identificationReason && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"><b>Why this match:</b> {analysis.identificationReason}</p>}{analysis.visibleFeatures?.length > 0 && <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm leading-6 text-sky-950"><b>Visible features:</b> {analysis.visibleFeatures.join("; ")}</p>}{analysis.alternativeCandidates?.length > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950"><b>Other possible matches:</b> {analysis.alternativeCandidates.join(", ")}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(analysis.identifiedCrops || []).map((item, index) => <article key={`${item.englishName}-${index}`} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><p className="font-bold text-slate-900">{item.englishName}</p><span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-sky-800">{confidence(item.confidence)}</span></div><p className="mt-1 text-xs text-slate-500">{item.scientificName}</p><p className="mt-3 text-sm text-slate-700"><b>Stage:</b> {item.growthStage}</p><p className="mt-1 text-sm text-slate-700"><b>Health:</b> {item.health}</p><p className="mt-2 text-xs leading-5 text-slate-500">{item.visualClues}</p></article>)}</div>{analysis.visibleSymptoms?.length > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><b>Visible symptoms:</b> {analysis.visibleSymptoms.join(", ")}</p>}{analysis.weedsPestsProblems?.length > 0 && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900"><b>Possible visible concerns:</b> {analysis.weedsPestsProblems.join(", ")}</p>}{analysis.reportRecommendation && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-950"><b>Recommended next step:</b> {analysis.reportRecommendation}</p>}</article>}

    <CropInformation cropInfo={cropInfo} />
    <FarmInformation farmInfo={farmInfo} />
  </section>;
}

function CropInformation({ cropInfo }) {
  if (!cropInfo) return <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><b>No crop guide was selected.</b> The system only shows crop care guidance when it has a usable crop name.</article>;
  if (cropInfo.availability) return <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><b>{cropInfo.commonName}:</b> {cropInfo.availability}<SourceLinks sources={cropInfo.sources}/></article>;
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-700">Crop information</p><h2 className="mt-2 text-xl font-extrabold text-slate-950">{cropInfo.commonName}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><DetailCard label="Scientific name" value={cropInfo.scientificName}/><DetailCard label="Variety" value={cropInfo.variety}/><DetailCard label="Detected stage" value={cropInfo.growthStage}/><DetailCard label="Planting and harvest" value={cropInfo.plantingAndHarvest}/><DetailCard label="Soil" value={cropInfo.soil}/><DetailCard label="Water" value={cropInfo.watering}/><DetailCard label="Sunlight" value={cropInfo.sunlight}/><DetailCard label="Fertilizer" value={cropInfo.fertilizer}/></div>{cropInfo.practices?.length > 0 && <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-bold">Recommended practices</p><ul className="mt-2 list-disc space-y-1 pl-5">{cropInfo.practices.map(item => <li key={item}>{item}</li>)}</ul></div>}<SourceLinks sources={cropInfo.sources}/></article>;
}

function SourceLinks({ sources = [] }) { return sources.length ? <p className="mt-4 text-xs text-slate-500">Sources: {sources.map((source, index) => <span key={source.url}>{index > 0 && " · "}<a className="font-bold text-emerald-700 underline" href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}</p> : null; }

function FarmInformation({ farmInfo }) {
  if (!farmInfo) return null;
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-700">Farm information</p><h2 className="mt-2 text-xl font-extrabold text-slate-950">Your saved farm context</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DetailCard label="Land" value={farmInfo.landName}/><DetailCard label="Barangay" value={farmInfo.barangay}/><DetailCard label="Land size" value={farmInfo.sizeHectares ? `${farmInfo.sizeHectares} hectares` : "Not recorded"}/><DetailCard label="Registered crops" value={farmInfo.registeredCrops?.join(", ") || "Not recorded"}/></div><div className="mt-5 rounded-xl bg-sky-50 p-4 text-sm leading-6 text-sky-950"><p className="font-bold">Farm recommendations based on saved records</p><ul className="mt-2 list-disc space-y-1 pl-5">{farmInfo.recommendations?.map(item => <li key={item}>{item}</li>)}</ul></div></article>;
}

export function CropDetectionPage({ token, onLogout }) {
  const videoRef = useRef(null);
  const uploadInputRef = useRef(null);
  const streamRef = useRef(null);
  const scanAbortRef = useRef(null);
  const scanSequenceRef = useRef(0);
  const submitLockRef = useRef(false);
  const [lands, setLands] = useState([]);
  const [landId, setLandId] = useState("");
  const [preview, setPreview] = useState("");
  const [photo, setPhoto] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [provider, setProvider] = useState(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }, []);

  const load = useCallback(async () => {
    try {
      const [profile, status] = await Promise.all([api("/farmers/me", { token }), api("/crop-detections/status", { token })]);
      setLands(profile.lands || []);
      setProvider(status.provider);
    } catch (loadError) { setError(loadError.message); }
  }, [token]);

  useEffect(() => { load(); return () => { scanAbortRef.current?.abort(); stopCamera(); }; }, [load, stopCamera]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function resetForNextScan() {
    scanSequenceRef.current += 1;
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    submitLockRef.current = false;
    stopCamera();
    setDetecting(false);
    setPreparingPhoto(false);
    setPhoto(null);
    setPreview("");
    setResult(null);
    setError("");
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  async function choosePhoto(file) {
    if (!file || detecting) return;
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) { setError("Choose a JPG, PNG, or WebP crop photo."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Choose an image smaller than 20 MB."); return; }
    scanSequenceRef.current += 1;
    const sequence = scanSequenceRef.current;
    setPreparingPhoto(true);
    setError("");
    setResult(null);
    setPhoto(null);
    setPreview("");
    try {
      const optimizedPhoto = await optimizePhotoForAnalysis(file);
      if (sequence !== scanSequenceRef.current) return;
      if (optimizedPhoto.size > maxAnalysisPhotoBytes) { setError("The optimized image is still larger than 8 MB. Choose a closer photo with a lower camera resolution."); return; }
      setPhoto(optimizedPhoto);
      setPreview(URL.createObjectURL(optimizedPhoto));
    } catch (photoError) {
      if (sequence === scanSequenceRef.current) setError(photoError.message || "The selected image could not be prepared for analysis.");
    } finally {
      if (sequence === scanSequenceRef.current) setPreparingPhoto(false);
    }
  }

  async function openCamera() {
    if (detecting || preparingPhoto) return;
    setError("");
    if (!window.isSecureContext) { setError("Camera access needs HTTPS or localhost. You can upload a crop photo instead."); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError("This browser does not support camera access. Upload a crop photo instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      await new Promise(requestAnimationFrame);
      if (!videoRef.current) { stopCamera(); return; }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (cameraError) {
      setError(cameraError.name === "NotAllowedError" ? "Camera permission was blocked. Allow access in your browser settings, then try again." : "Unable to start the camera. Upload a crop photo instead.");
      stopCamera();
    }
  }

  function capturePhoto() {
    if (detecting || preparingPhoto) return;
    const video = videoRef.current;
    if (!video?.videoWidth) { setError("Wait for the camera preview before capturing."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (blob) void choosePhoto(new File([blob], `crop-detection-${Date.now()}.jpg`, { type: "image/jpeg" }));
      stopCamera();
    }, "image/jpeg", .9);
  }

  async function submit(event) {
    event.preventDefault();
    if (submitLockRef.current || detecting || preparingPhoto) return;
    if (!photo) { setError("Open the camera or upload a crop photo before detection."); return; }
    if (!provider?.configured) { setError("AI crop analysis is not configured on the server. Add a valid Gemini key, restart the server, then try again."); return; }
    const sequence = scanSequenceRef.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 65_000);
    scanAbortRef.current = controller;
    submitLockRef.current = true;
    setDetecting(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append("photo", photo);
      if (landId) body.append("landId", landId);
      const data = await api("/crop-detections", { token, method: "POST", body, signal: controller.signal });
      if (sequence === scanSequenceRef.current) {
        setResult(data);
        setProvider(data.provider);
      }
    } catch (submitError) {
      if (sequence === scanSequenceRef.current) setError(submitError.message || "The crop scan could not be completed. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      if (scanAbortRef.current === controller) scanAbortRef.current = null;
      if (sequence === scanSequenceRef.current) {
        setDetecting(false);
        submitLockRef.current = false;
      }
    }
  }

  const controlsDisabled = detecting || preparingPhoto;
  function submitDamageReport(detection, analysis) {
    sessionStorage.setItem("agrisystem-report-draft", JSON.stringify({ id: detection.id, landId: detection.land_id, cropName: detection.crop_name, confidence: detection.confidence, damageType: analysis?.possibleDamageType, photoUrl: detection.image_url }));
    window.location.hash = "#report";
  }
  return <AppShell role="farmer" onLogout={onLogout}><PageHeader eyebrow="Crop tools" title="AI crop detection" description="Capture or upload a crop photo, review the model result and farm context, then save the real detection record." action={<a href="#crop-history" className="button !w-auto">Detection history</a>}/>{error && <Notice tone="error">{error}</Notice>}<ModelStatus provider={provider}/><form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.62fr)]"><div><p className="text-lg font-extrabold text-slate-950">1. Capture a clear crop photo</p><p className="mt-1 text-sm leading-6 text-slate-600">Use one plant, leaf, fruit, or vegetable in good light. Photos are prepared at up to 1440px before upload to reduce mobile data and analysis time.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={controlsDisabled} onClick={cameraOpen ? stopCamera : openCamera} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{cameraOpen ? "Stop camera" : "Open camera"}</button><label className={`cursor-pointer rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-bold text-emerald-800 ${controlsDisabled ? "pointer-events-none opacity-50" : ""}`}>Upload crop photo<input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={controlsDisabled} onChange={event => { void choosePhoto(event.target.files?.[0]); event.target.value = ""; }}/></label></div>{preparingPhoto && <p className="mt-3 text-sm font-semibold text-emerald-800">Preparing photo for faster analysis...</p>}{cameraOpen && <div className="mt-4 overflow-hidden rounded-xl bg-black"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover"/><div className="flex justify-center p-3"><button type="button" onClick={capturePhoto} disabled={controlsDisabled} className="rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-extrabold text-emerald-950 disabled:opacity-60">Capture photo</button></div></div>}{preview && <div className="mt-4"><PhotoWithBoxes preview={preview} boxes={result?.analysis?.boundingBoxes || []}/><button type="button" disabled={controlsDisabled} onClick={resetForNextScan} className="mt-3 text-sm font-bold text-emerald-700 underline disabled:opacity-60">Choose another photo</button></div>}</div><div className="rounded-xl bg-emerald-50 p-4"><p className="font-bold text-emerald-950">2. Associate the farm</p><p className="mt-1 text-xs leading-5 text-emerald-800">Optional. Your selected land stays selected when you scan another crop.</p><label className="mt-4 block text-sm font-semibold text-slate-700">Registered land<select value={landId} disabled={controlsDisabled} onChange={event => setLandId(event.target.value)} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm disabled:opacity-60"><option value="">No land selected</option>{lands.map(land => <option key={land.id} value={land.id}>{land.name || "Farm land"} - {land.barangay || "Barangay not set"}</option>)}</select></label><button disabled={controlsDisabled || !photo || !provider?.configured} className="button mt-5 !w-full disabled:opacity-60">{preparingPhoto ? "Preparing photo..." : detecting ? "Analyzing crop..." : provider?.configured ? "Detect crop and save record" : provider ? "AI analysis unavailable" : "Checking AI service..."}</button><p className="mt-3 text-xs leading-5 text-emerald-900">Successful scans are saved in detection history. Uncertain identifications remain advisory and show their confidence; failed scans are not saved.</p></div></div></form><DetectionResult result={result} preview={preview} onScanAnother={resetForNextScan} onSubmitDamage={submitDamageReport}/></AppShell>;
}
function ModelStatus({ provider }) {
  if (!provider) return null;
  const tone = provider.configured ? "warning" : "error";
  return <Notice tone={tone}><b>{provider.configured ? `${provider.provider} is configured (${provider.model}).` : "AI provider is not configured."}</b> {provider.configured ? provider.cropSpecificValidation?.message : "Add a valid GEMINI_API_KEY to the project's .env file (beside .env.example), then restart the server to analyze crop images. Until then, photos can only be saved as Unknown Crop."}</Notice>;
}

function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export function CropDetectionHistoryPage({ token, onLogout }) {
  const [detections, setDetections] = useState([]); const [query, setQuery] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [deleting, setDeleting] = useState("");
  const [viewing, setViewing] = useState(null);
  const load = useCallback(async (search = query) => { setLoading(true); try { setError(""); const data = await api(`/crop-detections?search=${encodeURIComponent(search)}`, { token }); setDetections(data.detections || []); } catch (loadError) { setError(loadError.message); } finally { setLoading(false); } }, [query, token]);
  useEffect(() => { load(""); }, [token]);
  useEffect(() => { if (!viewing) return undefined; const closeOnEscape = event => { if (event.key === "Escape") setViewing(null); }; window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, [viewing]);
  async function remove(id) { if (!window.confirm("Delete this crop detection record and its saved image?")) return; setDeleting(id); try { await api(`/crop-detections/${id}`, { token, method: "DELETE" }); setDetections(current => current.filter(item => item.id !== id)); } catch (removeError) { setError(removeError.message); } finally { setDeleting(""); } }
  function exportCsv() { const rows = [["Date and time", "Crop", "Scientific name", "Confidence", "Land", "Barangay", "Health status", "Possible issues"]]; detections.forEach(item => rows.push([dateTime(item.created_at), item.crop_name, item.scientific_name, item.confidence == null ? "" : item.confidence, item.land_name, item.land_barangay, item.health_status, (item.possible_issues || []).join("; ")])); const blob = new Blob([rows.map(row => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `crop-detection-history-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); }
  return <AppShell role="farmer" onLogout={onLogout}><PageHeader eyebrow="Crop tools" title="Detection history" description="Search, review, export, or delete the crop photos and model results saved to your farm profile." action={<a href="#crop-detection" className="button !w-auto">New detection</a>}/>{error && <Notice tone="error">{error}</Notice>}<section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-end"><label className="block flex-1 text-sm font-bold text-slate-700">Search records<input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); load(); } }} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal" placeholder="Crop, land, or barangay"/></label><button type="button" onClick={() => load()} className="rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-bold text-emerald-800">Search</button><button type="button" onClick={exportCsv} disabled={!detections.length} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Export CSV</button></div>{loading ? <p className="p-8 text-center text-sm text-slate-500">Loading detection history...</p> : <div className="divide-y divide-slate-100">{detections.map(item => <article key={item.id} className="grid gap-4 p-5 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"><a href={item.image_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl bg-slate-100"><img src={item.image_url} alt={`${item.crop_name} detection`} className="aspect-square h-full w-full object-cover"/></a><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold text-slate-950">{item.crop_name}</h2><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800">{confidence(item.confidence)}</span></div><p className="mt-1 text-sm text-slate-600">{item.scientific_name || "Scientific name not confirmed"}</p><p className="mt-2 text-xs text-slate-500">{item.land_name || "No land selected"} · {item.land_barangay || "Location not recorded"} · {dateTime(item.created_at)}</p><p className="mt-2 text-sm text-slate-700"><b>Health:</b> {item.health_status || "Not assessed"}</p>{item.possible_issues?.length > 0 && <p className="mt-1 text-sm text-amber-900"><b>Possible concerns:</b> {item.possible_issues.join(", ")}</p>}</div><div className="flex items-start gap-2"><button type="button" onClick={() => setViewing(item)} className="h-fit rounded-xl border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50">View</button><button type="button" onClick={() => remove(item.id)} disabled={deleting === item.id} className="h-fit rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">{deleting === item.id ? "Deleting..." : "Delete"}</button></div></article>)}{!detections.length && <Empty>No crop detection records found.</Empty>}</div>}</section>{viewing && <DetectionHistoryDialog item={viewing} onClose={() => setViewing(null)}/>}</AppShell>;
}


function DetectionHistoryDialog({ item, onClose }) {
  const analysis = item.analysis || {};
  return <div className="fixed inset-0 z-[1000] overflow-y-auto bg-slate-950/60 p-3 sm:p-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="detection-detail-title" className="mx-auto my-4 max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:my-8"><header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-700">Saved crop scan</p><h2 id="detection-detail-title" className="mt-1 text-xl font-extrabold text-slate-950">{item.crop_name}</h2><p className="mt-1 text-sm text-slate-500">{dateTime(item.created_at)}</p></div><button type="button" autoFocus onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button></header><div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]"><div><img src={item.image_url} alt={item.crop_name + " saved crop photo"} className="max-h-[34rem] w-full rounded-xl bg-slate-100 object-contain"/><a href={item.image_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-emerald-700 underline">Open original image</a>{analysis.imageSummary && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{analysis.imageSummary}</p>}</div><div className="space-y-4"><div className="grid grid-cols-2 gap-2"><DetailCard label="Confidence" value={confidence(item.confidence)}/><DetailCard label="Scientific name" value={item.scientific_name}/><DetailCard label="Health status" value={item.health_status}/><DetailCard label="Growth stage" value={item.growth_stage}/><DetailCard label="Possible damage" value={analysis.possibleDamageType}/><DetailCard label="Severity" value={analysis.damageSeverity}/><DetailCard label="Farm" value={item.land_name}/><DetailCard label="Barangay" value={item.land_barangay}/></div>{analysis.identifiedCrops?.length > 0 && <HistoryDetailList title="Identified crops" items={analysis.identifiedCrops.map(crop => crop.englishName + "  -  " + confidence(crop.confidence) + "  -  " + crop.scientificName + "  -  " + crop.growthStage + "  -  " + crop.health)}/>}{analysis.visibleSymptoms?.length > 0 && <HistoryDetailList title="Visible symptoms" items={analysis.visibleSymptoms}/>}{item.possible_issues?.length > 0 && <HistoryDetailList title="Possible concerns" items={item.possible_issues}/>}{item.recommendations?.length > 0 && <HistoryDetailList title="Recommendations" items={item.recommendations}/>}{analysis.reportRecommendation && <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><b>Next step:</b> {analysis.reportRecommendation}</p>}{!item.analysis && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This older record has no saved AI details. Its photo and recorded crop information are still available.</p>}</div></div></section></div>;
}

function HistoryDetailList({ title, items }) { return <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">{title}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{items.map((item,index)=><li key={title + index}>{item}</li>)}</ul></div>; }
