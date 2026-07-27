import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  LayoutDashboard,
  Users,
  FileText,
  Menu,
  X,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { getCurrentUser, logout } from "../api/client";
import { getAccessToken } from "../api/tokenStorage";

/** Below this width the admin sidebar becomes an overlay drawer. */
const MOBILE_BREAKPOINT = 1024;
const SIDEBAR_PREF_KEY = "jobeasy.adminSidebar.open";

function readStoredSidebarPref() {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(SIDEBAR_PREF_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export default function AdminLayout() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  );
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < MOBILE_BREAKPOINT ? false : readStoredSidebarPref();
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setCurrentUser(null);
      return;
    }

    getCurrentUser()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const applyViewport = (matches) => {
      setIsMobile(matches);
      setSidebarOpen(matches ? false : readStoredSidebarPref());
    };

    const handleChange = (event) => applyViewport(event.matches);

    applyViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    if (!isMobile || !sidebarOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const lock = isMobile && sidebarOpen;
    document.body.style.overflow = lock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((previous) => {
      const next = !previous;
      if (!isMobile) {
        try {
          window.localStorage.setItem(SIDEBAR_PREF_KEY, String(next));
        } catch {
          /* storage unavailable — the toggle still works for this session */
        }
      }
      return next;
    });
  }, [isMobile]);

  const handleAuthButton = () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    logout();
    setCurrentUser(null);
    navigate("/login");
  };

  const navItems = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/requests", label: "Approval Requests", icon: Shield },
    { to: "/admin/users", label: "User Management", icon: Users },
    { to: "/admin/default-templates", label: "Default Templates", icon: FileText },
  ];

  const isCollapsed = !isMobile && !sidebarOpen;
  const isDrawerOpen = isMobile && sidebarOpen;

  const layoutClassName = [
    "admin-layout",
    isCollapsed ? "sidebar-collapsed" : "",
    isDrawerOpen ? "sidebar-drawer-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ToggleIcon = isMobile ? Menu : sidebarOpen ? PanelLeftClose : PanelLeftOpen;
  const toggleLabel = sidebarOpen ? "Close sidebar" : "Open sidebar";

  return (
    <div className={layoutClassName}>
      <div
        className="sidebar-backdrop"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="admin-sidebar"
        className="admin-sidebar"
        aria-hidden={isMobile && !sidebarOpen ? "true" : "false"}
      >
        <div className="admin-sidebar-header">
          <div className="admin-brand">
            {/* Brand links to landing page start URL, does NOT toggle sidebar */}
            <button
              type="button"
              className="admin-brand-link"
              onClick={() => navigate("/")}
              aria-label="Go to home - landing page"
              title="Go to home (Job Easy)"
            >
              <div className="admin-brand-mark admin-brand-mark-main">
                <Shield size={22} color="white" />
              </div>
              <div className="admin-brand-text">
                <h2>Job Easy</h2>
                <span className="admin-badge">Admin Panel</span>
              </div>
            </button>
            {/* Collapsed: toggle takes place of main icon and remains on sidebar */}
            <button
              type="button"
              className="admin-brand-mark admin-brand-toggle"
              onClick={toggleSidebar}
              aria-label="Open sidebar"
              aria-controls="admin-sidebar"
              title="Open sidebar"
            >
              <PanelLeftOpen size={20} />
            </button>
          </div>
          <div className="admin-sidebar-header-actions">
            {/* Desktop collapse — remains on sidebar */}
            <button
              type="button"
              className="sidebar-close-btn admin-sidebar-collapse-btn"
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              aria-controls="admin-sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
            {/* Mobile drawer close */}
            <button
              type="button"
              className="sidebar-close-btn admin-sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) => (isActive ? "admin-nav-link active" : "admin-nav-link")}
              >
                <Icon size={20} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main-content">
        <header className="admin-header">
          <div className="admin-header-title">
            <button
              type="button"
              className="sidebar-toggle-btn admin-sidebar-toggle-btn"
              onClick={toggleSidebar}
              aria-label={toggleLabel}
              aria-expanded={sidebarOpen}
              aria-controls="admin-sidebar"
              title={toggleLabel}
            >
              <ToggleIcon size={20} />
            </button>
            <h1>Admin Dashboard</h1>
          </div>
          <button
            className={currentUser ? "admin-logout-btn" : "admin-logout-btn admin-login-btn"}
            onClick={handleAuthButton}
          >
            {currentUser ? <LogOut size={18} /> : <LogIn size={18} />}
            <span className="admin-logout-label">{currentUser ? "Logout" : "Login"}</span>
          </button>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
