import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCoordinates, readablePlaceName, resolveFarmerWeatherLand, weatherCacheKey } from "./weatherLocation.js";

const mappedFarm = (overrides = {}) => ({ id: 12, name: "North Field", latitude: "12.7512", longitude: "121.4893", mapped_at: "2026-10-20T08:00:00.000Z", ...overrides });

test("selects only the requested farmer-owned mapped farm coordinates", () => {
  const result = resolveFarmerWeatherLand([mappedFarm(), mappedFarm({ id: 13, name: "South Field", latitude: "12.7" })], "12");
  assert.equal(result.land.name, "North Field");
  assert.deepEqual(result.coordinates, { latitude: 12.7512, longitude: 121.4893 });
});

test("requires a farm selection instead of silently choosing the newest farm", () => {
  const result = resolveFarmerWeatherLand([mappedFarm()], undefined);
  assert.equal(result.status, 400);
});

test("does not return a farm that is absent from the authenticated farmer's land list", () => {
  const result = resolveFarmerWeatherLand([mappedFarm({ id: 12 })], "99");
  assert.equal(result.status, 404);
});

test("rejects default or otherwise unconfirmed farm coordinates", () => {
  const result = resolveFarmerWeatherLand([mappedFarm({ mapped_at: null })], "12");
  assert.equal(result.status, 422);
  assert.match(result.message, /map or confirm/i);
});

test("rejects missing and out-of-range coordinates", () => {
  assert.equal(normalizeCoordinates(null, 121), null);
  assert.equal(normalizeCoordinates(91, 121), null);
  assert.equal(normalizeCoordinates(12, -181), null);
  assert.deepEqual(normalizeCoordinates("12", "121"), { latitude: 12, longitude: 121 });
});

test("keeps weather cache entries isolated by farm and coordinate", () => {
  const firstFarm = weatherCacheKey("farm:12", 12.75, 121.48);
  assert.notEqual(firstFarm, weatherCacheKey("farm:13", 12.75, 121.48));
  assert.notEqual(firstFarm, weatherCacheKey("farm:12", 12.76, 121.48));
});

test("builds a coarse readable place label from reverse-geocoded locality fields", () => {
  assert.equal(readablePlaceName({ village: "Bongabong", state: "Oriental Mindoro", country: "Philippines" }), "Bongabong, Oriental Mindoro, Philippines");
  assert.equal(readablePlaceName({ city: "Springfield", town: "Ignored town", country: "United States" }), "Springfield, United States");
  assert.equal(readablePlaceName({}), null);
});
