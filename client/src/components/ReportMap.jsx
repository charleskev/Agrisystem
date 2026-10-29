import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function ReportMap({ reports = [], height = "h-72 sm:h-96" }) {
  const validReports = reports.filter(report => report.latitude !== null && report.latitude !== undefined && report.latitude !== "" && report.longitude !== null && report.longitude !== undefined && report.longitude !== "" && Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude)) && Math.abs(Number(report.latitude)) <= 90 && Math.abs(Number(report.longitude)) <= 180);
  const center = validReports.length ? [Number(validReports[0].latitude), Number(validReports[0].longitude)] : [12.8797, 121.774];
  const zoom = validReports.length === 1 ? 16 : validReports.length ? 12 : 5;
  return <div className={`${height} overflow-hidden rounded-xl border border-green-900/10`}>
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
      <TileLayer attribution={"\u00A9 OpenStreetMap contributors"} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      {validReports.map(report => <CircleMarker key={report.id} center={[Number(report.latitude), Number(report.longitude)]} radius={9} pathOptions={{ color: ["resolved", "verified"].includes(report.status) ? "#15803d" : "#d97706", fillOpacity: 0.85 }}>
        <Popup><b>{report.farmer_name}</b><br/>{report.confirmed_plant || report.ai_detected_plant || "Crop pending"}<br/>{report.confirmed_damage_type || report.ai_detected_damage_type || "Damage pending"}</Popup>
      </CircleMarker>)}
    </MapContainer>
  </div>;
}
