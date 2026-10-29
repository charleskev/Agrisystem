import { getFarmerByUserId } from "../models/farmerModel.js";
import { listLandsByFarmer } from "../models/landModel.js";
import { getLand, saveWeatherSnapshot } from "../models/weatherModel.js";
import { getWeatherForLand } from "../services/weatherService.js";
import { normalizeCoordinates, readablePlaceName, resolveFarmerWeatherLand, weatherCacheKey } from "../services/weatherLocation.js";

const cachedWeather = new Map();
const cachedPlaces = new Map();
const weatherCacheTtlMs = 5 * 60 * 1000;
const maxStaleWeatherMs = 24 * 60 * 60 * 1000;
let geocodeQueue = Promise.resolve();
let lastGeocodeAt = 0;

export async function weatherForLand(req, res, next) {
  try {
    const land = await getLand(req.params.landId);
    if (!land) return res.status(404).json({ message: "Land was not found." });
    if (!land.mapped_at) return res.status(422).json({ message: "This farm has no confirmed location. Map or confirm it before viewing farm-specific weather." });
    const coordinates = normalizeCoordinates(land.latitude, land.longitude);
    if (!coordinates) return res.status(422).json({ message: "This farm has missing or invalid coordinates." });
    const weather = await getWeatherForLand(coordinates.latitude, coordinates.longitude);
    if (!weather) return res.status(503).json({ message: "Weather service has not been configured yet." });
    res.json({ snapshot: await saveWeatherSnapshot(land.id, weather) });
  } catch (error) { next(error); }
}

function weatherUrl(latitude, longitude) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max",
    forecast_days: "1", timezone: "auto",
  });
  return url;
}

async function currentWeather(latitudeValue, longitudeValue, location, cacheScope) {
  const coordinates = normalizeCoordinates(latitudeValue, longitudeValue);
  if (!coordinates) throw Object.assign(new Error("The selected location has invalid coordinates."), { status: 422 });
  const { latitude, longitude } = coordinates;
  const cacheKey = weatherCacheKey(cacheScope, latitude, longitude);
  const useCache = cacheScope !== "gps";
  const cache = useCache ? cachedWeather.get(cacheKey) : null;
  if (cache && Date.now() - cache.cachedAt < weatherCacheTtlMs) return { ...cache.payload, location };
  try {
    const response = await fetch(weatherUrl(latitude, longitude), { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Live weather service returned ${response.status}.`);
    const data = await response.json();
    if (!data?.current || !data?.daily?.time?.length) throw new Error("Live weather service returned incomplete data.");
    const payload = {
      location,
      coordinates: { latitude, longitude },
      modelCoordinates: { latitude: data.latitude, longitude: data.longitude },
      observedAt: data.current.time || null,
      fetchedAt: new Date().toISOString(),
      timezone: data.timezone || null,
      weather: data.current,
      today: {
        date: data.daily.time[0], weatherCode: data.daily.weather_code[0],
        temperatureMax: data.daily.temperature_2m_max[0], temperatureMin: data.daily.temperature_2m_min[0],
        rainChance: data.daily.precipitation_probability_max[0], rainTotal: data.daily.precipitation_sum[0], windMax: data.daily.wind_speed_10m_max[0],
      },
      stale: false, notice: null,
    };
    if (useCache) cachedWeather.set(cacheKey, { payload, cachedAt: Date.now() });
    return payload;
  } catch (error) {
    const cached = useCache ? cachedWeather.get(cacheKey) : null;
    if (cached && Date.now() - cached.cachedAt <= maxStaleWeatherMs) return { ...cached.payload, location, stale: true, notice: "Live weather is temporarily unavailable. Showing the most recently retrieved conditions for these coordinates." };
    throw error;
  }
}

async function reverseGeocode(latitude, longitude) {
  // Use municipality-level coordinates and only keep the display label in memory.
  const coarseLatitude = Number(latitude.toFixed(3));
  const coarseLongitude = Number(longitude.toFixed(3));
  const cacheKey = `${coarseLatitude},${coarseLongitude}`;
  const cached = cachedPlaces.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < 24 * 60 * 60 * 1000) return cached.name;

  const lookup = geocodeQueue.then(async () => {
    const queuedCache = cachedPlaces.get(cacheKey);
    if (queuedCache && Date.now() - queuedCache.cachedAt < 24 * 60 * 60 * 1000) return queuedCache.name;
    const delay = Math.max(0, 1000 - (Date.now() - lastGeocodeAt));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastGeocodeAt = Date.now();

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.search = new URLSearchParams({ format: "jsonv2", lat: String(coarseLatitude), lon: String(coarseLongitude), zoom: "10", addressdetails: "1" });
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(7000),
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
          "User-Agent": "SmartFarmAI-Weather/1.0",
          Referer: process.env.CLIENT_ORIGIN || "http://localhost:5173",
        },
      });
      if (!response.ok) return null;
      const result = await response.json();
      const name = readablePlaceName(result.address);
      if (!name) return null;
      if (cachedPlaces.size >= 1000) cachedPlaces.delete(cachedPlaces.keys().next().value);
      cachedPlaces.set(cacheKey, { name, cachedAt: Date.now() });
      return name;
    } catch { return null; }
  });
  geocodeQueue = lookup.then(() => undefined, () => undefined);
  return lookup;
}

export async function currentLocationWeather(req, res, next) {
  const coordinates = normalizeCoordinates(req.query.latitude, req.query.longitude);
  if (!coordinates) return res.status(400).json({ message: "The browser did not provide valid current coordinates. Allow location access and try again." });
  try {
    const weather = await currentWeather(coordinates.latitude, coordinates.longitude, "Your current location", "gps");
    let timeout;
    const location = await Promise.race([
      reverseGeocode(coordinates.latitude, coordinates.longitude),
      new Promise(resolve => { timeout = setTimeout(() => resolve(null), 1800); }),
    ]);
    clearTimeout(timeout);
    const weatherSummary = { ...weather };
    delete weatherSummary.coordinates;
    delete weatherSummary.modelCoordinates;
    res.json({ ...weatherSummary, location: location || "Your current location" });
  } catch (error) {
    const unavailable = new Error("Live weather is temporarily unavailable for your current location. Check your connection and try again.");
    unavailable.status = 503;
    next(unavailable);
  }
}

export async function bongabongWeather(_req, res, next) {
  try { res.json(await currentWeather(12.74642, 121.48741, "Bongabong, Oriental Mindoro", "municipal:Bongabong")); }
  catch (error) { const unavailable = new Error("Live weather is temporarily unavailable. Please refresh again in a moment."); unavailable.status = 503; next(unavailable); }
}

export async function myLandWeather(req, res, next) {
  let selection;
  try {
    const farmer = await getFarmerByUserId(req.user.id);
    if (!farmer) return res.status(404).json({ message: "Farmer profile was not found." });
    const lands = await listLandsByFarmer(farmer.id);
    selection = resolveFarmerWeatherLand(lands, req.query.landId);
  } catch (error) { return next(error); }

  if (selection.status) return res.status(selection.status).json({ message: selection.message });
  const { land, coordinates } = selection;
  const place = [land.name || "Registered farm", land.barangay, land.municipality || "Bongabong", land.province || "Oriental Mindoro"].filter(Boolean).join(" · ");
  try {
    res.json(await currentWeather(coordinates.latitude, coordinates.longitude, place, `farm:${land.id}`));
  } catch (error) {
    const unavailable = new Error("Live weather is temporarily unavailable for this farm. Please refresh again in a moment.");
    unavailable.status = 503;
    next(unavailable);
  }
}
