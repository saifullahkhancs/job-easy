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

  const getStatusConfig = (status) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          color: "yellow",
          title: "Pending Approval",
          description: "Your request is currently being reviewed by an admin.",
          action: null,
        };
      case "approved":
        return {
          icon: CheckCircle,
          color: "green",
          title: "Approved",
          description: "Congratulations! Your request has been approved. You now have full access to email automation features.",
          action: () => navigate("/app"),
          actionText: "Go to Dashboard",
        };
      case "rejected":
        return {
          icon: XCircle,
          color: "red",
          title: "Rejected",
          description: "Your request was not approved. Please review the admin notes below and submit a new request if needed.",
          action: () => navigate("/app/request-access"),
          actionText: "Submit New Request",
        };
      default:
        return {
          icon: Clock,
          color: "gray",
          title: "Unknown Status",
          description: "Unable to determine your approval status.",
          action: null,
        };
    }
  };

  const statusConfig = request ? getStatusConfig(request.status) : getStatusConfig("pending");
  const StatusIcon = statusConfig.icon;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Approval Request Status</h1>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
            <button
              className="primary-btn"
              onClick={() => navigate("/app/request-access")}
            >
              Submit New Request
              <ArrowRight size={16} className="btn-icon" />
            </button>
          )}
          <div className="header-badges">
            {currentUser && <RoleBadge role={currentUser.role} />}
            {request && <ApprovalStatusBadge status={request.approval_status || request.status} />}
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className={`status-banner status-${statusConfig.color}`}>
          <StatusIcon size={32} className="status-icon" />
          <div className="status-content">
            <h2>{statusConfig.title}</h2>
            <p>{statusConfig.description}</p>
          </div>
        </div>

        {request && (
          <div className="request-details">
            <h3>Request Details</h3>
            
            <div className="detail-row">
              <label>Requested At:</label>
              <span>{new Date(request.requested_at).toLocaleString()}</span>
            </div>

            {request.reviewed_at && (
              <div className="detail-row">
                <label>Reviewed At:</label>
                <span>{new Date(request.reviewed_at).toLocaleString()}</span>
              </div>
            )}

            {request.admin_notes && (
              <div className="admin-notes">
                <div className="notes-header">
                  <AlertCircle size={20} className="notes-icon" />
                  <h4>Admin Notes</h4>
                </div>
                <p>{request.admin_notes}</p>
              </div>
            )}
          </div>
        )}

        {!request && (
          <div className="no-request-state">
            <AlertCircle size={32} className="warning-icon" />
            <h3>No Request Found</h3>
            <p>You haven't submitted an approval request yet. Click the button above to get started.</p>
          </div>
        )}

        {statusConfig.action && (
          <div className="action-buttons">
            <button
              className="primary-btn"
              onClick={statusConfig.action}
            >
              {statusConfig.actionText}
              <ArrowRight size={20} className="btn-icon" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
