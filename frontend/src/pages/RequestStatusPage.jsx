import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Inbox,
  CalendarClock,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { getApprovalStatus, getCurrentUser } from "../api/client";
import { getAccessToken } from "../api/tokenStorage";
import { RoleBadge, ApprovalStatusBadge } from "../components/RoleBadge";

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    accent: "pending",
    title: "Pending Approval",
    description: "Your request is in the queue and being reviewed by an admin.",
    hint: "Most requests are reviewed within one business day.",
  },
  approved: {
    icon: CheckCircle,
    accent: "approved",
    title: "Approved",
    description:
      "Congratulations! You now have full access to Job Easy's email automation features.",
    hint: "Head to Templates to create your first application template.",
    actionText: "Go to Templates",
    actionPath: "/app/templates",
  },
  rejected: {
    icon: XCircle,
    accent: "rejected",
    title: "Rejected",
    description:
      "Your request was not approved. Review the admin notes below, then submit a new request.",
    hint: "Fixing the issue mentioned in the notes usually resolves it.",
    actionText: "Submit New Request",
    actionPath: "/app/request-access",
  },
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function RequestStatusPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visitorPreview, setVisitorPreview] = useState(false);
  const navigate = useNavigate();

  const fetchStatus = async () => {
    const token = getAccessToken();
    if (!token) {
      setVisitorPreview(true);
      setCurrentUser(null);
      setRequest({
        status: "pending",
        requested_at: new Date().toISOString(),
        reviewed_at: null,
        admin_notes: "Demo preview only. Real request values appear here after login and admin review.",
      });
      setLoading(false);
      return;
    }

    setVisitorPreview(false);

    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error("Failed to fetch user:", err);
    }

    try {
      const status = await getApprovalStatus();
      setRequest(status);
    } catch {
      // A 404 simply means the user has not submitted a request yet.
      setRequest(null);
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

  const config = request ? STATUS_CONFIG[request.status] : null;
  const StatusIcon = config?.icon;

  return (
    <div className="page-container page-container-full-width">
      <section className="card" style={{ minHeight: "auto", height: "auto" }}>
        <div className="page-accent-header accent-request">
          <div>
            <h2>Request Status</h2>
            <p>Track your email automation approval request.</p>
          </div>
          <div className="page-accent-badge">
            <Inbox size={22} />
          </div>
        </div>

        {visitorPreview && (
          <div className="visitor-banner" style={{ marginBottom: "24px" }}>
            <AlertCircle size={20} className="banner-icon" />
            <div className="banner-content">
              <h3>Visitor Preview</h3>
              <p>
                These are sample request-status values so visitors can see the page. Real approvals
                and status updates are managed only by the admin after you login or register.
              </p>
            </div>
            <div className="login-prompt-actions">
              <button className="login-prompt-login-btn" onClick={() => navigate("/login")}>Login</button>
              <button className="login-prompt-register-btn" onClick={() => navigate("/signup")}>Register</button>
            </div>
          </div>
        )}

        {/* Status hero */}
        {config ? (
          <div className={`status-hero status-hero-${config.accent}`}>
            <div className="status-hero-icon">
              <StatusIcon size={40} />
            </div>
            <div className="status-hero-content">
              <div className="status-hero-title-row">
                <h2>{config.title}</h2>
                {currentUser && (
                  <div className="header-badges">
                    <RoleBadge role={currentUser.role} />
                    <ApprovalStatusBadge status={request.status} />
                  </div>
                )}
              </div>
              <p>{config.description}</p>
              {config.hint && <span className="status-hero-hint">{config.hint}</span>}
            </div>
          </div>
        ) : (
          <div className="result-panel">
            <div className="result-icon-ring result-icon-muted">
              <FileText size={44} />
            </div>
            <h2>No Request Found</h2>
            <p>
              You haven't submitted an approval request yet. Set up your sender identity to get
              started with email automation.
            </p>
            <div className="action-buttons centered">
              <button className="primary-btn" onClick={() => navigate("/app/request-access")}>
                Submit a Request
                <ArrowRight size={18} className="btn-icon" />
              </button>
            </div>
          </div>
        )}

        {request && (
          <>
            <div className="section-header">
              <div>
                <h2>Request Details</h2>
                <p className="section-description">A timeline of your submission.</p>
              </div>
              <button
                className="secondary-btn"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh status"
              >
                <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="detail-stats-grid">
              <div className="detail-stat">
                <span className="detail-stat-label">
                  <CalendarClock size={15} /> Requested
                </span>
                <span className="detail-stat-value">{formatDate(request.requested_at)}</span>
              </div>
              <div className="detail-stat">
                <span className="detail-stat-label">
                  <ShieldCheck size={15} /> Reviewed
                </span>
                <span className="detail-stat-value">
                  {request.reviewed_at ? formatDate(request.reviewed_at) : "Awaiting review"}
                </span>
              </div>
              <div className="detail-stat">
                <span className="detail-stat-label">
                  <Inbox size={15} /> Status
                </span>
                <span className="detail-stat-value" style={{ textTransform: "capitalize" }}>
                  {request.status}
                </span>
              </div>
            </div>

            {request.admin_notes && (
              <div className="admin-notes-card">
                <div className="admin-notes-header">
                  <AlertCircle size={16} />
                  Admin Notes
                </div>
                <p>{request.admin_notes}</p>
              </div>
            )}

            {config?.actionPath && (
              <div className="action-buttons" style={{ marginTop: "24px" }}>
                <button
                  className="primary-btn"
                  onClick={() => navigate(config.actionPath)}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {config.actionText}
                  <ArrowRight size={18} className="btn-icon" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
