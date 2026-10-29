import test from "node:test";
import assert from "node:assert/strict";
import { coordinatesFromPosition, currentWeatherQuery, getCurrentPosition, locationFailureMessage } from "./currentLocation.js";

test("reads one current browser position using a fresh, high-accuracy GPS request", async () => {
  const position = { coords: { latitude: 40.7128, longitude: -74.006 } };
  let options;
  const geolocation = { getCurrentPosition(success, _failure, requestedOptions) { options = requestedOptions; success(position); } };

  assert.equal(await getCurrentPosition(geolocation), position);
  assert.deepEqual(options, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
});

test("explains denied location permission and permits retry through the same API", async () => {
  const geolocation = { getCurrentPosition(_success, failure) { failure({ code: 1 }); } };
  await assert.rejects(getCurrentPosition(geolocation), /permission was denied/i);
});

test("explains unavailable and timed-out GPS fixes", () => {
  assert.match(locationFailureMessage({ code: 2 }), /could not determine/i);
  assert.match(locationFailureMessage({ code: 3 }), /too long/i);
});

test("reports when browser geolocation is unsupported", async () => {
  await assert.rejects(getCurrentPosition(null), /does not provide GPS location/i);
});

test("keeps weather requests tied to each device's own coordinates", () => {
  const first = coordinatesFromPosition({ coords: { latitude: 40.7128123, longitude: -74.0060456 } });
  const second = coordinatesFromPosition({ coords: { latitude: 12.74642, longitude: 121.48741 } });
  assert.notDeepEqual(first, second);
  assert.equal(currentWeatherQuery(first), "latitude=40.71281&longitude=-74.00605");
  assert.equal(currentWeatherQuery(second), "latitude=12.74642&longitude=121.48741");
});
