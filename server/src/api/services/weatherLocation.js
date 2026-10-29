export function normalizeCoordinates(latitudeValue, longitudeValue) {
  if (latitudeValue === null || latitudeValue === undefined || latitudeValue === "" || longitudeValue === null || longitudeValue === undefined || longitudeValue === "") return null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function readablePlaceName(address) {
  if (!address || typeof address !== "object") return null;
  const locality = address.city || address.town || address.village || address.municipality || address.county || address.state_district || address.suburb;
  const region = address.state || address.province || address.region;
  const country = address.country;
  const parts = [locality, region, country].filter((part, index, all) => part && all.indexOf(part) === index);
  return parts.join(", ") || null;
}

export function resolveFarmerWeatherLand(lands, requestedLandId) {
  if (requestedLandId == null || requestedLandId === "") return { status: 400, message: "Select a farm to view its local weather." };
  if (!/^[1-9]\d*$/.test(String(requestedLandId))) return { status: 400, message: "The selected farm is not valid." };

  const land = lands.find(item => String(item.id) === String(requestedLandId));
  if (!land) return { status: 404, message: "The selected farm was not found." };
  if (!land.mapped_at) return { status: 422, message: "Please map or confirm your farm location to get farm-specific weather." };

  const coordinates = normalizeCoordinates(land.latitude, land.longitude);
  if (!coordinates) return { status: 422, message: "This farm has missing or invalid coordinates. Please map or confirm its location." };
  return { land, coordinates };
}

export function weatherCacheKey(scope, latitude, longitude) {
  return `${scope}:${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
}
