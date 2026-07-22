import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Eye, Filter, RefreshCw } from "lucide-react";
import { listAdminRequests, reviewAdminRequest } from "../api/adminClient";

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [adminNote, setAdminNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await listAdminRequests(statusFilter === "all" ? undefined : statusFilter);
      setRequests(data);
      setFilteredRequests(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    setReviewing(requestId);
    try {
      await reviewAdminRequest(requestId, { status: "approved", admin_notes: adminNote });
      setMessage("Request approved successfully");
      setAdminNote("");
      await fetchRequests();
    } catch (error) {
      setError(error.message);
    } finally {
      setReviewing(null);
    }
  };

  const handleReject = async (requestId) => {
    if (!adminNote.trim()) {
      setError("Admin note is required for rejection");
      return;
    }
    setReviewing(requestId);
    try {
      await reviewAdminRequest(requestId, { status: "rejected", admin_notes: adminNote });
      setMessage("Request rejected successfully");
      setAdminNote("");
      await fetchRequests();
    } catch (error) {
      setError(error.message);
    } finally {
      setReviewing(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="admin-status-badge admin-status-pending">
            <Clock size={14} />
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="admin-status-badge admin-status-approved">
            <CheckCircle size={14} />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="admin-status-badge admin-status-rejected">
            <XCircle size={14} />
            Rejected
          </span>
        );
      default:
        return <span className="admin-status-badge">{status}</span>;
    }
  };

  const canReview = (status) => status === "pending";

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">Loading requests...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Approval Requests</h1>
        <p className="admin-page-subtitle">Review and manage email automation approval requests</p>
      </div>

      <div className="admin-toolbar">
        <div className="admin-filter-group">
          <Filter size={18} className="filter-icon" />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-filter-select"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <button 
          className="admin-refresh-btn"
          onClick={fetchRequests}
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {error && <div className="admin-error-message">{error}</div>}
      {message && <div className="admin-success-message">{message}</div>}

      <div className="admin-table-container">
        {filteredRequests.length === 0 ? (
          <div className="admin-empty-state">
            <Clock size={48} className="empty-icon" />
            <h3>No requests found</h3>
            <p>No approval requests match the current filter.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Sender Email (Masked)</th>
                <th>Sender Name</th>
                <th>Requested At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <div className="admin-user-cell">
                      <div className="admin-user-avatar">
                        {request.user?.first_name?.[0]}{request.user?.last_name?.[0]}
                      </div>
                      <div>
                        <div className="admin-user-name">
                          {request.user?.first_name} {request.user?.last_name}
                        </div>
                        <div className="admin-user-email">{request.user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{request.user_email?.sender_email || "N/A"}</td>
                  <td>{request.user_email?.sender_name || "N/A"}</td>
                  <td>{new Date(request.requested_at).toLocaleString()}</td>
                  <td>{getStatusBadge(request.status)}</td>
                  <td>
                    <div className="admin-actions">
                      {canReview(request.status) && (
                        <>
                          <button
                            className="admin-btn admin-btn-approve"
                            onClick={() => handleApprove(request.id)}
                            disabled={reviewing === request.id}
                          >
                            <CheckCircle size={16} />
                            Approve
                          </button>
                          <button
                            className="admin-btn admin-btn-reject"
                            onClick={() => handleReject(request.id)}
                            disabled={reviewing === request.id}
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </>
                      )}
                      {request.status === "rejected" && (
                        <button
                          className="admin-btn admin-btn-view"
                          onClick={() => setAdminNote(request.admin_notes)}
                        >
                          <Eye size={16} />
                          View Note
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reviewing && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Add Admin Note</h3>
              <p className="admin-modal-subtitle">Optional note for this approval action</p>
            </div>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Enter your notes here..."
              rows={4}
              className="admin-modal-textarea"
            />
            <div className="admin-modal-actions">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setReviewing(null)}
              >
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => {
                  // The actual approve/reject will be called with the note
                  setReviewing(null);
                }}
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
