import { useEffect, useRef } from "react";
import * as mapboxgl from "mapbox-gl/esm";
import "mapbox-gl/dist/mapbox-gl.css";

const emptyFeatureCollection = { type: "FeatureCollection", features: [] };

function toMapboxCenter(center) {
  return [Number(center?.[1]), Number(center?.[0])];
}

function boundaryFeatures(points) {
  const coordinates = points
    .map(point => [Number(point.longitude), Number(point.latitude)])
    .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
  const features = [];
  if (coordinates.length >= 2) {
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } });
  }
  if (coordinates.length >= 3) {
    features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...coordinates, coordinates[0]]] } });
  }
  return { type: "FeatureCollection", features };
}

function pointFeatures(points, movingPoint) {
  return {
    type: "FeatureCollection",
    features: points.map((point, index) => ({
      type: "Feature",
      properties: { index, selected: index === movingPoint },
      geometry: { type: "Point", coordinates: [Number(point.longitude), Number(point.latitude)] },
    })),
  };
}

function accuracyFeature(position, accuracy) {
  const radius = Number(accuracy);
  if (!position || !Number.isFinite(radius) || radius <= 0) return emptyFeatureCollection;
  const earthRadius = 6_371_008.8;
  const latitude = Number(position.latitude);
  const longitude = Number(position.longitude);
  const latitudeRadians = latitude * Math.PI / 180;
  const longitudeScale = Math.max(0.01, Math.cos(latitudeRadians));
  const ring = [];
  for (let step = 0; step < 64; step += 1) {
    const angle = step * Math.PI * 2 / 64;
    const offsetLatitude = radius * Math.cos(angle) / earthRadius * 180 / Math.PI;
    const offsetLongitude = radius * Math.sin(angle) / (earthRadius * longitudeScale) * 180 / Math.PI;
    ring.push([longitude + offsetLongitude, latitude + offsetLatitude]);
  }
  ring.push(ring[0]);
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }],
  };
}

function positionFeature(position) {
  if (!position) return emptyFeatureCollection;
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [Number(position.longitude), Number(position.latitude)] },
    }],
  };
}

function setSourceData(map, sourceId, data) {
  const source = map.getSource(sourceId);
  if (source) source.setData(data);
}

export default function FarmMappingMap({
  accessToken,
  center,
  zoom,
  focusKey,
  boundary,
  movingPoint,
  currentPosition,
  accuracy,
  followGps,
  onMapClick,
  onSelectBoundaryPoint,
  onUserPan,
  onReady,
  onError,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const focusKeyRef = useRef(focusKey);
  const latestRef = useRef({ center, zoom, focusKey, boundary, movingPoint, currentPosition, accuracy, followGps, onMapClick, onSelectBoundaryPoint, onUserPan, onReady, onError });
  latestRef.current = { center, zoom, focusKey, boundary, movingPoint, currentPosition, accuracy, followGps, onMapClick, onSelectBoundaryPoint, onUserPan, onReady, onError };

  useEffect(() => {
    if (!containerRef.current || !accessToken) return undefined;
    let map;
    try {
      map = new mapboxgl.Map({
        accessToken,
        container: containerRef.current,
        style: "mapbox://styles/mapbox/satellite-v9",
        center: toMapboxCenter(center),
        zoom,
        minZoom: 3,
        maxZoom: 21,
        maxPitch: 0,
        pitch: 0,
        dragRotate: false,
        touchPitch: false,
        touchZoomRotate: true,
        attributionControl: { compact: true, customAttribution: '<a href="https://www.maxar.com/" target="_blank" rel="noopener">© Maxar</a>' },
        logoPosition: "bottom-left",
        renderWorldCopies: false,
      });
    } catch {
      latestRef.current.onError?.("Mapbox could not start. This device needs a WebGL2-capable browser or Android System WebView.");
      return undefined;
    }

    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.dragRotate.disable();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-left");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");

    const handleLoad = () => {
      map.addSource("farm-outline-source", { type: "geojson", data: emptyFeatureCollection });
      map.addLayer({
        id: "farm-boundary-fill",
        type: "fill",
        source: "farm-outline-source",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#10b981", "fill-opacity": 0.2 },
      });
      map.addLayer({
        id: "farm-boundary-outline-shadow",
        type: "line",
        source: "farm-outline-source",
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
        paint: { "line-color": "#052e2b", "line-width": 7, "line-opacity": 0.82, "line-join": "round", "line-cap": "round" },
      });
      map.addLayer({
        id: "farm-boundary-outline",
        type: "line",
        source: "farm-outline-source",
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
        paint: { "line-color": "#facc15", "line-width": 3.5, "line-join": "round", "line-cap": "round" },
      });
      map.addSource("farm-points-source", { type: "geojson", data: emptyFeatureCollection });
      map.addLayer({
        id: "farm-boundary-points",
        type: "circle",
        source: "farm-points-source",
        paint: {
          "circle-radius": ["case", ["boolean", ["get", "selected"], false], 10, 7],
          "circle-color": ["case", ["boolean", ["get", "selected"], false], "#f97316", "#facc15"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });
      map.addSource("gps-accuracy-source", { type: "geojson", data: emptyFeatureCollection });
      map.addLayer({
        id: "gps-accuracy-area",
        type: "fill",
        source: "gps-accuracy-source",
        paint: { "fill-color": "#3b82f6", "fill-opacity": 0.13 },
      });
      map.addLayer({
        id: "gps-accuracy-outline",
        type: "line",
        source: "gps-accuracy-source",
        paint: { "line-color": "#60a5fa", "line-width": 1.5, "line-opacity": 0.8 },
      });
      map.addSource("gps-position-source", { type: "geojson", data: emptyFeatureCollection });
      map.addLayer({
        id: "gps-position-halo",
        type: "circle",
        source: "gps-position-source",
        paint: { "circle-radius": 15, "circle-color": "#3b82f6", "circle-opacity": 0.28 },
      });
      map.addLayer({
        id: "gps-position-dot",
        type: "circle",
        source: "gps-position-source",
        paint: { "circle-radius": 7, "circle-color": "#2563eb", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
      });

      const latest = latestRef.current;
      setSourceData(map, "farm-outline-source", boundaryFeatures(latest.boundary));
      setSourceData(map, "farm-points-source", pointFeatures(latest.boundary, latest.movingPoint));
      setSourceData(map, "gps-accuracy-source", accuracyFeature(latest.currentPosition, latest.accuracy));
      setSourceData(map, "gps-position-source", positionFeature(latest.currentPosition));
      const initialCenter = latest.followGps && latest.currentPosition
        ? [latest.currentPosition.longitude, latest.currentPosition.latitude]
        : toMapboxCenter(latest.center);
      map.jumpTo({ center: initialCenter, zoom: latest.zoom });
      focusKeyRef.current = latest.focusKey;
      readyRef.current = true;
      latest.onReady?.();
      map.resize();
    };
    const handleError = event => {
      const status = Number(event?.error?.status);
      const message = status === 401 || status === 403
        ? "Mapbox rejected the public token. Check that it is active, allowed for this app's origin, and has read access to styles and tiles."
        : "Mapbox satellite imagery could not load. Check the connection and Mapbox service status.";
      latestRef.current.onError?.(message);
    };
    const handleClick = event => {
      if (!readyRef.current) return;
      const feature = map.queryRenderedFeatures(event.point, { layers: ["farm-boundary-points"] })[0];
      if (feature) {
        latestRef.current.onSelectBoundaryPoint?.(Number(feature.properties.index));
        return;
      }
      latestRef.current.onMapClick?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };
    const handleDragStart = () => latestRef.current.onUserPan?.();
    map.on("load", handleLoad);
    map.on("error", handleError);
    map.on("click", handleClick);
    map.on("dragstart", handleDragStart);

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map.resize());
    if (observer) observer.observe(containerRef.current);

    return () => {
      readyRef.current = false;
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  // The Mapbox map is intentionally initialized once; props are synchronized by the effects below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    setSourceData(map, "farm-outline-source", boundaryFeatures(boundary));
    setSourceData(map, "farm-points-source", pointFeatures(boundary, movingPoint));
  }, [boundary, movingPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    setSourceData(map, "gps-accuracy-source", accuracyFeature(currentPosition, accuracy));
    setSourceData(map, "gps-position-source", positionFeature(currentPosition));
  }, [accuracy, currentPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || focusKeyRef.current === focusKey) return;
    focusKeyRef.current = focusKey;
    map.easeTo({ center: toMapboxCenter(center), zoom, duration: 550, essential: true });
  }, [center, focusKey, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !followGps || !currentPosition) return;
    map.easeTo({ center: [currentPosition.longitude, currentPosition.latitude], duration: 350, essential: true });
  }, [currentPosition, followGps]);

  return <div ref={containerRef} className="mapbox-farm-map h-full w-full" aria-label="Farm boundary satellite map" role="application"/>;
}
