import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { api } from "../services/api.js";
import { distanceBetweenPoints, measureBoundary } from "../services/farmGeometry.js";

const defaultMapCenter = [12.74737, 121.48858];
const defaultMapZoom = 17;
const maxMappingAccuracyMeters = 15;
const FarmMappingMap = lazy(() => import("../components/FarmMappingMap.jsx"));
const EsriFarmMappingMap = lazy(() => import("../components/EsriFarmMappingMap.jsx"));
const configuredMapboxToken = (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || "").trim();
const mapboxTokenIsPublic = configuredMapboxToken.startsWith("pk.");
const button = "!w-auto min-h-11 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50";
const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";

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
  const [mapZoom, setMapZoom] = useState(defaultMapZoom), [focusKey, setFocusKey] = useState(0), [locating, setLocating] = useState(false);
  const [mapLayer, setMapLayer] = useState("satellite");
  const [mapStatus, setMapStatus] = useState("loading"), [mapError, setMapError] = useState("");
  const [recording, setRecording] = useState(false), [paused, setPaused] = useState(false), [manualMode, setManualMode] = useState(false), [movingPoint, setMovingPoint] = useState(null);
  const [followGps, setFollowGps] = useState(false), [gpsGapDetected, setGpsGapDetected] = useState(false), [gapReviewConfirmed, setGapReviewConfirmed] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState("idle");
  const [gpsWalkDistance, setGpsWalkDistance] = useState(0), [hasGpsTrack, setHasGpsTrack] = useState(false);
  const [accuracy, setAccuracy] = useState(null), [accuracySamples, setAccuracySamples] = useState([]), [gpsMessage, setGpsMessage] = useState("Location is off. Choose Start Mapping to request GPS access, or add points on the map manually.");
  const [gpsRetryAvailable, setGpsRetryAvailable] = useState(false), [gpsRetryKey, setGpsRetryKey] = useState(0), [locationConfirmation, setLocationConfirmation] = useState("");
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", barangay: "", municipality: "", province: "", region: "", cropTypes: "", address: "", notes: "" });
  const [measurement, setMeasurement] = useState(null);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const watchId = useRef(null);
  const lastAcceptedPosition = useRef(null);
  const boundaryLengthRef = useRef(0);
  const elapsedMappingMs = useRef(0);
  const activeMappingStartedAt = useRef(null);
  const initialFarmFocus = useRef(false);
  const handleMapReady = useCallback(() => { setMapStatus("ready"); setMapError(""); }, []);
  const handleMapError = useCallback(message => { setMapStatus("error"); setMapError(message); }, []);

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
  useEffect(() => { boundaryLengthRef.current = boundary.length; }, [boundary.length]);
  useEffect(() => {
    if (!recording || paused) return undefined;
    if (activeMappingStartedAt.current == null) activeMappingStartedAt.current = Date.now();
    const segmentStartedAt = activeMappingStartedAt.current;
    const updateDuration = () => setRecordingDurationSeconds(Math.floor((elapsedMappingMs.current + Date.now() - segmentStartedAt) / 1000));
    updateDuration();
    const timer = window.setInterval(updateDuration, 1000);
    return () => {
      window.clearInterval(timer);
      if (activeMappingStartedAt.current === segmentStartedAt) {
        elapsedMappingMs.current += Date.now() - segmentStartedAt;
        activeMappingStartedAt.current = null;
        setRecordingDurationSeconds(Math.floor(elapsedMappingMs.current / 1000));
      }
    };
  }, [paused, recording]);

  const calculated = useMemo(() => { try { return boundary.length >= 3 ? measureBoundary(boundary) : null; } catch { return null; } }, [boundary]);
  const walkingDistanceMeters = useMemo(() => boundary.slice(1).reduce((sum, point, index) => sum + distanceBetweenPoints(boundary[index], point), 0), [boundary]);
  const boundaryCenter = calculated ? { latitude: calculated.latitude, longitude: calculated.longitude } : null;
  const locationFingerprint = useMemo(() => JSON.stringify({
    boundary: boundary.map(point => [point.latitude, point.longitude]),
    barangay: form.barangay.trim(), municipality: form.municipality.trim(), province: form.province.trim(), address: form.address.trim(),
  }), [boundary, form.address, form.barangay, form.municipality, form.province]);
  const locationConfirmed = locationConfirmation === locationFingerprint;
  const gpsAccessError = () => {
    if (!globalThis.navigator?.geolocation) return "This device or browser does not provide GPS location. You can still map the boundary manually.";
    const hostname = globalThis.location?.hostname;
    const localHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    if (globalThis.isSecureContext === false && !localHost) return "GPS needs a secure HTTPS connection. Open AgriSystem over HTTPS or on this device's localhost, then try again.";
    return "";
  };
  const acceptPosition = useCallback(position => {
    const next = { latitude: position.coords.latitude, longitude: position.coords.longitude, heading: Number.isFinite(position.coords.heading) ? Number(position.coords.heading) : null };
    const nextAccuracy = Number(position.coords.accuracy);
    const timestamp = Number(position.timestamp) || Date.now();
    if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude) || next.latitude < -90 || next.latitude > 90 || next.longitude < -180 || next.longitude > 180) {
      setGpsRetryAvailable(true); setTrackingStatus("error"); setGpsMessage("The phone returned invalid GPS coordinates. Check location services, then retry."); return;
    }
    setCurrentPosition(next); setAccuracy(nextAccuracy);
    if (!Number.isFinite(nextAccuracy) || nextAccuracy > maxMappingAccuracyMeters) {
      if (boundaryLengthRef.current > 0) { setGpsGapDetected(true); setGapReviewConfirmed(false); }
      lastAcceptedPosition.current = null;
      setGpsRetryAvailable(true);
      setTrackingStatus(recording && !paused ? "weak" : "ready");
      setGpsMessage(`GPS is too weak to measure reliably (device reports ±${Number.isFinite(nextAccuracy) ? nextAccuracy.toFixed(1) : "unknown"} m). No point was recorded. Move outdoors, enable precise location, and wait for accuracy of ${maxMappingAccuracyMeters} m or better.`);
      return;
    }
    setGpsRetryAvailable(false);
    if (!recording || paused) { setTrackingStatus("ready"); setGpsMessage(`GPS ready. Device reports ±${nextAccuracy.toFixed(1)} m accuracy.`); return; }
    const previous = lastAcceptedPosition.current;
    if (previous) {
      const segmentMeters = distanceBetweenPoints(previous.point, next);
      const elapsedSeconds = Math.max(0.5, (timestamp - previous.timestamp) / 1000);
      // Record boundary corners more often than the old 6–12 m dead zone,
      // while scaling the noise filter to the device's reported GPS accuracy.
      const averageAccuracy = (previous.accuracy + nextAccuracy) / 2;
      const minimumStep = Math.max(3.5, Math.min(6, averageAccuracy * 0.4));
      const maximumStep = Math.max(15, elapsedSeconds * 3 + Math.min(5, averageAccuracy * 0.4));
      if (segmentMeters < minimumStep) return;
      if (segmentMeters > maximumStep || elapsedSeconds > 45) {
        setGpsGapDetected(true); setGapReviewConfirmed(false);
        lastAcceptedPosition.current = { point: next, timestamp, accuracy: nextAccuracy };
        setTrackingStatus("recording");
        setGpsMessage(`GPS gap detected (${segmentMeters.toFixed(0)} m or ${Math.round(elapsedSeconds)} seconds). This section was skipped. Review the outline and add missing corners manually before saving.`);
        return;
      }
      setGpsWalkDistance(total => total + segmentMeters);
    }
    lastAcceptedPosition.current = { point: next, timestamp, accuracy: nextAccuracy };
    setHasGpsTrack(true);
    setTrackingStatus("recording");
    setGpsMessage(`Recording boundary point. Device GPS reports ±${nextAccuracy.toFixed(1)} m accuracy.`);
    setAccuracySamples(samples => [...samples, nextAccuracy].slice(-100));
    setMeasurement(null);
    if (boundaryLengthRef.current >= 2000) { setGpsMessage("The 2,000 point mapping limit was reached. Finish this boundary before recording more points."); return; }
    setBoundary(points => [...points, next]);
  }, [paused, recording]);

  useEffect(() => {
    if (!recording || paused) { if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current); watchId.current = null; return; }
    if (!navigator.geolocation) { setGpsMessage("This browser does not provide location services. Use manual map points instead."); setGpsRetryAvailable(true); setTrackingStatus("error"); setRecording(false); return; }
    setTrackingStatus("connecting");
    setGpsMessage("Requesting location permission. Keep this page open while walking around the boundary.");
    watchId.current = navigator.geolocation.watchPosition(acceptPosition, geoError => {
      setGpsRetryAvailable(true);
      if (boundaryLengthRef.current > 0) { setGpsGapDetected(true); setGapReviewConfirmed(false); }
      if (geoError.code === 1) { setGpsMessage("Location permission was denied. Allow location access in your browser or phone settings, then retry GPS, or use manual map mode."); setTrackingStatus("error"); setRecording(false); }
      else if (geoError.code === 3) { setGpsMessage("GPS is taking too long. Move outdoors and retry, or continue with manual map points."); setTrackingStatus("connecting"); }
      else { setGpsMessage("GPS signal is unavailable. Check your device location setting and retry, or use manual map mode."); setTrackingStatus("error"); }
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
    return () => { if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current); watchId.current = null; };
  }, [acceptPosition, gpsRetryKey, paused, recording]);

  const handleMapUserPan = useCallback(() => setFollowGps(false), []);

  function handleMapClick(point) {
    if (movingPoint != null) {
      const selectedPoint = movingPoint + 1;
      setHasGpsTrack(false);
      setBoundary(points => points.map((item, index) => index === movingPoint ? point : item));
      setMeasurement(null); setGapReviewConfirmed(false);
      setAccuracy(null); setAccuracySamples([]);
      setGpsMessage(`Boundary point ${selectedPoint} moved.`); setMovingPoint(null); return;
    }
    if (manualMode) {
      setHasGpsTrack(false);
      setBoundary(points => [...points, point]);
      setMeasurement(null); setGapReviewConfirmed(false);
      setAccuracy(null); setAccuracySamples([]);
      setGpsMessage(`Manual boundary point ${boundary.length + 1} added.`);
    }
  }

  function toggleManualMode() {
    if (recording && !paused) {
      setPaused(true); setTrackingStatus("paused"); setFollowGps(false);
      lastAcceptedPosition.current = null;
      if (boundaryLengthRef.current > 0) { setGpsGapDetected(true); setGapReviewConfirmed(false); }
    }
    const nextMode = !manualMode;
    setManualMode(nextMode); setMovingPoint(null);
    setGpsMessage(nextMode ? "Manual editing is on. Tap the map to add corners; select a boundary dot to move or remove it." : "Manual editing is off. Turn it on before tapping the map to add corners.");
  }

  function selectBoundaryPoint(index) {
    if (recording && !paused) {
      setPaused(true); setTrackingStatus("paused"); setFollowGps(false); lastAcceptedPosition.current = null;
      if (boundaryLengthRef.current > 0) { setGpsGapDetected(true); setGapReviewConfirmed(false); }
    }
    setMovingPoint(index); setManualMode(true);
    setGpsMessage(`Boundary point ${index + 1} selected. Tap the map to move it, or remove the selected point.`);
  }

  function startMapping() {
    const accessError = gpsAccessError();
    if (accessError) { setGpsMessage(accessError); setGpsRetryAvailable(true); setTrackingStatus("error"); return; }
    if (boundary.length && !window.confirm("Start a fresh GPS trace? The saved farm boundary will remain unchanged until you save the new measurement.")) return;
    if (boundary.length) { setBoundary([]); setMeasurement(null); setAccuracySamples([]); }
    elapsedMappingMs.current = 0; activeMappingStartedAt.current = null; setRecordingDurationSeconds(0);
    lastAcceptedPosition.current = null;
    setGpsWalkDistance(0); setHasGpsTrack(false); setGpsGapDetected(false); setGapReviewConfirmed(false); setManualMode(false); setFollowGps(true); setCurrentPosition(null); setAccuracySamples([]);
    setError(""); setMessage(""); setAccuracy(null); setGpsRetryAvailable(false); setRecording(true); setPaused(false); setTrackingStatus("connecting"); setGpsMessage("Waiting for a high-accuracy GPS fix. Keep this page open while walking around the boundary.");
  }

  function togglePause() {
    const next = !paused;
    if (!next && manualMode) { setGpsMessage("Turn off manual editing before resuming live GPS recording."); return; }
    if (next && boundaryLengthRef.current > 0) { setGpsGapDetected(true); setGapReviewConfirmed(false); }
    setPaused(next);
    setTrackingStatus(next ? "paused" : "connecting");
    setGpsMessage(next ? "Mapping paused. Resume before continuing to record GPS points." : "Reconnecting to GPS. Wait for a reliable fix before continuing to walk.");
    if (next) lastAcceptedPosition.current = null;
  }

  function retryGps() {
    const accessError = gpsAccessError();
    if (accessError) {
      setGpsMessage(accessError);
      return;
    }
    lastAcceptedPosition.current = null;
    setFollowGps(true);
    setGpsRetryAvailable(false); setAccuracy(null); setPaused(false); setTrackingStatus("connecting"); setGpsMessage("Requesting a fresh high-accuracy GPS fix…");
    if (recording) setGpsRetryKey(key => key + 1);
    else setRecording(true);
  }
  function finishMapping() {
    setError(""); setMessage("");
    let result;
    try { result = measureBoundary(boundary); }
    catch (err) { setMeasurement(null); setGpsMessage(`${err.message} Keep mapping until GPS records the boundary, or turn on manual editing to place the corners yourself.`); return; }
    const closingDistance = distanceBetweenPoints(boundary[0], boundary.at(-1));
    const warning = closingDistance > 20 ? " The last point is far from the start, so the closing edge may leave an unrecorded section." : "";
    if (!window.confirm(`Finish this outline and close the boundary to its starting point? The closing edge is ${closingDistance.toFixed(1)} m.${warning} Review the outline on the map before saving.`)) return;
    setRecording(false); setPaused(false); setFollowGps(false);
    setMeasurement(result); setTrackingStatus("completed"); setGpsMessage(`Boundary completed with ${boundary.length} points. Review the estimate and any GPS gaps before saving.`);
  }
  function clearBoundary() {
    if (!window.confirm("Clear all unsaved boundary points?")) return;
    elapsedMappingMs.current = 0; activeMappingStartedAt.current = null; setRecordingDurationSeconds(0);
    setRecording(false); setPaused(false); setBoundary([]); setMeasurement(null); setAccuracySamples([]); lastAcceptedPosition.current = null; setGpsWalkDistance(0); setHasGpsTrack(false); setGpsGapDetected(false); setGapReviewConfirmed(false); setMovingPoint(null); setFollowGps(false); setError(""); setTrackingStatus("ready"); setGpsMessage("Boundary cleared. Your saved farm records are unchanged.");
  }
  function selectLand(land) {
    const hasUnsavedBoundary = boundary.length > 0 && (!measurement || String(land.id) !== selectedId);
    if ((recording || hasUnsavedBoundary) && !window.confirm("Discard the unsaved boundary points and open this saved farm?")) return;
    lastAcceptedPosition.current = null;
    setRecording(false); setPaused(false); setManualMode(false); setMovingPoint(null); setFollowGps(false); setGpsGapDetected(false); setGapReviewConfirmed(false);
    elapsedMappingMs.current = 0; activeMappingStartedAt.current = null; setRecordingDurationSeconds(0);
    setMapCenter(hasSavedLocation(land) ? landCenter(land) : defaultMapCenter); setMapZoom(hasSavedLocation(land) ? 18 : defaultMapZoom); setFocusKey(key => key + 1);
    setCurrentPosition(null); setAccuracy(land.gps_accuracy_m == null ? null : Number(land.gps_accuracy_m)); setAccuracySamples([]);
    setSelectedId(String(land.id)); setBoundary(toPoints(land)); setLocationConfirmation(""); setMeasurement(land.area_square_meters ? { areaSquareMeters:Number(land.area_square_meters), areaHectares:Number(land.size_hectares), areaAcres:Number(land.area_acres), perimeterMeters:Number(land.perimeter_meters), walkingDistanceMeters:land.walking_distance_meters == null ? null : Number(land.walking_distance_meters) } : null); setGpsWalkDistance(land.walking_distance_meters == null ? 0 : Number(land.walking_distance_meters)); setHasGpsTrack(land.gps_accuracy_m != null && land.walking_distance_meters != null); setTrackingStatus(hasSavedLocation(land) ? "ready" : "idle");
    setForm({ name:land.name || "", barangay:land.barangay || "", municipality:land.municipality || "", province:land.province || "", region:land.region || "", cropTypes:(land.crop_types || []).join(", "), address:land.address || "", notes:land.notes || "" });
    setError(""); setMessage(""); setGpsMessage(hasSavedLocation(land) ? `Editing ${land.name || "farm record"}. Start mapping to collect GPS points or use manual map mode to adjust the boundary.` : `Editing ${land.name || "farm record"}. This record has no saved GPS location yet; use your current location or place points manually.`);
  }
  function newFarm(skipDiscardConfirmation = false) {
    if (!skipDiscardConfirmation && (recording || boundary.length) && !window.confirm("Start a new farm and clear the current map points? Any saved farm boundary stays unchanged until you save an edit.")) return;
    initialFarmFocus.current = true; lastAcceptedPosition.current = null; elapsedMappingMs.current = 0; activeMappingStartedAt.current = null; setRecordingDurationSeconds(0); setRecording(false); setPaused(false); setManualMode(false); setMovingPoint(null); setFollowGps(false); setGpsGapDetected(false); setGapReviewConfirmed(false); setSelectedId(""); setMapCenter(defaultMapCenter); setMapZoom(defaultMapZoom); setFocusKey(key => key + 1); setCurrentPosition(null); setBoundary([]); setMeasurement(null); setAccuracySamples([]); setGpsWalkDistance(0); setHasGpsTrack(false); setLocationConfirmation(""); setTrackingStatus("idle"); setForm({ name:"", barangay:"", municipality:"", province:"", region:"", cropTypes:"", address:"", notes:"" }); setError(""); setMessage("");
  }

  function locateMyFarm() {
    const selectedLand = lands.find(land => String(land.id) === selectedId);
    const land = selectedLand || lands.find(hasSavedLocation);
    if (!land || !hasSavedLocation(land)) {
      setGpsMessage("No saved farm coordinates are available yet. Select a farm with a mapped boundary or use your current location to find the farm on the map.");
      return;
    }
    setFollowGps(false);
    setMapCenter(landCenter(land)); setMapZoom(18); setFocusKey(key => key + 1);
    setGpsMessage(`Map centered on ${land.name || "your saved farm"}. Its saved coordinates were not changed.`);
  }

  function locateCurrentPosition() {
    const accessError = gpsAccessError();
    if (accessError) {
      setGpsMessage(accessError);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude, heading: Number.isFinite(position.coords.heading) ? Number(position.coords.heading) : null };
      setCurrentPosition(point); setAccuracy(Number(position.coords.accuracy));
      setMapCenter([point.latitude, point.longitude]); setMapZoom(18); setFocusKey(key => key + 1);
      setFollowGps(false);
      setTrackingStatus("ready");
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
    setHasGpsTrack(false); setAccuracy(null); setAccuracySamples([]); setGapReviewConfirmed(false); setGpsMessage(`Boundary point ${movingPoint + 1} removed.`); setMovingPoint(null); setMeasurement(null);
  }

  function undoPoint() {
    if (recording && !paused) {
      setPaused(true); setTrackingStatus("paused"); lastAcceptedPosition.current = null;
      if (boundaryLengthRef.current > 0) { setGpsGapDetected(true); setGapReviewConfirmed(false); }
    }
    setBoundary(points => points.slice(0, -1));
    setHasGpsTrack(false); setAccuracy(null); setAccuracySamples([]); setGapReviewConfirmed(false); setMeasurement(null); setMovingPoint(null);
  }

  async function saveFarm(event) {
    event.preventDefault(); setError(""); setMessage("");
    let measured;
    try { measured = measureBoundary(boundary); }
    catch (err) { setError(err.message); return; }
    if (!measurement) { setError("Finish and review the boundary before saving its measurement."); return; }
    if (!form.name.trim() || !form.barangay.trim() || !form.municipality.trim() || !form.province.trim()) { setError("Enter the farm name, barangay, municipality, and province before saving."); return; }
    if (!locationConfirmed) { setError("Review the map boundary and farm location details, then confirm that they refer to the same farm before saving."); return; }
    if (gpsGapDetected && !gapReviewConfirmed) { setError("Review the GPS gap warning, add any missing boundary corners, then confirm that the outline is complete."); return; }
    setSaving(true);
    const averageAccuracy = accuracySamples.length ? accuracySamples.reduce((sum, value) => sum + value, 0) / accuracySamples.length : hasGpsTrack ? accuracy : null;
    const body = { ...form, cropTypes:form.cropTypes.split(",").map(item=>item.trim()).filter(Boolean), boundary:boundary.map(point=>({latitude:point.latitude,longitude:point.longitude})), gpsAccuracyM:averageAccuracy, walkingDistanceMeters:hasGpsTrack ? gpsWalkDistance : measured.walkingDistanceMeters };
    try {
      const result = selectedId
        ? await api(`/farmers/lands/${selectedId}`, {token, method:"PATCH", body:JSON.stringify(body)})
        : await api("/farmers/lands", {token, method:"POST", body:JSON.stringify(body)});
      setMessage(`${result.land.name || "Farm"} saved. The mapped area is an estimate, not a survey measurement.`);
      setSelectedId(String(result.land.id)); setBoundary(toPoints(result.land)); setMeasurement(measured); setGpsWalkDistance(Number(result.land.walking_distance_meters ?? measured.walkingDistanceMeters)); setHasGpsTrack(result.land.gps_accuracy_m != null); setGpsGapDetected(false); setGapReviewConfirmed(false); await reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function removeFarm(land) {
    if (!window.confirm(`Delete ${land.name || "this farm"}? Existing damage reports may prevent deletion.`)) return;
    setError(""); setMessage("");
    try { await api(`/farmers/lands/${land.id}`, {token, method:"DELETE"}); if (String(land.id) === selectedId) newFarm(true); setMessage("Farm record deleted."); await reload(); }
    catch (err) { setError(err.message); }
  }

  const accuracyWarning = accuracy == null ? null : accuracy > maxMappingAccuracyMeters ? "GPS uncertainty is too high for reliable mapping. Weak fixes are excluded from the boundary; wait for a better outdoor signal." : accuracy > 10 ? "GPS uncertainty may affect the estimate. Review the boundary on the map." : "The reported GPS uncertainty is low, but phone GPS is still not survey-grade.";
  const recordingDuration = formatDuration(recordingDurationSeconds);
  const trackingLabel = recording ? paused ? "Paused" : trackingStatus === "recording" ? "Recording" : trackingStatus === "weak" ? "Weak GPS signal" : trackingStatus === "error" ? "GPS unavailable" : "GPS connecting" : trackingStatus === "completed" ? "Completed" : trackingStatus === "ready" ? "GPS ready" : "Not recording";
  const trackingTone = trackingStatus === "completed" ? "bg-sky-100 text-sky-800" : recording && trackingStatus === "recording" ? "bg-emerald-100 text-emerald-800" : paused || trackingStatus === "weak" ? "bg-amber-100 text-amber-900" : trackingStatus === "error" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600";
  const mapProviderLabel = mapLayer === "clean" ? "OpenStreetMap clean map" : mapboxTokenIsPublic ? "Mapbox Satellite" : "Esri World Imagery";

  return <AppShell onLogout={onLogout}><PageHeader eyebrow="Farmer portal" title="GPS farm mapping" description="Walk the farm perimeter or place boundary points on the map. Area, walking distance, and perimeter are estimates from the points you record." action={<button type="button" onClick={() => newFarm()} className={button}>New farm</button>}/>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message && <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,.8fr)]">
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Map the farm boundary</h2><p className="mt-1 text-xs leading-5 text-slate-500">Walk along the field edge. The map opens in satellite view and follows your phone while GPS mapping is active.</p></div><div role="status" aria-live="polite" className={`rounded-full px-3 py-1.5 text-xs font-bold ${trackingTone}`}>{trackingLabel}</div></div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold text-slate-600">Pinch to zoom, drag to pan, or use the map controls.</p><p className="mt-1 text-[11px] text-slate-500">{mapProviderLabel} · {mapLayer === "satellite" ? "imagery detail and capture dates vary by location." : "roads and place labels depend on local map coverage."}</p></div>
          <div role="group" aria-label="Map style" className="inline-flex rounded-lg border border-emerald-200 bg-white p-1">
            <button type="button" aria-pressed={mapLayer === "satellite"} onClick={() => setMapLayer("satellite")} className={`rounded-md px-3 py-1.5 text-xs font-bold ${mapLayer === "satellite" ? "bg-emerald-700 text-white" : "text-emerald-800 hover:bg-emerald-50"}`}>Satellite</button>
            <button type="button" aria-pressed={mapLayer === "clean"} onClick={() => setMapLayer("clean")} className={`rounded-md px-3 py-1.5 text-xs font-bold ${mapLayer === "clean" ? "bg-emerald-700 text-white" : "text-emerald-800 hover:bg-emerald-50"}`}>Clean map</button>
          </div>
        </div>
        <div className="mb-2 grid gap-2 sm:flex sm:flex-wrap"><button type="button" className={`${button} w-full sm:w-auto`} onClick={locateMyFarm}>Locate My Farm</button><button type="button" className={`${button} w-full sm:w-auto`} onClick={locateCurrentPosition} disabled={locating}>{locating ? "Locating..." : "Use My Current Location"}</button>{currentPosition && <button type="button" className={`${button} w-full sm:w-auto`} aria-pressed={followGps} onClick={() => setFollowGps(value => !value)}>{followGps ? "Stop following location" : "Follow My Location"}</button>}</div>
        <div className="farm-mapping-map relative h-[min(70vh,45rem)] min-h-80 overflow-hidden rounded-lg border border-slate-200">
          <Suspense fallback={<div className="h-full animate-pulse bg-slate-200" aria-hidden="true"/>}>
            {mapboxTokenIsPublic && mapLayer === "satellite"
              ? <FarmMappingMap accessToken={configuredMapboxToken} center={mapCenter} zoom={mapZoom} focusKey={focusKey} boundary={boundary} movingPoint={movingPoint} currentPosition={currentPosition} accuracy={accuracy} followGps={followGps} onMapClick={handleMapClick} onSelectBoundaryPoint={selectBoundaryPoint} onUserPan={handleMapUserPan} onReady={handleMapReady} onError={handleMapError}/>
              : <EsriFarmMappingMap layer={mapLayer} center={mapCenter} zoom={mapZoom} focusKey={focusKey} boundary={boundary} movingPoint={movingPoint} currentPosition={currentPosition} accuracy={accuracy} followGps={followGps} onMapClick={handleMapClick} onSelectBoundaryPoint={selectBoundaryPoint} onUserPan={handleMapUserPan} onReady={handleMapReady} onError={handleMapError}/>}
          </Suspense>
          {mapStatus === "loading" && <div className="pointer-events-none absolute inset-x-0 top-3 z-[1100] mx-auto w-fit rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow" role="status" aria-live="polite">Loading {mapProviderLabel}...</div>}
        </div>
        {mapError && <p role="alert" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">{mapError}</p>}
        <p className="mt-2 text-[11px] leading-5 text-slate-500">{mapLayer === "satellite" ? `Satellite imagery is not live. Current phone GPS supplies the position and farm boundary; it does not update the imagery itself.${!mapboxTokenIsPublic ? " Esri imagery at this Bongabong view is capped at its verified native zoom level 18." : ""}` : "Clean street map with roads and labels; OpenStreetMap attribution is shown on the map."}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><button type="button" className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50" onClick={recording ? finishMapping : startMapping} disabled={saving}>{recording ? "Finish Mapping" : "Start Mapping"}</button>{recording && <button type="button" className={button} onClick={togglePause}>{paused ? "Resume Mapping" : "Pause Mapping"}</button>}<button type="button" className={button} onClick={undoPoint} disabled={!boundary.length}>Undo point</button><button type="button" className={`${button} ${manualMode ? "border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-900" : ""}`} aria-pressed={manualMode} onClick={toggleManualMode}>{manualMode ? "Manual editing on" : "Add / edit points"}</button><button type="button" className={button} onClick={()=>setMovingPoint(null)} disabled={movingPoint==null}>Done moving point</button><button type="button" className={button} onClick={removeSelectedPoint} disabled={movingPoint==null}>Remove selected point</button><button type="button" className={button} onClick={clearBoundary} disabled={!boundary.length}>Clear boundary</button></div>
        <p role="status" aria-live="polite" className={`mt-3 rounded-lg p-3 text-xs leading-5 ${manualMode ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-600"}`}>{manualMode ? "Manual editing is ON: tap the map to add a corner. Select a boundary dot, then tap elsewhere to move it, or remove it." : "Manual editing is OFF. Turn on Add / edit points before tapping the map to add corners."}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span>GPS accuracy: <b>{accuracy == null ? "Not available" : `±${accuracy.toFixed(1)} m (device reported)`}</b></span><span>GPS coordinates: <b>{currentPosition ? `${currentPosition.latitude.toFixed(6)}, ${currentPosition.longitude.toFixed(6)}` : "Waiting for location"}</b></span><span>Recording time: <b>{recordingDuration}</b></span><span>Boundary points: <b>{boundary.length}</b></span><span>Map points: <b>{manualMode ? "Tap map to add; select a dot to edit it" : "Manual mode off"}</b></span></div>
        <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 text-xs leading-5 ${accuracy != null && accuracy > maxMappingAccuracyMeters || gpsRetryAvailable ? "text-amber-800" : "text-slate-500"}`}><p>{gpsMessage}</p>{gpsRetryAvailable && <button type="button" className={button} onClick={retryGps}>Try GPS Again</button>}</div>
        {gpsGapDetected && <div role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><p className="font-bold">GPS points were skipped because the signal was inaccurate or interrupted.</p><p className="mt-1">Inspect the whole outline. Turn on manual editing to add missing corners or adjust the line across the gap before saving.</p><label className="mt-2 flex items-start gap-2 font-semibold"><input type="checkbox" className="mt-0.5 accent-amber-700" checked={gapReviewConfirmed} onChange={event => setGapReviewConfirmed(event.target.checked)}/><span>I reviewed the map and confirmed the farm outline is complete.</span></label></div>}
      </section>

      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-900">Measurement estimate</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${trackingTone}`}>GPS: {trackingLabel}</span></div><div className="mt-3 grid grid-cols-2 gap-3"><Metric label="GPS accuracy" value={accuracy == null ? "Not available" : `±${accuracy.toFixed(1)} m`}/><Metric label="Boundary points" value={String(boundary.length)}/><Metric label={hasGpsTrack ? "Distance walked" : "Boundary path"} value={`${(hasGpsTrack ? gpsWalkDistance : walkingDistanceMeters).toFixed(1)} m`}/><Metric label="Recording time" value={recordingDuration}/><Metric label="Area" value={calculated ? `${calculated.areaSquareMeters.toLocaleString(undefined,{maximumFractionDigits:0})} m²` : "—"}/><Metric label="Farm perimeter" value={calculated ? `${calculated.perimeterMeters.toFixed(1)} m` : "—"}/><Metric label="Hectares" value={calculated ? `${calculated.areaHectares.toFixed(4)} ha` : "—"}/><Metric label="Acres" value={calculated ? `${calculated.areaAcres.toFixed(3)} ac` : "—"}/></div>{!calculated && <p className="mt-3 text-sm text-slate-500">Record at least three reliable boundary points to calculate area and farm perimeter.</p>}{calculated && <p className="mt-2 text-[11px] text-slate-500">GPS distance includes active tracking segments and excludes pauses and the final closing line.</p>}{accuracyWarning && <p className={`mt-3 rounded-lg p-3 text-xs leading-5 ${accuracy > 20 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{accuracyWarning}</p>}<p className="mt-3 text-[11px] leading-5 text-slate-500">These measurements are GPS estimates, not official land surveys. Ordinary phone GPS is not survey-grade. Actual planted area can be smaller than the total farm boundary.</p></section>
        <form onSubmit={saveFarm} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div><h2 className="font-bold text-slate-900">{selectedId ? "Save farm boundary" : "Save mapped farm"}</h2><p className="mt-1 text-xs text-slate-500">Mapped area and boundary-derived coordinates are stored on the existing land record.</p></div>
          <Field label="Farm name"><input className={input} maxLength="150" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. North rice field"/></Field>
          <Field label="Barangay"><input className={input} maxLength="120" required value={form.barangay} onChange={e=>setForm({...form,barangay:e.target.value})}/></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Municipality"><input className={input} required value={form.municipality} onChange={e=>setForm({...form,municipality:e.target.value})}/></Field><Field label="Province"><input className={input} required value={form.province} onChange={e=>setForm({...form,province:e.target.value})}/></Field></div>
          <Field label="Region (optional)"><input className={input} value={form.region} onChange={e=>setForm({...form,region:e.target.value})}/></Field>
          <Field label="Primary crops (comma separated)"><input className={input} value={form.cropTypes} onChange={e=>setForm({...form,cropTypes:e.target.value})} placeholder="Rice, corn, vegetables"/></Field>
          <Field label="Address or sitio (optional)"><input className={input} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></Field>
          <Field label="Farm notes (optional)"><textarea className={input} rows="2" maxLength="2000" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
          {boundaryCenter && calculated && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950"><p className="font-bold">Farm pin to be saved from this boundary</p><p>Latitude {boundaryCenter.latitude.toFixed(6)} · Longitude {boundaryCenter.longitude.toFixed(6)}</p><p className="mt-1">These coordinates are derived from the boundary points, not the default map center or a separate live GPS reading.</p><label className="mt-3 flex items-start gap-2 font-semibold"><input type="checkbox" className="mt-0.5 accent-emerald-800" checked={locationConfirmed} onChange={event=>setLocationConfirmation(event.target.checked ? locationFingerprint : "")}/><span>I checked that the boundary, barangay, municipality, province, and farm details describe the same location.</span></label></div>}
          <button type="submit" className="min-h-11 w-full rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50" disabled={saving || recording || !calculated || !measurement || !locationConfirmed || (gpsGapDetected && !gapReviewConfirmed)}>{saving ? "Saving farm…" : selectedId ? "Save updated boundary" : "Save farm profile"}</button>
        </form>
      </div>
    </div>

    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Saved farms</h2><p className="mt-1 text-xs text-slate-500">Select a farm to review or remap it. Crop detection and damage reports already use these land records.</p></div>{loading && <span className="text-xs text-slate-500">Loading…</span>}</div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{lands.map(land=><article key={land.id} className={`rounded-lg border p-4 ${String(land.id)===selectedId ? "border-emerald-400 bg-emerald-50/50" : "border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{land.name || "Farm land"}</h3><p className="mt-1 text-xs text-slate-500">{[land.barangay,land.municipality,land.province].filter(Boolean).join(", ") || "Location not provided"}</p></div><button type="button" onClick={()=>removeFarm(land)} className="text-xs font-bold text-red-700 hover:underline">Delete</button></div>{land.boundary_geojson ? <><p className="mt-3 text-sm text-emerald-900">{Number(land.area_square_meters).toLocaleString(undefined,{maximumFractionDigits:0})} m² · {Number(land.size_hectares).toFixed(4)} ha · {Number(land.area_acres).toFixed(3)} acres</p><p className="mt-1 text-xs text-slate-500">Perimeter {Number(land.perimeter_meters).toFixed(1)} m · {land.boundary_geojson.coordinates?.[0]?.length ? land.boundary_geojson.coordinates[0].length-1 : 0} points · GPS {land.measurement_quality || "manual"}</p></> : <p className="mt-3 text-xs text-amber-800">Saved land pin only; map its perimeter to calculate an area.</p>}<button type="button" className={`${button} !w-full mt-3`} onClick={()=>selectLand(land)}>{String(land.id)===selectedId ? "Selected for editing" : "Review / remap"}</button><MeasurementHistory token={token} landId={land.id}/></article>)}{!loading && !lands.length && <p className="text-sm text-slate-500">No saved farm records yet.</p>}</div></section>
  </AppShell>;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m ${String(remainder).padStart(2, "0")}s` : `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function Field({ label, children }) { return <label className="block text-xs font-bold text-slate-700">{label}{children}</label>; }
function Metric({ label, value }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-extrabold text-emerald-950">{value}</p></div>; }
function MeasurementHistory({ token, landId }) {
  const [rows, setRows] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const result = await api(`/farmers/lands/${landId}/measurements`, {token}); setRows(result.measurements); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return <div className="mt-2"><button type="button" onClick={load} disabled={loading} className="w-full py-1 text-xs font-bold text-sky-800 hover:underline disabled:opacity-50">{loading ? "Loading history…" : rows ? "Refresh measurement history" : "View measurement history"}</button>{error && <p className="mt-1 text-xs text-red-700">{error}</p>}{rows && <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-2">{rows.map(item=><p key={item.id} className="text-[10px] leading-4 text-slate-600"><b>{new Date(item.measured_at).toLocaleString()}</b> · {Number(item.area_square_meters).toLocaleString(undefined,{maximumFractionDigits:0})} m² · {Number(item.area_hectares).toFixed(4)} ha · walked {item.walking_distance_meters == null ? "not recorded" : `${Number(item.walking_distance_meters).toFixed(1)} m`} · {item.measurement_quality}</p>)}{!rows.length && <p className="text-[10px] text-slate-500">No perimeter measurement has been saved yet.</p>}</div>}</div>;
}
