const radius = 6_371_008.8;
const radians = degrees => degrees * Math.PI / 180;
const pointMeters = (point, referenceLatitude) => [radius * radians(point.longitude) * Math.cos(radians(referenceLatitude)), radius * radians(point.latitude)];
const distance = (a, b) => {
  const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
};

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}

export function measureBoundary(points) {
  if (!Array.isArray(points) || points.length < 3 || points.length > 2000) throw new Error("A farm boundary must contain between 3 and 2,000 points.");
  let ring = points.map(point => ({ latitude: Number(point.latitude), longitude: Number(point.longitude) }));
  if (ring.some(point => !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || point.latitude < -90 || point.latitude > 90 || point.longitude < -180 || point.longitude > 180)) throw new Error("Boundary points need valid longitude and latitude coordinates.");
  if (distance(ring[0], ring.at(-1)) < 0.01) ring.pop();
  const distinct = [];
  for (const point of ring) if (!distinct.some(other => distance(other, point) < 1)) distinct.push(point);
  ring = distinct;
  if (ring.length < 3) throw new Error("Add at least three distinct boundary points.");
  const referenceLatitude = ring.reduce((sum, point) => sum + point.latitude, 0) / ring.length;
  const projected = ring.map(point => pointMeters(point, referenceLatitude));
  for (let i = 0; i < projected.length; i += 1) {
    const nextI = (i + 1) % projected.length;
    for (let j = i + 1; j < projected.length; j += 1) {
      const nextJ = (j + 1) % projected.length;
      if (i === j || nextI === j || nextJ === i) continue;
      if (segmentsIntersect(projected[i], projected[nextI], projected[j], projected[nextJ])) throw new Error("The boundary crosses itself. Adjust the points so the farm outline does not overlap.");
    }
  }
  let sum = 0, perimeterMeters = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    sum += radians(b.longitude - a.longitude) * (2 + Math.sin(radians(a.latitude)) + Math.sin(radians(b.latitude)));
    perimeterMeters += distance(a, b);
  }
  const areaSquareMeters = Math.abs(sum) * radius ** 2 / 2;
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters < 4 || areaSquareMeters > 5_000_000_000) throw new Error("The measured boundary area is too small or too large to save. Check the points and map scale.");
  const center = ring.reduce((result, point) => ({ latitude: result.latitude + point.latitude / ring.length, longitude: result.longitude + point.longitude / ring.length }), { latitude: 0, longitude: 0 });
  return { ...center, areaSquareMeters, areaHectares: areaSquareMeters / 10000, areaAcres: areaSquareMeters / 4046.8564224, perimeterMeters };
}

export { distance as distanceBetweenPoints };
