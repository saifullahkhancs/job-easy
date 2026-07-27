import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutGrid,
  LayoutTemplate,
  Send,
  LogOut,
  Clock,
  UploadCloud,
  Edit,
  CheckCircle2,
  FolderKanban,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { getCurrentUser, logout } from "../api/client";
import { getAccessToken } from "../api/tokenStorage";
import { RoleBadge, ApprovalStatusBadge } from "./RoleBadge";
import { ROLES } from "./RoleGuard";

/** Below this width the sidebar behaves as an overlay drawer instead of a docked column. */
const MOBILE_BREAKPOINT = 1024;
const SIDEBAR_PREF_KEY = "jobeasy.sidebar.open";

function readStoredSidebarPref() {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(SIDEBAR_PREF_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export default function Layout() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  );
  // On desktop this means "expanded"; on mobile it means "drawer visible".
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < MOBILE_BREAKPOINT ? false : readStoredSidebarPref();
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Keep track of the viewport so the sidebar can switch between docked and drawer mode.
  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const applyViewport = (matches) => {
      setIsMobile(matches);
      // Entering mobile always starts closed; returning to desktop restores the saved preference.
      setSidebarOpen(matches ? false : readStoredSidebarPref());
    };

    const handleChange = (event) => applyViewport(event.matches);

    applyViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Navigating on a phone should dismiss the drawer, otherwise it covers the new page.
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, sidebarOpen]);

  // Prevent the page behind the drawer from scrolling on mobile.
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

  const fetchCurrentUser = async () => {
    const token = getAccessToken();
    if (!token) {
      setCurrentUser(null);
      return;
    }
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      logout();
      setCurrentUser(null);
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    navigate("/app/templates", { replace: true });
  };

  const getNavItems = () => {
    if (!currentUser) {
      // For guest, show all pages (disabled state)
      return [
        { to: "/app/templates", label: "Templates", icon: FolderKanban, end: true },
        { to: "/app/new", label: "New Template", icon: UploadCloud },
        { to: "/app/view", label: "View Templates", icon: LayoutTemplate },
        { to: "/app/send", label: "Send Email", icon: Send },
        { to: "/app/update", label: "Update Template", icon: Edit },
      ];
    }

    const isVisitor = currentUser.role === ROLES.VISITOR;
    const isCustomer = currentUser.role === ROLES.CUSTOMER;
    const isAdmin = currentUser.role === ROLES.ADMIN;

    if (isVisitor) {
      return [
        { to: "/app/templates", label: "Templates", icon: FolderKanban, end: true },
        { to: "/app/new", label: "New Template", icon: UploadCloud },
        { to: "/app/view", label: "View Templates", icon: LayoutTemplate },
        { to: "/app/send", label: "Send Email", icon: Send },
        { to: "/app/update", label: "Update Template", icon: Edit },
        { to: "/app/request-access", label: "Request Access", icon: Clock },
        { to: "/app/request-status", label: "Request Status", icon: CheckCircle2 },
      ];
    }

    if (isCustomer) {
      return [
        { to: "/app/templates", label: "Templates", icon: FolderKanban, end: true },
        { to: "/app/new", label: "New Template", icon: UploadCloud },
        { to: "/app/view", label: "View Templates", icon: LayoutTemplate },
        { to: "/app/send", label: "Send Email", icon: Send },
        { to: "/app/update", label: "Update Template", icon: Edit },
        { to: "/app/request-status", label: "Request Status", icon: CheckCircle2 },
      ];
    }

    if (isAdmin) {
      return [
        { to: "/app/templates", label: "Templates", icon: FolderKanban, end: true },
        { to: "/app/new", label: "New Template", icon: UploadCloud },
        { to: "/app/view", label: "View Templates", icon: LayoutTemplate },
        { to: "/app/send", label: "Send Email", icon: Send },
        { to: "/app/update", label: "Update Template", icon: Edit },
      ];
    }

    return [];
  };

  const navItems = getNavItems();
  const isCollapsed = !isMobile && !sidebarOpen;
  const isDrawerOpen = isMobile && sidebarOpen;

  const layoutClassName = [
    "app-layout",
    isCollapsed ? "sidebar-collapsed" : "",
    isDrawerOpen ? "sidebar-drawer-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const toggleLabel = sidebarOpen ? "Close sidebar" : "Open sidebar";

  return (
    <div className={layoutClassName}>
      {/* Mobile-only bar: hosts the hamburger that opens the drawer. */}
      <header className="app-topbar">
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={toggleSidebar}
          aria-label={toggleLabel}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          title={toggleLabel}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="app-topbar-brand">
          <div className="brand-icon brand-icon-sm">
            <LayoutGrid size={18} />
          </div>
          <span>Job Easy</span>
        </div>
      </header>

      {/* Desktop-only: floating button that re-expands the collapsed rail. */}
      <button
        type="button"
        className="sidebar-expand-btn"
        onClick={toggleSidebar}
        aria-label="Open sidebar"
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
        title="Open sidebar"
      >
        <PanelLeftOpen size={18} />
      </button>

      {/* Dimmed backdrop behind the mobile drawer. */}
      <div
        className="sidebar-backdrop"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        className="app-sidebar"
        aria-hidden={isMobile && !sidebarOpen ? "true" : "false"}
      >
        <div className="sidebar-brand">
          <div className="brand-icon">
            <LayoutGrid size={24} />
          </div>
          <h2>Job Easy</h2>
          {/* Desktop: collapses the sidebar to an icon rail.
              Mobile: closes the drawer. */}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
            aria-controls="app-sidebar"
            title={isMobile ? "Close sidebar" : "Collapse sidebar"}
          >
            {isMobile ? <X size={20} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-heading">EMAIL AUTOMATION</p>
          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.label}
                  className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
                >
                  <Icon size={20} className="link-icon" />
                  <span className="sidebar-link-label">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {currentUser && (
          <div className="sidebar-user-info">
            <div className="user-badges">
              {currentUser.role === ROLES.VISITOR && currentUser.approval_status === 'pending' ? (
                <ApprovalStatusBadge status={currentUser.approval_status} />
              ) : (
                <>
                  <RoleBadge role={currentUser.role} />
                  <ApprovalStatusBadge status={currentUser.approval_status} />
                </>
              )}
            </div>
            <div className="user-details">
              <span className="user-name">{currentUser.first_name} {currentUser.last_name}</span>
              <span className="user-email">{currentUser.email}</span>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          {currentUser ? (
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={20} className="link-icon" />
              <span className="sidebar-link-label">Logout</span>
            </button>
          ) : (
            <div className="sidebar-auth-buttons">
              <button className="sidebar-login-btn" onClick={() => navigate("/login")} title="Login">
                <span className="sidebar-link-label">Login</span>
                <span className="sidebar-collapsed-initial" aria-hidden="true">L</span>
              </button>
              <button className="sidebar-register-btn" onClick={() => navigate("/signup")} title="Register">
                <span className="sidebar-link-label">Register</span>
                <span className="sidebar-collapsed-initial" aria-hidden="true">R</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="app-main-content">
        <div className="app-content-inner">
          <Outlet key={currentUser?.email || 'guest'} />
        </div>
      </main>
    </div>
  );
}
