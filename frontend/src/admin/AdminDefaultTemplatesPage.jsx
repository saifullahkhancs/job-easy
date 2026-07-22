import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Eye, RefreshCw, FileText } from "lucide-react";
import { listAdminDefaultTemplates, createAdminDefaultTemplate, deleteAdminTemplate } from "../api/adminClient";

export default function AdminDefaultTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    template_role: "",
    title: "",
    context: "",
    cv_pdf: null,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const templatesData = await listAdminDefaultTemplates();
      setTemplates(templatesData);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!createForm.cv_pdf) {
      setError("CV file is required");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("template_role", createForm.template_role);
      formData.append("title", createForm.title);
      formData.append("context", createForm.context);
      formData.append("cv_pdf", createForm.cv_pdf);

      await createAdminDefaultTemplate(formData);
      setMessage("Default template created successfully");
      setShowCreateModal(false);
      setCreateForm({ template_role: "", title: "", context: "", cv_pdf: null });
      await fetchData();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this default template?")) {
      return;
    }

    try {
      await deleteAdminTemplate(templateId);
      setMessage("Template deleted successfully");
      await fetchData();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleView = (templateId) => {
    navigate(`/admin/templates/${templateId}`);
  };

  const handleEdit = (templateId) => {
    navigate(`/admin/templates/${templateId}/edit`);
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading-state">Loading default templates...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Default Templates</h1>
        <p className="admin-page-subtitle">Manage system default templates for visitor browsing</p>
      </div>

      <div className="admin-toolbar">
        <button 
          className="admin-btn admin-btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={18} />
          Create Default Template
        </button>
        <button 
          className="admin-refresh-btn"
          onClick={fetchData}
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {error && <div className="admin-error-message">{error}</div>}
      {message && <div className="admin-success-message">{message}</div>}

      <div className="admin-grid-container">
        {templates.length === 0 ? (
          <div className="admin-empty-state">
            <FileText size={48} className="empty-icon" />
            <h3>No Default Templates</h3>
            <p>Create default templates that visitors can browse before approval.</p>
          </div>
        ) : (
          <div className="admin-cards-grid">
            {templates.map((template) => (
              <div key={template.id} className="admin-card">
                <div className="admin-card-header">
                  <div className="admin-card-icon">
                    <FileText size={24} />
                  </div>
                  <span className="admin-card-badge">Default</span>
                </div>
                <h3 className="admin-card-title">{template.title}</h3>
                <p className="admin-card-description">{template.context}</p>
                <div className="admin-card-meta">
                  <span>CV: {template.filename || "Uploaded"}</span>
                  <span>Role: {template.template_role || "N/A"}</span>
                </div>
                <div className="admin-card-actions">
                  <button
                    className="admin-btn admin-btn-view"
                    onClick={() => handleView(template.id)}
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button
                    className="admin-btn admin-btn-edit"
                    onClick={() => handleEdit(template.id)}
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button
                    className="admin-btn admin-btn-delete"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal admin-modal-large">
            <div className="admin-modal-header">
              <h3>Create Default Template</h3>
              <p className="admin-modal-subtitle">Create a system default template for visitors</p>
            </div>
            <form onSubmit={handleCreate} className="admin-modal-form">
              <div className="admin-form-group">
                <label>Template Role</label>
                <input
                  type="text"
                  value={createForm.template_role}
                  onChange={(e) => setCreateForm({ ...createForm, template_role: e.target.value })}
                  placeholder="e.g., software_engineer"
                  className="admin-input"
                  required
                />
                <p className="input-hint">Unique identifier for this template role</p>
              </div>
              <div className="admin-form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Template title"
                  className="admin-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>Email Body</label>
                <textarea
                  value={createForm.context}
                  onChange={(e) => setCreateForm({ ...createForm, context: e.target.value })}
                  placeholder="Email body content..."
                  rows={6}
                  className="admin-textarea"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>CV File (PDF)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setCreateForm({ ...createForm, cv_pdf: e.target.files?.[0] || null })}
                  className="admin-file-input"
                  required
                />
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                >
                  Create Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
