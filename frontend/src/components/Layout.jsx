import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutGrid, LayoutTemplate, Send, LogOut, User, Clock, Shield } from "lucide-react";
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
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error("Failed to fetch current user:", error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getNavItems = () => {
    if (!currentUser) return [];

    const isVisitor = currentUser.role === ROLES.VISITOR;
    const isCustomer = currentUser.role === ROLES.CUSTOMER;
    const isAdmin = currentUser.role === ROLES.ADMIN;

    const baseItems = [
      { to: "/app", label: "Templates", end: true, icon: LayoutTemplate },
    ];

    if (isVisitor) {
      return [
        ...baseItems,
        { to: "/app/request-access", label: "Request Access", icon: Clock },
      ];
    }

    if (isCustomer) {
      return [
        ...baseItems,
        { to: "/app/send", label: "Send Email", icon: Send },
      ];
    }

    if (isAdmin) {
      return baseItems; // Admin should use separate admin interface
    }

    return baseItems;
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
              <RoleBadge role={currentUser.role} />
              <ApprovalStatusBadge status={currentUser.approval_status} />
            </div>
            <div className="user-details">
              <span className="user-name">{currentUser.first_name} {currentUser.last_name}</span>
              <span className="user-email">{currentUser.email}</span>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} className="link-icon" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="app-main-content">
        <Outlet />
      </main>
    </div>
  );
}
