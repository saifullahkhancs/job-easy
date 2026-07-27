import { NavLink, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Edit,
  FolderKanban,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  UploadCloud,
  X,
} from "lucide-react";
import { RoleBadge, ApprovalStatusBadge } from "./RoleBadge";
import { ROLES } from "./RoleGuard";

/**
 * One shared Job Easy sidebar used by both the landing page and the app shell.
 * The page owns the open/collapsed/mobile state; this component only renders
 * the consistent navigation, account area and collapse controls.
 */
export default function MainSidebar({
  currentUser,
  isMobile,
  sidebarOpen,
  toggleSidebar,
  onLogout,
  id = "app-sidebar",
}) {
  const navigate = useNavigate();

  const navItems = getMainNavItems(currentUser);

  const handleNavigateHome = () => {
    if (isMobile && sidebarOpen) toggleSidebar();
    navigate("/");
  };

  // The one toggle lives in the sidebar header and stays mounted in every state
  // (expanded, collapsed rail, mobile drawer) so the sidebar can always be reopened.
  const toggleTitle = isMobile
    ? "Close sidebar"
    : sidebarOpen
      ? "Collapse sidebar"
      : "Open sidebar";

  const ToggleIcon = isMobile ? X : sidebarOpen ? PanelLeftClose : PanelLeftOpen;

  return (
    <aside
      id={id}
      className="app-sidebar"
      aria-hidden={isMobile && !sidebarOpen ? "true" : "false"}
    >
      <div className="sidebar-brand">
        <button
          type="button"
          className="sidebar-brand-link"
          onClick={handleNavigateHome}
          aria-label="Go to Job Easy home"
          title="Go to Job Easy home"
        >
          <div className="brand-icon brand-icon-main">
            <LayoutGrid size={24} />
          </div>
          <h2>Job Easy</h2>
        </button>

        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={toggleSidebar}
          aria-label={toggleTitle}
          aria-expanded={sidebarOpen}
          aria-controls={id}
          title={toggleTitle}
        >
          <ToggleIcon size={22} />
        </button>
      </div>

      <div className="sidebar-section">
        <p className="sidebar-heading">MAIN</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
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

      <div className="sidebar-bottom">
        {currentUser && (
          <div className="sidebar-user-info">
            <div className="user-badges">
              {currentUser.role === ROLES.VISITOR && currentUser.approval_status === "pending" ? (
                <ApprovalStatusBadge status={currentUser.approval_status} />
              ) : (
                <>
                  <RoleBadge role={currentUser.role} />
                  <ApprovalStatusBadge status={currentUser.approval_status} />
                </>
              )}
            </div>
            <div className="user-details">
              <span className="user-name">
                {currentUser.first_name} {currentUser.last_name}
              </span>
              <span className="user-email">{currentUser.email}</span>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          {currentUser ? (
            <button className="logout-btn" onClick={onLogout} title="Logout">
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
      </div>
    </aside>
  );
}

function getMainNavItems(currentUser) {
  const sharedItems = [
    { to: "/app/templates", label: "Templates", icon: FolderKanban, end: true },
    { to: "/app/new", label: "New Template", icon: UploadCloud },
    { to: "/app/view", label: "View Templates", icon: LayoutTemplate },
    { to: "/app/send", label: "Send Email", icon: Send },
    { to: "/app/update", label: "Update Template", icon: Edit },
  ];

  // Guests and visitor accounts must be able to see the request pages from the sidebar.
  if (!currentUser || currentUser.role === ROLES.VISITOR) {
    return [
      ...sharedItems,
      { to: "/app/request-access", label: "Request Access", icon: Clock },
      { to: "/app/request-status", label: "Request Status", icon: CheckCircle2 },
    ];
  }

  if (currentUser.role === ROLES.CUSTOMER) {
    return [
      ...sharedItems,
      { to: "/app/request-status", label: "Request Status", icon: CheckCircle2 },
    ];
  }

  return sharedItems;
}
