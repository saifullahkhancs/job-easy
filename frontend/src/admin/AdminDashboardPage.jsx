import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Shield, Clock, XCircle, CheckCircle, ArrowRight } from "lucide-react";
import { listAdminUsers, listAdminRequests } from "../api/adminClient";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    visitors: 0,
    customers: 0,
    pendingRequests: 0,
    rejectedRequests: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [users, requests] = await Promise.all([
        listAdminUsers(),
        listAdminRequests()
      ]);

      const visitors = users.filter(u => u.role === "visitor").length;
      const customers = users.filter(u => u.role === "customer").length;
      const pending = requests.filter(r => r.status === "pending").length;
      const rejected = requests.filter(r => r.status === "rejected").length;

      setStats({
        totalUsers: users.length,
        visitors,
        customers,
        pendingRequests: pending,
        rejectedRequests: rejected,
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "blue",
      link: "/admin/users",
    },
    {
      title: "Visitors",
      value: stats.visitors,
      icon: Clock,
      color: "yellow",
      link: "/admin/users?role=visitor",
    },
    {
      title: "Customers",
      value: stats.customers,
      icon: CheckCircle,
      color: "green",
      link: "/admin/users?role=customer",
    },
    {
      title: "Pending Requests",
      value: stats.pendingRequests,
      icon: Shield,
      color: "orange",
      link: "/admin/requests?status=pending",
    },
    {
      title: "Rejected Requests",
      value: stats.rejectedRequests,
      icon: XCircle,
      color: "red",
      link: "/admin/requests?status=rejected",
    },
  ];

  const quickActions = [
    {
      title: "Review Pending Requests",
      description: "Approve or reject email automation requests",
      icon: Shield,
      link: "/admin/requests?status=pending",
      color: "orange",
    },
    {
      title: "Manage Users",
      description: "View and manage user roles and status",
      icon: Users,
      link: "/admin/users",
      color: "blue",
    },
    {
      title: "Manage Default Templates",
      description: "Create and edit system default templates",
      icon: CheckCircle,
      link: "/admin/default-templates",
      color: "green",
    },
  ];

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p className="admin-page-subtitle">Overview of system activity and quick actions</p>
      </div>

      <div className="admin-stats-grid">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.title} 
              className={`admin-stat-card admin-stat-${stat.color}`}
              onClick={() => navigate(stat.link)}
              style={{ cursor: "pointer" }}
            >
              <div className="admin-stat-icon">
                <Icon size={24} />
              </div>
              <div className="admin-stat-content">
                <div className="admin-stat-value">{stat.value}</div>
                <div className="admin-stat-label">{stat.title}</div>
              </div>
              <ArrowRight size={16} className="admin-stat-arrow" />
            </div>
          );
        })}
      </div>

      <div className="admin-quick-actions">
        <h2>Quick Actions</h2>
        <div className="admin-actions-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <div 
                key={action.title} 
                className="admin-action-card"
                onClick={() => navigate(action.link)}
              >
                <div className={`admin-action-icon admin-action-${action.color}`}>
                  <Icon size={24} />
                </div>
                <div className="admin-action-content">
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                </div>
                <ArrowRight size={20} className="admin-action-arrow" />
              </div>
            );
          })}
        </div>
      </div>

      {stats.pendingRequests > 0 && (
        <div className="admin-alert-banner admin-alert-warning">
          <Shield size={20} className="alert-icon" />
          <div className="alert-content">
            <h3>Pending Approval Requests</h3>
            <p>You have {stats.pendingRequests} pending request{stats.pendingRequests > 1 ? "s" : ""} awaiting review.</p>
          </div>
          <button 
            className="admin-alert-btn"
            onClick={() => navigate("/admin/requests?status=pending")}
          >
            Review Now
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
