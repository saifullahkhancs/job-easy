import { NavLink, Outlet } from "react-router-dom";
import { LayoutGrid, UploadCloud, LayoutTemplate, Send, Edit, LogOut } from "lucide-react";

const navItems = [
  { to: "/", label: "New Template", end: true, icon: UploadCloud },
  { to: "/view", label: "View Templates", icon: LayoutTemplate },
  { to: "/send", label: "Send Email", icon: Send },
  { to: "/update", label: "Update Template", icon: Edit },
];

export default function Layout() {
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

        <div className="sidebar-footer">
          <button className="logout-btn">
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
