import { CircleMarker, GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function pointsFrom(geometry) {
  const coordinates = geometry?.coordinates?.[0] || [];
  return coordinates.map(([longitude, latitude]) => [Number(latitude), Number(longitude)]).filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
}

export default function FarmBoundaryMap({ land, height = "h-64" }) {
  const points = pointsFrom(land?.boundary_geojson);
  const center = points.length ? [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length] : [Number(land?.latitude) || 12.8797, Number(land?.longitude) || 121.774];
  return <div className={`${height} overflow-hidden rounded-xl border border-slate-200`}><MapContainer center={center} zoom={points.length ? 16 : 13} scrollWheelZoom className="h-full w-full"><TileLayer attribution="© OpenStreetMap contributors" url={import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}/>{land?.boundary_geojson && <GeoJSON data={land.boundary_geojson} style={{ color: "#047857", weight: 3, fillColor: "#34d399", fillOpacity: .2 }} />}{!land?.boundary_geojson && Number.isFinite(Number(land?.latitude)) && Number.isFinite(Number(land?.longitude)) && <CircleMarker center={center} radius={9} pathOptions={{ color: "#047857", fillOpacity: .75 }} />}</MapContainer></div>;
}
