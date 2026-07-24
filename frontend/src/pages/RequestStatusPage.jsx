import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle, XCircle, RefreshCw, ArrowRight, AlertCircle } from "lucide-react";
import { getApprovalStatus, listMyRequests, getCurrentUser } from "../api/client";
import { RoleBadge, ApprovalStatusBadge } from "../components/RoleBadge";

export default function RequestStatusPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchStatus = async () => {
    try {
      const [user, status] = await Promise.all([
        getCurrentUser(),
        getApprovalStatus()
      ]);
      setCurrentUser(user);
      setRequest(status);
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  // Admins don't have approval requests — redirect them away
  if (currentUser?.role === "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "480px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "2.5rem", textAlign: "center" }}>
          <AlertCircle size={48} color="#3b82f6" style={{ marginBottom: "1rem" }} />
          <h2 style={{ color: "#1e293b", margin: "0 0 0.5rem" }}>Not Available for Admins</h2>
          <p style={{ color: "#64748b", margin: "0 0 1.5rem" }}>Approval requests are for customer accounts only. Use the Admin Panel to review requests.</p>
          <button className="primary-btn" onClick={() => navigate("/admin/requests")} style={{ width: "100%", justifyContent: "center" }}>
            Go to Admin Panel
            <ArrowRight size={16} className="btn-icon" />
          </button>
        </div>
      </div>
    );
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          color: "yellow",
          cardBg: "#fef9c3",
          cardBorder: "#fde047",
          cardColor: "#92400e",
          title: "Pending Approval",
          description: "Your request is currently being reviewed by an admin.",
          action: null,
        };
      case "approved":
        return {
          icon: CheckCircle,
          color: "green",
          cardBg: "#dcfce7",
          cardBorder: "#86efac",
          cardColor: "#166534",
          title: "Approved",
          description: "Congratulations! Your request has been approved. You now have full access to email automation features.",
          action: () => navigate("/app"),
          actionText: "Go to Dashboard",
        };
      case "rejected":
        return {
          icon: XCircle,
          color: "red",
          cardBg: "#fee2e2",
          cardBorder: "#fca5a5",
          cardColor: "#991b1b",
          title: "Rejected",
          description: "Your request was not approved. Please review the admin notes below and submit a new request if needed.",
          action: () => navigate("/app/request-access"),
          actionText: "Submit New Request",
        };
      default:
        return {
          icon: Clock,
          color: "gray",
          cardBg: "#f1f5f9",
          cardBorder: "#cbd5e1",
          cardColor: "#334155",
          title: "Unknown Status",
          description: "Unable to determine your approval status.",
          action: null,
        };
    }
  };

  const statusConfig = request ? getStatusConfig(request.status) : getStatusConfig("pending");
  const StatusIcon = statusConfig.icon;
  const { cardBg, cardBorder, cardColor } = statusConfig;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: "560px" }}>

        {/* Status Card */}
        <div style={{
          background: cardBg,
          border: `2px solid ${cardBorder}`,
          borderRadius: "16px",
          padding: "2.5rem",
          textAlign: "center",
          marginBottom: "1.5rem",
        }}>
          <StatusIcon size={56} color={cardColor} style={{ marginBottom: "1rem" }} />
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: cardColor, margin: "0 0 0.5rem" }}>
            {statusConfig.title}
          </h1>
          <p style={{ color: cardColor, opacity: 0.8, margin: 0 }}>
            {statusConfig.description}
          </p>
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#334155" }}>Approval Request Status</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {request && (
              <button
                className="secondary-btn"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh status"
              >
                <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            )}
            {!request && (
              <button className="primary-btn" onClick={() => navigate("/app/request-access")}>
                Submit New Request
                <ArrowRight size={16} className="btn-icon" />
              </button>
            )}
            {/* <div style={{ display: "flex", gap: "0.5rem" }}>
              {currentUser && <RoleBadge role={currentUser.role} />}
              {request && <ApprovalStatusBadge status={request.approval_status || request.status} />}
            </div> */}
          </div>
        </div>

        {/* Request Details */}
        {request && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.5rem", marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 1rem", color: "#1e293b" }}>Request Details</h3>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: "#64748b", fontWeight: 500 }}>Requested At</span>
              <span style={{ color: "#1e293b" }}>{new Date(request.requested_at).toLocaleString()}</span>
            </div>

            {request.reviewed_at && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ color: "#64748b", fontWeight: 500 }}>Reviewed At</span>
                <span style={{ color: "#1e293b" }}>{new Date(request.reviewed_at).toLocaleString()}</span>
              </div>
            )}

            {request.admin_notes && (
              <div style={{ marginTop: "1rem", background: "#fef9c3", border: "1px solid #fde047", borderRadius: "8px", padding: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <AlertCircle size={16} color="#92400e" />
                  <span style={{ fontWeight: 600, color: "#92400e" }}>Admin Notes</span>
                </div>
                <p style={{ margin: 0, color: "#78350f" }}>{request.admin_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* No request state */}
        {!request && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "2rem", textAlign: "center" }}>
            <AlertCircle size={32} color="#94a3b8" style={{ marginBottom: "0.75rem" }} />
            <h3 style={{ color: "#1e293b", margin: "0 0 0.5rem" }}>No Request Found</h3>
            <p style={{ color: "#64748b", margin: 0 }}>You haven't submitted an approval request yet. Click the button above to get started.</p>
          </div>
        )}

        {/* Action button */}
        {statusConfig.action && (
          <div style={{ marginTop: "1rem" }}>
            <button className="primary-btn" onClick={statusConfig.action} style={{ width: "100%", justifyContent: "center" }}>
              {statusConfig.actionText}
              <ArrowRight size={20} className="btn-icon" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
