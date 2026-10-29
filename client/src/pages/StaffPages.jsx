import { Fragment, useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Pagination from "../components/Pagination.jsx";
import ReportMap from "../components/ReportMap.jsx";
import FarmBoundaryMap from "../components/FarmBoundaryMap.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api } from "../services/api.js";
import useRealtimeRefresh from "../hooks/useRealtimeRefresh.js";

const bongabongBarangays = ["Anilao", "Aplaya", "Bagong Bayan I", "Bagong Bayan II", "Batangan", "Bukal", "Camantigue", "Carmundo", "Cawayan", "Dayhagan", "Formon", "Hagan", "Hagupit", "Ipil", "Kaligtasan", "Labasan", "Labonan", "Libertad", "Lisap", "Luna", "Malitbog", "Mapang", "Masaguisi", "Mina de Oro", "Morente", "Ogbot", "Orconuma", "Poblacion", "Pulosahi", "Sagana", "San Isidro", "San Jose", "San Juan", "Sta. Cruz", "Sigange", "Tawas"];
const csvValue = value => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function StaffDashboard({ token, onLogout, role = "staff" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true); setError("");
    try { setData(await api("/dashboard", { token })); }
    catch (err) { setError(err.message); }
    finally { if (!background) setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(token, load);
  const summary = data?.summary || {};
  const reports = data?.reports || [];
  const dataLoading = loading || !data;
  const today = new Date();

  const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return <AppShell role={role} onLogout={onLogout}>
    <div className="staff-dashboard">
      <header className="staff-dashboard-heading">
        <div>
          <p className="staff-dashboard-breadcrumb"><DashboardIcon name="home"/> Dashboard</p>
          <h1>Staff Dashboard</h1>
          <p className="staff-dashboard-description">Monitor farm activities, manage reports, and support our farmers.</p>
        </div>
        <time className="staff-dashboard-date" dateTime={dateValue}><DashboardIcon name="calendar"/>{today.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</time>
      </header>
      {error && <Notice tone="red">{error} <button onClick={load} className="ml-2 font-bold underline">Try again</button></Notice>}

      <section className="staff-stats-grid" aria-label="Farm and report summary">
        <DashboardMetric icon="farmers" label="Total Farmers" value={dataLoading ? "—" : summary.total_farmers || 0} detail="Registered profiles" tone="green"/>
        <DashboardMetric icon="farms" label="Total Farms" value={dataLoading ? "—" : summary.total_farms || 0} detail="Registered farm records" tone="green"/>
        <DashboardMetric icon="pending" label="Pending Reports" value={dataLoading ? "—" : summary.pending_status_reports || 0} detail="Awaiting review" tone="amber"/>
        <DashboardMetric icon="review" label="Under Review" value={dataLoading ? "—" : summary.under_review_reports || 0} detail="Being reviewed" tone="blue"/>
        <DashboardMetric icon="resolved" label="Resolved Reports" value={dataLoading ? "—" : summary.resolved_reports || 0} detail="Resolved or verified" tone="green"/>
      </section>

      <section className="staff-chart-grid" aria-label="Report analytics">
        <DistributionChart title="Damage reports by category" description="Confirmed labels take priority over AI advisory labels." values={data?.damageByCategory || []} loading={dataLoading}/>
        <SeverityDonut values={data?.severityDistribution || []} loading={dataLoading}/>
      </section>

      <section className="staff-dashboard-bottom">
        <article className="staff-panel staff-quick-actions-panel">
          <div className="staff-section-heading"><div><h2>Quick Actions</h2><p>Access the most common staff tasks and tools.</p></div></div>
          <div className="staff-quick-actions">
            <StaffQuickLink href="#review" icon="review" title="Review Reports" text="Check incoming reports"/>
            {role !== "technician" && <StaffQuickLink href="#farm-activity" icon="farms" title="Farm & Crop Records" text="Open maps and crop activity"/>}
            {role !== "technician" && <StaffQuickLink href="#registrations" icon="registrations" title="Farmer Registrations" text="Review pending applications"/>}
            <StaffQuickLink href="#send-notification" icon="notify" title="Send Notification" text="Share an update with farmers"/>
            <StaffQuickLink href="#announcements" icon="announcement" title="Announcements" text="Review sent announcements"/>
          </div>
        </article>
        <RecentActivity reports={reports} loading={dataLoading}/>
      </section>

      <section className="staff-panel staff-incident-map">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2>Incident map</h2><p>Green markers are verified; amber markers need review.</p></div><span>{reports.length} incidents shown</span></div>
        <div className="mt-4">{dataLoading ? <LoadingBlock/> : <ReportMap reports={reports}/>}</div>
      </section>
      <ReportsTable reports={reports} loading={dataLoading}/>
    </div>
  </AppShell>;
}

function DashboardMetric({ icon, label, value, detail, tone }) {
  return <article className={`staff-metric staff-metric-${tone}`}>
    <span className="staff-metric-icon" aria-hidden="true"><DashboardIcon name={icon}/></span>
    <span className="staff-metric-copy"><span className="staff-metric-label">{label}</span><strong className="staff-metric-value">{value}</strong><span className="staff-metric-detail">{detail}</span></span>
  </article>;
}

function DashboardIcon({ name }) {
  let shape;
  switch (name) {
    case "home": shape = <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></>; break;
    case "calendar": shape = <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>; break;
    case "farmers": shape = <><circle cx="9" cy="8" r="3"/><path d="M3 20c.4-3.5 2.4-5.2 6-5.2s5.6 1.7 6 5.2M17 11a3 3 0 1 0 0-6M17 15c2.3.4 3.7 2 4 5"/></>; break;
    case "farms": shape = <><path d="M12 21V9"/><path d="M12 13c-5.5 0-8-2.8-8-7 5.4 0 8 2.2 8 7ZM12 17c0-4.2 2.6-7 8-7 0 4.2-2.5 7-8 7Z"/></>; break;
    case "pending": shape = <><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v5M12 17h.01"/></>; break;
    case "review": shape = <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M8 11h6"/></>; break;
    case "resolved": shape = <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>; break;
    case "registrations": shape = <><circle cx="9" cy="8" r="3"/><path d="M3 20c.4-3.5 2.4-5.2 6-5.2M18 8v8M14 12h8"/></>; break;
    case "notify": shape = <><path d="M4 5h16v12H9l-5 4z"/><path d="M8 10h8M8 13.5h5"/></>; break;
    case "announcement": shape = <><path d="m3 11 18-6-6 15-3.5-6.5L3 11Z"/><path d="M11.5 13.5 21 5"/></>; break;
    default: shape = <path d="M5 12h14M12 5l7 7-7 7"/>;
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{shape}</svg>;
}

function DistributionChart({ title, description, values = [], loading = false }) {
  const chartValues = values.filter(item => Number(item.total) > 0).slice(0, 8);
  const maximum = Math.max(1, ...chartValues.map(item => Number(item.total) || 0));
  return <section className="staff-panel staff-category-chart">
    <h2 className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    {loading ? <p className="staff-chart-empty animate-pulse">Loading analytics...</p> : chartValues.length ? <div className="staff-category-bars">{chartValues.map(item => { const count = Number(item.total) || 0; const width = Math.max(3, (count / maximum) * 100); return <div key={item.label}><div className="staff-category-label"><span>{item.label}</span><strong>{count}</strong></div><div className="staff-category-track"><span style={{ width: width + "%" }}/></div></div>; })}</div> : <p className="staff-chart-empty">No report category data is available yet.</p>}
  </section>;
}

function SeverityDonut({ values = [], loading = false }) {
  const categories = [
    { label: "Critical", color: "#dc2626" },
    { label: "High", color: "#f97316" },
    { label: "Moderate", color: "#fbbf24" },
    { label: "Low", color: "#45b86b" },
    { label: "Unknown", color: "#94a3b8" },
    { label: "Not assessed", color: "#64748b" },
  ].map(item => ({ ...item, count: Number(values.find(value => String(value.label).toLowerCase() === item.label.toLowerCase())?.total || 0) }));
  const total = categories.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  const stops = categories.filter(item => item.count > 0).map(item => {
    const start = offset;
    offset += (item.count / total) * 100;
    return `${item.color} ${start}% ${offset}%`;
  }).join(", ");
  const legend = categories.filter(item => item.count > 0 || ["High", "Moderate", "Low", "Not assessed"].includes(item.label));
  return <section className="staff-panel staff-severity-panel">
    <h2>AI severity distribution</h2>
    <p className="staff-panel-description">AI advisory or farmer-reported severity; staff verification is tracked separately.</p>
    {loading ? <p className="staff-chart-empty animate-pulse">Loading analytics...</p> : <div className="staff-severity-content">
      <div className="staff-severity-donut" role="img" aria-label={`Severity distribution across ${total} reports`} style={{ background: total ? `conic-gradient(from -90deg, ${stops})` : "#e8efeb" }}><span><small>Total</small><strong>{total}</strong></span></div>
      <ul className="staff-severity-legend">{legend.map(item => <li key={item.label}><span className="staff-severity-legend-label"><i style={{ backgroundColor: item.color }}/>{item.label}</span><strong>{item.count}</strong></li>)}</ul>
      {!total && <p className="staff-severity-empty">No severity assessments yet.</p>}
    </div>}
  </section>;
}

function StaffQuickLink({ href, icon, title, text }) {
  return <a href={href} className="staff-quick-link"><span className="staff-quick-link-icon" aria-hidden="true"><DashboardIcon name={icon}/></span><strong>{title}</strong><span className="staff-quick-link-description">{text}</span><span className="staff-quick-link-arrow" aria-hidden="true">›</span></a>;
}

function RecentActivity({ reports, loading }) {
  return <article className="staff-panel staff-recent-activity">
    <header><div><h2>Recent Activity</h2><p>Latest farmer report submissions</p></div><a href="#review">View all</a></header>
    {loading ? <div className="staff-activity-empty animate-pulse">Loading recent reports...</div> : reports.length ? <ul>{reports.slice(0, 4).map(report => <li key={report.id}>
      <span className={`staff-activity-icon staff-activity-${report.status === "resolved" || report.status === "verified" ? "resolved" : report.status === "reviewing" ? "reviewing" : "pending"}`} aria-hidden="true"><DashboardIcon name="pending"/></span>
      <span className="staff-activity-copy"><strong>Damage report submitted</strong><span>{report.farmer_name || "Farmer"} · {report.confirmed_plant || report.ai_detected_plant || "Crop not recorded"} · {report.land_name || report.barangay || "Farm not specified"}</span></span>
      <span className="staff-activity-meta"><time dateTime={report.created_at}>{relativeTime(report.created_at)}</time><StatusBadge value={report.status}/></span>
    </li>)}</ul> : <div className="staff-activity-empty">No recent report activity yet.</div>}
  </article>;
}

function relativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Date unavailable";
  const minutes = Math.round((timestamp - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}
function LegacyReviewReportsPage({ token, onLogout }) {
  const [reports, setReports] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [updating, setUpdating] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const data = await api("/reports", { token }); setReports(data.reports); } catch (err) { setError(err.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  async function review(id, status) { setUpdating(id); setError(""); try { await api(`/reports/${id}/review`, { token, method: "PATCH", body: JSON.stringify({ status }) }); await load(); } catch (err) { setError(err.message); } finally { setUpdating(""); } }
  return <AppShell role="staff" onLogout={onLogout}><PageHeader eyebrow="MAO operations" title="Review damage reports" description="Verify reports after checking the submitted details and incident location."/>{error && <Notice tone="red">{error}</Notice>}<div className="mt-6 space-y-3">{loading ? <LoadingBlock/> : reports.map(report => <article key={report.id} className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold text-slate-900">{report.farmer_name} <span className="font-normal text-slate-300">/</span> {report.land_name || "Farm land"}</h2><p className="mt-1 text-sm text-slate-500">{report.barangay || "Location not provided"} | {report.confirmed_plant || report.ai_detected_plant || "Crop pending"} | {report.confirmed_damage_type || report.ai_detected_damage_type || "Damage type pending"}</p><p className="mt-2 text-xs text-slate-400">Submitted {new Date(report.created_at).toLocaleString()} | {report.photos?.length || 0} photo(s)</p></div><StatusBadge value={report.status}/></div>{report.status === "pending" && <div className="mt-4 flex gap-2"><button disabled={updating === report.id} className="button !w-auto" onClick={() => review(report.id, "verified")}>{updating === report.id ? "Saving..." : "Verify"}</button><button disabled={updating === report.id} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60" onClick={() => review(report.id, "rejected")}>Reject</button></div>}</article>)}{!loading && !reports.length && <Empty text="No damage reports are waiting for review."/>}</div></AppShell>;
}

export function ReviewReportsPage({ token, onLogout, role = "staff" }) {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [status, setStatus] = useState("pending");
  const [barangay, setBarangay] = useState("");
  const [query, setQuery] = useState("");
  const [farmFilter, setFarmFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setReports((await api("/reports", { token })).reports); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => {
    load();
    if (role !== "technician") api("/admin/review-indicators/reports/mark-seen", { token, method: "POST" }).then(() => window.dispatchEvent(new Event("agrisystem-review-items-seen"))).catch(() => {});
  }, [load, role, token]);
  useRealtimeRefresh(token, load);
  useEffect(() => { setPage(1); setExpanded(null); }, [status, barangay, farmFilter, severityFilter, fromDate, toDate, query]);
  async function review(id, nextStatus, correction = {}) {
    if (updating) return;
    if (nextStatus === "rejected" && !window.confirm("Reject report #" + id + "?")) return;
    setUpdating(id); setError("");
    try { await api(`/reports/${id}/review`, { token, method: "PATCH", body: JSON.stringify({ status: nextStatus, ...correction }) }); await load(); }
    catch (err) { setError(err.message); }
    finally { setUpdating(""); }
  }
  const barangays = bongabongBarangays;
  const filtered = reports.filter(report => (status === "all" || report.status === status || (status === "resolved" && report.status === "verified")) && (!barangay || report.barangay === barangay) && (!farmFilter || String(report.land_id) === farmFilter) && (!severityFilter || (report.reported_severity || report.ai_damage_severity) === severityFilter) && (!fromDate || new Date(report.created_at) >= new Date(`${fromDate}T00:00:00`)) && (!toDate || new Date(report.created_at) <= new Date(`${toDate}T23:59:59`)) && `${report.farmer_name} ${report.contact_number || ""} ${report.land_name || ""} ${report.confirmed_plant || report.ai_detected_plant || ""} ${report.confirmed_damage_type || report.ai_detected_damage_type || ""}`.toLowerCase().includes(query.toLowerCase()));
  const pending = reports.filter(report => ["pending", "reviewing"].includes(report.status)).length;
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleReports = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeReview = reports.find(report => report.id === expanded);
  return <AppShell role={role} onLogout={onLogout}>
    <PageHeader eyebrow="MAO operations" title="Farmer damage reports" description="Review clear, live report records from farmers. Open full details and evidence before taking MAO action." action={<div className="flex flex-wrap gap-2">{role !== "technician" && <a href="#farm-activity" className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800">Farm records</a>}<button type="button" disabled={!filtered.length} onClick={() => downloadReports(filtered)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Export filtered CSV</button><button onClick={load} className="button !w-auto">Refresh</button></div>}/>
    {error && <Notice tone="red">{error}</Notice>}
    <section className="mt-6 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
      <div className="border-b p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-extrabold text-slate-900">Farmer reports</p>
            <p className="mt-1 text-sm text-slate-500">{loading ? "Loading live report data..." : `${filtered.length} of ${reports.length} report(s) | ${pending} awaiting MAO review`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { setQuery(""); setStatus("pending"); setBarangay(""); setFarmFilter(""); setSeverityFilter(""); setFromDate(""); setToDate(""); }} className="text-sm font-bold text-emerald-700 hover:underline">Clear filters</button>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500"/>Realtime</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input aria-label="Search reports" value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm xl:col-span-2" placeholder="Search farmer, crop, or contact"/>
          <select aria-label="Filter reports by status" value={status} onChange={event => setStatus(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="pending">Pending</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option><option value="all">All report statuses</option></select>
          <select aria-label="Filter reports by barangay" value={barangay} onChange={event => setBarangay(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All Bongabong barangays</option>{barangays.map(item => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Filter reports by farm" value={farmFilter} onChange={event => setFarmFilter(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All farms</option>{Array.from(new Map(reports.map(item => [String(item.land_id), item.land_name])).entries()).map(([id, name]) => <option key={id} value={id}>{name || "Farm land"}</option>)}</select>
          <select aria-label="Filter reports by severity" value={severityFilter} onChange={event => setSeverityFilter(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All severities</option>{["Low", "Moderate", "High", "Critical"].map(item => <option key={item}>{item}</option>)}</select>
          <label className="block text-xs font-semibold text-slate-500">From<input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"/></label>
          <label className="block text-xs font-semibold text-slate-500">To<input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"/></label>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Farmer / contact</th><th className="px-5 py-3">Crop and damage</th><th className="px-5 py-3">Barangay</th><th className="px-5 py-3">Evidence</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">MAO action</th></tr></thead><tbody>{visibleReports.map(report => <Fragment key={report.id}><tr className={`border-t border-slate-100 ${expanded === report.id ? "bg-emerald-50/40" : ""}`}><td className="px-5 py-4"><p className="font-bold text-slate-800">{report.farmer_name}</p><p className="mt-1 text-xs text-slate-400">{report.contact_number || "No contact"} | #{report.id}</p></td><td className="px-5 py-4"><p className="font-bold text-slate-800">{report.confirmed_plant || report.ai_detected_plant || "Crop pending"}</p><p className="mt-1 text-xs text-slate-500">{report.confirmed_damage_type || report.ai_detected_damage_type || "Damage pending"}</p></td><td className="px-5 py-4"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800">{report.barangay || "Not provided"}</span><p className="mt-1 text-xs text-slate-400">{report.land_name || "Farm land"}</p></td><td className="px-5 py-4"><p className="font-semibold text-slate-700">{report.photos?.length || 0} photo(s)</p><p className="mt-1 text-xs text-slate-400">{Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude)) ? "GPS saved" : "No GPS pin"}</p></td><td className="px-5 py-4 text-xs text-slate-500">{new Date(report.created_at).toLocaleString()}</td><td className="px-5 py-4"><StatusBadge value={report.status}/></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button type="button" disabled={Boolean(updating)} onClick={() => setExpanded(expanded === report.id ? null : report.id)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">{expanded === report.id ? "Hide" : "View"}</button>{["pending", "reviewing"].includes(report.status) && <><button disabled={Boolean(updating)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60" onClick={() => review(report.id, "reviewing")}>Start review</button>{report.status === "pending" && <button disabled={Boolean(updating)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60" onClick={() => review(report.id, "rejected")}>Reject</button>}</>}</div></td></tr>{expanded === report.id && <tr className="border-t border-emerald-100"><td colSpan="7" className="p-0"><ReportDetails report={report}/></td></tr>}</Fragment>)} </tbody></table></div>
      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} start={(currentPage - 1) * pageSize + 1} end={Math.min(currentPage * pageSize, filtered.length)} onPageChange={setPage}/>
      {activeReview && <ReviewCorrectionForm key={activeReview.id} report={activeReview} saving={Boolean(updating)} onReview={review}/>}
      {!loading && !filtered.length && <Empty text="No reports match the selected filters."/>}
    </section>
  </AppShell>;
}

function ReviewCorrectionForm({ report, saving, onReview }) {
  const [confirmedPlant, setConfirmedPlant] = useState(report.confirmed_plant || report.ai_detected_plant || "");
  const [confirmedDamageType, setConfirmedDamageType] = useState(report.confirmed_damage_type || report.ai_detected_damage_type || "");
  const [rejectionReason, setRejectionReason] = useState("");
  const [nextStatus, setNextStatus] = useState(report.status === "verified" ? "resolved" : report.status);
  const [staffRemarks, setStaffRemarks] = useState(report.staff_remarks || "");
  const [actionsTaken, setActionsTaken] = useState(report.actions_taken || "");
  const correction = { confirmedPlant: confirmedPlant.trim(), confirmedDamageType: confirmedDamageType.trim(), rejectionReason: rejectionReason.trim(), staffRemarks: staffRemarks.trim(), actionsTaken: actionsTaken.trim() };
  return <form onSubmit={event => { event.preventDefault(); onReview(report.id, nextStatus, correction); }} className="border-t border-slate-200 bg-white p-5"><p className="text-sm font-extrabold text-slate-900">Staff review and action log</p><p className="mt-1 text-xs leading-5 text-slate-500">Record the current review status, remarks, corrections, and actions taken. Each save is added to report history.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold text-slate-700">Report status<select value={nextStatus} onChange={event => setNextStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"><option value="pending">Pending</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></label><label className="text-xs font-bold text-slate-700">Final crop / plant<input value={confirmedPlant} onChange={event => setConfirmedPlant(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Crop or plant"/></label><label className="text-xs font-bold text-slate-700">Final damage type<input value={confirmedDamageType} onChange={event => setConfirmedDamageType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Damage type"/></label></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">Remarks for farmer<textarea value={staffRemarks} onChange={event => setStaffRemarks(event.target.value)} maxLength="4000" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" rows="3" placeholder="Review result, findings, or information needed."/></label><label className="text-xs font-bold text-slate-700">Actions taken<textarea value={actionsTaken} onChange={event => setActionsTaken(event.target.value)} maxLength="4000" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" rows="3" placeholder="For example: field visit scheduled or guidance sent."/></label></div>{nextStatus === "rejected" && <label className="mt-3 block text-xs font-bold text-slate-700">Rejection reason<textarea value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} maxLength="4000" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" rows="2" placeholder="Explain what needs correction or more evidence."/></label>}<div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} className="button !w-auto">{saving ? "Saving..." : "Save review update"}</button></div></form>;
}

function LegacyReviewReportsPageCleanCards({ token, onLogout }) {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [status, setStatus] = useState("pending");
  const [barangay, setBarangay] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setReports((await api("/reports", { token })).reports); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); api("/admin/review-indicators/reports/mark-seen", { token, method: "POST" }).then(() => window.dispatchEvent(new Event("agrisystem-review-items-seen"))).catch(() => {}); }, [load, token]);
  useRealtimeRefresh(token, load);
  async function review(id, nextStatus) {
    setUpdating(id); setError("");
    try { await api(`/reports/${id}/review`, { token, method: "PATCH", body: JSON.stringify({ status: nextStatus }) }); await load(); }
    catch (err) { setError(err.message); }
    finally { setUpdating(""); }
  }
  const barangays = bongabongBarangays;
  const filtered = reports.filter(report => (status === "all" || report.status === status) && (!barangay || report.barangay === barangay) && `${report.farmer_name} ${report.land_name || ""} ${report.confirmed_plant || report.ai_detected_plant || ""} ${report.confirmed_damage_type || report.ai_detected_damage_type || ""}`.toLowerCase().includes(query.toLowerCase()));
  const pending = reports.filter(report => report.status === "pending").length;
  return <AppShell role="staff" onLogout={onLogout}>
    <PageHeader eyebrow="MAO operations" title="Review farmer damage reports" description="Use the report details, evidence photos, crop analysis, and incident location to make a complete MAO review." action={<button onClick={load} className="button !w-auto">Refresh reports</button>}/>
    {error && <Notice tone="red">{error}</Notice>}
    <section className="mt-6 rounded-lg border border-slate-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-emerald-700">Live review queue</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{pending} report(s) awaiting MAO action</h2><p className="mt-1 text-sm text-slate-500">Open each report before verifying or rejecting it.</p></div><div className="grid gap-3 sm:grid-cols-3"><input value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="Search farmer or crop"/><select value={status} onChange={event => setStatus(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="pending">Pending review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="all">All statuses</option></select><select value={barangay} onChange={event => setBarangay(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All barangays</option>{barangays.map(item => <option key={item} value={item}>{item}</option>)}</select></div></div></section>
    <div className="mt-5 space-y-4">{loading ? <LoadingBlock/> : filtered.map(report => <article key={report.id} className={`overflow-hidden rounded-lg border bg-white shadow-sm ${report.status === "pending" ? "border-amber-200" : "border-slate-100"}`}><div className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge value={report.status}/><span className="text-xs font-semibold text-slate-400">Report #{report.id}</span></div><h2 className="mt-3 text-lg font-extrabold text-slate-900">{report.confirmed_plant || report.ai_detected_plant || "Crop identification pending"}</h2><p className="mt-1 text-sm font-semibold text-slate-600">{report.confirmed_damage_type || report.ai_detected_damage_type || "Damage assessment pending"}</p><p className="mt-3 text-sm text-slate-500"><b className="text-slate-700">{report.farmer_name}</b> | {report.land_name || "Farm land"} | {report.barangay || "Barangay not provided"}</p><p className="mt-1 text-xs text-slate-400">Submitted {new Date(report.created_at).toLocaleString()} | {report.photos?.length || 0} evidence photo(s)</p></div><div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap"><ReviewStat label="Farm photos" value={report.photos?.length || 0}/><ReviewStat label="GPS pin" value={Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude)) ? "Saved" : "None"}/><ReviewStat label="AI labels" value={report.camera_scene_objects?.length || 0}/></div></div><div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setExpanded(expanded === report.id ? null : report.id)} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">{expanded === report.id ? "Hide full details" : "View full report"}</button>{report.status === "pending" && <><button disabled={updating === report.id} className="button !w-auto" onClick={() => review(report.id, "verified")}>{updating === report.id ? "Saving..." : "Verify report"}</button><button disabled={updating === report.id} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60" onClick={() => review(report.id, "rejected")}>Reject report</button></>}</div></div>{expanded === report.id && <ReportDetails report={report}/>}</article>)}{!loading && !filtered.length && <Empty text="No reports match the selected filters."/>}</div>
  </AppShell>;
}
function ReviewStat({ label, value }) { return <div className="rounded-xl bg-slate-50 px-3 py-2 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-extrabold text-slate-800">{value}</p></div>; }

function LegacyReviewReportsPageV2({ token, onLogout }) {
  const [reports, setReports] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [updating, setUpdating] = useState(""); const [expanded, setExpanded] = useState(null);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setReports((await api("/reports", { token })).reports); } catch (err) { setError(err.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); api("/admin/review-indicators/reports/mark-seen", { token, method: "POST" }).then(() => window.dispatchEvent(new Event("agrisystem-review-items-seen"))).catch(() => {}); }, [load, token]);
  useRealtimeRefresh(token, load);
  async function review(id, status) { setUpdating(id); setError(""); try { await api(`/reports/${id}/review`, { token, method: "PATCH", body: JSON.stringify({ status }) }); await load(); } catch (err) { setError(err.message); } finally { setUpdating(""); } }
  return <AppShell role="staff" onLogout={onLogout}><PageHeader eyebrow="MAO operations" title="Review damage reports" description="Open every report to inspect farmer, land, location, AI labels, notes, and all submitted photos before taking action."/>{error && <Notice tone="red">{error}</Notice>}<div className="mt-6 space-y-3">{loading ? <LoadingBlock/> : reports.map(report => <article key={report.id} className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm"><div className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold text-slate-900">{report.farmer_name} <span className="font-normal text-slate-300">/</span> {report.land_name || "Farm land"}</h2><p className="mt-1 text-sm text-slate-500">{report.barangay || "Location not provided"} | {report.confirmed_plant || report.ai_detected_plant || "Crop pending"} | {report.confirmed_damage_type || report.ai_detected_damage_type || "Damage type pending"}</p><p className="mt-2 text-xs text-slate-400">Submitted {new Date(report.created_at).toLocaleString()} | {report.photos?.length || 0} photo(s)</p></div><StatusBadge value={report.status}/></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setExpanded(expanded === report.id ? null : report.id)} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50">{expanded === report.id ? "Hide full details" : "View full report"}</button>{report.status === "pending" && <><button disabled={updating === report.id} className="button !w-auto" onClick={() => review(report.id, "verified")}>{updating === report.id ? "Saving..." : "Verify"}</button><button disabled={updating === report.id} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60" onClick={() => review(report.id, "rejected")}>Reject</button></>}</div></div>{expanded === report.id && <ReportDetails report={report}/>}</article>)}{!loading && !reports.length && <Empty text="No damage reports have been submitted yet."/>}</div></AppShell>;
}

function ReportedDamageAssessment({ report }) {
  const severity = report.reported_severity;
  const affectedArea = report.reported_affected_area;
  const happenedAt = report.incident_occurred_at;
  if (!severity && !affectedArea && !happenedAt) return null;
  return <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950"><p className="font-bold">Farmer-reported incident details <span className="font-normal">(confirm during MAO review)</span></p><div className="mt-2 grid gap-2 sm:grid-cols-2">{severity && <p><b>Observed severity:</b> {severity}</p>}{affectedArea && <p><b>Estimated affected area:</b> {affectedArea}</p>}{happenedAt && <p className="sm:col-span-2"><b>Incident time:</b> {new Date(happenedAt).toLocaleString()}</p>}</div></div>;
}
function AiDamageAssessment({ report }) {
  const analysis = report.ai_analysis;
  if (!analysis) return null;
  const severity = report.ai_damage_severity || analysis.damageSeverity || "Unknown";
  const confidence = Number(report.ai_damage_confidence ?? analysis.damageConfidence ?? 0);
  return <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-sky-950"><p className="font-bold">AI farm-damage assessment <span className="font-normal">(requires MAO verification)</span></p><div className="mt-2 grid gap-2 sm:grid-cols-2"><p><b>Severity:</b> {severity}</p><p><b>Damage confidence:</b> {Math.round(confidence * 100)}%</p><p><b>Affected area:</b> {report.ai_affected_area_estimate || analysis.affectedAreaEstimate || "Not measurable from image"}</p><p><b>Affected plants / regions:</b> {report.ai_affected_plant_count || analysis.affectedPlantCount || "Not measurable from image"}</p></div>{analysis.damageEvidence?.length > 0 && <p className="mt-2"><b>Visible evidence:</b> {analysis.damageEvidence.join(", ")}</p>}{analysis.possibleCauses?.length > 0 && <p className="mt-2"><b>Possible causes:</b> {analysis.possibleCauses.join(", ")}</p>}{analysis.recommendedActions?.length > 0 && <p className="mt-2"><b>Immediate actions:</b> {analysis.recommendedActions.join("; ")}</p>}</div>;
}

function ReportDetails({ report }) {
  const plant = report.confirmed_plant || report.ai_detected_plant || "Not identified";
  const damage = report.confirmed_damage_type || report.ai_detected_damage_type || "Not identified";
  const hasCoordinates = (latitude, longitude) => latitude !== null && latitude !== undefined && latitude !== "" && longitude !== null && longitude !== undefined && longitude !== "" && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
  const incidentPhotoLocations = (report.photos || []).filter(photo => hasCoordinates(photo.latitude, photo.longitude));
  const farmLocation = hasCoordinates(report.latitude, report.longitude) ? { latitude: report.latitude, longitude: report.longitude } : null;
  const mapLocation = incidentPhotoLocations[0] || farmLocation;
  const locationLabel = incidentPhotoLocations.length ? "Incident GPS pin from submitted photo" : farmLocation ? "Registered farm location (incident GPS not saved)" : "No coordinates saved";
  const mapUrl = mapLocation ? `https://www.openstreetmap.org/?mlat=${mapLocation.latitude}&mlon=${mapLocation.longitude}#map=17/${mapLocation.latitude}/${mapLocation.longitude}` : null;
  return <div className="border-t border-slate-100 bg-slate-50/70 p-5">{report.boundary_geojson && <section className="mb-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Saved farm boundary</p><p className="mt-2 font-extrabold text-slate-900">{report.land_name || "Farm land"}</p><p className="mt-1 text-sm text-slate-600">{Number(report.mapped_farm_area_hectares || 0).toFixed(4)} ha · {Number(report.mapped_farm_area_square_meters || 0).toLocaleString()} m² · {report.farm_perimeter_meters ? Number(report.farm_perimeter_meters).toLocaleString() + " m perimeter" : "Perimeter not recorded"}</p><p className="mt-1 text-xs text-slate-500">Boundary quality: {report.measurement_quality || "Not recorded"}</p></div><FarmBoundaryMap land={{ boundary_geojson: report.boundary_geojson, latitude: report.latitude, longitude: report.longitude }} height="h-56"/></section>}<div className="grid gap-4 lg:grid-cols-3"><section className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Farmer and land</p><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs text-slate-400">Farmer</dt><dd className="font-semibold text-slate-800">{report.farmer_name}</dd></div><div><dt className="text-xs text-slate-400">Contact number</dt><dd className="text-slate-700">{report.contact_number || "Not available"}</dd></div><div><dt className="text-xs text-slate-400">Land / barangay</dt><dd className="text-slate-700">{report.land_name || "Farm land"} | {report.barangay || "Not available"}</dd></div><div><dt className="text-xs text-slate-400">Registered crop types</dt><dd className="text-slate-700">{report.crop_types?.join(", ") || "Not available"}</dd></div></dl></section><section className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Incident assessment</p><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs text-slate-400">Crop / plant</dt><dd className="font-semibold text-slate-800">{plant}</dd></div><div><dt className="text-xs text-slate-400">Damage type</dt><dd className="text-slate-700">{damage}</dd></div><div><dt className="text-xs text-slate-400">Farmer notes</dt><dd className="whitespace-pre-wrap text-slate-700">{report.farmer_notes || "No additional notes."}</dd></div>{report.ai_confidence_notes && <div><dt className="text-xs text-slate-400">Camera / AI advisory</dt><dd className="text-xs leading-5 text-slate-600">{report.ai_confidence_notes}</dd></div>}</dl>{report.crop_detection && <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900"><b>Linked saved crop scan:</b> #{report.crop_detection.id} · {report.crop_detection.crop_name} · {Math.round(Number(report.crop_detection.confidence || 0) * 100)}% confidence</p>}<ReportedDamageAssessment report={report}/><AiDamageAssessment report={report}/></section><section className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Location and scan labels</p><p className="mt-3 text-xs font-semibold text-slate-500">{locationLabel}</p>{mapLocation ? <><p className="mt-1 text-sm text-slate-700">{Number(mapLocation.latitude).toFixed(6)}, {Number(mapLocation.longitude).toFixed(6)}</p><div className="mt-3"><ReportMap reports={[{ ...report, latitude: mapLocation.latitude, longitude: mapLocation.longitude }]} height="h-56"/></div>{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-bold text-sky-700 hover:text-sky-900">Open map in new tab</a>}</> : <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">The report and registered farm do not have saved coordinates.</p>}{report.camera_scene_objects?.length > 0 && <div className="mt-4"><p className="text-xs text-slate-400">Saved camera labels</p><div className="mt-2 flex flex-wrap gap-2">{report.camera_scene_objects.map((item, index) => <span key={`${item.label}-${index}`} className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">{item.label}{item.confidence ? ` ${Math.round(item.confidence * 100)}%` : ""}</span>)}</div></div>}</section></div><section className="mt-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Submitted farm photos</p><p className="text-xs text-slate-400">Select any image to view full size</p></div>{report.photos?.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{report.photos.map(photo => <a key={photo.id} href={photo.fileUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-slate-200 bg-white"><img src={photo.fileUrl} alt={`Report evidence for ${plant}`} className="aspect-square w-full object-cover transition duration-200 group-hover:scale-105"/><span className="block px-2 py-1.5 text-[10px] text-slate-500">Open full image</span></a>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">No uploaded report photos found.</p>}</section>{report.review_history?.length > 0 && <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-bold text-slate-900">Report review history</h3><div className="mt-3 space-y-3">{report.review_history.map(item => <article key={item.id} className="border-l-2 border-emerald-300 pl-3"><p className="text-xs text-slate-500">{item.staff_name || "Staff"} · {item.status} · {new Date(item.created_at).toLocaleString()}</p>{item.remarks && <p className="mt-1 text-sm text-slate-700"><b>Remarks:</b> {item.remarks}</p>}{item.actions_taken && <p className="mt-1 text-sm text-slate-700"><b>Actions:</b> {item.actions_taken}</p>}</article>)}</div></section>}</div>;
}

export function AdminDashboard({ token, onLogout, role = "staff" }) {
  const [farmers, setFarmers] = useState([]);
  const [barangay, setBarangay] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const load = useCallback(async () => {
    setLoading(true);
    try { setError(""); setFarmers((await api("/admin/registrations?status=pending", { token })).farmers); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); api("/admin/review-indicators/registrations/mark-seen", { token, method: "POST" }).then(() => window.dispatchEvent(new Event("agrisystem-review-items-seen"))).catch(() => {}); }, [load, token]);
  useRealtimeRefresh(token, load);
  useEffect(() => { setPageNumber(1); }, [query, barangay]);
  async function viewApplication(id) {
    if (loadingDetail) return;
    setLoadingDetail(true); setSelected(null); setError("");
    try { setSelected(await api("/admin/registrations/" + id, { token })); }
    catch (err) { setError(err.message); }
    finally { setLoadingDetail(false); }
  }
  async function decide(id, status) {
    if (loading || updating) return;
    const farmerName = farmers.find(farmer => farmer.id === id)?.full_name || "this farmer";
    const prompt = status === "approved"
      ? "Approve " + farmerName + "'s registration?"
      : "Reject " + farmerName + "'s registration? This removes the application from the pending queue.";
    if (!window.confirm(prompt)) return;
    setUpdating(id); setError("");
    try {
      await api("/admin/registrations/" + id, { token, method: "PATCH", body: JSON.stringify({ status }) });
      if (selected?.farmer?.id === id) setSelected(null);
      await load();
    } catch (err) { setError(err.message); }
    finally { setUpdating(""); }
  }
  const detail = selected?.farmer;
  const filteredFarmers = farmers.filter(farmer => (!barangay || farmer.barangay === barangay) && (farmer.full_name + " " + (farmer.contact_number || "") + " " + (farmer.email || "") + " " + (farmer.barangay || "")).toLowerCase().includes(query.toLowerCase()));
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredFarmers.length / pageSize));
  const currentPage = Math.min(pageNumber, pageCount);
  const pageFarmers = filteredFarmers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <AppShell role={role} onLogout={onLogout}>
    <PageHeader eyebrow="MAO operations" title="Farmer registrations" description="Review identity, contact, farm location, crop records, and land-title proof before accepting a farmer account." action={<div className="flex gap-2"><a href="#farm-activity" className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800">Farm records</a><button type="button" disabled={loading} onClick={load} className="button !w-auto">{loading ? "Loading..." : "Refresh queue"}</button></div>}/>
    {error && <Notice tone="red">{error}</Notice>}
    <section className="mt-6 rounded-lg border border-slate-100 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-3"><div><p className="font-bold text-slate-900">Pending farmer applications</p><p className="mt-1 text-sm text-slate-500">{loading ? "Loading applications?" : filteredFarmers.length + " of " + farmers.length + " application(s) shown"}</p></div><input aria-label="Search farmer applications" value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="Search name, mobile, or email"/><select aria-label="Filter applications by barangay" value={barangay} onChange={event => setBarangay(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All Bongabong barangays</option>{bongabongBarangays.map(item => <option key={item} value={item}>{item}</option>)}</select></div></section>
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.92fr)]">
      <div className="space-y-3">
        {loading ? <LoadingBlock/> : pageFarmers.map(farmer => <article key={farmer.id} className={detail?.id === farmer.id ? "rounded-lg border border-emerald-300 bg-white p-5 shadow-sm ring-2 ring-emerald-100" : "rounded-lg border border-slate-100 bg-white p-5 shadow-sm"}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-extrabold text-slate-900">{farmer.full_name}</p><p className="mt-1 text-sm text-slate-500">{farmer.contact_number || "No contact"} | {farmer.barangay || "No barangay"}</p><p className="mt-1 text-xs text-slate-400">{farmer.land_count || 0} farm(s) &middot; {farmer.scan_count || 0} scan(s) &middot; {farmer.report_count || 0} report(s)</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={loadingDetail} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" onClick={() => viewApplication(farmer.id)}>{loadingDetail ? "Loading..." : detail?.id === farmer.id ? "Viewing" : "View application"}</button><button type="button" disabled={Boolean(updating)} className="button !w-auto" onClick={() => decide(farmer.id, "approved")}>{updating === farmer.id ? "Saving..." : "Approve"}</button><button type="button" disabled={Boolean(updating)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50" onClick={() => decide(farmer.id, "rejected")}>{updating === farmer.id ? "Saving..." : "Reject"}</button></div></div>
        </article>)}
        <Pagination page={currentPage} pageCount={pageCount} total={filteredFarmers.length} start={(currentPage - 1) * pageSize + 1} end={Math.min(currentPage * pageSize, filteredFarmers.length)} onPageChange={setPageNumber}/>
        {!loading && !filteredFarmers.length && <Empty text={barangay ? "No pending farmer registrations in " + barangay + "." : "No pending farmer registrations."}/>}
      </div>
      <aside className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm xl:sticky xl:top-5 xl:self-start">{loadingDetail ? <LoadingBlock/> : !detail ? <div className="py-12 text-center"><p className="font-bold text-slate-800">Review before accepting</p><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Choose &quot;View application&quot; to check the applicant&apos;s profile photo, contact details, land information, and documentary proof.</p></div> : <RegistrationDetail farmer={detail} lands={selected.lands || []}/>}</aside>
    </section>
  </AppShell>;
}
function RegistrationDetail({ farmer, lands }) {
  return <div><div className="flex items-start gap-4">{farmer.profile_photo_file ? <a href={farmer.profile_photo_file} target="_blank" rel="noreferrer"><img src={farmer.profile_photo_file} alt={`${farmer.full_name} profile`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover"/></a> : <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-100 text-xl font-extrabold text-emerald-800">{farmer.full_name?.slice(0, 1) || "F"}</span>}<div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Pending application</p><h2 className="mt-1 truncate text-xl font-extrabold text-slate-900">{farmer.full_name}</h2><p className="mt-1 text-sm text-slate-500">{farmer.contact_number || "No mobile number"}</p>{farmer.profile_photo_file && <a href={farmer.profile_photo_file} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-bold text-emerald-700">View profile photo →</a>}</div></div><div className="mt-5 grid gap-3 text-sm"><ApplicationField label="Email" value={farmer.email || "Not provided"}/><ApplicationField label="Home address" value={farmer.address || "Not provided"}/><ApplicationField label="Barangay" value={farmer.barangay || "Not provided"}/></div><div className="mt-5 border-t border-slate-100 pt-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Declared land ({lands.length})</p><StatusBadge value={farmer.registration_status}/></div><div className="mt-3 space-y-3">{lands.map(land => <LandProofCard key={land.id} land={land}/>)}{!lands.length && <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No land declaration found. Confirm this with the farmer before approval.</p>}</div></div></div>;
}
function ApplicationField({ label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-400">{label}</p><p className="mt-1 break-words text-slate-700">{value}</p></div>; }
function LandProofCard({ land }) { const mapped = Number.isFinite(Number(land.latitude)) && Number.isFinite(Number(land.longitude)); const mapUrl = mapped ? `https://www.openstreetmap.org/?mlat=${land.latitude}&mlon=${land.longitude}#map=16/${land.latitude}/${land.longitude}` : null; return <article className="rounded-lg border border-slate-200 p-4 text-sm"><p className="font-extrabold text-slate-900">{land.name || "Farm land"}</p><p className="mt-1 text-slate-600">{land.size_hectares || "—"} hectares | {(land.crop_types || []).join(", ") || "Crop not specified"}</p><p className="mt-2 text-xs text-slate-500">{land.barangay || "Location not set"}{mapped ? ` | ${land.latitude}, ${land.longitude}` : " | No coordinates"}</p><div className="mt-3 flex flex-wrap gap-3">{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-sky-700">Open map →</a>}{land.ownership_proof_file ? <a href={land.ownership_proof_file} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-700">View land title / proof →</a> : <span className="text-xs font-semibold text-red-600">No title proof uploaded</span>}</div></article>; }

function LegacyAdminDashboard({ token, onLogout }) {
  const [farmers, setFarmers] = useState([]); const [error, setError] = useState(""); const [updating, setUpdating] = useState("");
  const load = useCallback(async () => { try { setError(""); const data = await api("/admin/registrations?status=pending", { token }); setFarmers(data.farmers); } catch (err) { setError(err.message); } }, [token]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(token, load);
  async function decide(id, status) { setUpdating(id); try { await api(`/admin/registrations/${id}`, { token, method: "PATCH", body: JSON.stringify({ status }) }); await load(); } catch (err) { setError(err.message); } finally { setUpdating(""); } }
  return <AppShell role="staff" onLogout={onLogout}><PageHeader eyebrow="Administration" title="Farmer registrations" description="Approve farmers once their identity and farm details have been checked."/>{error && <Notice tone="red">{error}</Notice>}<div className="mt-6 space-y-3">{farmers.map(farmer => <article key={farmer.id} className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm"><b>{farmer.full_name}</b><p className="mt-1 text-sm text-slate-500">{farmer.contact_number} | {farmer.barangay || "No barangay"} | {farmer.land_count} land record(s)</p><div className="mt-4 flex gap-2"><button disabled={updating === farmer.id} className="button !w-auto" onClick={() => decide(farmer.id, "approved")}>Approve</button><button disabled={updating === farmer.id} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700" onClick={() => decide(farmer.id, "rejected")}>Reject</button></div></article>)}{!farmers.length && <Empty text="No pending farmer registrations."/>}</div></AppShell>;
}

function ReportsTable({ reports, loading }) { return <section className="staff-panel mt-6 rounded-lg border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Latest incoming reports</h2><a href="#review" className="text-sm font-semibold text-emerald-700">Open review queue</a></div>{loading ? <div className="mt-4"><LoadingBlock/></div> : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-slate-500"><tr><th className="pb-3">Farmer</th><th className="pb-3">Crop / damage</th><th className="pb-3">Status</th></tr></thead><tbody>{reports.slice(0, 6).map(report => <tr key={report.id} className="border-b last:border-0"><td className="py-3 font-medium">{report.farmer_name}<br/><span className="text-xs font-normal text-slate-400">{report.barangay || "Unknown location"}</span></td><td className="py-3">{report.confirmed_plant || report.ai_detected_plant || "Not specified"}<br/><span className="text-xs text-slate-400">{report.confirmed_damage_type || report.ai_detected_damage_type || "Pending assessment"}</span></td><td className="py-3"><StatusBadge value={report.status}/></td></tr>)}</tbody></table>{!reports.length && <p className="py-4 text-sm text-slate-500">No reports submitted yet.</p>}</div>}</section>; }
function downloadReports(reports) {
  const headings = ["Report ID", "Farmer", "Contact", "Farm", "Barangay", "Crop", "Damage", "Severity", "Status", "Submitted"];
  const rows = reports.map(report => [report.id, report.farmer_name, report.contact_number, report.land_name, report.barangay, report.confirmed_plant || report.ai_detected_plant, report.confirmed_damage_type || report.ai_detected_damage_type, report.reported_severity || report.ai_damage_severity, report.status, report.created_at]);
  const blob = new Blob([[headings, ...rows].map(row => row.map(csvValue).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `mao-damage-reports-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}
function Notice({ children, tone }) { return <p className={`mt-5 rounded-xl p-3 text-sm ${tone === "red" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{children}</p>; }
function LoadingBlock() { return <div className="animate-pulse rounded-xl bg-slate-100 p-10 text-center text-sm text-slate-400">Loading dashboard data…</div>; }
function Empty({ text }) { return <p className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{text}</p>; }
