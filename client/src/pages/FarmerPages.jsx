import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api } from "../services/api.js";
import useRealtimeRefresh from "../hooks/useRealtimeRefresh.js";
import { Error, Input } from "./AuthPages.jsx";
import BongabongWeather from "../components/BongabongWeather.jsx";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const bongabongBarangays = ["Anilao", "Aplaya", "Bagong Bayan I", "Bagong Bayan II", "Batangan", "Bukal", "Camantigue", "Carmundo", "Cawayan", "Dayhagan", "Formon", "Hagan", "Hagupit", "Ipil", "Kaligtasan", "Labasan", "Labonan", "Libertad", "Lisap", "Luna", "Malitbog", "Mapang", "Masaguisi", "Mina de Oro", "Morente", "Ogbot", "Orconuma", "Poblacion", "Pulosahi", "Sagana", "San Isidro", "San Jose", "San Juan", "Sta. Cruz", "Sigange", "Tawas"];

function readDamageReportDraft() { try { return JSON.parse(sessionStorage.getItem("agrisystem-report-draft") || "null"); } catch { return null; } }

export function FarmerDashboard({ token, onLogout }) {
  const [lands, setLands] = useState([]); const [detections, setDetections] = useState([]); const [reports, setReports] = useState([]);
  const [farmerName, setFarmerName] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [farmData, scanData, reportData] = await Promise.all([
        api('/farmers/me', { token }), api('/crop-detections', { token }), api('/reports/mine', { token }),
      ]);
      setFarmerName(farmData.profile?.full_name || ''); setLands(farmData.lands || []); setDetections(scanData.detections || []); setReports(reportData.reports || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(token, load);
  const pending = reports.filter(report => ['pending', 'reviewing'].includes(report.status)).length;
  const totalArea = lands.reduce((total, land) => total + (Number(land.size_hectares) || 0), 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return <AppShell onLogout={onLogout}>
    <PageHeader className="farmer-dashboard-page-header" eyebrow="Farmer portal" title={`${greeting}, ${farmerName || 'Farmer'}!`} description="Here's an overview of your farm activities and recent updates." action={<a href="#report" className="button !w-auto">Report damage</a>}/>
    {error && <Message error text={error}/>}
    <section className="farmer-dashboard-hero mt-6">
      <div className="farmer-dashboard-hero-copy">
        <p className="text-xs font-bold uppercase tracking-[.16em]">Farmer action center</p>
        <h2 className="mt-2 text-xl font-extrabold">Keep your farm record ready for MAO support.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6">Complete your profile and land information first. When damage occurs, submit photos and details through a report.</p>
        <a href="#profile" className="farmer-dashboard-hero-link">Update farm record</a>
      </div>
      <img className="farmer-dashboard-illustration" src="/images/farm-dashboard.svg" alt="" aria-hidden="true"/>
    </section>
    <div className="farmer-stats-grid mt-5">
      <StatCard label="Total farms" value={lands.length}/>
      <StatCard label="Total farm area" value={`${totalArea.toFixed(2)} ha`} tone="blue"/>
      <StatCard label="Crop scans" value={detections.length}/>
      <StatCard label="Pending reports" value={pending} tone="amber"/>
    </div>
    <div className="farmer-dashboard-grid mt-5">
      <FarmerQuickActions/>
      <QuickStart pending={pending} reportCount={reports.length}/>
    </div>
    <div className="farmer-recent-grid mt-5">
      <RecentCropScans detections={detections} loading={loading}/>
      <RecentDamageReports reports={reports} loading={loading}/>
    </div>
  </AppShell>;
}

function FarmerQuickActions() {
  const actions = [
    { icon: 'scan', title: 'Scan Crop', text: 'Analyze your plants with AI', href: '#crop-detection', primary: true },
    { icon: 'map', title: 'Map a Farm', text: 'Measure and save your farm area', href: '#farm-mapping' },
    { icon: 'report', title: 'View Farm Reports', text: 'Check your farm and reports', href: '#farm-reports' },
    { icon: 'damage', title: 'Submit Damage Report', text: 'Report issues to MAO staff', href: '#report' },
  ];
  return <section className="dashboard-panel farmer-quick-actions-panel">
    <div><h2 className="font-bold text-slate-900">Quick Actions</h2><p className="mt-1 text-sm text-slate-500">Get things done faster with these common tasks.</p></div>
    <div className="farmer-quick-actions">{actions.map(action => <a key={action.title} href={action.href} className={`farmer-quick-action${action.primary ? ' farmer-quick-action-primary' : ''}`}>
      <span className="farmer-quick-action-icon" aria-hidden="true"><FarmerActionIcon name={action.icon}/></span>
      <strong>{action.title}</strong><span>{action.text}</span>
    </a>)}</div>
  </section>;
}

function FarmerActionIcon({ name }) {
  const icons = {
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10M12 7v10"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>,
    report: <><path d="M7 3h8l4 4v14H5V3h2Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
    damage: <><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v5M12 17h.01"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}

function RecentCropScans({ detections, loading }) {
  return <section className="dashboard-panel farmer-recent-panel">
    <div className="farmer-recent-heading"><div><h2 className="font-bold text-slate-900">Recent Crop Scans</h2><p className="mt-1 text-sm text-slate-500">Latest saved crop analyses.</p></div><a href="#crop-history">View all</a></div>
    {loading ? <Loading/> : detections.length ? <div className="farmer-recent-list">
      {detections.slice(0, 4).map(scan => <a href="#crop-history" className="farmer-scan-row" key={scan.id}>
        {scan.image_url ? <img className="farmer-scan-thumb" src={scan.image_url} alt=""/> : <span className="farmer-scan-thumb farmer-scan-thumb-empty" aria-hidden="true"><FarmerActionIcon name="scan"/></span>}
        <span className="farmer-recent-date">{formatFarmerDate(scan.created_at)}</span>
        <span className="farmer-recent-farm">{scan.land_name || 'Farm not selected'}</span>
        <span className="farmer-recent-crop">{scan.crop_name || 'Unknown crop'}</span>
        <HealthPill value={scan.health_status}/><span className="farmer-row-arrow" aria-hidden="true">›</span>
      </a>)}
    </div> : <p className="farmer-recent-empty">Your saved crop scans will appear here.</p>}
  </section>;
}

function RecentDamageReports({ reports, loading }) {
  return <section className="dashboard-panel farmer-recent-panel">
    <div className="farmer-recent-heading"><div><h2 className="font-bold text-slate-900">Recent Damage Reports</h2><p className="mt-1 text-sm text-slate-500">Status of your latest submissions.</p></div><a href="#my-reports">View all</a></div>
    {loading ? <Loading/> : reports.length ? <div className="farmer-recent-list">
      {reports.slice(0, 4).map(report => <a href="#my-reports" className="farmer-report-row" key={report.id}>
        <span className="farmer-report-date">{formatFarmerDate(report.created_at, false)}</span>
        <span className="farmer-report-farm">{report.land_name || 'Farm'}</span>
        <span className="farmer-report-issue">{report.confirmed_damage_type || report.ai_detected_damage_type || 'Damage pending'}</span>
        <span className="farmer-report-status"><StatusBadge value={report.status}/></span><span className="farmer-row-arrow" aria-hidden="true">›</span>
      </a>)}
    </div> : <p className="farmer-recent-empty">You have not submitted a damage report yet.</p>}
  </section>;
}

function formatFarmerDate(value, withTime = true) {
  if (!value) return 'Date unavailable';
  return new Date(value).toLocaleString(undefined, withTime ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' });
}

function HealthPill({ value }) {
  const normalized = String(value || 'Not assessed').toLowerCase();
  const healthy = normalized.includes('healthy') || normalized.includes('good');
  const concern = normalized.includes('disease') || normalized.includes('poor') || normalized.includes('damage') || normalized.includes('unhealthy');
  return <span className={`farmer-health-pill${healthy ? ' is-healthy' : concern ? ' has-concern' : ''}`}>{value || 'Not assessed'}</span>;
}

function QuickStart({ pending, reportCount }) {
  const token = JSON.parse(localStorage.getItem('agrisystem-session') || 'null')?.token;
  const [weatherOpen, setWeatherOpen] = useState(false);
  return <>
    <aside className="dashboard-guide">
      <div className="dashboard-guide-heading"><p className="text-xs font-bold uppercase tracking-[.14em]">Quick guide</p><h2 className="mt-2 text-lg font-extrabold">What you can do next</h2></div>
      <div className="dashboard-guide-steps">
        <a href="#profile" className="dashboard-guide-step"><span className="dashboard-guide-number">1</span><span className="dashboard-guide-copy"><span className="dashboard-guide-title">Check your farm details</span><span className="dashboard-guide-description">Make sure your farm location and crop details are accurate.</span></span></a>
        <a href="#crop-detection" className="dashboard-guide-step"><span className="dashboard-guide-number">2</span><span className="dashboard-guide-copy"><span className="dashboard-guide-title">Upload a crop photo</span><span className="dashboard-guide-description">Get a clear photo of your plant for better analysis.</span></span></a>
        <a href="#report" className="dashboard-guide-step"><span className="dashboard-guide-number">3</span><span className="dashboard-guide-copy"><span className="dashboard-guide-title">Submit a damage report</span><span className="dashboard-guide-description">Report issues if you notice any problems in your farm.</span></span></a>
        <a href="#my-reports" className="dashboard-guide-step"><span className="dashboard-guide-number">4</span><span className="dashboard-guide-copy"><span className="dashboard-guide-title">View your reports</span><span className="dashboard-guide-description">{pending ? `${pending} report(s) await review. Check for status updates.` : reportCount ? 'Check your report status and MAO feedback.' : 'Your submitted reports and updates will appear here.'}</span></span></a>
      </div>
      <button type="button" onClick={() => setWeatherOpen(true)} className="dashboard-weather-link">Check local weather</button>
    </aside>
    {weatherOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"><div className="app-modal-panel w-full max-w-md bg-white p-5"><div className="flex items-center justify-between"><p className="font-extrabold text-slate-900">Weather at your location</p><button type="button" onClick={() => setWeatherOpen(false)} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">Close</button></div><BongabongWeather token={token}/></div></div>}
  </>;
}
export function ProfileLandPage({ token, onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterBarangay, setFilterBarangay] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [gpsMessage, setGpsMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const reload = useCallback(() => api("/farmers/me", { token }).then(setData).catch(err => setError(err.message)), [token]);
  useEffect(() => { reload(); }, [reload]); useRealtimeRefresh(token, reload);
  function useGps() {
    if (!navigator.geolocation) { setGpsMessage("This device does not support GPS location."); return; }
    setLocating(true); setGpsMessage("");
    navigator.geolocation.getCurrentPosition(position => {
      setLatitude(position.coords.latitude.toFixed(6)); setLongitude(position.coords.longitude.toFixed(6));
      setGpsMessage(`GPS location saved — accuracy within about ${Math.round(position.coords.accuracy)} meters.`); setLocating(false);
    }, gpsError => { setGpsMessage(gpsError.code === gpsError.PERMISSION_DENIED ? "Location permission was blocked. Allow location access, then try again." : "GPS could not get a location. Move outdoors and try again."); setLocating(false); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  async function addLand(event) {
    event.preventDefault(); const form = event.currentTarget; setSaving(true); setError(""); setSuccess("");
    try { await api("/farmers/lands", { token, method: "POST", body: new FormData(form) }); form.reset(); setLatitude(""); setLongitude(""); setSuccess("Land record saved successfully. You can now select it when submitting a damage report."); reload(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  const profile = data?.profile;
  const lands = (data?.lands || []).filter(land => !filterBarangay || land.barangay === filterBarangay);
  return <AppShell onLogout={onLogout}><PageHeader eyebrow="Farmer portal" title="My profile & land" description="Your registered land is your saved farm record. Select it in a damage report so MAO Staff can confirm the farm, Barangay, crops, GPS location, and land proof."/>{error && <Message error text={error}/>} {success && <Message text={success}/>}<div className="mt-6 grid gap-5 lg:grid-cols-5"><section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Registration details</p><h2 className="mt-2 text-xl font-bold">{profile?.full_name || "Your farmer profile"}</h2><div className="mt-4"><StatusBadge value={profile?.registration_status || "loading"}/></div><dl className="mt-6 space-y-4 text-sm"><div><dt className="font-semibold text-slate-400">Address</dt><dd className="mt-1 text-slate-700">{profile?.address || "Add your address to complete your profile."}</dd></div><div><dt className="font-semibold text-slate-400">Barangay</dt><dd className="mt-1 text-slate-700">{profile?.barangay || "Not yet provided"}</dd></div></dl><div className="mt-7 flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-bold text-slate-900">Registered land</h3><p className="mt-1 text-xs leading-5 text-slate-500">These are your farm records. Choose one later when sending a damage report.</p></div><select value={filterBarangay} onChange={event => setFilterBarangay(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"><option value="">All barangays</option>{bongabongBarangays.map(barangay => <option key={barangay} value={barangay}>{barangay}</option>)}</select></div><div className="mt-3 space-y-3">{lands.map(land => <article key={land.id} className="rounded-xl border border-slate-200 p-3 text-sm"><b>{land.name || "Farm land"}</b><p className="mt-1 text-slate-500">{land.size_hectares} hectares · {land.crop_types?.join(", ")}</p><p className="mt-1 text-xs text-slate-400">{land.barangay || "Location not specified"} · {land.latitude}, {land.longitude}</p></article>)}{data && !lands.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{filterBarangay ? `No registered land in ${filterBarangay}.` : "No land registered yet. Add your first land record."}</p>}</div></section><form onSubmit={addLand} className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm lg:col-span-3"><h2 className="text-xl font-bold">Add a land record</h2><p className="mt-1 text-sm text-slate-500">Save each farm once. It will appear under “Registered land” when you send a crop-damage report.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Input name="name" label="Land name" placeholder="Example: Corn field - Labasan"/><label className="block text-sm font-semibold text-slate-700">Barangay<select name="barangay" required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900"><option value="">Select Bongabong barangay</option>{bongabongBarangays.map(barangay => <option key={barangay} value={barangay}>{barangay}</option>)}</select></label><div className="sm:col-span-2"><Input name="address" label="Land address" placeholder="Sitio, road, or nearby landmark"/></div><Input name="sizeHectares" label="Size (hectares)" type="number" step="0.01" required/><Input name="cropTypes" label="Crop types" placeholder="Rice, corn, vegetables" required/><div className="rounded-lg border border-sky-100 bg-sky-50 p-4 sm:col-span-2"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-900">Farm GPS location</p><p className="mt-1 text-xs leading-5 text-slate-600">Stand at the farm, then tap the button to fill latitude and longitude automatically.</p></div><button type="button" onClick={useGps} disabled={locating} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{locating ? "Getting GPS..." : "Use my GPS location"}</button></div>{gpsMessage && <p className={`mt-3 text-xs ${gpsMessage.startsWith("GPS") ? "text-emerald-700" : "text-red-700"}`}>{gpsMessage}</p>}<div className="mt-4 grid gap-4 sm:grid-cols-2"><Input name="latitude" label="Latitude" type="number" step="any" required value={latitude} onChange={event => setLatitude(event.target.value)} placeholder="Use GPS or enter manually"/><Input name="longitude" label="Longitude" type="number" step="any" required value={longitude} onChange={event => setLongitude(event.target.value)} placeholder="Use GPS or enter manually"/></div></div><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Ownership or tenancy proof <span className="font-normal text-slate-400">(optional)</span><input name="ownershipProof" type="file" className="mt-1 block w-full text-sm"/></label></div><button disabled={saving} className="button mt-5 !w-auto">{saving ? "Saving…" : "Save land record"}</button></form></div></AppShell>;
}

function LegacyProfileLandPage({ token, onLogout }) {
  const [data, setData] = useState(null); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [saving, setSaving] = useState(false);
  const reload = useCallback(() => api("/farmers/me", { token }).then(setData).catch(err => setError(err.message)), [token]);
  useEffect(() => { reload(); }, [reload]);
  useRealtimeRefresh(token, reload);
  async function addLand(event) { event.preventDefault(); const form = event.currentTarget; setSaving(true); setError(""); try { await api("/farmers/lands", { token, method: "POST", body: new FormData(form) }); form.reset(); setSuccess("Land record saved successfully."); reload(); } catch (err) { setError(err.message); } finally { setSaving(false); } }
  const profile = data?.profile;
  return <AppShell onLogout={onLogout}><PageHeader eyebrow="Farmer portal" title="My profile & land" description="Your land information supports faster validation when you submit a damage report."/>{error && <Message error text={error}/>} {success && <Message text={success}/>}<div className="mt-6 grid gap-5 lg:grid-cols-5"><section className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Registration details</p><h2 className="mt-2 text-xl font-bold">{profile?.full_name || "Your farmer profile"}</h2><div className="mt-4"><StatusBadge value={profile?.registration_status || "loading"}/></div><dl className="mt-6 space-y-4 text-sm"><div><dt className="font-semibold text-slate-400">Address</dt><dd className="mt-1 text-slate-700">{profile?.address || "Add your address to complete your profile."}</dd></div><div><dt className="font-semibold text-slate-400">Barangay</dt><dd className="mt-1 text-slate-700">{profile?.barangay || "Not yet provided"}</dd></div></dl><h3 className="mt-7 font-bold">Registered land</h3><div className="mt-3 space-y-3">{data?.lands?.map(land => <article key={land.id} className="rounded-xl border border-slate-200 p-3 text-sm"><b>{land.name || "Farm land"}</b><p className="mt-1 text-slate-500">{land.size_hectares} hectares · {land.crop_types?.join(", ")}</p><p className="mt-1 text-xs text-slate-400">{land.barangay || "Location not specified"}</p></article>)}{data && !data.lands?.length && <p className="text-sm text-slate-500">No land registered yet. Add your first land record.</p>}</div></section><form onSubmit={addLand} className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm lg:col-span-3"><h2 className="text-xl font-bold">Add a land record</h2><p className="mt-1 text-sm text-slate-500">Accurate coordinates help the MAO validate damage reports.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Input name="name" label="Land name"/><Input name="barangay" label="Barangay" required/><div className="sm:col-span-2"><Input name="address" label="Land address"/></div><Input name="sizeHectares" label="Size (hectares)" type="number" step="0.01" required/><Input name="cropTypes" label="Crop types" placeholder="Rice, corn, vegetables" required/><Input name="latitude" label="Latitude" type="number" step="any" required/><Input name="longitude" label="Longitude" type="number" step="any" required/><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Ownership or tenancy proof <span className="font-normal text-slate-400">(optional)</span><input name="ownershipProof" type="file" className="mt-1 block w-full text-sm"/></label></div><button disabled={saving} className="button mt-5 !w-auto">{saving ? "Saving…" : "Save land record"}</button></form></div></AppShell>;
}

export function DamageReportPage({ token, onLogout }) {
  const [scanDraft, setScanDraft] = useState(readDamageReportDraft);
  const [cropScans, setCropScans] = useState([]);
  const [scansLoading, setScansLoading] = useState(true);
  const [lands, setLands] = useState([]);
  const [landId, setLandId] = useState(() => { const draft = readDamageReportDraft(); return draft?.landId ? String(draft.landId) : ""; });
  const [confirmedPlant, setConfirmedPlant] = useState(() => readDamageReportDraft()?.cropName && readDamageReportDraft()?.cropName !== "Unknown Crop" ? readDamageReportDraft().cropName : "");
  const damageTypes = ["Flood", "Drought", "Typhoon / strong wind", "Pest infestation", "Plant disease", "Nutrient deficiency", "Animal damage", "Fire", "Soil erosion", "Landslide", "Other"];
  const [confirmedDamageType, setConfirmedDamageType] = useState(() => damageTypes.includes(readDamageReportDraft()?.damageType) ? readDamageReportDraft().damageType : "");
  const [incidentOccurredAt, setIncidentOccurredAt] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const loadLands = useCallback(() => api("/farmers/me", { token }).then(data => setLands(data.lands)).catch(err => setError(err.message)), [token]);
  const loadCropScans = useCallback(() => api("/crop-detections", { token }).then(data => setCropScans(data.detections || [])).catch(err => setError(err.message)).finally(() => setScansLoading(false)), [token]);
  useEffect(() => { loadLands(); }, [loadLands]);
  useEffect(() => { loadCropScans(); }, [loadCropScans]);
  useRealtimeRefresh(token, loadLands);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setSending(true); setError(""); setMessage("");
    try {
      const body = new FormData(form);
      const uploadedPhotos = body.getAll("photos").filter(file => file instanceof File && file.size > 0);
      const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!uploadedPhotos.length && !body.get("cropDetectionId")) throw new Error("Choose a saved crop scan photo or upload at least one farm photo.");
      if (uploadedPhotos.length > 5) throw new Error("Upload a maximum of five farm photos.");
      if (uploadedPhotos.some(file => !allowedTypes.has(file.type))) throw new Error("Upload JPG, PNG, or WebP farm photos only.");
      if (uploadedPhotos.some(file => file.size > 8 * 1024 * 1024)) throw new Error("Each farm photo must be 8 MB or smaller.");
      await api("/reports", { token, method: "POST", body });
      setMessage("Your damage report was sent to the MAO for review.");
      sessionStorage.removeItem("agrisystem-report-draft"); setScanDraft(null);
      setConfirmedPlant(""); setConfirmedDamageType("");
      form.reset(); setLandId(""); setIncidentOccurredAt(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  }

  function chooseCropScan(event) {
    const id = event.target.value;
    const detection = cropScans.find(item => String(item.id) === id);
    if (!detection) {
      sessionStorage.removeItem("agrisystem-report-draft"); setScanDraft(null);
      setConfirmedPlant(""); setConfirmedDamageType("");
      return;
    }
    const analysis = detection.analysis || {};
    const suggestedDamage = damageTypes.find(type => type.toLowerCase() === String(analysis.possibleDamageType || "").toLowerCase()) || "";
    const draft = { id: detection.id, landId: detection.land_id ? String(detection.land_id) : "", cropName: detection.crop_name, confidence: detection.confidence, damageType: suggestedDamage, photoUrl: detection.image_url };
    sessionStorage.setItem("agrisystem-report-draft", JSON.stringify(draft)); setScanDraft(draft);
    if (draft.landId) setLandId(draft.landId);
    setConfirmedPlant(draft.cropName && draft.cropName !== "Unknown Crop" ? draft.cropName : "");
    setConfirmedDamageType(suggestedDamage);
  }

  const selectedLand = lands.find(land => String(land.id) === String(landId));
  return <AppShell onLogout={onLogout}>
    <PageHeader eyebrow="Farmer portal" title="Submit a damage report" description="Send a suspected farm damage incident and its evidence to MAO for staff review. Crop scans remain separate unless you choose to link one here."/>
    {message && <Message text={message}/>} {error && <Message error text={error}/>}
    <form onSubmit={submit} className="mx-auto mt-6 w-full max-w-4xl rounded-lg border border-slate-200 bg-white p-5 sm:p-7">
      <div className="mb-6 grid gap-3 rounded-lg bg-emerald-50 p-4 text-sm sm:grid-cols-4">
        <p><b className="text-emerald-800">1. Farm</b><br/><span className="text-slate-600">Land and Barangay</span></p>
        <p><b className="text-emerald-800">2. Incident</b><br/><span className="text-slate-600">Crop, type, severity</span></p>
        <p><b className="text-emerald-800">3. Evidence</b><br/><span className="text-slate-600">Upload clear photos</span></p>
        <p><b className="text-emerald-800">4. Location</b><br/><span className="text-slate-600">Save incident GPS pin</span></p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Link a saved Crop Detection scan <span className="font-normal text-slate-400">(optional)</span><select value={scanDraft?.id || ""} onChange={chooseCropScan} disabled={scansLoading} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">{scansLoading ? "Loading your saved scans..." : "No scan — upload report photos instead"}</option>{cropScans.map(scan => <option key={scan.id} value={scan.id}>{scan.crop_name || "Unidentified crop"} · {scan.land_name || "No farm linked"} · {new Date(scan.created_at).toLocaleDateString()}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Choose a scan to attach its crop result, photo, and farm link to this report. You can also add extra photos below.</span></label>
        {scanDraft?.id && <><input type="hidden" name="cropDetectionId" value={scanDraft.id}/><div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 sm:col-span-2"><b>Linked crop scan:</b> {scanDraft.cropName || "Saved crop detection"} · {Math.round(Number(scanDraft.confidence || 0) * 100)}% crop confidence. The saved scan photo and analysis will be included.<button type="button" onClick={() => { sessionStorage.removeItem("agrisystem-report-draft"); setScanDraft(null); setLandId(""); setConfirmedPlant(""); setConfirmedDamageType(""); }} className="ml-3 font-bold underline">Remove scan link</button></div></>}
        {scanDraft?.landId ? <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm sm:col-span-2"><input type="hidden" name="landId" value={scanDraft.landId}/><b className="text-emerald-900">Farm from crop scan:</b> <span className="text-emerald-800">{selectedLand?.name || "Saved farm"}{selectedLand?.barangay ? ` · ${selectedLand.barangay}` : ""}</span>{selectedLand?.area_square_meters && <p className="mt-1 text-xs text-emerald-800">Farm area: {Number(selectedLand.area_square_meters).toLocaleString(undefined,{maximumFractionDigits:0})} m² ({Number(selectedLand.size_hectares).toFixed(4)} ha). Incident affected area is recorded separately.</p>}<p className="mt-1 text-xs text-emerald-700">The linked farm will be included automatically.</p></div> : <div><label className="block text-sm font-medium text-slate-700">Registered land<select name="landId" required value={landId} onChange={event => setLandId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Select your land</option>{lands.map(land => <option key={land.id} value={land.id}>{land.name || "Farm land"} - {land.barangay || "Barangay not set"}</option>)}</select></label>{scanDraft?.id && <p className="mt-1 text-xs text-slate-500">This crop scan has no farm saved. Select the farm where it was taken.</p>}{selectedLand?.area_square_meters && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">Mapped farm total: {Number(selectedLand.area_square_meters).toLocaleString(undefined,{maximumFractionDigits:0})} m² ({Number(selectedLand.size_hectares).toFixed(4)} ha). Damage affected area is recorded separately.</p>}</div>}
        <ReportBarangay selectedLand={selectedLand}/>
        <FieldSelect name="confirmedPlant" label="Affected crop" required value={confirmedPlant} onChange={event => setConfirmedPlant(event.target.value)}><option value="">Select affected crop</option>{confirmedPlant && !["Rice","Corn","Coconut","Vegetables","Other"].includes(confirmedPlant) && <option value={confirmedPlant}>{confirmedPlant} (from scan)</option>}<option>Rice</option><option>Corn</option><option>Coconut</option><option>Vegetables</option><option>Other</option></FieldSelect>
        <label className="block text-sm font-medium text-slate-700">Damage type<select name="confirmedDamageType" required value={confirmedDamageType} onChange={event => setConfirmedDamageType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Select damage type</option>{damageTypes.map(type => <option key={type}>{type}</option>)}</select></label>
        <label className="block text-sm font-medium text-slate-700">Observed severity<select name="reportedSeverity" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Select observed severity</option><option>Low</option><option>Moderate</option><option>High</option><option>Critical</option></select><span className="mt-1 block text-xs text-slate-400">Your estimate. MAO Staff will validate the final assessment.</span></label>
        <label className="block text-sm font-medium text-slate-700">When did it happen?<input name="incidentOccurredAt" type="datetime-local" required value={incidentOccurredAt} onChange={event => setIncidentOccurredAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"/></label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Estimated affected area <span className="font-normal text-slate-400">(optional)</span><input name="reportedAffectedArea" maxLength="180" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Example: approximately 0.5 hectare, or around 30% of the field"/><span className="mt-1 block text-xs text-slate-400">Enter only your field observation. Do not use an AI estimate.</span></label>
        <DamagePhotoUpload/>
        <IncidentLocation/>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Incident description<textarea name="farmerNotes" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows="5" placeholder="Describe what happened, when it happened, visible damage, and the affected area."/><span className="mt-1 block text-xs text-slate-400">Give MAO Staff enough detail to review the incident with your photos and location.</span></label>
      </div>
      {scanDraft?.photoUrl && <img src={scanDraft.photoUrl} alt="Linked crop scan evidence" className="mt-4 max-h-72 rounded-xl border border-slate-200 object-contain"/>}
      <div className="mt-6 rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-sky-900"><b>Review before submitting:</b> Your report will include the farm, incident details, selected severity, evidence, GPS pin when available, and description. A crop scan is linked only because you chose Submit Damage Report from a saved scan.</div>
      <button disabled={sending || !lands.length} className="button mt-5 !w-auto">{sending ? "Submitting..." : "Submit report for MAO review"}</button>
      {!lands.length && <p className="mt-3 text-sm text-amber-700">Add a land record first before submitting a report.</p>}
    </form>
  </AppShell>;
}

function DamagePhotoUpload() {
  const [previews, setPreviews] = useState([]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);
  function update(event) {
    const files = Array.from(event.target.files || []).slice(0, 5);
    setPreviews(current => { current.forEach(item => URL.revokeObjectURL(item.url)); return files.map(file => ({ name: file.name, size: file.size, url: URL.createObjectURL(file) })); });
  }
  return <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 sm:col-span-2"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-emerald-950">Farm photo evidence</p><p className="mt-1 text-xs leading-5 text-emerald-800">Upload one to five clear photos showing the affected crop or farm area, or attach a saved crop scan from Crop Detection.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-800">{previews.length}/5 selected</span></div><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={update} className="mt-3 block w-full text-sm"/><p className="mt-2 text-xs text-slate-500">JPG, PNG, or WebP. Maximum 8 MB each.</p>{previews.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{previews.map(item => <figure key={item.url} className="overflow-hidden rounded-lg border border-emerald-200 bg-white"><img src={item.url} alt={item.name} className="aspect-square w-full object-cover"/><figcaption className="truncate px-2 py-1.5 text-[10px] text-slate-500">{item.name}</figcaption></figure>)}</div>}</section>;
}
function ReportBarangay({ selectedLand }) { const [value, setValue] = useState(""); useEffect(() => { setValue(selectedLand?.barangay || ""); }, [selectedLand?.id, selectedLand?.barangay]); return <label className="block text-sm font-medium text-slate-700">Land Barangay<select name="incidentBarangay" required value={value} onChange={event => setValue(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">Select Bongabong barangay</option>{bongabongBarangays.map(barangay => <option key={barangay} value={barangay}>{barangay}</option>)}</select><span className="mt-1 block text-xs text-slate-400">Prefilled from your selected land. Confirm the barangay where the incident happened.</span></label>; }

function LegacyDamageReportPage({ token, onLogout }) {
  const [lands, setLands] = useState([]); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [sending, setSending] = useState(false);
  const loadLands = useCallback(() => api("/farmers/me", { token }).then(data => setLands(data.lands)).catch(err => setError(err.message)), [token]);
  useEffect(() => { loadLands(); }, [loadLands]);
  useRealtimeRefresh(token, loadLands);
  async function submit(event) { event.preventDefault(); const form = event.currentTarget; setSending(true); setError(""); try { await api("/reports", { token, method: "POST", body: new FormData(form) }); setMessage("Your damage report was sent to the MAO for review."); form.reset(); } catch (err) { setError(err.message); } finally { setSending(false); } }
  return <AppShell onLogout={onLogout}><PageHeader eyebrow="Farmer portal" title="Submit a damage report" description="Provide clear crop and location details so the MAO can validate your incident quickly."/>{message && <Message text={message}/>} {error && <Message error text={error}/>}<form onSubmit={submit} className="mx-auto mt-6 w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-5 sm:p-7"><div className="grid gap-5 sm:grid-cols-2"><FieldSelect name="landId" label="Registered land" required><option value="">Select your land</option>{lands.map(land => <option key={land.id} value={land.id}>{land.name || "Farm land"} — {land.barangay}</option>)}</FieldSelect><FieldSelect name="confirmedPlant" label="Damaged crop" required><option value="">Select damaged crop</option><option>Rice</option><option>Corn</option><option>Coconut</option><option>Vegetables</option><option>Other</option></FieldSelect><label className="block text-sm font-medium text-slate-700">Damage type<select name="confirmedDamageType" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Select damage type</option><option>Flood</option><option>Drought</option><option>Typhoon / strong wind</option><option>Pest infestation</option><option>Plant disease</option><option>Nutrient deficiency</option><option>Animal damage</option><option>Fire</option><option>Soil erosion</option><option>Landslide</option><option>No obvious damage detected</option><option>Other</option></select><span className="mt-1 block text-xs text-slate-400">This label and the photo may be used for MAO-reviewed training data.</span></label><label className="block text-sm font-medium text-slate-700">Farm photos<input name="photos" type="file" accept="image/*" capture="environment" multiple required className="mt-1 block w-full text-sm"/><span className="mt-1 block text-xs text-slate-400">Upload up to five clear crop-damage photos.</span></label><IncidentLocation/><label className="block text-sm font-medium text-slate-700 sm:col-span-2">Additional notes<textarea name="farmerNotes" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows="4" placeholder="Describe what happened, when it happened, and the affected area."/></label></div><button disabled={sending || !lands.length} className="button mt-6 !w-auto">{sending ? "Submitting…" : "Submit report for review"}</button>{!lands.length && <p className="mt-3 text-sm text-amber-700">Add a land record first before submitting a report.</p>}</form></AppShell>;
}

export function NotificationsPage({ token, onLogout }) { const [items, setItems] = useState([]); const [error, setError] = useState(""); const load = useCallback(() => api("/notifications/mine", { token }).then(async data => { setItems(data.notifications); const unread = data.notifications.filter(item => !item.read_at); await Promise.all(unread.map(item => api(`/notifications/${item.id}/read`, { token, method: "PATCH" }))); setItems(current => current.map(item => item.read_at ? item : { ...item, read_at: new Date().toISOString() })); }).catch(err => setError(err.message)), [token]); useEffect(() => { load(); }, [load]); useRealtimeRefresh(token, load); return <AppShell onLogout={onLogout}><PageHeader eyebrow="Farmer portal" title="My notifications" description="Updates from the MAO about your reports, assistance, and farm-related alerts."/>{error && <Message error text={error}/>}<div className="mt-6 space-y-3">{items.map(item => <article key={item.id} className={`rounded-lg border bg-white p-5 shadow-sm ${item.read_at ? "border-slate-100" : "border-emerald-200 ring-2 ring-emerald-50"}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><StatusBadge value={item.type}/>{!item.read_at && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">New</span>}</div><time className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</time></div><p className="mt-3 leading-6 text-slate-700">{item.message}</p></article>)}{!items.length && <Empty text="No notifications yet. MAO updates will appear here."/>}</div></AppShell>; }
export function WeatherPage({ token, onLogout }) { return <AppShell onLogout={onLogout}><PageHeader eyebrow="Farmer portal" title="Weather condition" description="Allow your browser to use GPS and see the weather where you are now. Your current location is used for this forecast and is not saved to your farm record."/><div className="mx-auto mt-6 w-full max-w-3xl"><BongabongWeather token={token}/></div></AppShell>; }
function LegacyMyReportsPage({ token, onLogout }) { const [reports, setReports] = useState([]); const [error, setError] = useState(""); const load = useCallback(() => api("/reports/mine", { token }).then(data => setReports(data.reports)).catch(err => setError(err.message)), [token]); useEffect(() => { load(); }, [load]); useRealtimeRefresh(token, load); return <AppShell onLogout={onLogout}><PageHeader eyebrow="Farmer portal" title="My damage reports" description="Track reports from submission through field validation and final review." action={<a href="#report" className="button !w-auto">New report</a>}/>{error && <Message error text={error}/>}<section className="mt-6 rounded-lg border border-slate-100 bg-white shadow-sm"><ReportList reports={reports} detailed/></section></AppShell>; }

export function MyReportsPage({ token, onLogout }) {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const load = useCallback(() => api("/reports/mine", { token }).then(data => setReports(data.reports)).catch(err => setError(err.message)), [token]);
  useEffect(() => { load(); }, [load]); useRealtimeRefresh(token, load);
  const pending = reports.filter(report => ["pending", "reviewing"].includes(report.status)).length;
  const verified = reports.filter(report => ["verified", "resolved"].includes(report.status)).length;
  const filtered = reports.filter(report => {
    const search = `${report.id} ${report.land_name || ""} ${report.barangay || ""} ${report.confirmed_plant || report.ai_detected_plant || ""} ${report.confirmed_damage_type || report.ai_detected_damage_type || ""}`.toLowerCase();
    return (status === "all" || report.status === status || (status === "resolved" && report.status === "verified")) && search.includes(query.toLowerCase());
  });
  function exportCsv() {
    const rows = [["Report ID", "Submitted", "Farm", "Barangay", "Crop", "Damage", "Observed severity", "AI damage confidence", "Status"]];
    filtered.forEach(report => rows.push([`DR-${String(report.id).padStart(6, "0")}`, new Date(report.created_at).toLocaleString(), report.land_name || "", report.barangay || "", report.confirmed_plant || report.ai_detected_plant || "", report.confirmed_damage_type || report.ai_detected_damage_type || "", report.reported_severity || report.ai_damage_severity || report.ai_analysis?.damageSeverity || "", report.ai_damage_confidence ?? report.ai_analysis?.damageConfidence ?? "", report.status]));
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `farm-damage-reports-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <AppShell onLogout={onLogout}><PageHeader eyebrow="Farmer portal" title="My damage reports" description="Search saved farm-damage reports, inspect incident details, print a report, or export your report list." action={<div className="flex flex-wrap gap-2"><button type="button" onClick={exportCsv} disabled={!filtered.length} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">Export CSV</button><a href="#report" className="button !w-auto">New report</a></div>}/>{error && <Message error text={error}/>}<section className="mt-6 grid gap-3 sm:grid-cols-3"><ReportProgress label="All reports" value={reports.length} tone="sky"/><ReportProgress label="Awaiting MAO review" value={pending} tone="amber"/><ReportProgress label="Verified" value={verified} tone="emerald"/></section><section className="mt-5 rounded-lg border border-slate-200 bg-white p-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><label className="text-sm font-bold text-slate-700">Search reports<input value={query} onChange={event => setQuery(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="Report ID, farm, crop, or damage"/></label><label className="text-sm font-bold text-slate-700">Review status<select value={status} onChange={event => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="all">All statuses</option><option value="pending">Pending</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="verified">Resolved (legacy)</option><option value="rejected">Rejected</option></select></label></div></section><div className="mt-5 space-y-4">{filtered.map(report => <article key={report.id} className={`overflow-hidden rounded-lg border bg-white shadow-sm ${report.status === "pending" ? "border-amber-200" : "border-slate-100"}`}><div className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge value={report.status}/><span className="text-xs font-semibold text-slate-400">DR-{String(report.id).padStart(6, "0")}</span>{(report.reported_severity || report.ai_damage_severity) && <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-orange-800">{report.reported_severity || report.ai_damage_severity} severity</span>}</div><h2 className="mt-3 text-lg font-extrabold text-slate-900">{report.confirmed_plant || report.ai_detected_plant || "Crop identification pending"}</h2><p className="mt-1 text-sm font-semibold text-slate-600">{report.confirmed_damage_type || report.ai_detected_damage_type || "Damage assessment pending"}</p><p className="mt-3 text-sm text-slate-500">{report.land_name || "Farm land"} - {report.barangay || "Location not provided"}</p><p className="mt-1 text-xs text-slate-400">Submitted {new Date(report.created_at).toLocaleString()} - {report.photos?.length || 0} photo(s)</p></div><div className="rounded-xl bg-slate-50 px-3 py-2 text-right text-xs"><p className="font-bold text-slate-400">MAO review</p><p className="mt-1 font-extrabold text-slate-800">{report.status === "pending" ? "Awaiting validation" : report.status === "verified" ? "Verified" : "Needs correction"}</p></div></div><div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setExpanded(expanded === report.id ? null : report.id)} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">{expanded === report.id ? "Hide report details" : "View report details"}</button><button type="button" onClick={() => printDamageReport(report)} className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-bold text-sky-700 hover:bg-sky-50">Print / save PDF</button>{report.status === "pending" && <span className="self-center text-xs text-amber-800">MAO Staff will check your photo, crop, damage, and location.</span>}</div></div>{expanded === report.id && <FarmerReportDetails report={report}/>}</article>)}{!filtered.length && <Empty text={reports.length ? "No reports match your search or filter." : "You have not submitted a damage report yet."}/>}</div></AppShell>;
}
function ReportProgress({ label, value, tone }) { const tones = { sky: "bg-sky-50 text-sky-900", amber: "bg-amber-50 text-amber-900", emerald: "bg-emerald-50 text-emerald-900" }; return <article className={`rounded-lg p-4 ${tones[tone]}`}><p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></article>; }
function FarmerAiAssessment({ report }) {
  const analysis = report.ai_analysis;
  if (!analysis) return null;
  const confidence = Number(report.ai_damage_confidence ?? analysis.damageConfidence ?? 0);
  return <section className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-sky-800">AI image advisory</p><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><p><b>Severity:</b> {report.ai_damage_severity || analysis.damageSeverity || "Unknown"}</p><p><b>Damage confidence:</b> {Math.round(confidence * 100)}%</p><p><b>Affected area:</b> {report.ai_affected_area_estimate || analysis.affectedAreaEstimate || "Not measurable from image"}</p><p><b>Affected plants / regions:</b> {report.ai_affected_plant_count || analysis.affectedPlantCount || "Not measurable from image"}</p></div>{analysis.damageEvidence?.length > 0 && <p className="mt-3 text-sm"><b>Visible evidence:</b> {analysis.damageEvidence.join(", ")}</p>}{analysis.recommendedActions?.length > 0 && <p className="mt-2 text-sm"><b>Suggested action:</b> {analysis.recommendedActions.join("; ")}</p>}<p className="mt-3 text-xs leading-5 text-sky-800">This is an image-based advisory. MAO verification determines the final report status.</p></section>;
}
function FarmerReportDetails({ report }) {
  const plant = report.confirmed_plant || report.ai_detected_plant || "Not identified";
  const damage = report.confirmed_damage_type || report.ai_detected_damage_type || "Not identified";
  const severity = report.reported_severity || report.ai_damage_severity || report.ai_analysis?.damageSeverity || "Not recorded";
  const affectedArea = report.reported_affected_area || report.ai_affected_area_estimate || report.ai_analysis?.affectedAreaEstimate || "Not recorded";
  const mapped = Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude));
  const mapUrl = mapped ? `https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=17/${report.latitude}/${report.longitude}` : null;
  return <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6"><div className="grid gap-4 lg:grid-cols-3"><section className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Incident details</p><p className="mt-3 font-bold text-slate-900">{plant}</p><p className="mt-1 text-sm text-slate-600">{damage}</p><div className="mt-4 grid gap-2 text-sm"><p><b>Observed severity:</b> {severity}</p><p><b>Estimated affected area:</b> {affectedArea}</p><p><b>Incident time:</b> {report.incident_occurred_at ? new Date(report.incident_occurred_at).toLocaleString() : "Not recorded"}</p></div><p className="mt-4 text-xs font-semibold text-slate-400">Your description</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.farmer_notes || "No additional notes provided."}</p></section><section className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Farm and location</p><p className="mt-3 text-sm font-bold text-slate-900">{report.land_name || "Farm land"}</p><p className="mt-1 text-sm text-slate-600">{report.barangay || "Barangay not provided"}</p><p className="mt-3 text-xs text-slate-500">{mapped ? `${report.latitude}, ${report.longitude}` : "No incident pin saved"}</p>{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-bold text-sky-700">Open incident pin</a>}</section><section className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">MAO review</p><p className="mt-3 text-sm text-slate-700">{report.status === "pending" ? "Awaiting MAO validation." : ["resolved", "verified"].includes(report.status) ? "This report was resolved by MAO Staff." : report.status === "reviewing" ? "MAO Staff is reviewing this report." : "This report needs correction."}</p>{(report.staff_remarks || report.rejection_reason) && <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900"><b>MAO feedback:</b> {report.staff_remarks || report.rejection_reason}</p>}{report.actions_taken && <p className="mt-2 text-sm text-slate-700"><b>Actions taken:</b> {report.actions_taken}</p>}{report.ai_analysis && <FarmerAiAssessment report={report}/>}</section></div><section className="mt-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Your submitted photos</p><p className="text-xs text-slate-400">Select a photo to view full size</p></div>{report.photos?.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{report.photos.map(photo => <a key={photo.id} href={photo.fileUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-slate-200 bg-white"><img src={photo.fileUrl} alt={`Evidence for ${plant}`} className="aspect-square w-full object-cover transition group-hover:scale-105"/><span className="block px-2 py-1.5 text-[10px] text-slate-500">Open full image</span></a>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">No photo is attached to this report.</p>}</section></div>;
}
function printDamageReport(report) {
  const escapeHtml = value => String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  const plant = report.confirmed_plant || report.ai_detected_plant || "Not identified";
  const damage = report.confirmed_damage_type || report.ai_detected_damage_type || "Not identified";
  const severity = report.reported_severity || report.ai_damage_severity || report.ai_analysis?.damageSeverity || "Not recorded";
  const affectedArea = report.reported_affected_area || report.ai_affected_area_estimate || report.ai_analysis?.affectedAreaEstimate || "Not recorded";
  const photos = (report.photos || []).map(photo => `<img src="${escapeHtml(photo.fileUrl)}" alt="Farm evidence"/>`).join("");
  const windowRef = window.open("", "_blank");
  if (!windowRef) return;
  windowRef.document.write(`<!doctype html><html><head><title>Damage report DR-${String(report.id).padStart(6, "0")}</title><style>body{font:14px Arial;color:#18352a;margin:32px}h1{color:#065f46}section{border:1px solid #d1d5db;border-radius:10px;padding:14px;margin:14px 0}dl{display:grid;grid-template-columns:180px 1fr;gap:8px}dt{font-weight:bold}img{max-width:220px;max-height:180px;object-fit:cover;margin:6px;border-radius:6px}@media print{body{margin:14px}}</style></head><body><h1>Farm Damage Report</h1><p><b>Report ID:</b> DR-${String(report.id).padStart(6, "0")}<br/><b>Submitted:</b> ${escapeHtml(new Date(report.created_at).toLocaleString())}<br/><b>Status:</b> ${escapeHtml(report.status)}</p><section><dl><dt>Farm</dt><dd>${escapeHtml(report.land_name || "Farm land")}</dd><dt>Barangay</dt><dd>${escapeHtml(report.barangay || "Not provided")}</dd><dt>Crop</dt><dd>${escapeHtml(plant)}</dd><dt>Damage</dt><dd>${escapeHtml(damage)}</dd><dt>Observed severity</dt><dd>${escapeHtml(severity)}</dd><dt>Estimated affected area</dt><dd>${escapeHtml(affectedArea)}</dd><dt>Incident time</dt><dd>${escapeHtml(report.incident_occurred_at ? new Date(report.incident_occurred_at).toLocaleString() : "Not recorded")}</dd></dl></section><section><h2>Farmer description</h2><p>${escapeHtml(report.farmer_notes || "No description provided.")}</p></section><section><h2>Evidence photos</h2>${photos || "<p>No photo attached.</p>"}</section><p>MAO verification determines the official assessment.</p><script>window.onload=()=>window.print()<\/script></body></html>`);
  windowRef.document.close();
}
function FieldSelect({ label, children, ...props }) { return <label className="block text-sm font-medium text-slate-700">{label}<select {...props} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">{children}</select></label>; }
function IncidentLocation() { const [location, setLocation] = useState(null); const [error, setError] = useState(""); const [finding, setFinding] = useState(false); function locate() { if (!navigator.geolocation) { setError("This browser does not support GPS location."); return; } setFinding(true); setError(""); navigator.geolocation.getCurrentPosition(position => { const { latitude, longitude, accuracy } = position.coords; setLocation({ latitude, longitude, accuracy }); setFinding(false); }, err => { setFinding(false); setError(err.code === err.PERMISSION_DENIED ? "Location permission was blocked. Allow it, or enter the coordinates manually." : "GPS could not get a precise location. Move outdoors and try again, or enter coordinates manually."); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); } const latitude = location?.latitude ?? "", longitude = location?.longitude ?? ""; return <section className="rounded-lg border border-sky-100 bg-sky-50 p-4 sm:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><b className="text-sm text-slate-900">Incident location</b><p className="mt-1 text-xs text-slate-600">Use your device GPS for the most accurate report pin.</p></div><button type="button" onClick={locate} disabled={finding} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{finding ? "Getting GPS..." : "Use current GPS location"}</button></div>{error && <p className="mt-3 text-xs text-red-700">{error}</p>}<div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Incident latitude<input name="latitude" value={latitude} onChange={event => setLocation(current => ({ ...(current || {}), latitude: event.target.value }))} type="number" step="any" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="e.g. 12.746420"/></label><label className="block text-sm font-medium text-slate-700">Incident longitude<input name="longitude" value={longitude} onChange={event => setLocation(current => ({ ...(current || {}), longitude: event.target.value }))} type="number" step="any" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="e.g. 121.487410"/></label></div>{Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && latitude !== "" && longitude !== "" && <><div className="mt-3 flex items-center justify-between text-xs text-sky-800"><span>Map pin: {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}</span>{location?.accuracy && <span>GPS accuracy: within {Math.round(location.accuracy)} m</span>}</div><div className="mt-3 h-64 overflow-hidden rounded-xl border border-sky-200"><MapContainer key={`${latitude}-${longitude}`} center={[Number(latitude), Number(longitude)]} zoom={17} scrollWheelZoom className="h-full w-full"><TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><CircleMarker center={[Number(latitude), Number(longitude)]} radius={10} pathOptions={{ color: "#0369a1", fillColor: "#38bdf8", fillOpacity: .8 }}/></MapContainer></div></>}</section>; }
function ReportList({ reports, detailed = false }) { return <div className="divide-y divide-slate-100">{reports.map(report => <article key={report.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">{report.confirmed_plant || report.ai_detected_plant || "Crop not specified"}</h2><p className="mt-1 text-sm text-slate-500">{report.confirmed_damage_type || report.ai_detected_damage_type || "Damage type pending"}</p>{detailed && <p className="mt-2 text-xs text-slate-400">Submitted {new Date(report.created_at).toLocaleString()}</p>}</div><StatusBadge value={report.status}/></div></article>)}{!reports.length && <Empty text="You have not submitted a damage report yet."/>}</div>; }
function Message({ text, error = false }) { return <div className="mt-5">{error ? <Error text={text}/> : <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{text}</p>}</div>; }
function Empty({ text }) { return <p className="p-6 text-center text-sm text-slate-500">{text}</p>; }
function Loading() { return <div className="animate-pulse rounded-xl bg-slate-100 p-8 text-center text-sm text-slate-400">Loading reports…</div>; }
