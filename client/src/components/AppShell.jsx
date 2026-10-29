import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";
import useRealtimeRefresh from "../hooks/useRealtimeRefresh.js";

const farmerLinks = [
  { group: "Workspace", label: "Overview", href: "#farmer", tag: "Home" },
  { label: "My Profile & Land", href: "#profile", tag: "Land" },
  { label: "GPS Farm Mapping", href: "#farm-mapping", tag: "Map" },
  { label: "Crop Detection", href: "#crop-detection", tag: "Scan" },
  { label: "Detection History", href: "#crop-history", tag: "History" },
  { label: "Farm Reports", href: "#farm-reports", tag: "Farms" },
  { group: "Reports", label: "Report Damage", href: "#report", tag: "Report" },
  { label: "My Reports", href: "#my-reports", tag: "Reports" },
  { group: "Updates", label: "Weather Condition", href: "#weather", tag: "Weather" },
  { label: "Notifications", href: "#notifications", tag: "Alerts" },
];

const staffLinks = [
  { group: "Operations", label: "Operations Overview", href: "#staff", tag: "Home" },
  { label: "Farm & Crop Records", href: "#farm-activity", tag: "Farms" },
  { label: "Review Reports", href: "#review", tag: "Review" },
  { label: "Farmer Registrations", href: "#registrations", tag: "Farmers" },
  { label: "Accepted Farmers", href: "#farmers", tag: "Directory" },
  { group: "Communication", label: "Send Notification", href: "#send-notification", tag: "Notify" },
  { label: "Announcements", href: "#announcements", tag: "Sent" },
  { group: "MAO Staff", label: "User Management", href: "#users", tag: "Users" },
  { group: "Admin controls", label: "User directory", href: "#admin-users", tag: "Users", adminOnly: true },
  { label: "Create account", href: "#staff-accounts", tag: "Add", adminOnly: true },
  { label: "Activity logs", href: "#admin-logs", tag: "Logs", adminOnly: true },
  { label: "System settings", href: "#system-settings", tag: "Setup", adminOnly: true },
  { label: "Staff SMS alerts", href: "#staff-sms", tag: "SMS", adminOnly: true },
];

function NavigationIcon({ tag }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  let icon;
  switch (tag) {
    case "Home": icon = <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>; break;
    case "Land": icon = <><circle cx="12" cy="8" r="3.2"/><path d="M5 20c.6-3.3 3.1-5.2 7-5.2s6.4 1.9 7 5.2"/></>; break;
    case "Map": icon = <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>; break;
    case "Scan": icon = <><path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/></>; break;
    case "History": icon = <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>; break;
    case "Report": icon = <><path d="m12 3 9 16H3z"/><path d="M12 9v4M12 16h.01"/></>; break;
    case "Weather": icon = <path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9Z"/>; break;
    case "Alerts": icon = <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>; break;
    case "Review": icon = <><path d="M8 4H5a2 2 0 0 0-2 2v14h18V6a2 2 0 0 0-2-2h-3"/><path d="M8 3h8v4H8zM8 13l2.5 2.5L16 10"/></>; break;
    case "Farmers": case "Directory": case "Users": icon = <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-3.4 2.2-5 5.5-5s5.1 1.6 5.5 5M16 5.5a3 3 0 0 1 0 5.8M17 15c2.3.4 3.5 2 3.8 5"/></>; break;
    case "Notify": case "SMS": icon = <><path d="M4 5h16v12H9l-5 4z"/><path d="M8 10h8M8 13.5h5"/></>; break;
    case "Sent": icon = <><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>; break;
    case "Add": icon = <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>; break;
    case "Setup": case "MAO": icon = <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.3 1-1.4 2.4-1.6-.6a8 8 0 0 1-1.5.9l-.3 1.7h-2.8l-.3-1.7a8 8 0 0 1-1.5-.9l-1.6.6L6.4 16l1.3-1a7 7 0 0 1 0-1.8l-1.3-1 1.4-2.4 1.6.6a8 8 0 0 1 1.5-.9l.3-1.7H14l.3 1.7a8 8 0 0 1 1.5.9l1.6-.6 1.4 2.4-1.3 1a7 7 0 0 1-.1 1.8Z"/></>; break;
    default: icon = <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></>;
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="app-nav-svg h-5 w-5 shrink-0" {...common}>{icon}</svg>;
}

function HeaderBell() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>;
}

export default function AppShell({ role = "farmer", children, onLogout }) {
  const isFarmer = role === "farmer";
  const isAdmin = role === "admin";
  const isTechnician = role === "technician";
  const adminHiddenLinks = ["#staff", "#review", "#registrations", "#farmers", "#send-notification", "#announcements", "#users"];
  const technicianLinks = new Set(["#staff", "#review", "#send-notification", "#announcements"]);
  const links = (isFarmer ? farmerLinks : staffLinks).filter(link => (!link.adminOnly || isAdmin) && (!isAdmin || !adminHiddenLinks.includes(link.href)) && (!isTechnician || technicianLinks.has(link.href)));
  const home = isFarmer ? "#farmer" : isAdmin ? "#admin" : "#staff";
  const activeHash = window.location.hash || home;
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [staffReviewCounts, setStaffReviewCounts] = useState({ reports: 0, registrations: 0 });
  const currentSession = JSON.parse(localStorage.getItem("agrisystem-session") || "null");
  const currentUser = currentSession?.user || {};
  const token = currentSession?.token;
  const profileName = currentUser.fullName || currentUser.full_name || (isFarmer ? "Farmer account" : "Staff account");
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const roleLabel = { farmer: "Farmer", staff: "MAO Staff", technician: "MAO Technician", admin: "Administrator" }[currentUser.role || role] || "Account";
  const profileCard = <><span className="app-user-avatar" aria-hidden="true">{profileInitials || "U"}</span><span className="app-user-details"><span className="app-user-name">{profileName}</span><span className="app-user-role">{roleLabel}</span></span></>;
  const loadUnreadNotifications = useCallback(() => {
    if (!isFarmer || !token) return Promise.resolve();
    return api("/notifications/mine", { token }).then(data => setUnreadNotifications(data.notifications.filter(item => !item.read_at).length)).catch(() => setUnreadNotifications(0));
  }, [isFarmer, token]);
  const loadStaffReviewCounts = useCallback(() => {
    if (isFarmer || isTechnician || !token) return Promise.resolve();
    return api("/admin/review-indicators", { token }).then(counts => setStaffReviewCounts({ reports: counts.reports || 0, registrations: counts.registrations || 0 })).catch(() => setStaffReviewCounts({ reports: 0, registrations: 0 }));
  }, [isFarmer, isTechnician, token]);
  const skipIndicators = useCallback(() => Promise.resolve(), []);
  const refreshIndicators = isFarmer ? loadUnreadNotifications : isTechnician ? skipIndicators : loadStaffReviewCounts;
  useEffect(() => {
    let active = true;
    refreshIndicators().catch(() => { if (active) setUnreadNotifications(0); });
    return () => { active = false; };
  }, [refreshIndicators]);
  useRealtimeRefresh(token, refreshIndicators);
  useEffect(() => {
    window.addEventListener("agrisystem-review-items-seen", loadStaffReviewCounts);
    return () => window.removeEventListener("agrisystem-review-items-seen", loadStaffReviewCounts);
  }, [loadStaffReviewCounts]);

  return <div className="app-shell min-h-screen">
    <header className="app-header sticky top-0 z-30 border-b text-white">
      <div className={`app-header-inner flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-7 ${isAdmin ? "max-w-none" : "mx-auto max-w-[1600px]"}`}>
        <a href={home} className="app-brand flex min-w-0 items-center" aria-label="AgriSystem home">
          <span className="app-brand-logo flex shrink-0 items-center justify-center overflow-hidden"><img src="/icons/agrisystem-icon.svg" alt="" className="h-full w-full object-contain"/></span>
          <span className="app-brand-copy min-w-0"><span className="app-brand-heading flex min-w-0 items-center"><span className="app-brand-title block truncate font-extrabold"><span className="app-brand-agri">Agri</span><span className="app-brand-system">System</span></span></span></span>
        </a>
        <div className="app-header-actions">
          {isFarmer && <a href="#notifications" className="app-notification-link" aria-label={`Notifications, ${unreadNotifications} unread`} title="Notifications"><HeaderBell/>{unreadNotifications > 0 && <span className="app-notification-count">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</a>}
          {isFarmer ? <a href="#profile" className="app-user-block" aria-label="Open profile and land">{profileCard}</a> : <div className="app-user-block">{profileCard}</div>}
          <button onClick={onLogout} className="app-signout shrink-0 rounded-lg border px-3 py-2 text-sm font-bold text-white transition focus:outline-none focus:ring-2 focus:ring-lime-300">Sign out</button>
        </div>
      </div>
    </header>

    <div className={`grid w-full lg:grid-cols-[18rem_minmax(0,1fr)] ${isAdmin ? "max-w-none" : "mx-auto max-w-[1600px]"}`}>
      <aside className="app-sidebar border-b shadow-sm backdrop-blur lg:sticky lg:top-[66px] lg:self-start lg:border-b-0 lg:border-r lg:shadow-none">
        <nav aria-label={isFarmer ? "Farmer portal navigation" : isAdmin ? "Administrator navigation" : "MAO staff navigation"} className="p-3 lg:p-4">
          <div className="app-workspace-block flex items-start gap-3 border-b border-slate-200 px-3 py-4">
            <span className="app-workspace-icon" aria-hidden="true"><NavigationIcon tag={isFarmer ? "Land" : "Users"}/></span>
            <div className="min-w-0">
              <p className="app-workspace-title">{isFarmer ? "Farmer Workspace" : isAdmin ? "Administrator Workspace" : "MAO Staff Workspace"}</p>
              <p className="app-workspace-description">{isFarmer ? "Manage land records, crop reports, weather, and service updates." : isAdmin ? "Manage account access, audit records, and system settings." : "Review reports, registrations, and farmer communication."}</p>
            </div>
          </div>

          <div className="app-nav-items flex flex-wrap lg:mt-3">
            {links.map((link, index) => <div key={link.href} className={`shrink-0 ${link.group ? "lg:mt-3" : ""}`}>
              {link.group && <p className={`hidden px-3 pb-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400 lg:block ${index === 0 ? "lg:mt-0" : ""}`}>{link.group}</p>}
              {(() => { const reviewCount = link.href === "#review" ? staffReviewCounts.reports : link.href === "#registrations" ? staffReviewCounts.registrations : 0; const badgeCount = link.href === "#notifications" ? unreadNotifications : reviewCount; const badgeLabel = link.href === "#review" ? "reports awaiting MAO review" : link.href === "#registrations" ? "farmer registrations awaiting MAO review" : "unread notifications"; return <a href={link.href} aria-current={activeHash === link.href ? "page" : undefined} className={`app-nav-link group flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium ${activeHash !== link.href ? "border border-transparent" : ""}`}>
                <span className="app-nav-icon"><NavigationIcon tag={link.tag}/></span>
                <span className="min-w-0 flex-1 break-words leading-5">{link.label}</span>{badgeCount > 0 && <span aria-label={`${badgeCount} ${badgeLabel}`} className={`ml-auto flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${activeHash === link.href ? "bg-lime-300 text-emerald-950" : "bg-red-500 text-white"}`}>{badgeCount > 99 ? "99+" : badgeCount}</span>}
              </a>; })()}
            </div>)}
          </div>

        </nav>
      </aside>

      <main className="app-main min-w-0 px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
        <div className={`app-page-container w-full ${isFarmer || isAdmin ? "mx-auto max-w-[1440px]" : "mx-auto max-w-[1320px]"}`}>{children}</div>
      </main>
    </div>
  </div>;
}
