import { useEffect, useState } from "react";
import { ForgotPasswordPage, LoginPage, RegisterPage } from "./pages/AuthPages.jsx";
import { DamageReportPage, FarmerDashboard, NotificationsPage, ProfileLandPage, WeatherPage } from "./pages/FarmerPages.jsx";
import { MyReportsPage } from "./pages/DamageMonitoringPage.jsx";
import { AdminDashboard, ReviewReportsPage, StaffDashboard } from "./pages/StaffPages.jsx";
import { CropDetectionHistoryPage, CropDetectionPage } from "./pages/CropDetectionPages.jsx";
import { AdminControlCenter, AnnouncementsPage, FarmerDirectoryPage, SendNotificationPage, UserManagementPage } from "./pages/StaffAdminPages.jsx";
import StaffFarmActivityPage from "./pages/StaffFarmActivityPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import FarmMappingPage from "./pages/FarmMappingPage.jsx";
import FarmReportsPage from "./pages/FarmReportsPage.jsx";
import { AdminLogsPage, StaffAccountsPage, StaffSmsSettingsPage, SystemSettingsPage } from "./pages/AdminToolsPages.jsx";
import { api } from "./services/api.js";

function readSession() {
  try {
    const stored = JSON.parse(localStorage.getItem("agrisystem-session") || "null");
    if (!stored?.token || !stored?.user?.role) return null;
    return stored;
  } catch {
    localStorage.removeItem("agrisystem-session");
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const [checkingSessionRole, setCheckingSessionRole] = useState(() => Boolean(readSession()?.token));
  const [route, setRoute] = useState(() => location.hash || "#home");
  useEffect(() => { const change=()=>setRoute(location.hash || "#home"); addEventListener("hashchange",change); return ()=>removeEventListener("hashchange",change); }, []);
  useEffect(() => {
    if (!session?.token) { setCheckingSessionRole(false); return; }
    let active = true;
    setCheckingSessionRole(true);
    api("/auth/me", { token: session.token }).then(({ user }) => {
      if (!active || !user?.role) return;
      const verified = { ...session, user: { ...session.user, id: user.id, fullName: user.full_name, role: user.role, contactNumber: user.contact_number } };
      localStorage.setItem("agrisystem-session", JSON.stringify(verified));
      setSession(verified);
    }).catch(() => {
      if (!active) return;
      localStorage.removeItem("agrisystem-session");
      setSession(null);
      if (location.hash !== "#login") location.hash = "#login";
    }).finally(() => { if (active) setCheckingSessionRole(false); });
    return () => { active = false; };
  }, [session?.token]);
  function login(result) { const next={ token: result.token, user: result.user }; localStorage.setItem("agrisystem-session",JSON.stringify(next)); setCheckingSessionRole(true); setSession(next); location.hash=next.user.role === "farmer" ? "#farmer" : next.user.role === "admin" ? "#admin" : "#staff"; }
  function logout(){localStorage.removeItem("agrisystem-session");setSession(null);setCheckingSessionRole(false);location.hash="#login";}
  if (route === "#home") return <HomePage onNavigate={h => location.hash = h}/>;
  // Public routes must be resolved before the saved session. This lets an
  // administrator sign in as another account or register a farmer without
  // being sent back to the administrator dashboard.
  if (route === "#register") return <RegisterPage onLogin={login} onNavigate={h=>location.hash=h}/>;
  if (route === "#forgot-password") return <ForgotPasswordPage onNavigate={h=>location.hash=h}/>;
  if (route === "#login") return <LoginPage onLogin={login} onNavigate={h=>location.hash=h}/>;
  if (!session) return <HomePage onNavigate={h => location.hash = h}/>;
  if (checkingSessionRole) return <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5] p-6"><p className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">Checking your account access…</p></div>;
  const props={token:session.token,onLogout:logout,role:session.user.role};
  if (session.user.role === "admin") {
    if (route === "#farm-activity") return <StaffFarmActivityPage {...props}/>;
    if (route === "#admin-users") return <UserManagementPage {...props}/>;
    if (route === "#staff-accounts") return <StaffAccountsPage {...props}/>;
    if (route === "#admin-logs") return <AdminLogsPage {...props}/>;
    if (route === "#system-settings") return <SystemSettingsPage {...props}/>;
    if (route === "#staff-sms") return <StaffSmsSettingsPage {...props}/>;
    return <AdminControlCenter {...props}/>;
  }
  if(session.user.role !== "farmer") { if(route==="#review")return <ReviewReportsPage {...props}/>; if(route==="#registrations")return <AdminDashboard {...props}/>; if(route==="#farmers")return <FarmerDirectoryPage {...props}/>; if(route==="#farm-activity")return <StaffFarmActivityPage {...props}/>; if(route==="#users")return <UserManagementPage {...props}/>; if(route==="#send-notification")return <SendNotificationPage {...props}/>; if(route==="#announcements")return <AnnouncementsPage {...props}/>; return <StaffDashboard {...props}/>; }
  if(route==="#profile")return <ProfileLandPage {...props}/>; if(route==="#farm-mapping")return <FarmMappingPage {...props}/>; if(route==="#farm-reports")return <FarmReportsPage {...props}/>; if(route==="#crop-detection")return <CropDetectionPage {...props}/>; if(route==="#crop-history")return <CropDetectionHistoryPage {...props}/>; if(route==="#report")return <DamageReportPage {...props}/>; if(route==="#my-reports")return <MyReportsPage {...props}/>; if(route==="#weather")return <WeatherPage {...props}/>; if(route==="#notifications")return <NotificationsPage {...props}/>; return <FarmerDashboard {...props}/>;
}
