import test from "node:test";
import assert from "node:assert/strict";
import { measureFarmBoundary } from "./farmGeometry.js";

const squarePath = [
  [121.4800, 12.7500],
  [121.4810, 12.7500],
  [121.4810, 12.7510],
  [121.4800, 12.7510],
];

test("calculates an open walking route separately from the closed farm perimeter", () => {
  const result = measureFarmBoundary(squarePath);
  assert.ok(result.areaSquareMeters > 11_000 && result.areaSquareMeters < 13_000);
  assert.ok(result.perimeterMeters > 435 && result.perimeterMeters < 445);
  assert.ok(result.walkingDistanceMeters > 325 && result.walkingDistanceMeters < 335);
  assert.ok(result.walkingDistanceMeters < result.perimeterMeters);
});

test("counts the farmer's final return to the start as walked distance", () => {
  const result = measureFarmBoundary([...squarePath, squarePath[0]]);
  assert.ok(Math.abs(result.walkingDistanceMeters - result.perimeterMeters) < 1);
});

test("rejects boundaries with fewer than three distinct points", () => {
  assert.throws(() => measureFarmBoundary([[121.48, 12.75], [121.480001, 12.75], [121.480002, 12.75]]), /three distinct/i);
});
