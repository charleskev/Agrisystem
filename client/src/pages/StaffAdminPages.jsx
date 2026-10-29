import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Pagination from "../components/Pagination.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { api } from "../services/api.js";
import useRealtimeRefresh from "../hooks/useRealtimeRefresh.js";

const number = value => new Intl.NumberFormat("en-PH").format(Number(value || 0));
const bongabongBarangays = ["Anilao", "Aplaya", "Bagong Bayan I", "Bagong Bayan II", "Batangan", "Bukal", "Camantigue", "Carmundo", "Cawayan", "Dayhagan", "Formon", "Hagan", "Hagupit", "Ipil", "Kaligtasan", "Labasan", "Labonan", "Libertad", "Lisap", "Luna", "Malitbog", "Mapang", "Masaguisi", "Mina de Oro", "Morente", "Ogbot", "Orconuma", "Poblacion", "Pulosahi", "Sagana", "San Isidro", "San Jose", "San Juan", "Sta. Cruz", "Sigange", "Tawas"];

function LegacyAdminControlCenterV1({ token, onLogout, role }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setError(""); setData(await api("/admin/system-summary", { token })); }
    catch (err) { setError(err.message); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(token, load);
  if (role !== "admin") return <AppShell role="staff" onLogout={onLogout}><PageHeader eyebrow="Restricted" title="Administrator access required" description="System-wide charts and account controls are available only to an administrator."/><Alert text="Your account can still review reports, manage registrations, and send farmer notifications." error/></AppShell>;
  const countFor = (items, value) => Number(items?.find(item => item.status === value || item.role === value)?.total || 0);
  const registrations = ["pending", "approved", "rejected"].map(status => ({ label: status === "pending" ? "Pending" : status === "approved" ? "Approved" : "Rejected", value: countFor(data?.registrations, status), tone: status === "approved" ? "bg-emerald-500" : status === "pending" ? "bg-amber-400" : "bg-red-400" }));
  const reports = ["pending", "verified", "rejected"].map(status => ({ label: status === "pending" ? "Needs review" : status === "verified" ? "Verified" : "Rejected", value: countFor(data?.reports, status), tone: status === "verified" ? "bg-sky-500" : status === "pending" ? "bg-violet-500" : "bg-red-400" }));
  const accounts = ["admin", "staff", "technician", "farmer"].map(roleName => ({ label: roleName === "admin" ? "Admin" : roleName === "staff" ? "MAO staff" : roleName === "technician" ? "Technician" : "Farmers", value: countFor(data?.roles, roleName), tone: roleName === "farmer" ? "bg-emerald-500" : "bg-slate-500" }));
  return <AppShell role="staff" onLogout={onLogout}>
    <PageHeader eyebrow="System administration" title="Admin control center" description="A live view of the platform’s actual accounts, registrations, land records, and farmer reports." action={<button onClick={load} className="button !w-auto">Refresh overview</button>}/>
    {error && <Alert text={error} error/>}
    {!data ? <Loading/> : <><div className="mt-5 flex items-center gap-2 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500"/> Live database overview — updates when registrations, reports, and accounts change.</div><section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="All accounts" value={number(data.counts.users)} tone="emerald"/><Metric label="Farmer profiles" value={number(data.counts.farmers)} tone="sky"/><Metric label="Land records" value={number(data.counts.lands)} tone="lime"/><Metric label="All reports" value={number(data.counts.reports)} tone="violet"/><Metric label="Needs review" value={number(data.counts.pending_reports)} tone="amber"/></section><section className="mt-6 grid gap-5 xl:grid-cols-3"><ChartCard title="Farmer registration status" description="Current application decisions"><BarChart rows={registrations}/></ChartCard><ChartCard title="Damage report workflow" description="Current report validation status"><BarChart rows={reports}/></ChartCard><ChartCard title="Account roles" description="Access distribution across the system"><BarChart rows={accounts}/></ChartCard></section><section className="mt-6 grid gap-5 lg:grid-cols-3"><AdminPanel title="Account access" description="Manage account roles and availability."><Summary label="Administrators" value={countFor(data.roles, "admin")}/><Summary label="Staff and technicians" value={countFor(data.roles, "staff") + countFor(data.roles, "technician")}/><Summary label="Farmer accounts" value={countFor(data.roles, "farmer")}/><a href="#users" className="mt-4 inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-900">Open user management →</a></AdminPanel><AdminPanel title="Registration queue" description="Check documents and farm details before granting access."><Summary label="Pending applications" value={countFor(data.registrations, "pending")}/><Summary label="Approved farmers" value={countFor(data.registrations, "approved")}/><Summary label="Rejected applications" value={countFor(data.registrations, "rejected")}/><a href="#registrations" className="mt-4 inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-900">Review applications →</a></AdminPanel><AdminPanel title="Report operations" description="Prioritize incidents that need MAO validation."><Summary label="Pending reports" value={countFor(data.reports, "pending")}/><Summary label="Verified reports" value={countFor(data.reports, "verified")}/><Summary label="Rejected reports" value={countFor(data.reports, "rejected")}/><a href="#review" className="mt-4 inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-900">Open review queue →</a></AdminPanel></section><section className="mt-6 rounded-lg border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Daily operations</p><div className="mt-4 grid gap-3 md:grid-cols-3"><QuickLink href="#review" title="Validate reports" text="Check crop, damage, photos, and incident pin before verifying."/><QuickLink href="#registrations" title="Approve farmers" text="Open the full application and check documentary proof before approval."/><QuickLink href="#send-notification" title="Send updates" text="Share assistance, weather, and schedule notices with approved farmers."/></div></section></>}
  </AppShell>;
}

export function AdminControlCenter({ token, onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setError(""); setData(await api("/admin/system-summary", { token })); }
    catch (err) { setError(err.message); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(token, load);
  const countFor = (items, role) => Number(items?.find(item => item.role === role)?.total || 0);
  const roles = [
    { label: "Administrators", value: countFor(data?.roles, "admin"), tone: "bg-violet-500" },
    { label: "MAO staff", value: countFor(data?.roles, "staff"), tone: "bg-slate-500" },
    { label: "Technicians", value: countFor(data?.roles, "technician"), tone: "bg-slate-500" },
    { label: "Farmers", value: countFor(data?.roles, "farmer"), tone: "bg-emerald-500" },
  ];
  return <AppShell role="admin" onLogout={onLogout}>
    <PageHeader eyebrow="System administration" title="Admin dashboard" description="Manage account access, audit records, and system settings." action={<button onClick={load} className="button !w-auto">Refresh overview</button>}/>
    {error && <Alert text={error} error/>}
    {!data ? <Loading/> : <>
      <section className="admin-metric-grid mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="All accounts" value={number(data.counts.users)} tone="emerald"/><Metric label="Administrators" value={countFor(data.roles, "admin")} tone="violet"/><Metric label="Staff & technicians" value={countFor(data.roles, "staff") + countFor(data.roles, "technician")} tone="sky"/><Metric label="Farmer profiles" value={number(data.counts.farmers)} tone="lime"/></section>
      <section className="admin-overview-grid mt-6 grid gap-5 lg:grid-cols-2"><ChartCard title="Account roles" description="Access distribution across the system"><BarChart rows={roles}/></ChartCard><AdminPanel title="System records" description="Current database totals."><Summary label="Land records" value={data.counts.lands}/><Summary label="Damage reports" value={data.counts.reports}/><Summary label="Reports awaiting review" value={data.counts.pending_reports}/></AdminPanel></section>
      <section className="admin-tools-panel mt-6 rounded-lg border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Administrator tools</p><div className="admin-tools-grid mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><QuickLink href="#admin-users" title="User directory" text="Search, filter, sort, and manage every account."/><QuickLink href="#staff-accounts" title="Create account" text="Create staff, technician, or administrator access."/><QuickLink href="#admin-logs" title="Activity logs" text="Review account and settings changes."/><QuickLink href="#system-settings" title="System settings" text="Update office details and maintenance mode."/></div></section>
    </>}
  </AppShell>;
}

function ChartCard({ title, description, children }) { return <article className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><div className="mt-5">{children}</div></article>; }
function BarChart({ rows }) { const maximum = Math.max(1, ...rows.map(row => row.value)); return <div className="space-y-4">{rows.map(row => <div key={row.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{row.label}</span><b className="text-slate-900">{number(row.value)}</b></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-500 ${row.tone}`} style={{ width: `${Math.max(row.value ? 8 : 0, (row.value / maximum) * 100)}%` }}/></div></div>)}</div>; }

function LegacyAdminControlCenter({ token, onLogout, role }) {
  const [data, setData] = useState(null); const [error, setError] = useState("");
  const load = useCallback(() => { setError(""); return api("/admin/system-summary", { token }).then(setData).catch(err => setError(err.message)); }, [token]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(token, load);
  if (role !== "admin") return <AppShell role="staff" onLogout={onLogout}><PageHeader eyebrow="Restricted" title="Administrator access required" description="System settings and account controls are available only to an administrator."/><Alert text="Your account can still review reports, manage registrations, and send farmer notifications." error/></AppShell>;
  const countFor = (items, field) => items?.find(item => item.status === field || item.role === field)?.total || 0;
  return <AppShell role="staff" onLogout={onLogout}><PageHeader eyebrow="System administration" title="Admin control center" description="Monitor platform activity, manage access, and keep field operations moving." action={<button onClick={load} className="button !w-auto">Refresh overview</button>}/>{error && <Alert text={error} error/>}{!data ? <Loading/> : <><section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="All accounts" value={number(data.counts.users)} tone="emerald"/><Metric label="Farmer profiles" value={number(data.counts.farmers)} tone="sky"/><Metric label="Land records" value={number(data.counts.lands)} tone="lime"/><Metric label="All reports" value={number(data.counts.reports)} tone="violet"/><Metric label="Needs review" value={number(data.counts.pending_reports)} tone="amber"/></section><section className="mt-6 grid gap-5 lg:grid-cols-3"><AdminPanel title="Account access" description="Manage account roles and availability."><Summary label="Administrators" value={countFor(data.roles, "admin")}/><Summary label="Staff and technicians" value={Number(countFor(data.roles, "staff")) + Number(countFor(data.roles, "technician"))}/><Summary label="Farmer accounts" value={countFor(data.roles, "farmer")}/><a href="#users" className="mt-4 inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-900">Open user management →</a></AdminPanel><AdminPanel title="Registration queue" description="Review farmer applications before enabling reports."><Summary label="Pending applications" value={countFor(data.registrations, "pending")}/><Summary label="Approved farmers" value={countFor(data.registrations, "approved")}/><Summary label="Rejected applications" value={countFor(data.registrations, "rejected")}/><a href="#registrations" className="mt-4 inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-900">Review registrations →</a></AdminPanel><AdminPanel title="Report operations" description="Prioritize incidents that need MAO validation."><Summary label="Pending reports" value={countFor(data.reports, "pending")}/><Summary label="Verified reports" value={countFor(data.reports, "verified")}/><Summary label="Rejected reports" value={countFor(data.reports, "rejected")}/><a href="#review" className="mt-4 inline-flex text-sm font-bold text-emerald-700 hover:text-emerald-900">Open review queue →</a></AdminPanel></section><section className="mt-6 rounded-lg border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">Admin checklist</p><h2 className="mt-2 text-xl font-extrabold text-slate-900">Daily operations</h2><div className="mt-5 grid gap-3 md:grid-cols-3"><QuickLink href="#review" title="Validate reports" text="Check crop, damage, photos, and incident pin before verifying."/><QuickLink href="#registrations" title="Approve farmers" text="Confirm applications so eligible farmers can submit reports."/><QuickLink href="#send-notification" title="Send updates" text="Share assistance, weather, and schedule notices with approved farmers."/></div></section></>}</AppShell>;
}

export function UserManagementPage({ token, onLogout, role }) {
  const [users, setUsers] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(""); const [query, setQuery] = useState(""); const [sortBy, setSortBy] = useState("newest"); const [roleFilter, setRoleFilter] = useState("all"); const [statusFilter, setStatusFilter] = useState("all"); const [pageNumber, setPageNumber] = useState(1);
  const load = useCallback(async () => { setLoading(true); try { setError(""); setUsers((await api("/admin/users", { token })).users); } catch (err) { setError(err.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]); useRealtimeRefresh(token, load); useEffect(() => { setPageNumber(1); }, [query, sortBy, roleFilter, statusFilter]);
  async function updateUser(user, changes) { if (saving) return; if (changes.isActive === false && !window.confirm("Disable the account for " + user.full_name + "? They will no longer be able to sign in.")) return; setSaving(user.id); setError(""); try { const result = await api(`/admin/users/${user.id}`, { token, method: "PATCH", body: JSON.stringify(changes) }); setUsers(current => current.map(item => item.id === user.id ? { ...item, ...result.user } : item)); } catch (err) { setError(err.message); } finally { setSaving(""); } }
  const visible = useMemo(() => {
    const roleOrder = { admin: 0, staff: 1, technician: 2, farmer: 3 };
    return users.filter(user => {
      const searchable = `${user.full_name} ${user.email || ""} ${user.contact_number || ""} ${user.role}`.toLowerCase().includes(query.toLowerCase());
      const matchesRole = role !== "admin" || roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? Boolean(user.is_active) : !user.is_active);
      return searchable && matchesRole && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === "name") return a.full_name.localeCompare(b.full_name);
      if (sortBy === "role") return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99) || a.full_name.localeCompare(b.full_name);
      if (sortBy === "staff") return (a.role === "staff" || a.role === "technician" ? 0 : 1) - (b.role === "staff" || b.role === "technician" ? 0 : 1) || a.full_name.localeCompare(b.full_name);
      if (sortBy === "oldest") return new Date(a.created_at) - new Date(b.created_at);
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [users, query, role, roleFilter, statusFilter, sortBy]);
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(pageNumber, pageCount);
  const visibleUsers = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const currentUserId = JSON.parse(localStorage.getItem("agrisystem-session") || "null")?.user?.id;
  const staffCount = users.filter(user => user.role === "staff" || user.role === "technician").length;
  const farmerCount = users.filter(user => user.role === "farmer").length;
  return <AppShell role={role} onLogout={onLogout}><PageHeader eyebrow={role === "admin" ? "Administrator tools" : "MAO Staff"} title={role === "admin" ? "User directory" : "User management"} description={role === "admin" ? "Search, filter, sort, and manage every farmer, staff, technician, and administrator account." : "Search and sort registered farmer accounts."} action={<button onClick={load} className="button !w-auto">Refresh list</button>}/>{error && <Alert text={error} error/>}<section className="mt-6 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm"><div className="border-b p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-900">Account directory</p><p className="mt-1 text-sm text-slate-500">{loading ? "Loading accounts..." : `${number(visible.length)} of ${number(users.length)} account(s)`}</p></div>{role === "admin" && <div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{number(farmerCount)} farmers</span><span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">{number(staffCount)} staff</span></div>}</div><div className={`mt-4 grid gap-3 ${role === "admin" ? "md:grid-cols-4" : "md:grid-cols-2"}`}><input value={query} onChange={event=>setQuery(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="Search name, role, email, or contact"/>{role === "admin" && <select aria-label="Filter by account role" value={roleFilter} onChange={event=>setRoleFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="all">All roles</option><option value="farmer">Farmers</option><option value="staff">MAO staff</option><option value="technician">Technicians</option><option value="admin">Administrators</option></select>}<select aria-label="Filter by account status" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="all">All statuses</option><option value="active">Active only</option><option value="disabled">Disabled only</option></select><select aria-label="Sort accounts" value={sortBy} onChange={event=>setSortBy(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A-Z</option>{role === "admin" && <><option value="role">Role order</option><option value="staff">Staff first</option></>}</select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Status</th>{role === "admin" && <th className="px-5 py-3 text-right">Account action</th>}</tr></thead><tbody>{visibleUsers.map(user=><tr key={user.id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-bold text-slate-800">{user.full_name}</p><p className="mt-1 text-xs text-slate-400">{user.email || "No email"}</p></td><td className="px-5 py-4 text-slate-600">{user.contact_number || "-"}</td><td className="px-5 py-4">{role === "admin" ? <select aria-label={`Role for ${user.full_name}`} value={user.role} disabled={Boolean(saving)} onChange={event=>updateUser(user,{role:event.target.value})} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold"><option value="farmer">Farmer</option><option value="staff">Staff</option><option value="technician">Technician</option><option value="admin">Admin</option></select> : <StatusBadge value={user.role}/>}</td><td className="px-5 py-4 text-xs text-slate-500">{new Date(user.created_at).toLocaleDateString()}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{user.is_active ? "Active" : "Disabled"}</span></td>{role === "admin" && <td className="px-5 py-4 text-right"><button disabled={Boolean(saving) || (String(user.id) === String(currentUserId) && user.is_active)} onClick={()=>updateUser(user,{isActive:!user.is_active})} className={`rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 ${user.is_active ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>{saving === user.id ? "Saving..." : user.is_active ? "Disable" : "Enable"}</button></td>}</tr>)}</tbody></table></div><Pagination page={currentPage} pageCount={pageCount} total={visible.length} start={(currentPage - 1) * pageSize + 1} end={Math.min(currentPage * pageSize, visible.length)} onPageChange={setPageNumber}/>{!loading && !visible.length && <Empty text="No matching user records found."/>}</section></AppShell>;
}

function LegacyUserManagementPage({ token, onLogout, role }) {
  const [users, setUsers] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(""); const [query, setQuery] = useState("");
  const load = useCallback(async () => { setLoading(true); try { setError(""); setUsers((await api("/admin/users", { token })).users); } catch (err) { setError(err.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(token, load);
  async function updateUser(user, changes) { setSaving(user.id); setError(""); try { const result = await api(`/admin/users/${user.id}`, { token, method: "PATCH", body: JSON.stringify(changes) }); setUsers(current => current.map(item => item.id === user.id ? { ...item, ...result.user } : item)); } catch (err) { setError(err.message); } finally { setSaving(""); } }
  const filtered = useMemo(() => users.filter(user => `${user.full_name} ${user.email || ""} ${user.contact_number || ""} ${user.role}`.toLowerCase().includes(query.toLowerCase())), [users, query]);
  return <AppShell role="staff" onLogout={onLogout}><PageHeader eyebrow="Administration" title="User management" description="Review every AgriSystem account, assign operational roles, and control account access."/>{error && <Alert text={error} error/>}<section className="mt-6 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-900">Account directory</p><p className="mt-1 text-sm text-slate-500">{loading ? "Loading accounts..." : `${number(filtered.length)} of ${number(users.length)} account(s)`}</p></div><input value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:w-64" placeholder="Search name, role, contact"/></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th>{role === "admin" && <th className="px-5 py-3 text-right">Admin action</th>}</tr></thead><tbody>{filtered.map(user => <tr key={user.id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-bold text-slate-800">{user.full_name}</p><p className="mt-1 text-xs text-slate-400">{user.email || "No email"}</p></td><td className="px-5 py-4 text-slate-600">{user.contact_number || "—"}</td><td className="px-5 py-4">{role === "admin" ? <select aria-label={`Role for ${user.full_name}`} value={user.role} disabled={saving === user.id} onChange={event => updateUser(user, { role: event.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold"><option value="farmer">Farmer</option><option value="staff">Staff</option><option value="technician">Technician</option><option value="admin">Admin</option></select> : <StatusBadge value={user.role}/>}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{user.is_active ? "Active" : "Disabled"}</span></td>{role === "admin" && <td className="px-5 py-4 text-right"><button disabled={saving === user.id} onClick={() => updateUser(user, { isActive: !user.is_active })} className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${user.is_active ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>{saving === user.id ? "Saving..." : user.is_active ? "Disable" : "Enable"}</button></td>}</tr>)}</tbody></table></div>{!loading && !filtered.length && <Empty text="No matching user records found."/>}</section></AppShell>;
}

export function FarmerDirectoryPage({ token, onLogout, role = "staff" }) {
  const [farmers, setFarmers] = useState([]); const [selected, setSelected] = useState(null); const [query, setQuery] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [loadingDetail, setLoadingDetail] = useState(false); const [pageNumber, setPageNumber] = useState(1);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setFarmers((await api("/admin/farmers", { token })).farmers); } catch (err) { setError(err.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(token, load);
  useEffect(() => { setPageNumber(1); }, [query]);
  async function viewFarmer(id) { setLoadingDetail(true); setError(""); try { setSelected(await api(`/admin/farmers/${id}`, { token })); } catch (err) { setError(err.message); } finally { setLoadingDetail(false); } }
  const filtered = useMemo(() => farmers.filter(farmer => `${farmer.full_name} ${farmer.contact_number} ${farmer.email || ""} ${farmer.barangay || ""}`.toLowerCase().includes(query.toLowerCase())), [farmers, query]);
  const detail = selected?.farmer;
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(pageNumber, pageCount);
  const visibleFarmers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <AppShell role={role} onLogout={onLogout}><PageHeader eyebrow="MAO operations" title="Accepted farmer directory" description="View approved farmer accounts, farms, crop scans, and report counts." action={<div className="flex gap-2"><a href="#farm-activity" className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800">Farm activity</a><button onClick={load} className="button !w-auto">Refresh list</button></div>}/>{error && <Alert text={error} error/>}<section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,.9fr)]"><article className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-extrabold text-slate-900">Approved accounts</p><p className="mt-1 text-sm text-slate-500">{loading ? "Loading farmers..." : `${number(filtered.length)} accepted farmer account(s)`}</p></div><input value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:w-60" placeholder="Search farmer or barangay"/></div><div className="divide-y divide-slate-100">{loading && <p className="p-5 text-sm text-slate-500">Loading accepted farmer accounts...</p>}{visibleFarmers.map(farmer => <button type="button" key={farmer.id} onClick={() => viewFarmer(farmer.id)} className={`flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-emerald-50 ${detail?.id === farmer.id ? "bg-emerald-50" : ""}`}><span className="min-w-0"><span className="block truncate font-bold text-slate-900">{farmer.full_name}</span><span className="mt-1 block text-xs text-slate-500">{farmer.barangay || "Barangay not set"} | {farmer.land_count || 0} farms | {farmer.scan_count || 0} scans | {farmer.report_count || 0} reports</span></span><span className="shrink-0 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">View</span></button>)}<Pagination page={currentPage} pageCount={pageCount} total={filtered.length} start={(currentPage - 1) * pageSize + 1} end={Math.min(currentPage * pageSize, filtered.length)} onPageChange={setPageNumber}/>{!loading && !filtered.length && <Empty text="No accepted farmer accounts found."/>}</div></article><aside className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">{loadingDetail ? <Loading/> : !detail ? <div className="py-12 text-center"><p className="font-bold text-slate-800">Select a farmer account</p><p className="mt-2 text-sm leading-6 text-slate-500">Choose an accepted farmer from the directory to view their profile, registration photos, and registered land.</p></div> : <FarmerDetail farmer={detail} lands={selected.lands || []}/>}</aside></section></AppShell>;
}

function FarmerDetail({ farmer, lands }) { return <div><div className="flex items-start gap-4">{farmer.profile_photo_file ? <a href={farmer.profile_photo_file} target="_blank" rel="noreferrer" title="Open profile photo"><img src={farmer.profile_photo_file} alt="Farmer profile" className="h-14 w-14 rounded-lg border border-slate-200 object-cover transition hover:opacity-80"/></a> : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-100 text-lg font-extrabold text-emerald-800">{farmer.full_name?.slice(0, 1) || "F"}</span>}<div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Farmer account</p><h2 className="mt-1 truncate text-xl font-extrabold text-slate-900">{farmer.full_name}</h2><p className="mt-1 text-sm text-slate-500">{farmer.contact_number}</p>{farmer.profile_photo_file && <a href={farmer.profile_photo_file} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-bold text-emerald-700 hover:text-emerald-900">Open profile photo →</a>}</div></div><dl className="mt-5 grid gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-400">Email</dt><dd className="mt-1 text-slate-700">{farmer.email || "Not provided"}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-400">Home address</dt><dd className="mt-1 text-slate-700">{farmer.address}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-400">Barangay</dt><dd className="mt-1 text-slate-700">{farmer.barangay || "Not provided"}</dd></div></dl><div className="mt-5 border-t border-slate-100 pt-5"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Registered land ({lands.length})</p><div className="mt-3 space-y-3">{lands.map(land => <article key={land.id} className="rounded-xl border border-slate-200 p-3 text-sm"><p className="font-bold text-slate-900">{land.name || "Farm land"}</p><p className="mt-1 text-slate-600">{land.size_hectares} hectares · {(land.crop_types || []).join(", ")}</p><p className="mt-1 text-xs text-slate-500">{land.barangay || "Location not set"} · {land.latitude}, {land.longitude}</p>{land.ownership_proof_file && <a href={land.ownership_proof_file} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-emerald-700 hover:text-emerald-900">Open land title / proof →</a>}</article>)}{!lands.length && <p className="text-sm text-slate-500">No land record available.</p>}</div></div></div>; }

export function SendNotificationPage({ token, onLogout, role = "staff" }) {
  const [farmers, setFarmers] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [farmersLoading, setFarmersLoading] = useState(true);
  const [recipientMode, setRecipientMode] = useState("individual");
  useEffect(() => {
    let active = true;
    api("/notifications/recipients", { token }).then(data => { if (active) setFarmers(data.recipients || []); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setFarmersLoading(false); });
    return () => { active = false; };
  }, [token]);
  async function submit(event) {
    event.preventDefault();
    if (sending || farmersLoading || !farmers.length) return;
    if (recipientMode === "all" && !window.confirm("Send this notification to all " + farmers.length + " approved farmer accounts?")) return;
    const form = event.currentTarget;
    setSending(true); setError(""); setFeedback("");
    try {
      const result = await api("/notifications", { token, method: "POST", body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), recipientMode }) });
      form.reset(); setRecipientMode("individual"); setFeedback(result.message || "Notification sent successfully.");
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  }
  return <AppShell role={role} onLogout={onLogout}>
    <div className="mx-auto flex w-full flex-col items-center">
      <PageHeader eyebrow="MAO operations" title="Send a farmer notification" description="Send assistance, weather, or schedule updates to one farmer, a Bongabong barangay, or every approved farmer." centered/>
      {feedback && <div className="w-full max-w-3xl"><Alert text={feedback}/></div>}
      {error && <div className="w-full max-w-3xl"><Alert text={error} error/></div>}
      <form onSubmit={submit} className="mt-6 w-full max-w-3xl rounded-lg border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div className="space-y-5">
        <fieldset><legend className="text-sm font-bold text-slate-700">Send to</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[ ["individual", "Individual farmer", "Choose one approved account"], ["barangay", "Specific barangay", "Send to approved farmers in one barangay"], ["all", "All farmers", "Send to every approved farmer"] ].map(([value, label, hint]) => <label key={value} className={"cursor-pointer rounded-xl border p-3 transition " + (recipientMode === value ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-200")}><input type="radio" name="recipientModeChoice" value={value} checked={recipientMode === value} onChange={() => setRecipientMode(value)} className="sr-only"/><span className="block text-sm font-bold text-slate-800">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span></label>)}
        </div></fieldset>
        {recipientMode === "individual" && <label className="block text-sm font-bold text-slate-700">Approved farmer<select name="farmerId" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">{farmersLoading ? "Loading approved farmers..." : farmers.length ? "Select an approved farmer" : "No approved farmers available"}</option>{farmers.map(farmer => <option value={farmer.id} key={farmer.id}>{farmer.full_name} - {farmer.barangay || "No barangay"}</option>)}</select></label>}
        {recipientMode === "barangay" && <label className="block text-sm font-bold text-slate-700">Bongabong barangay<select name="barangay" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Select a barangay</option>{bongabongBarangays.map(barangay => <option value={barangay} key={barangay}>{barangay}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Only approved farmers registered in this barangay will receive the notification.</span></label>}
        {recipientMode === "all" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><b>All approved farmers:</b> this will send the same notification to {farmers.length} approved farmer account(s).</div>}
        <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Notification type<select name="type" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="benefit">Benefit / assistance</option><option value="alert">Weather or service alert</option></select></label><div className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">Notifications are delivered inside AgriSystem to approved farmer accounts. Email and SMS results will be shown after sending.</div></div>
        <label className="block text-sm font-bold text-slate-700">Message<textarea name="message" required rows="5" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Example: Rice seed distribution is available at the MAO on Monday."/></label>
        <button disabled={sending || farmersLoading || !farmers.length} className="button !w-auto">{farmersLoading ? "Loading recipients..." : sending ? "Sending..." : "Send notification"}</button>
      </div></form>
    </div>
  </AppShell>;
}
export function AnnouncementsPage({ token, onLogout, role = "staff" }) {
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const data = await api("/notifications/sent", { token });
      setAnnouncements(data.announcements || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh(token, load);
  const visibleAnnouncements = announcements.filter(item => (typeFilter === "all" || item.type === typeFilter) && `${item.message} ${item.recipient_names || ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppShell role={role} onLogout={onLogout}>
      <PageHeader
        eyebrow="Communication"
        title="Sent announcements"
        description="Review the announcements you have sent to approved farmers."
        action={<a href="#send-notification" className="button !w-auto">Create announcement</a>}
      />

      {error && <Alert text={error} error />}

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="font-display text-lg text-slate-900">Announcement history</p>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? "Loading announcements..." : `${number(visibleAnnouncements.length)} of ${number(announcements.length)} announcement(s)`}
            </p>
          </div>
          <button type="button" onClick={load} className="rounded-md border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800">
            Refresh
          </button>
        </div>

        <div className="grid gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-[1fr_220px]"><input aria-label="Search sent announcements" value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Search message or recipients"/><select aria-label="Filter announcements by type" value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="all">All announcement types</option><option value="benefit">Benefits / assistance</option><option value="alert">Alerts</option></select></div>

        {loading && <Loading />}

        {!loading && visibleAnnouncements.length > 0 && (
          <div className="divide-y divide-slate-100">
            {visibleAnnouncements.map((announcement) => (
              <article key={`${announcement.created_at}-${announcement.type}-${announcement.message}`} className="px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${announcement.type === "alert" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {announcement.type === "alert" ? "Alert" : "Benefit / assistance"}
                  </span>
                  <time className="text-sm text-slate-500">{new Date(announcement.created_at).toLocaleString()}</time>
                </div>
                <p className="mt-3 whitespace-pre-line text-slate-800">{announcement.message}</p>
                <p className="mt-3 text-sm text-slate-600">
                  <strong>{number(announcement.recipient_count)}</strong> approved farmer(s) received this announcement.
                </p>
                {announcement.recipient_names && (
                  <p className="mt-1 truncate text-sm text-slate-500" title={announcement.recipient_names}>
                    Recipients: {announcement.recipient_names}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}

        {!loading && !announcements.length && <Empty text="You have not sent any announcements yet." />}
        {!loading && announcements.length > 0 && !visibleAnnouncements.length && <Empty text="No announcements match the selected search and type." />}
      </section>
    </AppShell>
  );
}

function LegacySendNotificationPage({ token, onLogout }) {
  const [farmers, setFarmers] = useState([]); const [feedback, setFeedback] = useState(""); const [error, setError] = useState(""); const [sending, setSending] = useState(false);
  useEffect(() => { api("/admin/registrations?status=approved", { token }).then(data => setFarmers(data.farmers)).catch(err => setError(err.message)); }, [token]);
  async function submit(event) { event.preventDefault(); setSending(true); setError(""); setFeedback(""); try { await api("/notifications", { token, method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); event.currentTarget.reset(); setFeedback("Notification sent successfully."); } catch (err) { setError(err.message); } finally { setSending(false); } }
  return <AppShell role="staff" onLogout={onLogout}><PageHeader eyebrow="MAO operations" title="Send a farmer notification" description="Share benefit availability, weather warnings, and schedule reminders with approved farmers."/>{feedback && <Alert text={feedback}/>} {error && <Alert text={error} error/>}<form onSubmit={submit} className="mt-6 max-w-2xl rounded-lg border border-slate-100 bg-white p-5 shadow-sm sm:p-6"><div className="space-y-5"><label className="block text-sm font-bold text-slate-700">Recipient<select name="farmerId" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Select an approved farmer</option>{farmers.map(farmer => <option value={farmer.id} key={farmer.id}>{farmer.full_name} — {farmer.barangay || "No barangay"}</option>)}</select></label><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Notification type<select name="type" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="benefit">Benefit / assistance</option><option value="alert">Weather or service alert</option></select></label><div className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">Only farmers with approved registration can receive MAO notifications.</div></div><label className="block text-sm font-bold text-slate-700">Message<textarea name="message" required rows="5" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Example: Rice seed distribution is available at the MAO on Monday."/></label><button disabled={sending || !farmers.length} className="button !w-auto">{sending ? "Sending..." : "Send notification"}</button></div></form></AppShell>;
}

function Metric({ label, value, tone }) {
  const icon = tone === "amber"
    ? <><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v5M12 17h.01"/></>
    : tone === "violet"
      ? <><path d="M7 3h8l4 4v14H5V3h2Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></>
      : tone === "lime"
        ? <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>
        : <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-3.4 2.2-5 5.5-5s5.1 1.6 5.5 5M16 5.5a3 3 0 0 1 0 5.8M17 15c2.3.4 3.5 2 3.8 5"/></>;
  return <article data-tone={tone} className="admin-metric">
    <span className="admin-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span>
    <span className="admin-metric-copy"><span className="admin-metric-label">{label}</span><span className="admin-metric-value">{value}</span></span>
  </article>;
}
function AdminPanel({ title, description, children }) { return <article className="admin-panel rounded-lg border border-slate-100 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p><div className="mt-4 space-y-2">{children}</div></article>; }
function Summary({ label, value }) { return <div className="admin-summary-row flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm"><span className="text-slate-600">{label}</span><b className="text-slate-900">{number(value)}</b></div>; }
function QuickLink({ href, title, text }) { return <a href={href} className="admin-quick-link rounded-lg border border-slate-100 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"><p className="font-bold text-slate-900">{title}</p><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p><span className="mt-3 inline-flex text-sm font-bold text-emerald-700">Open →</span></a>; }
function Alert({ text, error = false }) { return <p className={`mt-5 rounded-xl p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{text}</p>; }
function Empty({ text }) { return <p className="p-6 text-center text-sm text-slate-500">{text}</p>; }
function Loading() { return <div className="mt-6 animate-pulse rounded-lg bg-slate-100 p-12 text-center text-sm text-slate-400">Loading administrator overview...</div>; }
