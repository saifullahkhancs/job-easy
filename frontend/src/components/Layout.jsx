import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutGrid, LayoutTemplate, Send, LogOut, User, Clock, UploadCloud, Edit, CheckCircle2 } from "lucide-react";
import { getCurrentUser, logout } from "../api/client";
import { RoleBadge, ApprovalStatusBadge } from "./RoleBadge";
import { ROLES } from "./RoleGuard";

export default function Layout() {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem("access_token");
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
    navigate("/app/templates/new", { replace: true });
  };

  const getNavItems = () => {
    if (!currentUser) {
      // For guest, show all pages (disabled state)
      return [
        { to: "/app/templates/new", label: "New Template", icon: UploadCloud },
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
        { to: "/app/templates/new", label: "New Template", icon: UploadCloud },
        { to: "/app/view", label: "View Templates", icon: LayoutTemplate },
        { to: "/app/send", label: "Send Email", icon: Send },
        { to: "/app/update", label: "Update Template", icon: Edit },
        { to: "/app/request-access", label: "Request Access", icon: Clock },
        { to: "/app/request-status", label: "Request Status", icon: CheckCircle2 },
      ];
    }

    if (isCustomer) {
      return [
        { to: "/app/templates/new", label: "New Template", icon: UploadCloud },
        { to: "/app/view", label: "View Templates", icon: LayoutTemplate },
        { to: "/app/send", label: "Send Email", icon: Send },
        { to: "/app/update", label: "Update Template", icon: Edit },
        { to: "/app/request-status", label: "Request Status", icon: CheckCircle2 },
      ];
    }

    if (isAdmin) {
      return [
        { to: "/app/templates/new", label: "New Template", icon: UploadCloud },
        { to: "/app/view", label: "View Templates", icon: LayoutTemplate },
        { to: "/app/send", label: "Send Email", icon: Send },
        { to: "/app/update", label: "Update Template", icon: Edit },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <LayoutGrid size={24} />
          </div>
          <h2>Job Easy</h2>
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
                  className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
                >
                  <Icon size={20} className="link-icon" />
                  <span>{item.label}</span>
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
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={20} className="link-icon" />
              <span>Logout</span>
            </button>
          ) : (
            <div className="sidebar-auth-buttons">
              <button className="sidebar-login-btn" onClick={() => navigate("/login")}>
                <span>Login</span>
              </button>
              <button className="sidebar-register-btn" onClick={() => navigate("/signup")}>
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="app-main-content" style={{ gridTemplateColumns: "1fr" }}>
        <Outlet key={currentUser?.user_id || 'guest'} />
      </main>
    </div>
  );
}
