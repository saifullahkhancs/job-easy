import { useState, useEffect } from "react";
import { Search, Filter, RefreshCw, Shield, Clock, CheckCircle, Edit, Eye } from "lucide-react";
import { listAdminUsers, updateAdminUser } from "../api/adminClient";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ role: "", is_verified: false });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, verifiedFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await listAdminUsers(
        roleFilter === "all" ? undefined : roleFilter,
        verifiedFilter === "all" ? undefined : verifiedFilter === "verified"
      );
      setUsers(data);
      setFilteredUsers(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(user => 
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const handleEdit = (user) => {
    setEditingUser(user);
    setEditForm({ role: user.role, is_verified: user.is_verified });
  };

  const handleSave = async () => {
    try {
      await updateAdminUser(editingUser.user_id, editForm);
      setMessage("User updated successfully");
      setEditingUser(null);
      await fetchUsers();
    } catch (error) {
      setError(error.message);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "admin":
        return (
          <span className="admin-role-badge admin-role-admin">
            <Shield size={14} />
            Admin
          </span>
        );
      case "customer":
        return (
          <span className="admin-role-badge admin-role-customer">
            <CheckCircle size={14} />
            Customer
          </span>
        );
      case "visitor":
        return (
          <span className="admin-role-badge admin-role-visitor">
            <Clock size={14} />
            Visitor
          </span>
        );
      default:
        return <span className="admin-role-badge">{role}</span>;
    }
  };

  const getVerificationBadge = (isVerified) => {
    return isVerified ? (
      <span className="admin-verification-badge admin-verified">
        <CheckCircle size={14} />
        Verified
      </span>
    ) : (
      <span className="admin-verification-badge admin-unverified">
        <Clock size={14} />
        Unverified
      </span>
    );
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>User Management</h1>
        <p className="admin-page-subtitle">View and manage user roles and verification status</p>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search-group">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-search-input"
          />
        </div>
        <div className="admin-filter-group">
          <Filter size={18} className="filter-icon" />
          <select 
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value)}
            className="admin-filter-select"
          >
            <option value="all">All Roles</option>
            <option value="visitor">Visitors</option>
            <option value="customer">Customers</option>
            <option value="admin">Admins</option>
          </select>
          <select 
            value={verifiedFilter} 
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="admin-filter-select"
          >
            <option value="all">All Status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
        <button 
          className="admin-refresh-btn"
          onClick={fetchUsers}
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {error && <div className="admin-error-message">{error}</div>}
      {message && <div className="admin-success-message">{message}</div>}

      <div className="admin-table-container">
        {filteredUsers.length === 0 ? (
          <div className="admin-empty-state">
            <Eye size={48} className="empty-icon" />
            <h3>No users found</h3>
            <p>No users match the current search or filter criteria.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>LinkedIn URL</th>
                <th>Role</th>
                <th>Verification</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.user_id}>
                  <td>
                    <div className="admin-user-cell">
                      <div className="admin-user-avatar">
                        {user.first_name[0]}{user.last_name[0]}
                      </div>
                      <div>
                        <div className="admin-user-name">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="admin-user-email">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {user.linkedin_url ? (
                      <a 
                        href={user.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="admin-link"
                      >
                        View Profile
                      </a>
                    ) : "N/A"}
                  </td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td>{getVerificationBadge(user.is_verified)}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="admin-btn admin-btn-edit"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Edit User</h3>
              <p className="admin-modal-subtitle">
                {editingUser.first_name} {editingUser.last_name} ({editingUser.email})
              </p>
            </div>
            <div className="admin-modal-form">
              <div className="admin-form-group">
                <label>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="admin-select"
                >
                  <option value="visitor">Visitor</option>
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label>Verification Status</label>
                <div className="admin-checkbox-group">
                  <label className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={editForm.is_verified}
                      onChange={(e) => setEditForm({ ...editForm, is_verified: e.target.checked })}
                    />
                    Verified
                  </label>
                </div>
              </div>
            </div>
            <div className="admin-modal-actions">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleSave}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
