import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import AppShell from "../components/AppShell.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { api } from "../services/api.js";
import { distanceBetweenPoints, measureBoundary } from "../services/farmGeometry.js";

const defaultMapCenter = [12.8797, 121.774];
const streetMaxZoom = 19;
const satelliteMaxZoom = 21;
// Esri returns HTTP 200 placeholder JPEGs above this level around Bongabong.
// Leaflet can still zoom further by enlarging the last real imagery tiles.
const satelliteMaxNativeZoom = 18;
const streetTileUrl = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const satelliteTileUrl = import.meta.env.VITE_SATELLITE_TILE_URL || "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const button = "min-h-11 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50";
const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";

function RecenterMap({ center, zoom, focusKey }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, zoom, { animate: true }); }, [center, focusKey, map, zoom]);
  return null;
}

function MapZoomLimit({ maxZoom }) {
  const map = useMap();
  useEffect(() => {
    map.setMaxZoom(maxZoom);
    if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
  }, [map, maxZoom]);
  return null;
}

function MapActions({ onMapClick }) {
  const map = useMap();
  const clickHandler = useRef(onMapClick);
  useEffect(() => { clickHandler.current = onMapClick; }, [onMapClick]);
  useEffect(() => {
    const handleClick = event => clickHandler.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [map]);
  return null;
}

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const element = map.getContainer().parentElement;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false, pan: false }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function toPoints(land) {
  const ring = land?.boundary_geojson?.coordinates?.[0] || [];
  const openRing = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  return openRing.map(([longitude, latitude]) => ({ latitude: Number(latitude), longitude: Number(longitude) }));
}

function landCenter(land) {
  const points = toPoints(land);
  if (points.length) return [points.reduce((sum, point) => sum + point.latitude, 0) / points.length, points.reduce((sum, point) => sum + point.longitude, 0) / points.length];
  return landCoordinates(land) || defaultMapCenter;
}

function landCoordinates(land) {
  if (land?.latitude == null || land?.longitude == null || land.latitude === "" || land.longitude === "") return null;
  const latitude = Number(land.latitude), longitude = Number(land.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? [latitude, longitude] : null;
}

function hasSavedLocation(land) {
  return toPoints(land).length > 0 || landCoordinates(land) != null;
}

export default function FarmMappingPage({ token, onLogout }) {
  const [lands, setLands] = useState([]), [boundary, setBoundary] = useState([]), [selectedId, setSelectedId] = useState(""), [currentPosition, setCurrentPosition] = useState(null), [mapCenter, setMapCenter] = useState(defaultMapCenter);
  const [mapZoom, setMapZoom] = useState(6), [focusKey, setFocusKey] = useState(0), [mapLayer, setMapLayer] = useState("street"), [locating, setLocating] = useState(false);
  const [satelliteTileError, setSatelliteTileError] = useState(""), [satelliteLoading, setSatelliteLoading] = useState(false);
  const [recording, setRecording] = useState(false), [paused, setPaused] = useState(false), [manualMode, setManualMode] = useState(false), [movingPoint, setMovingPoint] = useState(null);
  const [accuracy, setAccuracy] = useState(null), [accuracySamples, setAccuracySamples] = useState([]), [gpsMessage, setGpsMessage] = useState("Location is off. Choose Start Mapping to request GPS access, or add points on the map manually.");
  const [gpsRetryAvailable, setGpsRetryAvailable] = useState(false), [gpsRetryKey, setGpsRetryKey] = useState(0), [locationConfirmation, setLocationConfirmation] = useState("");
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", barangay: "", municipality: "", province: "", region: "", cropTypes: "", address: "", notes: "" });
  const [measurement, setMeasurement] = useState(null);
  const watchId = useRef(null);
  const initialFarmFocus = useRef(false);
  const handleSatelliteLoading = useCallback(() => setSatelliteLoading(true), []);
  const handleSatelliteLoaded = useCallback(() => setSatelliteLoading(false), []);
  const handleSatelliteTileError = useCallback(() => {
    setSatelliteLoading(false);
    setSatelliteTileError("Some satellite imagery or reference tiles failed to load. Check the connection, or switch back to Street view.");
  }, []);

  const reload = useCallback(async () => {
    try { const data = await api("/farmers/me", { token }); setLands(data.lands || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (loading || initialFarmFocus.current || selectedId) return;
    const firstLocatedFarm = lands.find(hasSavedLocation);
    if (!firstLocatedFarm) return;
    initialFarmFocus.current = true;
    setMapCenter(landCenter(firstLocatedFarm));
    setMapZoom(17);
    setFocusKey(key => key + 1);
  }, [lands, loading, selectedId]);
  useEffect(() => () => { if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current); }, []);

  const calculated = useMemo(() => { try { return boundary.length >= 3 ? measureBoundary(boundary) : null; } catch { return null; } }, [boundary]);
  const boundaryCenter = calculated ? { latitude: calculated.latitude, longitude: calculated.longitude } : null;
  const locationFingerprint = useMemo(() => JSON.stringify({
    boundary: boundary.map(point => [point.latitude, point.longitude]),
    barangay: form.barangay.trim(), municipality: form.municipality.trim(), province: form.province.trim(), address: form.address.trim(),
  }), [boundary, form.address, form.barangay, form.municipality, form.province]);
  const locationConfirmed = locationConfirmation === locationFingerprint;
  const mapMaxZoom = mapLayer === "satellite" ? satelliteMaxZoom : streetMaxZoom;
  const acceptPosition = useCallback(position => {
    const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    const nextAccuracy = Number(position.coords.accuracy);
    if (mapCenter === defaultMapCenter && !selectedId) {
      setMapCenter([next.latitude, next.longitude]); setMapZoom(18); setFocusKey(key => key + 1);
    }
    setCurrentPosition(next); setAccuracy(nextAccuracy);
    if (!Number.isFinite(nextAccuracy) || nextAccuracy > 30) {
      setGpsRetryAvailable(true);
      setGpsMessage(`Device GPS reports ±${Number.isFinite(nextAccuracy) ? nextAccuracy.toFixed(1) : "unknown"} m accuracy. This fix is too imprecise to record; try again outdoors or use manual map points.`);
      return;
    }
    setGpsRetryAvailable(false);
    setGpsMessage(`Device GPS reports ±${nextAccuracy.toFixed(1)} m accuracy.`);
    if (!recording || paused) return;
    setAccuracySamples(samples => [...samples, nextAccuracy].slice(-100));
    setBoundary(points => {
      const previous = points.at(-1);
      if (previous && distanceBetweenPoints(previous, next) < Math.max(4, nextAccuracy * 0.35)) return points;
      return [...points, next];
    });
  }, [mapCenter, paused, recording, selectedId]);

  useEffect(() => {
    if (!recording || paused) { if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current); watchId.current = null; return; }
    if (!navigator.geolocation) { setGpsMessage("This browser does not provide location services. Use manual map points instead."); setGpsRetryAvailable(true); setRecording(false); return; }
    setGpsMessage("Requesting location permission. Keep this page open while walking around the boundary.");
    watchId.current = navigator.geolocation.watchPosition(acceptPosition, geoError => {
      setGpsRetryAvailable(true);
      if (geoError.code === 1) { setGpsMessage("Location permission was denied. Allow location access in your browser, then try GPS again, or use manual map mode."); setRecording(false); }
      else if (geoError.code === 3) setGpsMessage("GPS is taking too long. Move outdoors and retry, or continue with manual map points.");
      else setGpsMessage("GPS signal is unavailable. Check your device location setting and retry, or use manual map mode.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    return () => { if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current); watchId.current = null; };
  }, [acceptPosition, gpsRetryKey, paused, recording]);

  function handleMapClick(point) {
    if (movingPoint != null) {
      const selectedPoint = movingPoint + 1;
      setBoundary(points => points.map((item, index) => index === movingPoint ? point : item));
      setGpsMessage(`Boundary point ${selectedPoint} moved.`); setMovingPoint(null); return;
    }
    if (manualMode) {
      setBoundary(points => [...points, point]);
      setGpsMessage(`Manual boundary point ${boundary.length + 1} added.`);
    }
  }

  function toggleManualMode() {
    const nextMode = !manualMode;
    setManualMode(nextMode); setMovingPoint(null);
    setGpsMessage(nextMode ? "Manual editing is on. Tap the map to add corners; select a boundary dot to move or remove it." : "Manual editing is off. Turn it on before tapping the map to add corners.");
  }

  function selectBoundaryPoint(index) {
    setMovingPoint(index); setManualMode(true);
    setGpsMessage(`Boundary point ${index + 1} selected. Tap the map to move it, or remove the selected point.`);
  }

  function startMapping() {
    if (selectedId && boundary.length && !window.confirm("Start a fresh GPS trace? The saved farm boundary will remain unchanged until you save the new measurement.")) return;
    if (selectedId && boundary.length) { setBoundary([]); setMeasurement(null); setAccuracySamples([]); }
    setError(""); setMessage(""); setAccuracy(null); setGpsRetryAvailable(false); setRecording(true); setPaused(false); setGpsMessage("Waiting for a high-accuracy GPS fix. GPS recording is active only while mapping is active.");
  }

  function retryGps() {
    if (!navigator.geolocation) {
      setGpsMessage("This browser does not provide location services. Use manual map mode to add the boundary.");
      return;
    }
    setGpsRetryAvailable(false); setAccuracy(null); setPaused(false); setGpsMessage("Requesting a fresh high-accuracy GPS fix…");
    if (recording) setGpsRetryKey(key => key + 1);
    else setRecording(true);
  }
  function finishMapping() {
    setRecording(false); setPaused(false);
    setError(""); setMessage("");
    try { setMeasurement(measureBoundary(boundary)); setGpsMessage(`Boundary completed with ${boundary.length} points.`); }
    catch (err) { setMeasurement(null); setError(err.message); setGpsMessage("A valid measurement needs at least three distinct boundary points. Add points manually or retry GPS."); }
  }
  function clearBoundary() {
    if (!window.confirm("Clear all unsaved boundary points?")) return;
    setRecording(false); setPaused(false); setBoundary([]); setMeasurement(null); setAccuracySamples([]); setMovingPoint(null); setError(""); setGpsMessage("Boundary cleared. Your saved farm records are unchanged.");
  }
  function selectLand(land) {
    setRecording(false); setPaused(false); setManualMode(false); setMovingPoint(null);
    setMapCenter(hasSavedLocation(land) ? landCenter(land) : defaultMapCenter); setMapZoom(hasSavedLocation(land) ? 18 : 6); setFocusKey(key => key + 1);
    setCurrentPosition(null); setAccuracy(land.gps_accuracy_m == null ? null : Number(land.gps_accuracy_m)); setAccuracySamples([]);
    setSelectedId(String(land.id)); setBoundary(toPoints(land)); setLocationConfirmation(""); setMeasurement(land.area_square_meters ? { areaSquareMeters:Number(land.area_square_meters), areaHectares:Number(land.size_hectares), areaAcres:Number(land.area_acres), perimeterMeters:Number(land.perimeter_meters) } : null);
    setForm({ name:land.name || "", barangay:land.barangay || "", municipality:land.municipality || "", province:land.province || "", region:land.region || "", cropTypes:(land.crop_types || []).join(", "), address:land.address || "", notes:land.notes || "" });
    setError(""); setMessage(""); setGpsMessage(hasSavedLocation(land) ? `Editing ${land.name || "farm record"}. Start mapping to collect GPS points or use manual map mode to adjust the boundary.` : `Editing ${land.name || "farm record"}. This record has no saved GPS location yet; use your current location or place points manually.`);
  }
  function newFarm() { initialFarmFocus.current = true; setRecording(false); setPaused(false); setManualMode(false); setMovingPoint(null); setSelectedId(""); setMapCenter(defaultMapCenter); setMapZoom(6); setFocusKey(key => key + 1); setCurrentPosition(null); setBoundary([]); setMeasurement(null); setAccuracySamples([]); setLocationConfirmation(""); setForm({ name:"", barangay:"", municipality:"", province:"", region:"", cropTypes:"", address:"", notes:"" }); setError(""); setMessage(""); }

  function locateMyFarm() {
    const selectedLand = lands.find(land => String(land.id) === selectedId);
    const land = selectedLand || lands.find(hasSavedLocation);
    if (!land || !hasSavedLocation(land)) {
      setGpsMessage("No saved farm coordinates are available yet. Select a farm with a mapped boundary or use your current location to find the farm on the map.");
      return;
    }
    setMapCenter(landCenter(land)); setMapZoom(18); setFocusKey(key => key + 1);
    setGpsMessage(`Map centered on ${land.name || "your saved farm"}. Its saved coordinates were not changed.`);
  }

  function locateCurrentPosition() {
    if (!navigator.geolocation) {
      setGpsMessage("This browser does not provide location services. You can still choose a saved farm or move the map manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCurrentPosition(point); setAccuracy(Number(position.coords.accuracy));
      setMapCenter([point.latitude, point.longitude]); setMapZoom(18); setFocusKey(key => key + 1);
      setGpsMessage(`Map centered on your current position (device GPS reports ±${Number(position.coords.accuracy).toFixed(1)} m). This location is only used to move the map.`);
      setLocating(false);
    }, geoError => {
      const text = geoError.code === 1 ? "Location permission was denied. Allow location access in your browser and try again." : geoError.code === 3 ? "GPS took too long to respond. Move outdoors and try again." : "Your current location is unavailable. Check your device location setting and try again.";
      setGpsMessage(text); setLocating(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }

  function removeSelectedPoint() {
    if (movingPoint == null) return;
    setBoundary(points => points.filter((_, index) => index !== movingPoint));
    setGpsMessage(`Boundary point ${movingPoint + 1} removed.`); setMovingPoint(null); setMeasurement(null);
  }

  function changeMapLayer(layer) {
    setSatelliteTileError("");
    setSatelliteLoading(layer === "satellite");
    setMapLayer(layer);
  }

  async function saveFarm(event) {
    event.preventDefault(); setError(""); setMessage("");
    let measured;
    try { measured = measureBoundary(boundary); }
    catch (err) { setError(err.message); return; }
    if (!form.name.trim() || !form.barangay.trim() || !form.municipality.trim() || !form.province.trim()) { setError("Enter the farm name, barangay, municipality, and province before saving."); return; }
    if (!locationConfirmed) { setError("Review the map boundary and farm location details, then confirm that they refer to the same farm before saving."); return; }
    setSaving(true);
    const averageAccuracy = accuracySamples.length ? accuracySamples.reduce((sum, value) => sum + value, 0) / accuracySamples.length : null;
    const body = { ...form, cropTypes:form.cropTypes.split(",").map(item=>item.trim()).filter(Boolean), boundary:boundary.map(point=>({latitude:point.latitude,longitude:point.longitude})), gpsAccuracyM:averageAccuracy };
    try {
      const result = selectedId
        ? await api(`/farmers/lands/${selectedId}`, {token, method:"PATCH", body:JSON.stringify(body)})
        : await api("/farmers/lands", {token, method:"POST", body:JSON.stringify(body)});
      setMessage(`${result.land.name || "Farm"} saved. The mapped area is an estimate, not a survey measurement.`);
      setSelectedId(String(result.land.id)); setBoundary(toPoints(result.land)); setMeasurement(measured); await reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function removeFarm(land) {
    if (!window.confirm(`Delete ${land.name || "this farm"}? Existing damage reports may prevent deletion.`)) return;
    setError(""); setMessage("");
    try { await api(`/farmers/lands/${land.id}`, {token, method:"DELETE"}); if (String(land.id) === selectedId) newFarm(); setMessage("Farm record deleted."); await reload(); }
    catch (err) { setError(err.message); }
  }

  const accuracyWarning = accuracy == null ? null : accuracy > 20 ? "GPS uncertainty is high and may materially affect this area estimate." : accuracy > 10 ? "GPS uncertainty may affect the estimate. Review the boundary on the map." : "The reported GPS uncertainty is low, but phone GPS is still not survey-grade.";
  const quality = accuracySamples.length ? accuracySamples.reduce((sum, value) => sum + value, 0) / accuracySamples.length : accuracy;

  return <AppShell onLogout={onLogout}><PageHeader eyebrow="Farmer portal" title="GPS farm mapping" description="Walk the farm perimeter or place boundary points on the map. Area and perimeter are estimates from the points you record." action={<button type="button" onClick={newFarm} className={button}>New farm</button>}/>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message && <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,.8fr)]">
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Map the farm boundary</h2><p className="mt-1 text-xs leading-5 text-slate-500">Walk only along the field edge. In manual mode, tap each corner around the perimeter.</p></div><div className={`rounded-full px-3 py-1.5 text-xs font-bold ${recording && !paused ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{recording ? paused ? "Paused" : "GPS recording" : "Not recording"}</div></div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-600">Zoom with the mouse wheel, map buttons, or pinch on a touchscreen.</p><div className="flex gap-2" role="group" aria-label="Map layer"><button type="button" className={`${button} ${mapLayer === "street" ? "border-emerald-700 bg-emerald-50" : ""}`} aria-pressed={mapLayer === "street"} onClick={() => changeMapLayer("street")}>Street</button><button type="button" className={`${button} ${mapLayer === "satellite" ? "border-emerald-700 bg-emerald-50" : ""}`} aria-pressed={mapLayer === "satellite"} onClick={() => changeMapLayer("satellite")}>Satellite</button></div></div>
        <div className="mb-2 flex flex-wrap gap-2"><button type="button" className={button} onClick={locateMyFarm}>Locate My Farm</button><button type="button" className={button} onClick={locateCurrentPosition} disabled={locating}>{locating ? "Locating…" : "Use My Current Location"}</button></div>
        <div className="relative h-[min(55vh,32rem)] min-h-72 overflow-hidden rounded-lg border border-slate-200">
          <MapContainer center={mapCenter} zoom={mapZoom} minZoom={3} maxZoom={satelliteMaxZoom} zoomControl scrollWheelZoom touchZoom doubleClickZoom zoomSnap={0.5} zoomDelta={0.5} className="h-full w-full">
            <RecenterMap center={mapCenter} zoom={mapZoom} focusKey={focusKey}/><MapZoomLimit maxZoom={mapMaxZoom}/><ResizeMap/><MapActions onMapClick={handleMapClick}/>
            {/* Do not set errorTileUrl: keep failed requests visible through tileerror instead of masking them with a fake tile. */}
            <TileLayer key={mapLayer} attribution={mapLayer === "street" ? '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>' : '<a href="https://www.esri.com/">Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community</a>'} url={mapLayer === "street" ? streetTileUrl : satelliteTileUrl} maxNativeZoom={mapLayer === "satellite" ? satelliteMaxNativeZoom : mapMaxZoom} maxZoom={mapMaxZoom} eventHandlers={mapLayer === "satellite" ? { loading: handleSatelliteLoading, load: handleSatelliteLoaded, tileerror: handleSatelliteTileError } : undefined}/>
            {mapLayer === "satellite" && <TileLayer attribution="Sources: Esri, Garmin, HERE, © OpenStreetMap contributors, and the GIS user community" url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={satelliteMaxNativeZoom} maxZoom={mapMaxZoom} eventHandlers={{ tileerror: handleSatelliteTileError }}/>}
            {mapLayer === "satellite" && <TileLayer attribution="Sources: Esri, HERE, Garmin, © OpenStreetMap contributors" url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={satelliteMaxNativeZoom} maxZoom={mapMaxZoom} eventHandlers={{ tileerror: handleSatelliteTileError }}/>}
            {boundary.length >= 3 && <Polygon positions={boundary.map(point=>[point.latitude,point.longitude])} pathOptions={{color:"#047857",fillColor:"#34d399",fillOpacity:.2,weight:3}}/>}
            {boundary.length === 2 && <Polyline positions={boundary.map(point=>[point.latitude,point.longitude])} pathOptions={{color:"#047857",weight:3}}/>}
            {boundary.map((point,index)=><CircleMarker key={`${index}-${point.latitude}-${point.longitude}`} center={[point.latitude,point.longitude]} radius={index===movingPoint?9:6} pathOptions={{color:"#065f46",fillColor:index===movingPoint?"#fbbf24":"#34d399",fillOpacity:1,bubblingMouseEvents:false}} eventHandlers={{click:()=>selectBoundaryPoint(index)}}/>)}
            {currentPosition && <CircleMarker center={[currentPosition.latitude,currentPosition.longitude]} radius={7} pathOptions={{color:"#1d4ed8",fillColor:"#60a5fa",fillOpacity:.9}}/>}
            {lands.filter(land=>land.boundary_geojson && String(land.id)!==selectedId).map(land=><Polygon key={`saved-${land.id}`} positions={toPoints(land).map(point=>[point.latitude,point.longitude])} pathOptions={{color:"#64748b",fillOpacity:.05,weight:2,dashArray:"5 6"}}/>)}
          </MapContainer>
        </div>
        {mapLayer === "satellite" && satelliteLoading && !satelliteTileError && <p role="status" className="mt-2 text-xs text-slate-600">Loading satellite imagery…</p>}
        {mapLayer === "satellite" && satelliteTileError && <p role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><span>{satelliteTileError}</span><button type="button" className={button} onClick={() => changeMapLayer("street")}>Switch to Street</button></p>}
        <p className="mt-2 text-[11px] leading-5 text-slate-500">{mapLayer === "street" ? "Street maps are capped at level 19." : "Satellite map zooms to level 21; native imagery is capped at level 18, and closer views enlarge those tiles where finer source imagery is unavailable."} Imagery resolution and capture date vary by location.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><button type="button" className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50" onClick={recording ? finishMapping : startMapping} disabled={saving}>{recording ? "Finish mapping" : "Start mapping"}</button>{recording && <button type="button" className={button} onClick={()=>setPaused(value=>!value)}>{paused ? "Resume" : "Pause"}</button>}<button type="button" className={button} onClick={()=>{setBoundary(points=>points.slice(0,-1));setMeasurement(null);setMovingPoint(null);}} disabled={!boundary.length}>Undo point</button><button type="button" className={`${button} ${manualMode ? "border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-900" : ""}`} aria-pressed={manualMode} onClick={toggleManualMode}>{manualMode ? "Manual editing on" : "Add / edit points"}</button><button type="button" className={button} onClick={()=>setMovingPoint(null)} disabled={movingPoint==null}>Done moving point</button><button type="button" className={button} onClick={removeSelectedPoint} disabled={movingPoint==null}>Remove selected point</button><button type="button" className={button} onClick={clearBoundary} disabled={!boundary.length}>Clear boundary</button></div>
        <p role="status" aria-live="polite" className={`mt-3 rounded-lg p-3 text-xs leading-5 ${manualMode ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-600"}`}>{manualMode ? "Manual editing is ON: tap the map to add a corner. Select a boundary dot, then tap elsewhere to move it, or remove it." : "Manual editing is OFF. Turn on Add / edit points before tapping the map to add corners."}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span>GPS accuracy: <b>{accuracy == null ? "Not available" : `±${accuracy.toFixed(1)} m (device reported)`}</b></span><span>Boundary points: <b>{boundary.length}</b></span><span>Map points: <b>{manualMode ? "Tap map to add; select a dot to edit it" : "Manual mode off"}</b></span></div>
        <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 text-xs leading-5 ${accuracy != null && accuracy > 20 || gpsRetryAvailable ? "text-amber-800" : "text-slate-500"}`}><p>{gpsMessage}</p>{gpsRetryAvailable && <button type="button" className={button} onClick={retryGps}>Try GPS Again</button>}</div>
      </section>

      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-bold text-slate-900">Measurement estimate</h2>{calculated ? <div className="mt-3 grid grid-cols-2 gap-3"><Metric label="Area" value={`${calculated.areaSquareMeters.toLocaleString(undefined,{maximumFractionDigits:0})} m²`}/><Metric label="Hectares" value={`${calculated.areaHectares.toFixed(4)} ha`}/><Metric label="Acres" value={`${calculated.areaAcres.toFixed(3)} ac`}/><Metric label="Perimeter" value={`${calculated.perimeterMeters.toFixed(1)} m`}/></div> : <p className="mt-2 text-sm text-slate-500">Record at least three distinct points to see area and perimeter.</p>}{accuracyWarning && <p className={`mt-3 rounded-lg p-3 text-xs leading-5 ${accuracy > 20 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{accuracyWarning}</p>}<p className="mt-3 text-[11px] leading-5 text-slate-500">Ordinary phone GPS is not survey-grade. Map tiles © OpenStreetMap contributors. Actual planted area can be smaller than the total farm boundary.</p></section>
        <form onSubmit={saveFarm} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div><h2 className="font-bold text-slate-900">{selectedId ? "Save farm boundary" : "Save mapped farm"}</h2><p className="mt-1 text-xs text-slate-500">Mapped area and boundary-derived coordinates are stored on the existing land record.</p></div>
          <Field label="Farm name"><input className={input} maxLength="150" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. North rice field"/></Field>
          <Field label="Barangay"><input className={input} maxLength="120" required value={form.barangay} onChange={e=>setForm({...form,barangay:e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Municipality"><input className={input} required value={form.municipality} onChange={e=>setForm({...form,municipality:e.target.value})}/></Field><Field label="Province"><input className={input} required value={form.province} onChange={e=>setForm({...form,province:e.target.value})}/></Field></div>
          <Field label="Region (optional)"><input className={input} value={form.region} onChange={e=>setForm({...form,region:e.target.value})}/></Field>
          <Field label="Primary crops (comma separated)"><input className={input} value={form.cropTypes} onChange={e=>setForm({...form,cropTypes:e.target.value})} placeholder="Rice, corn, vegetables"/></Field>
          <Field label="Address or sitio (optional)"><input className={input} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></Field>
          <Field label="Farm notes (optional)"><textarea className={input} rows="2" maxLength="2000" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
          {boundaryCenter && calculated && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950"><p className="font-bold">Farm pin to be saved from this boundary</p><p>Latitude {boundaryCenter.latitude.toFixed(6)} · Longitude {boundaryCenter.longitude.toFixed(6)}</p><p className="mt-1">These coordinates are derived from the boundary points, not the default map center or a separate live GPS reading.</p><label className="mt-3 flex items-start gap-2 font-semibold"><input type="checkbox" className="mt-0.5 accent-emerald-800" checked={locationConfirmed} onChange={event=>setLocationConfirmation(event.target.checked ? locationFingerprint : "")}/><span>I checked that the boundary, barangay, municipality, province, and farm details describe the same location.</span></label></div>}
          <button type="submit" className="min-h-11 w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50" disabled={saving || recording || !calculated || !locationConfirmed}>{saving ? "Saving farm…" : selectedId ? "Save updated boundary" : "Save farm profile"}</button>
        </form>
      </div>
    </div>

    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Saved farms</h2><p className="mt-1 text-xs text-slate-500">Select a farm to review or remap it. Crop detection and damage reports already use these land records.</p></div>{loading && <span className="text-xs text-slate-500">Loading…</span>}</div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{lands.map(land=><article key={land.id} className={`rounded-lg border p-4 ${String(land.id)===selectedId ? "border-emerald-400 bg-emerald-50/50" : "border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{land.name || "Farm land"}</h3><p className="mt-1 text-xs text-slate-500">{[land.barangay,land.municipality,land.province].filter(Boolean).join(", ") || "Location not provided"}</p></div><button type="button" onClick={()=>removeFarm(land)} className="text-xs font-bold text-red-700 hover:underline">Delete</button></div>{land.boundary_geojson ? <><p className="mt-3 text-sm text-emerald-900">{Number(land.area_square_meters).toLocaleString(undefined,{maximumFractionDigits:0})} m² · {Number(land.size_hectares).toFixed(4)} ha · {Number(land.area_acres).toFixed(3)} acres</p><p className="mt-1 text-xs text-slate-500">Perimeter {Number(land.perimeter_meters).toFixed(1)} m · {land.boundary_geojson.coordinates?.[0]?.length ? land.boundary_geojson.coordinates[0].length-1 : 0} points · GPS {land.measurement_quality || "manual"}</p></> : <p className="mt-3 text-xs text-amber-800">Saved land pin only; map its perimeter to calculate an area.</p>}<button type="button" className={`${button} mt-3 w-full`} onClick={()=>selectLand(land)}>{String(land.id)===selectedId ? "Selected for editing" : "Review / remap"}</button><MeasurementHistory token={token} landId={land.id}/></article>)}{!loading && !lands.length && <p className="text-sm text-slate-500">No saved farm records yet.</p>}</div></section>
  </AppShell>;
}

function Field({ label, children }) { return <label className="block text-xs font-bold text-slate-700">{label}{children}</label>; }
function Metric({ label, value }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-extrabold text-emerald-950">{value}</p></div>; }
function MeasurementHistory({ token, landId }) {
  const [rows, setRows] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const result = await api(`/farmers/lands/${landId}/measurements`, {token}); setRows(result.measurements); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return <div className="mt-2"><button type="button" onClick={load} disabled={loading} className="w-full py-1 text-xs font-bold text-sky-800 hover:underline disabled:opacity-50">{loading ? "Loading history…" : rows ? "Refresh measurement history" : "View measurement history"}</button>{error && <p className="mt-1 text-xs text-red-700">{error}</p>}{rows && <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-2">{rows.map(item=><p key={item.id} className="text-[10px] leading-4 text-slate-600"><b>{new Date(item.measured_at).toLocaleString()}</b> · {Number(item.area_square_meters).toLocaleString(undefined,{maximumFractionDigits:0})} m² · {Number(item.area_hectares).toFixed(4)} ha · {item.measurement_quality}</p>)}{!rows.length && <p className="text-[10px] text-slate-500">No perimeter measurement has been saved yet.</p>}</div>}</div>;
}
