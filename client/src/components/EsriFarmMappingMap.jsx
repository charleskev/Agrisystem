import { useEffect, useRef, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, ScaleControl, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const imageryUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const imageryAttribution = '<a href="https://www.esri.com/" target="_blank" rel="noopener">Source: Esri</a>, Vantor, Earthstar Geographics, and the GIS User Community';
const cleanMapUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const cleanMapAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';

function MapBehavior({ center, zoom, focusKey, currentPosition, followGps, maxZoom, onMapClick, onUserPan, onReady }) {
  const map = useMap();
  const latest = useRef({ onMapClick, onUserPan, onReady });
  const lastFocusKey = useRef(focusKey);
  latest.current = { onMapClick, onUserPan, onReady };

  useMapEvents({
    click(event) {
      latest.current.onMapClick?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });

  useEffect(() => {
    const handleDragStart = () => latest.current.onUserPan?.();
    map.on("dragstart", handleDragStart);
    map.whenReady(() => latest.current.onReady?.());
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map.invalidateSize({ pan: false }));
    if (observer) observer.observe(map.getContainer());
    return () => {
      map.off("dragstart", handleDragStart);
      observer?.disconnect();
    };
  }, [map]);

  useEffect(() => {
    map.setMaxZoom(maxZoom);
    if (map.getZoom() > maxZoom) map.setZoom(maxZoom);
  }, [map, maxZoom]);

  useEffect(() => {
    if (lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    map.flyTo(center, Math.min(maxZoom, zoom), { duration: 0.55 });
  }, [center, focusKey, map, maxZoom, zoom]);

  useEffect(() => {
    if (!followGps || !currentPosition) return;
    map.panTo([currentPosition.latitude, currentPosition.longitude], { animate: true, duration: 0.35 });
  }, [currentPosition, followGps, map]);

  return null;
}

export default function EsriFarmMappingMap({
  center,
  zoom,
  focusKey,
  boundary,
  layer = "satellite",
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const positions = boundary.map(point => [Number(point.latitude), Number(point.longitude)]);
  const cleanMap = layer === "clean";
  const maxZoom = cleanMap ? 19 : 18;

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === containerRef.current) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen?.();
    } catch {
      onError?.("Full-screen mode is not available in this browser.");
    }
  }

  return (
    <div ref={containerRef} className="esri-farm-map relative h-full w-full" aria-label="Farm boundary satellite map">
      <MapContainer
        center={center}
        zoom={Math.max(3, Math.min(maxZoom, Number(zoom) || 17))}
        minZoom={3}
        maxZoom={maxZoom}
        scrollWheelZoom
        touchZoom
        doubleClickZoom
        zoomSnap={1}
        zoomDelta={1}
        className="h-full w-full"
      >
        <MapBehavior
          center={center}
          zoom={zoom}
          focusKey={focusKey}
          currentPosition={currentPosition}
          followGps={followGps}
          maxZoom={maxZoom}
          onMapClick={onMapClick}
          onUserPan={onUserPan}
          onReady={onReady}
        />
        <ScaleControl position="bottomleft" metric imperial />
        <TileLayer
          attribution={cleanMap ? cleanMapAttribution : imageryAttribution}
          url={cleanMap ? cleanMapUrl : imageryUrl}
          minZoom={3}
          maxZoom={maxZoom}
          maxNativeZoom={maxZoom}
          eventHandlers={{ tileerror: () => onError?.(`${cleanMap ? "Clean map" : "Esri World Imagery"} could not load. Check the internet connection and try again.`) }}
        />
        {positions.length >= 3 && <Polygon positions={positions} pathOptions={{ color: "#facc15", fillColor: "#10b981", fillOpacity: 0.2, weight: 3 }} />}
        {positions.length === 2 && <Polyline positions={positions} pathOptions={{ color: "#facc15", weight: 4 }} />}
        {boundary.map((point, index) => (
          <CircleMarker
            key={`${index}-${point.latitude}-${point.longitude}`}
            center={[Number(point.latitude), Number(point.longitude)]}
            radius={index === movingPoint ? 9 : 6}
            pathOptions={{ color: "#ffffff", fillColor: index === movingPoint ? "#f97316" : "#facc15", fillOpacity: 1, weight: 2 }}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => onSelectBoundaryPoint?.(index) }}
          />
        ))}
        {currentPosition && Number.isFinite(Number(accuracy)) && Number(accuracy) > 0 && (
          <Circle center={[currentPosition.latitude, currentPosition.longitude]} radius={Number(accuracy)} pathOptions={{ color: "#60a5fa", fillColor: "#3b82f6", fillOpacity: 0.13, weight: 1.5 }} />
        )}
        {currentPosition && <CircleMarker center={[currentPosition.latitude, currentPosition.longitude]} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#2563eb", fillOpacity: 1, weight: 3 }} />}
      </MapContainer>
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-3 top-3 z-[1000] grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-xl font-bold text-slate-800 shadow hover:bg-slate-50"
        aria-label={isFullscreen ? "Exit full-screen map" : "Open full-screen map"}
        aria-pressed={isFullscreen}
        title={isFullscreen ? "Exit full screen" : "Full screen"}
      >
        {isFullscreen ? "×" : "⛶"}
      </button>
    </div>
  );
}
