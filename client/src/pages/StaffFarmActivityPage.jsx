import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import FarmBoundaryMap from "../components/FarmBoundaryMap.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Pagination from "../components/Pagination.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api } from "../services/api.js";
import useRealtimeRefresh from "../hooks/useRealtimeRefresh.js";

const count = value => new Intl.NumberFormat("en-PH").format(Number(value || 0));

export default function StaffFarmActivityPage({ token, onLogout, role = "staff" }) {
  const [farms, setFarms] = useState([]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("farmer");
  const [pageNumber, setPageNumber] = useState(1);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setFarms((await api("/admin/farm-activity", { token })).farms || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(token, load);
  useEffect(() => { setPageNumber(1); }, [query, sortBy]);

  async function openFarm(farm) {
    setSelected(farm); setDetailLoading(true); setDetail(null); setError("");
    try { setDetail(await api(`/admin/farmers/${farm.farmer_id}`, { token })); }
    catch (err) { setError(err.message); }
    finally { setDetailLoading(false); }
  }

  const filtered = farms.filter(farm => `${farm.farmer_name} ${farm.name || ""} ${farm.barangay || ""} ${(farm.crop_types || []).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const visible = [...filtered].sort((a, b) => sortBy === "area" ? Number(b.size_hectares || 0) - Number(a.size_hectares || 0) : (sortBy === "farm" ? (a.name || "Farm land") : (a.farmer_name || "")).localeCompare(sortBy === "farm" ? (b.name || "Farm land") : (b.farmer_name || ""), "en"));
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(pageNumber, pageCount);
  const visibleFarms = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const farm = detail?.lands?.find(item => String(item.id) === String(selected?.id)) || selected;
  const scans = (detail?.detections || []).filter(item => String(item.land_id) === String(selected?.id));
  const reports = (detail?.reports || []).filter(item => String(item.land_id) === String(selected?.id));

  return <AppShell role={role} onLogout={onLogout}>
    <PageHeader eyebrow="MAO operations" title="Farm & crop records" description="See each farmer’s registered farm, mapped area, Crop Detection history, and submitted damage reports together." action={<div className="flex gap-2"><a href="#review" className="button !w-auto">Review reports</a><button type="button" onClick={load} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800">Refresh</button></div>}/>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="mt-6 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-extrabold">Registered farm records</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading farms…" : `${count(visible.length)} of ${count(farms.length)} farm(s)`}</p></div><div className="grid w-full gap-2 sm:w-auto sm:min-w-[25rem] sm:grid-cols-[minmax(0,1fr)_160px]"><input aria-label="Search farms" value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Farmer, farm, crop, or barangay"/><select aria-label="Sort farm records" value={sortBy} onChange={event => setSortBy(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="farmer">Sort: farmer name</option><option value="farm">Sort: farm name</option><option value="area">Sort: area, largest first</option></select></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Farmer / Farm</th><th className="px-4 py-3">Barangay</th><th className="px-4 py-3">Registered crops</th><th className="px-4 py-3">Measured area</th><th className="px-4 py-3">Linked activity</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="6" className="p-8 text-center text-sm text-slate-500">Loading farm records...</td></tr> : visibleFarms.map(item => <tr key={item.id} className={`border-t border-slate-100 ${String(selected?.id) === String(item.id) ? "bg-emerald-50" : ""}`}><td className="px-4 py-4"><b className="block">{item.farmer_name}</b><span className="text-xs text-slate-500">{item.name || "Farm land"} · {item.contact_number}</span></td><td className="px-4 py-4">{item.barangay || "Not recorded"}</td><td className="px-4 py-4">{(item.crop_types || []).join(", ") || "Not recorded"}</td><td className="px-4 py-4">{item.size_hectares == null ? "Not measured" : `${Number(item.size_hectares).toFixed(4)} ha`}</td><td className="px-4 py-4">{count(item.scan_count)} scans · {count(item.report_count)} reports</td><td className="px-4 py-4 text-right"><button type="button" disabled={detailLoading} onClick={() => openFarm(item)} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">{detailLoading ? "Opening..." : "Open farm records"}</button></td></tr>)}</tbody></table></div>
      <Pagination page={currentPage} pageCount={pageCount} total={visible.length} start={(currentPage - 1) * pageSize + 1} end={Math.min(currentPage * pageSize, visible.length)} onPageChange={setPageNumber}/>
      {!loading && !visible.length && <p className="p-6 text-center text-sm text-slate-500">No farm records match your search.</p>}
    </section>

    {selected && <section className="mt-6 rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{selected.farmer_name}</p><h2 className="mt-1 text-xl font-extrabold">{selected.name || "Farm land"}</h2><p className="mt-1 text-sm text-slate-500">{[selected.barangay, selected.municipality, selected.province].filter(Boolean).join(", ") || "Location not recorded"} · {selected.contact_number}</p></div><div className="flex gap-2"><a href="#farmers" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">Farmer directory</a><a href="#review" className="button !w-auto">Open report review</a></div></div>
      {detailLoading ? <p className="mt-5 animate-pulse rounded-lg bg-slate-100 p-8 text-center text-sm text-slate-500">Loading farmer records…</p> : detail && <>
        <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><FarmBoundaryMap land={farm} height="h-64"/><p className="mt-2 text-xs text-slate-500">{farm.area_square_meters ? `${Number(farm.area_square_meters).toLocaleString()} m² · ${Number(farm.size_hectares).toFixed(4)} ha · ${Number(farm.area_acres || 0).toFixed(4)} acres` : "No measured boundary saved"}{farm.perimeter_meters ? ` · ${Number(farm.perimeter_meters).toFixed(1)} m perimeter` : ""}</p></div>
          <div><h3 className="font-bold">Crop Detection scans ({scans.length})</h3><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{scans.map(scan => <article key={scan.id} className="flex gap-3 rounded-lg border border-slate-200 p-3"><a href={scan.image_url} target="_blank" rel="noreferrer"><img src={scan.image_url} alt={`${scan.crop_name} crop scan`} className="h-16 w-16 rounded object-cover"/></a><div><b>{scan.crop_name}</b><p className="text-xs text-slate-500">{Math.round(Number(scan.confidence || 0) * 100)}% confidence · {new Date(scan.created_at).toLocaleString()}</p><p className="text-xs text-slate-500">{scan.health_status || "Condition not recorded"}</p></div></article>)}{!scans.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No scans are linked to this farm.</p>}</div></div></div>
        <div className="mt-6"><div className="flex items-center justify-between"><h3 className="font-bold">Damage reports ({reports.length})</h3><a href="#review" className="text-sm font-bold text-emerald-700">Go to review queue →</a></div><div className="mt-3 grid gap-3 lg:grid-cols-2">{reports.map(report => <article key={report.id} className="rounded-lg border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><b>{report.confirmed_plant || report.ai_detected_plant || "Crop not specified"} · {report.confirmed_damage_type || report.ai_detected_damage_type || "Damage pending"}</b><p className="mt-1 text-xs text-slate-500">Report #{report.id} · {new Date(report.created_at).toLocaleString()}</p></div><StatusBadge value={report.status}/></div><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">{report.farmer_notes}</p><div className="mt-3 flex gap-2">{report.photos?.slice(0, 3).map(photo => <a key={photo.id} href={photo.fileUrl} target="_blank" rel="noreferrer"><img src={photo.fileUrl} alt="Damage report evidence" className="h-14 w-14 rounded object-cover"/></a>)}</div></article>)}{!reports.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No submitted reports for this farm.</p>}</div></div>
      </>}
    </section>}
  </AppShell>;
}
