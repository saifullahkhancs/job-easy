import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Shield, LayoutDashboard, Users, FileText, Settings, LogOut, Menu, X } from "lucide-react";
import { getCurrentAdminUser, adminLogout } from "../api/adminClient";

export default function AdminLayout() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const user = await getCurrentAdminUser();
      setCurrentUser(user);
    } catch (error) {
      console.error("Failed to fetch current admin user:", error);
    }
  };

  const handleLogout = () => {
    adminLogout();
    navigate("/admin/login");
  };

  const navItems = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/requests", label: "Approval Requests", icon: Shield },
    { to: "/admin/users", label: "User Management", icon: Users },
    { to: "/admin/default-templates", label: "Default Templates", icon: FileText },
    { to: "/admin/template-role-types", label: "Template Role Types", icon: Settings },
  ];

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="admin-sidebar-header">
          <div className="admin-brand">
            <Shield size={24} className="brand-icon" />
            <div>
              <h2>Job Easy</h2>
              <span className="admin-badge">Admin Panel</span>
            </div>
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? "admin-nav-link active" : "admin-nav-link")}
              >
                <Icon size={20} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {currentUser && (
          <div className="admin-user-section">
            <div className="admin-user-info">
              <div className="admin-avatar">
                {currentUser.first_name[0]}{currentUser.last_name[0]}
              </div>
              <div className="admin-user-details">
                <span className="admin-user-name">{currentUser.first_name} {currentUser.last_name}</span>
                <span className="admin-user-email">{currentUser.email}</span>
              </div>
            </div>
            <button className="admin-logout-btn" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </aside>

      <main className="admin-main-content">
        <header className="admin-header">
          <div className="admin-header-title">
            <h1>Admin Dashboard</h1>
          </div>
          <div className="admin-header-actions">
            {currentUser && (
              <div className="admin-header-user">
                <span className="header-user-name">{currentUser.first_name} {currentUser.last_name}</span>
                <span className="header-user-role">Administrator</span>
              </div>
            )}
          </div>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
