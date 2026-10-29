import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { api } from "../services/api.js";

const constraints = [{ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, { video: true, audio: false }];
const localTypes = {
  apple: ["Apple", "fruit"], banana: ["Banana", "fruit"], orange: ["Orange", "fruit"], broccoli: ["Broccoli", "vegetable"], carrot: ["Carrot", "vegetable"],
  "potted plant": ["Potted plant", "ornamental plant"], cow: ["Cow", "livestock"], sheep: ["Sheep", "livestock"], horse: ["Horse", "livestock"], bird: ["Bird", "animal"], dog: ["Dog", "animal"], cat: ["Cat", "animal"],
  truck: ["Truck", "vehicle"], car: ["Car", "vehicle"], motorcycle: ["Motorcycle", "vehicle"], bicycle: ["Bicycle", "vehicle"], person: ["Person", "person"],
  "sports ball": ["Round object", "general object"], backpack: ["Backpack", "general object"], umbrella: ["Umbrella", "general object"], chair: ["Chair", "general object"], bottle: ["Bottle", "general object"],
};

function objectInfo(detection) {
  const [label, category] = localTypes[detection.class] || [detection.class, "general object"];
  return { ...detection, label, category };
}

function message(error) {
  if (!navigator.mediaDevices?.getUserMedia) return "This browser does not support camera access. Upload a photo instead.";
  if (["NotAllowedError", "SecurityError"].includes(error?.name)) return "Camera permission was blocked. Allow camera access for this site, then try again.";
  if (error?.name === "NotFoundError") return "No camera was found. Connect or enable a camera, then try again.";
  if (error?.name === "NotReadableError") return "Windows or the camera driver did not release the camera. Check Settings > Privacy & security > Camera, then restart this site.";
  return "Unable to start the camera. Please try again or upload a photo instead.";
}

export default function CameraDetector({ onCapture, onAnalysis, token }) {
  const videoRef = useRef(null), canvasRef = useRef(null), streamRef = useRef(null), modelRef = useRef(null), animationRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [objects, setObjects] = useState([]);
  const [photo, setPhoto] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [photoFacts, setPhotoFacts] = useState(null);
  useEffect(() => () => stop(), []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  function stop() {
    cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOpen(false);
  }
  async function getStream() {
    let lastError;
    for (const option of constraints) {
      try { return await navigator.mediaDevices.getUserMedia(option); }
      catch (cameraError) { lastError = cameraError; if (["NotAllowedError", "SecurityError"].includes(cameraError.name)) throw cameraError; }
    }
    throw lastError;
  }
  async function start() {
    setError(""); setObjects([]); setAnalysis(null); setAnalysisNotice("");
    if (!window.isSecureContext) { setError("Camera access only works on HTTPS or localhost. Open the app on localhost, or use an HTTPS address on your phone."); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError(message()); return; }
    setOpen(true);
    try {
      await new Promise(requestAnimationFrame);
      const stream = await getStream(); streamRef.current = stream;
      if (!videoRef.current) throw new Error("Preview unavailable");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      await tf.ready();
      modelRef.current ||= await cocoSsd.load({ base: "lite_mobilenet_v2" });
      detect();
    } catch (cameraError) { stop(); setError(message(cameraError)); }
  }
  async function detect() {
    if (!streamRef.current || !videoRef.current?.videoWidth || !modelRef.current) return;
    try {
      const found = (await modelRef.current.detect(videoRef.current, 16)).map(objectInfo);
      setObjects(found.slice(0, 6));
      const canvas = canvasRef.current, video = videoRef.current;
      if (!canvas) return;
      canvas.width = video.clientWidth; canvas.height = video.clientHeight;
      const context = canvas.getContext("2d"), scaleX = canvas.width / video.videoWidth, scaleY = canvas.height / video.videoHeight;
      context.clearRect(0, 0, canvas.width, canvas.height); context.lineWidth = 3; context.font = "bold 13px sans-serif";
      found.forEach(item => {
        const [left, top, width, height] = item.bbox;
        context.strokeStyle = context.fillStyle = ["fruit", "vegetable", "field crop", "tree crop"].includes(item.category) ? "#facc15" : "#bef264";
        context.strokeRect(left * scaleX, top * scaleY, width * scaleX, height * scaleY);
        context.fillText(`${item.label} ${Math.round(item.score * 100)}%`, left * scaleX + 4, Math.max(15, top * scaleY - 5));
      });
    } catch { setError("Live labels paused. You can still capture a photo for the detailed crop scan."); }
    if (streamRef.current) animationRef.current = requestAnimationFrame(detect);
  }
  async function analyzePhoto(file, currentObjects) {
    setAnalyzing(true); setAnalysis(null); setAnalysisNotice("");
    try {
      const body = new FormData(); body.append("photo", file);
      const landId = document.querySelector("select[name='landId']")?.value;
      const reportedCrop = document.querySelector("select[name='confirmedPlant']")?.value;
      const reportedDamageType = document.querySelector("select[name='confirmedDamageType']")?.value;
      const farmerNotes = document.querySelector("textarea[name='farmerNotes']")?.value;
      if (landId) body.append("landId", landId);
      if (reportedCrop) body.append("reportedCrop", reportedCrop);
      if (reportedDamageType) body.append("reportedDamageType", reportedDamageType);
      if (farmerNotes) body.append("farmerNotes", farmerNotes.slice(0, 1000));
      const result = await api("/vision/analyze", { token, method: "POST", body });
      setAnalysis(result.analysis);
      setAnalysisNotice(result.notice || (!landId ? "Identified without a selected land. Select your land before sending the final report so MAO can compare the crop record." : ""));
      onCapture(file, currentObjects, result.analysis);
      onAnalysis?.(result.analysis);
    } catch (scanError) {
      setAnalysisNotice(scanError.message || "AI analysis could not be reached. The camera photo is still attached for MAO review.");
      onCapture(file, currentObjects, null);
    } finally { setAnalyzing(false); }
  }
  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth) { setError("Wait for the camera preview before capturing."); return; }
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `crop-scan-${Date.now()}.jpg`, { type: "image/jpeg" });
      setPhoto(URL.createObjectURL(blob));
      setPhotoFacts({ width: video.videoWidth, height: video.videoHeight });
      stop();
      // Attach evidence immediately. AI may take longer or be unavailable, but
      // a valid captured photo must never be lost from the farmer's report.
      onCapture(file, objects, null);
      analyzePhoto(file, objects);
    }, "image/jpeg", 0.92);
  }
  function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose a JPG, PNG, or WebP farm photo."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("The farm photo must be 8 MB or smaller."); return; }
    setError(""); setPhoto(URL.createObjectURL(file)); setPhotoFacts(null); stop();
    onCapture(file, [], null);
    analyzePhoto(file, []);
  }
  function retake() { setPhoto(""); setPhotoFacts(null); setAnalysis(null); setAnalysisNotice(""); setError(""); start(); }
  const cropLabels = analysis?.detectedItems?.filter(item => ["fruit", "vegetable", "field crop", "tree crop"].includes(item.category)) || [];
  return <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 sm:col-span-2">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-emerald-950">Crop and farm-damage camera</p><p className="mt-1 max-w-xl text-xs leading-5 text-emerald-800">Capture a clear crop or farm-area photo. The scan identifies likely plants from visible features and checks separately for visible evidence of flood, fire, pests, disease, drought, wind, animal damage, or landslide.</p></div><div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-lg border border-emerald-700 bg-white px-3 py-2 text-xs font-bold text-emerald-800"><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadPhoto}/>Upload farm photo</label><button type="button" onClick={open ? stop : start} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">{open ? "Stop camera" : "Open back camera"}</button></div></div>
    <div className="mt-3 grid gap-2 text-xs text-emerald-900 sm:grid-cols-3"><p className="rounded-lg bg-white/70 p-2"><b>1. Crop / farm:</b> show the affected area</p><p className="rounded-lg bg-white/70 p-2"><b>2. Distance:</b> 30–80 cm, no blur</p><p className="rounded-lg bg-white/70 p-2"><b>3. Damage:</b> show the affected area</p></div>
    {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
    {open && <><div className="relative mt-4 overflow-hidden rounded-xl bg-black"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover"/><canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full"/></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-emerald-800">{objects.length ? `Basic live labels: ${objects.map(item => item.label).join(", ")}` : "Preparing live scene labels…"}</p><button type="button" onClick={capture} disabled={analyzing} className="rounded-lg bg-lime-300 px-3 py-2 text-xs font-extrabold text-emerald-950 disabled:opacity-60">Capture and analyze damage</button></div></>}
    {photo && <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3"><div className="relative overflow-hidden rounded-lg bg-black"><img src={photo} alt="Captured farm evidence" className="max-h-80 w-full object-contain"/><AnalysisRegions regions={analysis?.damageRegions} tone="damage"/><AnalysisRegions regions={analysis?.boundingBoxes} tone="crop"/></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{photoFacts ? `${photoFacts.width} × ${photoFacts.height} capture` : "Captured photo"}</span><button type="button" onClick={retake} className="rounded-lg border border-emerald-200 px-3 py-1.5 font-bold text-emerald-700 hover:bg-emerald-50">Retake photo</button></div>{analysis?.damageRegions?.length > 0 && <p className="mt-2 text-xs font-medium text-red-700">Red boxes mark AI-identified visible damage regions. They are approximate and need MAO verification.</p>}</div>}
    {analyzing && <p className="mt-3 rounded-lg bg-sky-50 p-3 text-xs font-bold text-sky-900">Analyzing crop type, fruit/vegetable category, visible plant part, condition, and possible damage…</p>}
    {analysisNotice && <p className={`mt-3 rounded-lg p-2 text-xs leading-5 ${analysis ? "bg-amber-50 text-amber-900" : "bg-white/80 text-slate-600"}`}>{analysisNotice}</p>}
    {analysis && <CropAnalysisCard analysis={analysis} cropLabels={cropLabels}/>} 
  </section>;
}

function AnalysisRegions({ regions, tone }) {
  if (!regions?.length) return null;
  const style = tone === "damage" ? "border-red-500 bg-red-500/10 text-red-950" : "border-lime-300 bg-lime-300/10 text-lime-950";
  return regions.map((region, index) => {
    const [yMin, xMin, yMax, xMax] = region.box || [];
    if (![yMin, xMin, yMax, xMax].every(Number.isFinite)) return null;
    return <span key={`${tone}-${index}`} className={`pointer-events-none absolute border-2 ${style}`} style={{ left: `${xMin / 10}%`, top: `${yMin / 10}%`, width: `${(xMax - xMin) / 10}%`, height: `${(yMax - yMin) / 10}%` }}><b className="absolute left-0 top-0 max-w-full -translate-y-full truncate rounded bg-white/90 px-1 py-0.5 text-[9px]">{region.label}</b></span>;
  });
}

function CropAnalysisCard({ analysis, cropLabels }) {
  const noDamage = analysis.possibleDamageType === "No obvious damage detected";
  return <div className="mt-3 rounded-xl border border-sky-200 bg-white p-4 text-xs">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-extrabold text-emerald-950">Crop and farm-damage analysis</p>
        <p className="mt-1 text-slate-500">AI advisory only. MAO Staff verifies the final report.</p>
      </div>
      <div className="flex flex-wrap gap-2"><span className="rounded-full bg-sky-100 px-2.5 py-1 font-extrabold text-sky-800">{Math.round((analysis.confidence || 0) * 100)}% crop confidence</span><span className="rounded-full bg-amber-100 px-2.5 py-1 font-extrabold text-amber-900">{Math.round((analysis.damageConfidence || 0) * 100)}% damage confidence</span></div>
    </div>
    {analysis.qualityCheck === "needs_clearer_photo" && <p className="mt-3 rounded-lg bg-amber-50 p-2 font-semibold text-amber-900">The plant or damage is not clear enough to assess safely. Retake or upload a closer, well-lit photo.</p>}
    {analysis.identificationUncertain && analysis.cropOrPlant !== "Unknown" && <p className="mt-3 rounded-lg bg-amber-50 p-2 font-semibold text-amber-900">Likely plant match; exact species is uncertain. Review the evidence and alternatives below.</p>}
    {noDamage && <p className="mt-3 rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-900">No obvious damage was found in this photo. This does not confirm that the whole farm is healthy; MAO review and field checks may still be needed.</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <ScanFact label="Identified crop / item" value={analysis.cropOrPlant || "Unknown"}/>
      <ScanFact label="Visible farm damage" value={analysis.possibleDamageType || "Unknown"}/>
      <ScanFact label="Estimated severity" value={analysis.damageSeverity || "Unknown"}/>
      <ScanFact label="Affected area" value={analysis.affectedAreaEstimate || "Not measurable from this image"}/>
      <ScanFact label="Affected plants / regions" value={analysis.affectedPlantCount || "Not measurable from this image"}/>
      <ScanFact label="Visual condition" value={analysis.healthStatus || "Not assessable"}/>
    </div>
    {analysis.identificationReason && <p className="mt-3 rounded-lg bg-slate-50 p-3 leading-5 text-slate-700"><b>Identification evidence:</b> {analysis.identificationReason}</p>}
    {analysis.visibleFeatures?.length > 0 && <AnalysisList label="Visible plant features" values={analysis.visibleFeatures}/>}
    {analysis.alternativeCandidates?.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-950"><b>Alternative plant matches:</b> {analysis.alternativeCandidates.join(", ")}</p>}
    {cropLabels.length > 0 && <div className="mt-3"><p className="font-bold text-slate-700">Crop / produce found in photo</p><div className="mt-2 flex flex-wrap gap-2">{cropLabels.map((item, index) => <span key={`${item.label}-${index}`} className="rounded-full bg-lime-100 px-2.5 py-1 font-bold text-lime-900">{item.label} - {Math.round((item.confidence || 0) * 100)}%</span>)}</div></div>}
    <AnalysisList label="Visible evidence" values={analysis.damageEvidence}/>
    <AnalysisList label="Visible symptoms" values={analysis.visibleSymptoms}/>
    <AnalysisList label="Visible pests or farm issues" values={analysis.weedsPestsProblems}/>
    <AnalysisList label="Possible causes (not confirmed)" values={analysis.possibleCauses}/>
    <AnalysisList label="Recommended immediate actions" values={analysis.recommendedActions}/>
    <AnalysisList label="Prevention and recovery" values={analysis.preventionRecovery}/>
    <p className="mt-3 rounded-lg bg-emerald-50 p-3 leading-5 text-emerald-950"><b>Report suggestion:</b> {analysis.reportSuggestion}<br/><b>Recommended next step:</b> {analysis.reportRecommendation}</p>
    <FullVisionReport report={analysis.formattedReport}/>
    {analysis.evidenceToCapture?.length > 0 && <p className="mt-3 text-slate-600"><b>For a better report, also capture:</b> {analysis.evidenceToCapture.join(", ")}</p>}
  </div>;
}
function AnalysisList({ label, values }) {
  if (!values?.length) return null;
  return <div className="mt-3"><p className="font-bold text-slate-700">{label}</p><ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">{values.map((value, index) => <li key={`${label}-${index}`}>{value}</li>)}</ul></div>;
}
function FullVisionReport({ report }) {
  if (!report) return null;
  return <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
    <summary className="cursor-pointer font-bold text-slate-800">Open full agricultural vision report</summary>
    <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-5 text-slate-700">{report}</pre>
  </details>;
}
function ScanFact({ label, value }) { return <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-bold capitalize text-slate-800">{value}</p></div>; }

function LegacyCameraDetector({ onCapture, token }) {
  const videoRef = useRef(null), canvasRef = useRef(null), streamRef = useRef(null), modelRef = useRef(null), animationRef = useRef(null);
  const [open, setOpen] = useState(false), [error, setError] = useState(""), [objects, setObjects] = useState([]), [photo, setPhoto] = useState(""), [analysis, setAnalysis] = useState(null), [analyzing, setAnalyzing] = useState(false), [analysisNotice, setAnalysisNotice] = useState("");
  useEffect(() => () => stop(), []);

  function stop() {
    cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOpen(false);
  }

  async function getStream() {
    let lastError;
    for (const option of constraints) {
      try { return await navigator.mediaDevices.getUserMedia(option); }
      catch (error) { lastError = error; if (["NotAllowedError", "SecurityError"].includes(error.name)) throw error; }
    }
    throw lastError;
  }

  async function start() {
    setError(""); setObjects([]); setAnalysis(null); setAnalysisNotice("");
    if (!navigator.mediaDevices?.getUserMedia) { setError(message()); return; }
    setOpen(true);
    try {
      await new Promise(requestAnimationFrame);
      const stream = await getStream(); streamRef.current = stream;
      if (!videoRef.current) throw new Error("Preview unavailable");
      videoRef.current.srcObject = stream; await videoRef.current.play();
      await tf.ready(); modelRef.current ||= await cocoSsd.load({ base: "lite_mobilenet_v2" }); detect();
    } catch (cameraError) { stop(); setError(message(cameraError)); }
  }

  async function detect() {
    if (!streamRef.current || !videoRef.current?.videoWidth || !modelRef.current) return;
    try {
      const found = (await modelRef.current.detect(videoRef.current, 16)).map(objectInfo);
      setObjects(found.slice(0, 6));
      const canvas = canvasRef.current, video = videoRef.current;
      if (!canvas) return;
      canvas.width = video.clientWidth; canvas.height = video.clientHeight;
      const context = canvas.getContext("2d"), scaleX = canvas.width / video.videoWidth, scaleY = canvas.height / video.videoHeight;
      context.clearRect(0, 0, canvas.width, canvas.height); context.lineWidth = 3; context.font = "bold 13px sans-serif";
      found.forEach(item => {
        const [left, top, width, height] = item.bbox;
        context.strokeStyle = context.fillStyle = item.category === "fruit" || item.category === "vegetable" ? "#facc15" : "#bef264";
        context.strokeRect(left * scaleX, top * scaleY, width * scaleX, height * scaleY);
        context.fillText(`${item.label} (${item.category}) ${Math.round(item.score * 100)}%`, left * scaleX + 4, Math.max(15, top * scaleY - 5));
      });
    } catch { setError("Camera is open but live detection paused. You can still capture a report photo."); }
    if (streamRef.current) animationRef.current = requestAnimationFrame(detect);
  }

  async function analyzePhoto(file, currentObjects) {
    setAnalyzing(true); setAnalysis(null); setAnalysisNotice("");
    try {
      const body = new FormData(); body.append("photo", file);
      // The API validates this land against the signed-in farmer before using
      // its registered crop types as analysis context.
      const landId = document.querySelector("select[name='landId']")?.value;
      const reportedCrop = document.querySelector("select[name='confirmedPlant']")?.value;
      const reportedDamageType = document.querySelector("select[name='confirmedDamageType']")?.value;
      const farmerNotes = document.querySelector("textarea[name='farmerNotes']")?.value;
      if (!landId) {
        setAnalysisNotice("Select one of your registered lands before capturing so the crop analysis can compare the image with that land's crop records.");
        onCapture(file, currentObjects, null);
        return;
      }
      if (landId) body.append("landId", landId);
      if (reportedCrop) body.append("reportedCrop", reportedCrop);
      if (reportedDamageType) body.append("reportedDamageType", reportedDamageType);
      if (farmerNotes) body.append("farmerNotes", farmerNotes.slice(0, 1000));
      const result = await api("/vision/analyze", { token, method: "POST", body });
      setAnalysis(result.analysis); setAnalysisNotice(result.notice || ""); onCapture(file, currentObjects, result.analysis);
    } catch (error) { setAnalysisNotice(error.message || "AI analysis could not be reached. Your camera photo is still ready for MAO review."); onCapture(file, currentObjects, null); }
    finally { setAnalyzing(false); }
  }

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth) { setError("Wait for the camera preview before capturing a photo."); return; }
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `camera-report-${Date.now()}.jpg`, { type: "image/jpeg" });
      setPhoto(URL.createObjectURL(blob)); analyzePhoto(file, objects);
    }, "image/jpeg", .9);
  }

  return <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 sm:col-span-2">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><b className="text-sm text-emerald-950">Farm camera</b><p className="mt-1 max-w-xl text-xs leading-5 text-emerald-800">Live scan recognizes general scene types. Capture a clear photo for detailed AI identification of fruits, vegetables, crops, trees, tools, equipment, and visible damage.</p></div><button type="button" onClick={open ? stop : start} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">{open ? "Stop camera" : "Open camera"}</button></div>
    {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
    {open && <><div className="relative mt-4 overflow-hidden rounded-xl bg-black"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover"/><canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full"/></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-emerald-800">{objects.length ? `Live scan: ${objects.map(item => `${item.label} (${item.category})`).join(", ")}` : "Scanning scene objects..."}</p><button type="button" onClick={capture} className="rounded-lg bg-lime-300 px-3 py-2 text-xs font-bold text-emerald-950">Capture & analyze</button></div></>}
    {photo && <img src={photo} alt="Captured report evidence" className="mt-4 max-h-72 w-full rounded-xl bg-black object-contain"/>}
    {analyzing && <p className="mt-3 text-xs font-bold text-emerald-800">Using crop-aware AI to analyze the captured photo: fruit, vegetable, crop, tree, objects, and visible damage...</p>}
    {analysisNotice && <p className={`mt-3 rounded-lg p-2 text-xs leading-5 ${analysis ? "bg-amber-50 text-amber-900" : "bg-white/80 text-slate-600"}`}>{analysisNotice}</p>}
    {analysis && <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950"><p><b>Report suggestion:</b> {analysis.reportSuggestion}</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><p><b>Land crop match:</b> {analysis.registeredCropMatch}</p><p><b>Suggested urgency:</b> {analysis.urgency}</p></div>{analysis.evidenceToCapture?.length > 0 && <p className="mt-2"><b>Also capture:</b> {analysis.evidenceToCapture.join(", ")}</p>}</div>}
    {analysis && <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-xs"><p className="font-bold text-emerald-900">Captured-photo analysis - needs MAO verification</p>{analysis.qualityCheck === "needs_clearer_photo" && <p className="mt-2 rounded-lg bg-amber-50 p-2 font-semibold text-amber-900">Low visual certainty: the system will not name a fruit, vegetable, or crop until the photo is clearer.</p>}<p className="mt-2 text-slate-700"><b>Image summary:</b> {analysis.imageSummary}</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><p className="text-slate-700"><b>Main subject:</b> {analysis.cropOrPlant} ({analysis.category})</p><p className="text-slate-700"><b>Scene:</b> {analysis.sceneType} - {Math.round(analysis.confidence * 100)}% confidence</p></div>{analysis.detectedItems?.length > 0 && <p className="mt-2 text-slate-700"><b>Detected in photo:</b> {analysis.detectedItems.map(item => `${item.label} (${item.category})`).join(", ")}</p>}<p className="mt-2 text-slate-700"><b>Possible damage:</b> {analysis.possibleDamageType}</p>{analysis.visibleSymptoms?.length > 0 && <p className="mt-1 text-slate-600"><b>Visible symptoms:</b> {analysis.visibleSymptoms.join(", ")}</p>}<p className="mt-2 rounded-lg bg-emerald-50 p-2 text-emerald-900"><b>Next step:</b> {analysis.reportRecommendation}</p></div>}
  </section>;
}
