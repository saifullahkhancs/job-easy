import { useState, useEffect } from "react";
import { Star, Trash2, RefreshCw, FileText, User, Undo2, ShieldAlert, Link2 } from "lucide-react";
import {
  listAdminDefaultTemplates,
  listAllCustomerTemplates,
  promoteTemplateToDefault,
  revertDefaultTemplate,
  assignDefaultTemplateToCustomer,
  deleteAdminTemplate,
} from "../api/adminClient";

const MAX_DEFAULTS = 2;

export default function AdminDefaultTemplatesPage() {
  const [defaultTemplates, setDefaultTemplates] = useState([]);
  const [customerTemplates, setCustomerTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
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
      setError(`Maximum of ${MAX_DEFAULTS} default templates allowed. Return one to its owner first.`);
      return;
    }
    setError("");
    setMessage("");
    setBusyId(templateId);
    try {
      await promoteTemplateToDefault(templateId);
      setMessage("Template promoted to default successfully.");
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Primary (non-destructive) action on a default template: hand it back to the
   * customer who created it. The CV and email body stay exactly as they were.
   */
  const handleRevert = async (template) => {
    const ownerName = template.owner
      ? `${template.owner.first_name} ${template.owner.last_name}`
      : "its owner";
    if (
      !window.confirm(
        `Return "${template.title}" to ${ownerName}?\n\n` +
          "It will stop being shown as a platform default and will reappear in their personal templates. Nothing is deleted."
      )
    ) {
      return;
    }
    setError("");
    setMessage("");
    setBusyId(template.id);
    try {
      const result = await revertDefaultTemplate(template.id);
      setMessage(result.message || "Template returned to its owner.");
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignOwner = async (template) => {
    const customerEmail = window.prompt(
      `Link "${template.title}" to a customer email.\n\n` +
        "Only existing customer accounts are accepted.",
      template.user_email || ""
    );

    if (customerEmail === null) {
      return;
    }

    const trimmedEmail = customerEmail.trim();
    if (!trimmedEmail) {
      setError("Enter a customer email to link this default template.");
      return;
    }

    setError("");
    setMessage("");
    setBusyId(template.id);
    try {
      const result = await assignDefaultTemplateToCustomer(template.id, trimmedEmail);
      setMessage(result.message || "Template linked to customer.");
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  /** Destructive action, kept secondary and clearly labelled. */
  const handleDelete = async (template) => {
    if (
      !window.confirm(
        `Permanently delete "${template.title}"?\n\n` +
          "This removes the template and its CV from the system. This cannot be undone."
      )
    ) {
      return;
    }
    setError("");
    setMessage("");
    setBusyId(template.id);
    try {
      await deleteAdminTemplate(template.id);
      setMessage("Default template deleted.");
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
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
          Promote customer templates so visitors and new users see them as defaults. Max{" "}
          {MAX_DEFAULTS} default templates.
        </p>
      </div>

      <div className="admin-toolbar">
        <button className="admin-refresh-btn" onClick={fetchData}>
          <RefreshCw size={18} />
          Refresh
        </button>
        <span
          style={{
            fontSize: "0.875rem",
            color: atLimit ? "#dc2626" : "#64748b",
            fontWeight: 500,
          }}
        >
          Default Templates: {defaultCount} / {MAX_DEFAULTS}
        </span>
      </div>

      {error && <div className="admin-error-message">{error}</div>}
      {message && <div className="admin-success-message">{message}</div>}

      <div className="admin-info-note">
        <ShieldAlert size={18} />
        <p>
          Removing a template from the defaults does <strong>not</strong> delete the customer's
          work. Use <strong>Change to Customer</strong> to hand it back. If an older default has no
          owner, use <strong>Link to Customer</strong> first — deleting remains a separate destructive action.
        </p>
      </div>

      {/* Current Default Templates */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 className="admin-section-title">
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
            {defaultTemplates.map((t) => {
              const hasOwner = Boolean(t.owner);
              const isBusy = busyId === t.id;
              return (
                <div key={t.id} className="admin-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                  <div className="admin-card-header">
                    <Star size={20} color="#f59e0b" fill="#f59e0b" />
                    <span
                      className="admin-card-badge"
                      style={{ background: "#fef9c3", color: "#92400e" }}
                    >
                      Default
                    </span>
                  </div>
                  <h3 className="admin-card-title">{t.title}</h3>
                  <p className="admin-card-description" style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    Role: <strong>{t.template_role}</strong>
                  </p>
                  <p className="admin-card-description">{t.context?.slice(0, 100)}...</p>

                  <div className="admin-owner-chip">
                    <User size={13} />
                    {hasOwner ? (
                      <span>
                        Owned by <strong>{t.owner.first_name} {t.owner.last_name}</strong>
                        <br />
                        <span style={{ color: "#94a3b8" }}>{t.owner.email}</span>
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>
                        No customer linked{t.user_email ? ` (${t.user_email})` : ""}
                      </span>
                    )}
                  </div>

                  <div className="admin-card-actions">
                    {hasOwner ? (
                      <button
                        className="admin-btn admin-btn-primary"
                        onClick={() => handleRevert(t)}
                        disabled={isBusy}
                        title="Return this template to the customer who created it"
                      >
                        <Undo2 size={16} />
                        {isBusy ? "Working..." : "Change to Customer"}
                      </button>
                    ) : (
                      <>
                        <button
                          className="admin-btn admin-btn-primary"
                          onClick={() => handleAssignOwner(t)}
                          disabled={isBusy}
                          title="Link this default template to an existing customer"
                        >
                          <Link2 size={16} />
                          {isBusy ? "Working..." : "Link to Customer"}
                        </button>
                        <button
                          className="admin-btn admin-btn-delete"
                          onClick={() => handleDelete(t)}
                          disabled={isBusy}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* All Customer Templates */}
      <section>
        <h2 className="admin-section-title">
          <User size={18} color="#3b82f6" />
          All Customer Templates ({customerTemplates.length})
        </h2>

        {customerTemplates.length === 0 ? (
          <div className="admin-empty-state" style={{ padding: "2rem" }}>
            <FileText size={36} className="empty-icon" />
            <p>No customer templates found.</p>
          </div>
        ) : (
          <div className="admin-template-rows">
            {customerTemplates.map((t) => {
              const isBusy = busyId === t.id;
              return (
                <div key={t.id} className="admin-template-row">
                  {/* Template info */}
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px" }}>
                      Role: <strong>{t.template_role}</strong> · CV: {t.filename}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "2px" }}>
                      {t.context?.slice(0, 80)}...
                    </div>
                  </div>

                  {/* Owner info */}
                  <div className="admin-owner-chip" style={{ flex: "0 0 200px" }}>
                    <User size={13} />
                    <span>
                      <strong>
                        {t.owner.first_name} {t.owner.last_name}
                      </strong>
                      <br />
                      <span style={{ color: "#94a3b8" }}>{t.owner.email}</span>
                    </span>
                  </div>

                  <div className="admin-row-actions">
                    <button
                      className={atLimit ? "admin-btn admin-btn-secondary" : "admin-btn admin-btn-primary"}
                      disabled={atLimit || isBusy}
                      onClick={() => handlePromote(t.id)}
                      title={atLimit ? `Max ${MAX_DEFAULTS} defaults reached` : "Set as default template"}
                      style={{ opacity: atLimit || isBusy ? 0.5 : 1 }}
                    >
                      <Star size={15} />
                      {atLimit ? "Limit reached" : "Set as Default"}
                    </button>
                    <button
                      className="admin-btn admin-btn-delete"
                      onClick={() => handleDelete(t)}
                      disabled={isBusy}
                      title="Permanently delete this template"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
