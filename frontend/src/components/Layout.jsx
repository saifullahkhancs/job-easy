import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Menu, X } from "lucide-react";
import { getCurrentUser, logout } from "../api/client";
import { getAccessToken } from "../api/tokenStorage";
import MainSidebar from "./MainSidebar";

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

      {/* Dimmed backdrop behind the mobile drawer. */}
      <div
        className="sidebar-backdrop"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <MainSidebar
        id="app-sidebar"
        currentUser={currentUser}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        onLogout={handleLogout}
      />

      <main className="app-main-content">
        <div className="app-content-inner">
          <Outlet key={currentUser?.email || "guest"} />
        </div>
      </main>
    </div>
  );
}
