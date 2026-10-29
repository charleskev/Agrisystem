import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import { coordinatesFromPosition, currentWeatherQuery, getCurrentPosition } from "../services/currentLocation.js";

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

export default function BongabongWeather({ token }) {
  const [coordinates, setCoordinates] = useState(null);
  const [data, setData] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [weatherError, setWeatherError] = useState("");
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const refreshWeather = useCallback(async (point, request = requestId.current) => {
    if (!point) return;
    setLoading(true);
    setWeatherError("");
    try {
      const result = await api(`/weather/current-location?${currentWeatherQuery(point)}`, { token });
      if (requestId.current === request) setData(result);
    } catch (error) {
      if (requestId.current === request) setWeatherError(error.message || "Weather data is temporarily unavailable. Please try again.");
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
      setData(null);
      setLocating(false);
      await refreshWeather(point, request);
    } catch (error) {
      if (requestId.current !== request) return;
      setLocating(false);
      setLocationError(error.message || "Your current location is unavailable. Check your device settings and try again.");
    }
  }, [refreshWeather]);

  useEffect(() => {
    // Deferring to the next task avoids duplicate permission prompts from React StrictMode's effect check.
    const timer = window.setTimeout(() => requestLocation(), 0);
    return () => { window.clearTimeout(timer); requestId.current += 1; };
  }, [requestLocation]);

  const weather = data?.weather;
  const today = data?.today;
  return <section className="mx-auto mt-6 w-full max-w-3xl overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50/70 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-gradient-to-r from-emerald-900 to-emerald-700 p-4 text-white">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Current location weather</p>
        <h3 className="mt-1 truncate text-lg font-semibold">{data?.location || (coordinates ? "Your current location" : "Finding your location")}</h3>
        <p className="mt-1 text-sm text-emerald-100">{coordinates ? "Forecast for your device's latest GPS location." : "Allow location access to get weather for where you are now."}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" onClick={requestLocation} disabled={locating} className="h-fit rounded-md border border-white/50 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-wait disabled:opacity-60">{locating ? "Finding location…" : coordinates ? "Update location" : "Try again"}</button>
        {coordinates && <button type="button" onClick={() => refreshWeather(coordinates, ++requestId.current)} disabled={loading || locating} className="h-fit rounded-md border border-white/50 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-wait disabled:opacity-60">{loading ? "Refreshing…" : "Refresh weather"}</button>}
      </div>
    </div>

    <p className="mt-3 text-xs leading-5 text-slate-600">Location is requested once when this page opens. Coordinates are sent to the weather and map lookup services to provide local conditions and an area name; they are not saved to your farm record. Place names are approximate, while weather uses your GPS coordinates.</p>
    {locating && <p role="status" className="mt-4 rounded-md border border-sky-200 bg-white p-3 text-sm text-sky-900">Waiting for your browser's location permission and GPS…</p>}
    {locationError && <div role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><p>{locationError}</p><button type="button" onClick={requestLocation} disabled={locating} className="mt-2 font-bold text-emerald-800 underline disabled:opacity-60">Try again</button></div>}
    {weatherError && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-800"><p>{weatherError}</p><button type="button" onClick={() => refreshWeather(coordinates, ++requestId.current)} disabled={!coordinates || loading} className="mt-2 font-bold underline disabled:opacity-60">Retry weather</button></div>}
    {coordinates && !weather && !weatherError && !locationError && <p role="status" className="mt-4 rounded-md border border-emerald-200 bg-white p-4 text-sm text-slate-600">{loading ? "Loading current conditions and forecast…" : "Weather is not available yet."}</p>}
    {weather && <>
      {data?.notice && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{data.notice}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">{[["Condition", condition(weather.weather_code)], ["Temperature", formatNumber(weather.temperature_2m, " °C")], ["Feels like", formatNumber(weather.apparent_temperature, " °C")], ["Humidity", formatNumber(weather.relative_humidity_2m, "%")], ["Wind", formatNumber(weather.wind_speed_10m, " km/h")], ["Rain", formatNumber(weather.rain, " mm", 1)]].map(([label, value]) => <Metric key={label} label={label} value={value}/>)}</div>
      {today && <div className="mt-5 rounded-md border border-emerald-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Today's forecast · {today.date || "date unavailable"}</p><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-slate-500">High / low:</span> <b className="text-slate-900">{formatNumber(today.temperatureMax, "°")} / {formatNumber(today.temperatureMin, "°C")}</b></p><p><span className="text-slate-500">Rain chance:</span> <b className="text-slate-900">{formatNumber(today.rainChance, "%")}</b></p><p><span className="text-slate-500">Expected precipitation:</span> <b className="text-slate-900">{formatNumber(today.rainTotal, " mm", 1)}</b></p></div></div>}
      <p className="mt-4 text-xs leading-5 text-slate-500">Model time: {formatDate(data?.observedAt, data?.timezone)} · Retrieved: {formatDate(data?.fetchedAt)}. Forecasts are model estimates for this area. Weather by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="font-semibold underline">Open-Meteo</a>; place names by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="font-semibold underline">OpenStreetMap</a>.</p>
    </>}
  </section>;
}
