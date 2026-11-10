import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import { coordinatesFromPosition, currentWeatherQuery, getCurrentPosition, locationFailureMessage } from "../services/currentLocation.js";

const labels = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Foggy", 48: "Foggy", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 80: "Rain showers", 81: "Rain showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail" };
const condition = code => labels[code] || "Current conditions";
const metricColors = {
  Condition: "border-emerald-200 bg-emerald-50 text-emerald-950",
  Temperature: "border-orange-200 bg-orange-50 text-orange-950",
  "Feels like": "border-amber-200 bg-amber-50 text-amber-950",
  Humidity: "border-sky-200 bg-sky-50 text-sky-950",
  Wind: "border-violet-200 bg-violet-50 text-violet-950",
  Rain: "border-blue-200 bg-blue-50 text-blue-950",
};
const rememberedLocationKey = "agrisystem-weather-manual-location-v1";
const autoDeniedKey = "agrisystem-weather-location-denied-v1";
const Metric = ({ label, value }) => <div className={`rounded-md border p-4 ${metricColors[label] || "border-slate-200 bg-white text-slate-900"}`}><p className="text-xs font-medium opacity-70">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;

function formatDate(value, timeZone) {
  if (!value) return "time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "time unavailable";
  try { return date.toLocaleString(undefined, { ...(timeZone ? { timeZone } : {}), dateStyle: "medium", timeStyle: "short" }); }
  catch { return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
}

function formatNumber(value, suffix, digits = 0) {
  return value == null || !Number.isFinite(Number(value)) ? "Unavailable" : `${Number(value).toFixed(digits)}${suffix}`;
}

function readRememberedLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(rememberedLocationKey) || "null");
    if (!saved || !Number.isFinite(saved.latitude) || !Number.isFinite(saved.longitude) || !saved.label) return null;
    if (saved.latitude < -90 || saved.latitude > 90 || saved.longitude < -180 || saved.longitude > 180) return null;
    return saved;
  } catch { return null; }
}

function wasAutoLocationDenied() {
  try { return sessionStorage.getItem(autoDeniedKey) === "1"; }
  catch { return false; }
}

export default function BongabongWeather({ token }) {
  const [coordinates, setCoordinates] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [data, setData] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [weatherError, setWeatherError] = useState("");
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectionSource, setSelectionSource] = useState("");
  const requestId = useRef(0);

  const refreshWeather = useCallback(async (point, request = requestId.current, displayName = "", rememberManual = false) => {
    if (!point) return;
    setLoading(true);
    setWeatherError("");
    try {
      if (navigator.onLine === false) throw new Error("No internet connection is available. Reconnect and retry the weather request.");
      const result = await api(`/weather/current-location?${currentWeatherQuery(point)}`, { token });
      if (requestId.current === request) {
        setData({ ...result, ...(displayName ? { location: displayName } : {}) });
        if (rememberManual && displayName) {
          try { localStorage.setItem(rememberedLocationKey, JSON.stringify({ ...point, label: displayName })); } catch { /* Storage may be unavailable in private browsing. */ }
        }
      }
    } catch (error) {
      if (requestId.current === request) {
        const networkFailure = navigator.onLine === false || error.message?.includes("Cannot reach the AgriSystem server");
        setWeatherError(networkFailure ? "Could not reach the weather service. Check your internet connection and try again." : error.message || "Weather data is temporarily unavailable. Please try again.");
      }
    } finally {
      if (requestId.current === request) setLoading(false);
    }
  }, [token]);

  const requestLocation = useCallback(async () => {
    const request = ++requestId.current;
    setLocating(true);
    setLocationError("");
    setWeatherError("");
    try {
      const position = await getCurrentPosition();
      if (requestId.current !== request) return;
      const point = coordinatesFromPosition(position);
      setCoordinates(point);
      setLocationLabel("");
      setSelectionSource("gps");
      setData(null);
      try { sessionStorage.removeItem(autoDeniedKey); localStorage.removeItem(rememberedLocationKey); } catch { /* Storage is optional. */ }
      setLocating(false);
      await refreshWeather(point, request);
    } catch (error) {
      if (requestId.current !== request) return;
      if (error?.code === 1) { try { sessionStorage.setItem(autoDeniedKey, "1"); } catch { /* Storage is optional. */ } }
      setLocating(false);
      setLocationError(error.message || locationFailureMessage(error));
    }
  }, [refreshWeather]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      const saved = readRememberedLocation();
      if (saved) {
        const request = ++requestId.current;
        setCoordinates({ latitude: saved.latitude, longitude: saved.longitude });
        setLocationLabel(saved.label);
        setSelectionSource("manual");
        await refreshWeather(saved, request, saved.label);
        return;
      }
      if (wasAutoLocationDenied()) {
        setLocationError(locationFailureMessage({ code: 1 }));
        return;
      }
      try {
        const permission = await navigator.permissions?.query?.({ name: "geolocation" });
        if (!active) return;
        if (permission?.state === "denied") {
          setLocationError(locationFailureMessage({ code: 1 }));
          return;
        }
      } catch { /* Geolocation permission queries are not supported in every browser. */ }
      if (active) void requestLocation();
    }, 0);
    return () => { active = false; window.clearTimeout(timer); requestId.current += 1; };
  }, [refreshWeather, requestLocation]);

  async function searchLocation(event) {
    event.preventDefault();
    const query = searchText.trim();
    if (query.length < 2) { setSearchError("Enter at least two characters to search for a place."); return; }
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const result = await api(`/weather/locations/search?q=${encodeURIComponent(query)}`, { token });
      setSearchResults(result.locations || []);
      if (!result.locations?.length) setSearchError("No matching places were found. Try a barangay, town, or city name.");
    } catch (error) { setSearchError(error.message || "Place search is unavailable. Check your connection and try again."); }
    finally { setSearching(false); }
  }

  async function selectManualLocation(place) {
    const point = { latitude: Number(place.latitude), longitude: Number(place.longitude) };
    const request = ++requestId.current;
    setCoordinates(point);
    setLocationLabel(place.label);
    setSelectionSource("manual");
    setLocationError("");
    setData(null);
    setSearchResults([]);
    setSearchError("");
    await refreshWeather(point, request, place.label, true);
  }

  function forgetManualLocation() {
    requestId.current += 1;
    try { localStorage.removeItem(rememberedLocationKey); } catch { /* Storage is optional. */ }
    setCoordinates(null);
    setLocationLabel("");
    setSelectionSource("");
    setData(null);
    setLoading(false);
    setWeatherError("");
    setLocationError("Choose Allow Location to use device GPS, or search for a place manually.");
  }

  const weather = data?.weather;
  const today = data?.today;
  return <section className="mx-auto mt-6 w-full max-w-3xl overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-gradient-to-r from-emerald-900 to-emerald-700 p-3 text-white sm:p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Current location weather</p>
        <h3 className="mt-1 truncate text-lg font-semibold">{locationLabel || data?.location || (locating ? "Finding your location" : "Choose a weather location")}</h3>
        <p className="mt-1 text-sm text-emerald-100">{selectionSource === "manual" ? "Weather forecast for the place you selected." : coordinates ? "Forecast for your device's latest GPS location." : "Allow location access or search for a place to see local weather."}</p>
      </div>
      <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
        <button type="button" onClick={requestLocation} disabled={locating} className="min-h-11 min-w-0 flex-1 rounded-md border border-white/50 bg-white/10 px-2 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-wait disabled:opacity-60 sm:flex-none sm:px-3 sm:text-sm">{locating ? "Finding location…" : coordinates ? "Retry Location" : "Allow Location"}</button>
        {coordinates && <button type="button" onClick={() => refreshWeather(coordinates, ++requestId.current, locationLabel, selectionSource === "manual")} disabled={loading || locating} className="min-h-11 min-w-0 flex-1 rounded-md border border-white/50 bg-white/10 px-2 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-wait disabled:opacity-60 sm:flex-none sm:px-3 sm:text-sm">{loading ? "Refreshing…" : "Refresh weather"}</button>}
      </div>
    </div>

    <p className="mt-3 text-xs leading-5 text-slate-600">Device GPS coordinates are used for this weather request and are not saved to your farm record. A manually selected place is remembered on this device so weather can load again next time; use “Forget saved place” to remove it.</p>
    {locating && <p role="status" className="mt-4 rounded-md border border-sky-200 bg-white p-3 text-sm text-sky-900">Waiting for phone location permission and a GPS fix…</p>}
    {locationError && <div role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><p>{locationError}</p><button type="button" onClick={requestLocation} disabled={locating} className="mt-2 font-bold text-emerald-800 underline disabled:opacity-60">Retry Location</button></div>}
    {weatherError && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-800"><p>{weatherError}</p><button type="button" onClick={() => refreshWeather(coordinates, ++requestId.current, locationLabel, selectionSource === "manual")} disabled={!coordinates || loading} className="mt-2 font-bold underline disabled:opacity-60">Retry weather</button></div>}

    <form onSubmit={searchLocation} className="mt-4 rounded-md border border-emerald-200 bg-white p-4">
      <label className="block text-sm font-semibold text-slate-800" htmlFor="weather-place-search">Search by barangay, town, or city</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input id="weather-place-search" value={searchText} onChange={event => setSearchText(event.target.value)} maxLength={120} placeholder="e.g. Bongabong, Oriental Mindoro" className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" disabled={searching} className="min-h-11 w-full rounded-md bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-60 sm:w-auto">{searching ? "Searching…" : "Search places"}</button>
      </div>
      {searching && <p role="status" className="mt-2 text-xs text-slate-500">Searching place names…</p>}
      {searchError && <p role="alert" className="mt-2 text-xs text-amber-800">{searchError}</p>}
      {searchResults.length > 0 && <ul className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-100">{searchResults.map((place, index) => <li key={`${place.latitude}-${place.longitude}-${index}`}><button type="button" onClick={() => selectManualLocation(place)} disabled={loading} className="min-h-11 w-full px-3 py-2 text-left text-sm font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-60">{place.label}</button></li>)}</ul>}
      {selectionSource === "manual" && <button type="button" onClick={forgetManualLocation} className="mt-3 text-xs font-semibold text-slate-500 underline">Forget saved place</button>}
      <p className="mt-2 text-[11px] leading-4 text-slate-500">Place search by OpenStreetMap contributors. Search a place if you prefer not to share device GPS.</p>
    </form>

    {coordinates && !weather && !weatherError && !locationError && <p role="status" className="mt-4 rounded-md border border-emerald-200 bg-white p-4 text-sm text-slate-600">{loading ? "Loading current conditions and forecast…" : "Weather is not available yet."}</p>}
    {weather && <>
      {data?.notice && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{data.notice}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">{[["Condition", condition(weather.weather_code)], ["Temperature", formatNumber(weather.temperature_2m, " °C")], ["Feels like", formatNumber(weather.apparent_temperature, " °C")], ["Humidity", formatNumber(weather.relative_humidity_2m, "%")], ["Wind", formatNumber(weather.wind_speed_10m, " km/h")], ["Rain", formatNumber(weather.rain, " mm", 1)]].map(([label, value]) => <Metric key={label} label={label} value={value}/>)}</div>
      {today && <div className="mt-5 rounded-md border border-emerald-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Today's forecast · {today.date || "date unavailable"}</p><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-slate-500">High / low:</span> <b className="text-slate-900">{formatNumber(today.temperatureMax, "°")} / {formatNumber(today.temperatureMin, "°C")}</b></p><p><span className="text-slate-500">Rain chance:</span> <b className="text-slate-900">{formatNumber(today.rainChance, "%")}</b></p><p><span className="text-slate-500">Expected precipitation:</span> <b className="text-slate-900">{formatNumber(today.rainTotal, " mm", 1)}</b></p></div></div>}
      <p className="mt-4 text-xs leading-5 text-slate-500">Model time: {formatDate(data?.observedAt, data?.timezone)} · Retrieved: {formatDate(data?.fetchedAt)}. Forecasts are model estimates for this area. Weather by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="font-semibold underline">Open-Meteo</a>; place names by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="font-semibold underline">OpenStreetMap</a>.</p>
    </>}
  </section>;
}
