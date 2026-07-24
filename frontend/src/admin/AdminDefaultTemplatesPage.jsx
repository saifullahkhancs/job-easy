import { useState, useEffect } from "react";
import { Star, Trash2, RefreshCw, FileText, User, CheckCircle } from "lucide-react";
import {
  listAdminDefaultTemplates,
  listAllCustomerTemplates,
  promoteTemplateToDefault,
  deleteAdminTemplate,
} from "../api/adminClient";

const MAX_DEFAULTS = 2;

export default function AdminDefaultTemplatesPage() {
  const [defaultTemplates, setDefaultTemplates] = useState([]);
  const [customerTemplates, setCustomerTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [defaults, customers] = await Promise.all([
        listAdminDefaultTemplates(),
        listAllCustomerTemplates(),
      ]);
      setDefaultTemplates(defaults);
      setCustomerTemplates(customers);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (templateId) => {
    if (defaultTemplates.length >= MAX_DEFAULTS) {
      setError(`Maximum of ${MAX_DEFAULTS} default templates allowed. Remove one first.`);
      return;
    }
    setError("");
    setMessage("");
    try {
      await promoteTemplateToDefault(templateId);
      setMessage("Template promoted to default successfully.");
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveDefault = async (templateId) => {
    if (!window.confirm("Remove this default template? It will be deleted from the system.")) return;
    setError("");
    setMessage("");
    try {
      await deleteAdminTemplate(templateId);
      setMessage("Default template removed.");
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">Loading templates...</div>
      </div>
    );
  }

  const defaultCount = defaultTemplates.length;
  const atLimit = defaultCount >= MAX_DEFAULTS;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Default Templates</h1>
        <p className="admin-page-subtitle">
          Promote customer templates to be shown as defaults to visitors and new users. Max {MAX_DEFAULTS} default templates.
        </p>
      </div>

      <div className="admin-toolbar">
        <button className="admin-refresh-btn" onClick={fetchData}>
          <RefreshCw size={18} />
          Refresh
        </button>
        <span style={{ fontSize: "0.875rem", color: atLimit ? "#dc2626" : "#64748b", fontWeight: 500 }}>
          Default Templates: {defaultCount} / {MAX_DEFAULTS}
        </span>
      </div>

      {error && <div className="admin-error-message">{error}</div>}
      {message && <div className="admin-success-message">{message}</div>}

      {/* Current Default Templates */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Star size={18} color="#f59e0b" fill="#f59e0b" />
          Current Default Templates ({defaultCount}/{MAX_DEFAULTS})
        </h2>

        {defaultTemplates.length === 0 ? (
          <div className="admin-empty-state" style={{ padding: "2rem" }}>
            <FileText size={36} className="empty-icon" />
            <p>No default templates yet. Promote a customer template below.</p>
          </div>
        ) : (
          <div className="admin-cards-grid">
            {defaultTemplates.map((t) => (
              <div key={t.id} className="admin-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                <div className="admin-card-header">
                  <Star size={20} color="#f59e0b" fill="#f59e0b" />
                  <span className="admin-card-badge" style={{ background: "#fef9c3", color: "#92400e" }}>Default</span>
                </div>
                <h3 className="admin-card-title">{t.title}</h3>
                <p className="admin-card-description" style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  Role: <strong>{t.template_role}</strong>
                </p>
                <p className="admin-card-description">{t.context?.slice(0, 100)}...</p>
                <div className="admin-card-actions">
                  <button
                    className="admin-btn admin-btn-delete"
                    onClick={() => handleRemoveDefault(t.id)}
                  >
                    <Trash2 size={16} />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All Customer Templates */}
      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <User size={18} color="#3b82f6" />
          All Customer Templates ({customerTemplates.length})
        </h2>

        {customerTemplates.length === 0 ? (
          <div className="admin-empty-state" style={{ padding: "2rem" }}>
            <FileText size={36} className="empty-icon" />
            <p>No customer templates found.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {customerTemplates.map((t) => (
              <div
                key={t.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                {/* Template info */}
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>{t.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                    Role: <strong>{t.template_role}</strong> · CV: {t.filename}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "2px" }}>
                    {t.context?.slice(0, 80)}...
                  </div>
                </div>

                {/* Owner info */}
                <div style={{
                  flex: "0 0 200px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.8rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#475569", fontWeight: 500 }}>
                    <User size={13} />
                    {t.owner.first_name} {t.owner.last_name}
                  </div>
                  <div style={{ color: "#94a3b8", marginTop: "2px" }}>{t.owner.email}</div>
                </div>

                {/* Promote button */}
                <button
                  className={atLimit ? "admin-btn admin-btn-secondary" : "admin-btn admin-btn-primary"}
                  disabled={atLimit}
                  onClick={() => handlePromote(t.id)}
                  title={atLimit ? `Max ${MAX_DEFAULTS} defaults reached` : "Set as default template"}
                  style={{ flex: "0 0 auto", opacity: atLimit ? 0.5 : 1 }}
                >
                  <Star size={15} />
                  {atLimit ? "Limit reached" : "Set as Default"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
