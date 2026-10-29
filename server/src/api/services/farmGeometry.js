const earthRadiusMeters = 6_371_008.8;
const toRadians = degrees => degrees * Math.PI / 180;

function pointMeters(point, referenceLatitude) {
  const [longitude, latitude] = point;
  return [earthRadiusMeters * toRadians(longitude) * Math.cos(toRadians(referenceLatitude)), earthRadiusMeters * toRadians(latitude)];
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}

export function measureFarmBoundary(input) {
  let points = input;
  if (typeof points === "string") { try { points = JSON.parse(points); } catch { points = null; } }
  if (points?.type === "Polygon") points = points.coordinates?.[0];
  if (!Array.isArray(points) || points.length < 3 || points.length > 2000) throw Object.assign(new Error("A farm boundary must contain between 3 and 2,000 points."), { status: 422 });
  const ring = points.map(point => {
    const longitude = Number(Array.isArray(point) ? point[0] : point?.longitude);
    const latitude = Number(Array.isArray(point) ? point[1] : point?.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) throw Object.assign(new Error("Boundary points need valid longitude and latitude coordinates."), { status: 422 });
    return [longitude, latitude];
  });
  if (Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1]) < 1e-9) ring.pop();
  const unique = [];
  for (const point of ring) if (!unique.some(other => Math.hypot((point[0] - other[0]) * 111320 * Math.cos(toRadians(point[1])), (point[1] - other[1]) * 111320) < 1)) unique.push(point);
  if (unique.length < 3) throw Object.assign(new Error("Add at least three distinct boundary points."), { status: 422 });
  const referenceLatitude = unique.reduce((sum, point) => sum + point[1], 0) / unique.length;
  const projected = unique.map(point => pointMeters(point, referenceLatitude));
  for (let i = 0; i < projected.length; i += 1) {
    const nextI = (i + 1) % projected.length;
    for (let j = i + 1; j < projected.length; j += 1) {
      const nextJ = (j + 1) % projected.length;
      if (i === j || nextI === j || nextJ === i) continue;
      if (segmentsIntersect(projected[i], projected[nextI], projected[j], projected[nextJ])) throw Object.assign(new Error("The boundary crosses itself. Adjust the points so the farm outline does not overlap."), { status: 422 });
    }
  }
  let areaAccumulator = 0, perimeter = 0;
  for (let i = 0; i < unique.length; i += 1) {
    const [lon1, lat1] = unique[i], [lon2, lat2] = unique[(i + 1) % unique.length];
    areaAccumulator += toRadians(lon2 - lon1) * (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
    const dLat = toRadians(lat2 - lat1), dLon = toRadians(lon2 - lon1);
    const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    perimeter += 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }
  const areaSquareMeters = Math.abs(areaAccumulator) * earthRadiusMeters ** 2 / 2;
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters < 4 || areaSquareMeters > 5_000_000_000) throw Object.assign(new Error("The measured boundary area is too small or too large to save. Check the points and map scale."), { status: 422 });
  const closedRing = [...unique, [...unique[0]]];
  const center = unique.reduce((acc, [lng, lat]) => [acc[0] + lng / unique.length, acc[1] + lat / unique.length], [0, 0]);
  return {
    boundaryGeojson: { type: "Polygon", coordinates: [closedRing] },
    pointCount: unique.length,
    areaSquareMeters,
    areaHectares: areaSquareMeters / 10_000,
    areaAcres: areaSquareMeters / 4_046.8564224,
    perimeterMeters: perimeter,
    longitude: center[0],
    latitude: center[1],
  };
}
