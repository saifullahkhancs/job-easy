import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchTemplatesV2,
  fetchTemplateV2,
  updateTemplateV2,
  updateTemplateCvV2,
  getCurrentUser,
} from "../api/client";
import { Save, UploadCloud, ShieldCheck, Lock, Edit } from "lucide-react";

export default function TemplateUpdatePage() {
  const { id } = useParams(); // optional — pre-select from dashboard edit button
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(id || "");
  const [template, setTemplate] = useState(null);
  const [templateRole, setTemplateRole] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [cvFile, setCvFile] = useState(null);
  const [updateTitle, setUpdateTitle] = useState(false);
  const [updateContext, setUpdateContext] = useState(false);
  const [updateCv, setUpdateCv] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load user + all templates on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      getCurrentUser()
        .then((u) => setCurrentUser(u))
        .catch(() => setCurrentUser(null));
    }

    fetchTemplatesV2()
      .then((items) => {
        const token = localStorage.getItem("access_token");
        // For guests/unauthenticated: show default templates for preview
        // For logged-in users: show only personal (customer-owned) templates
        const editable = token
          ? items.filter((t) => t.template_scope === "customer")
          : items; // guests see default templates
        setTemplates(editable);
        if (!id && editable.length > 0) {
          setSelectedId(String(editable[0].id));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setListLoading(false));
  }, []);

  // Load detail whenever selected template changes
  useEffect(() => {
    if (!selectedId) { setTemplate(null); return; }

    const token = localStorage.getItem("access_token");
    setDetailLoading(true);
    setMessage("");
    setError("");
    setUpdateTitle(false);
    setUpdateContext(false);
    setUpdateCv(false);
    setCvFile(null);

    if (!token) {
      // Guests: use list data directly (no auth needed)
      const item = templates.find((t) => String(t.id) === String(selectedId));
      setTemplate(item || null);
      setTitle(item?.title || "");
      setContext(item?.context || "");
      setTemplateRole(item?.template_role || "");
      setDetailLoading(false);
      return;
    }

    fetchTemplateV2(selectedId)
      .then((data) => {
        setTemplate(data);
        setTitle(data.title);
        setContext(data.context);
        setTemplateRole(data.template_role);
      })
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selectedId, templates]);

  const isGuest = !currentUser;
  const isVisitor = currentUser?.role === "visitor";
  // Can edit fields but cannot submit
  const cannotSubmit = isGuest || isVisitor || templates.length === 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (cannotSubmit || !selectedId) return;
    setMessage("");
    setError("");

    if (!updateTitle && !updateContext && !updateCv) {
      setError("Select at least one field to update.");
      return;
    }
    if (updateCv && !cvFile) {
      setError("Choose a PDF file to update the CV.");
      return;
    }

    setSubmitting(true);
    try {
      if (updateTitle || updateContext) {
        const body = {};
        if (updateTitle) body.title = title;
        if (updateContext) body.context = context;
        await updateTemplateV2(selectedId, body);
      }
      if (updateCv && cvFile) {
        await updateTemplateCvV2(selectedId, cvFile);
      }
      setMessage("Template updated successfully!");
      setUpdateTitle(false);
      setUpdateContext(false);
      setUpdateCv(false);
      setCvFile(null);
      // Refresh detail
      const refreshed = await fetchTemplateV2(selectedId);
      setTemplate(refreshed);
      setTitle(refreshed.title);
      setContext(refreshed.context);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (listLoading) return <p className="muted">Loading templates...</p>;

  return (
    <div style={{ padding: "32px", alignSelf: "start" }}>
      {(isGuest || isVisitor) && (
        <div className="visitor-banner">
          <Lock size={24} className="banner-icon" />
          <div className="banner-content">
            <h3>{isGuest ? "Preview Mode" : "Visitor Mode"}</h3>
            <p>
              {isGuest
                ? "You need to log in to save changes to templates."
                : "Your account needs admin approval before you can save template changes."}
            </p>
          </div>
        </div>
      )}

      <section className="card" style={{ minHeight: "auto", height: "auto" }}>
        <div className="page-header">
          <div>
            <h2>Update Template</h2>
            <p className="muted">Select a template and update only the fields you need.</p>
          </div>
          <button
            type="button"
            className="header-action"
            style={{
              background: "#fef9c3",
              color: "#854d0e",
              border: "1px solid #fef08a",
            }}
          >
            <ShieldCheck size={16} />
            Safe patch mode
          </button>
        </div>

        {/* Template selector dropdown */}
        {templates.length === 0 ? (
          <div style={{ padding: "1.5rem", background: "#f8fafc", borderRadius: "10px", textAlign: "center", color: "#64748b" }}>
            {isGuest || isVisitor
              ? "No templates available to preview."
              : "No personal templates found. Create one first to update it."}
          </div>
        ) : (
          <label>
            Select Template
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.template_role || t.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {detailLoading && <p className="muted">Loading template details...</p>}

        {template && !detailLoading && (
          <>
            {error && <div className="error-message" style={{ marginBottom: "16px" }}>{error}</div>}
            {message && <div className="success-message" style={{ marginBottom: "16px" }}>{message}</div>}

            <div className="form-page-layout">
              <div className="form-main-panel">
                <form className="form" onSubmit={handleSubmit}>

                  <label>
                    Template Role
                    <input type="text" value={templateRole} disabled />
                    <p className="input-hint">Template role cannot be changed after creation</p>
                  </label>

                  {/* Field selector checkboxes — always interactive */}
                  <div className="patch-options-group">
                    <label className={`patch-option-card ${updateTitle ? "active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={updateTitle}
                        onChange={(e) => setUpdateTitle(e.target.checked)}
                      />
                      Subject
                    </label>
                    <label className={`patch-option-card ${updateContext ? "active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={updateContext}
                        onChange={(e) => setUpdateContext(e.target.checked)}
                      />
                      Email Body
                    </label>
                    <label className={`patch-option-card ${updateCv ? "active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={updateCv}
                        onChange={(e) => setUpdateCv(e.target.checked)}
                      />
                      CV File
                    </label>
                  </div>

                  <label>
                    Email Subject
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={!updateTitle}
                    />
                  </label>

                  <label>
                    Email Body
                    <textarea
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      rows={8}
                      disabled={!updateContext}
                    />
                  </label>

                  <label>
                    New CV File
                    <div className="file-upload-area">
                      <input
                        type="file"
                        accept="application/pdf"
                        disabled={!updateCv}
                        onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                        id="cv-upload-edit"
                        style={{ display: "none" }}
                      />
                      <label
                        htmlFor={!updateCv ? "" : "cv-upload-edit"}
                        className="file-upload-label"
                        style={{
                          opacity: updateCv ? 1 : 0.5,
                          cursor: updateCv ? "pointer" : "not-allowed",
                        }}
                      >
                        <UploadCloud size={24} color={updateCv ? "#3b82f6" : "#94a3b8"} />
                        <span className="file-upload-text">
                          {updateCv ? "Choose new CV file" : "Enable CV update to select file"}
                        </span>
                        <span className="file-upload-hint">PDF only, up to 5 MB</span>
                        {cvFile && <span className="file-upload-name">{cvFile.name}</span>}
                      </label>
                    </div>
                    {template.filename && !updateCv && (
                      <p className="input-hint">Current file: {template.filename}</p>
                    )}
                  </label>

                  {/* Submit button — disabled for guests/visitors/no personal templates */}
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={submitting || cannotSubmit}
                    title={
                      isGuest
                        ? "Log in to save changes"
                        : isVisitor
                        ? "Admin approval required to save changes"
                        : templates.length === 0
                        ? "Create a personal template first"
                        : undefined
                    }
                  >
                    <Save size={18} />
                    {submitting
                      ? "Saving..."
                      : cannotSubmit
                      ? isGuest
                        ? "Login to Save"
                        : isVisitor
                        ? "Approval Required"
                        : "No Templates to Update"
                      : "Save Changes"}
                  </button>
                </form>
              </div>

              <div className="form-side-panel">
                <div className="dark-preview-card patch-summary">
                  <h3>Patch Summary</h3>
                  <div className="patch-items">
                    {updateTitle && <div className="patch-item"><span className="patch-icon">✓</span> Subject will be updated</div>}
                    {updateContext && <div className="patch-item"><span className="patch-icon">✓</span> Email body will be updated</div>}
                    {updateCv && <div className="patch-item"><span className="patch-icon">✓</span> CV file will be updated</div>}
                    {!updateTitle && !updateContext && !updateCv && (
                      <div className="patch-item disabled">No fields selected for update</div>
                    )}
                  </div>
                  <p className="patch-note">
                    Disabled fields stay untouched, so you can safely make targeted edits without
                    accidentally replacing stored data.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
