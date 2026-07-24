import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTemplateV2, getCurrentUser } from "../api/client";
import { UploadCloud, Wand2, ArrowLeft, Lock } from "lucide-react";

export default function TemplateCreatePage() {
  const [templateRole, setTemplateRole] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [cvFile, setCvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setCurrentUser(null);
      return;
    }
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      setCurrentUser(null);
    }
  };

  const isGuest = !currentUser;
  const isVisitor = currentUser?.role === "visitor";
  const isDisabled = isGuest || isVisitor;

  async function handleSubmit(event) {
    event.preventDefault();
    if (isDisabled) return;
    setLoading(true);
    setMessage("");
    setError("");

    // Check template limit
    if (currentUser && currentUser.current_template_count >= currentUser.template_limit) {
      setError(`You've reached your maximum of ${currentUser.template_limit} templates. Delete an existing template to create a new one.`);
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("template_role", templateRole);
    formData.append("title", title);
    formData.append("context", context);
    if (cvFile) formData.append("cv_pdf", cvFile);

    try {
      const result = await createTemplateV2(formData);
      setMessage("Template created successfully!");
      setTimeout(() => navigate("/app/templates"), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container page-container-full-width" style={{ width: "100%", margin: 0 }}>
      {(isGuest || isVisitor) && (
        <div className="visitor-banner">
          <Lock size={24} className="banner-icon" />
          <div className="banner-content">
            <h3>{isGuest ? "Preview Mode" : "Visitor Mode"}</h3>
            <p>{isGuest ? "You need to log in to create and manage templates." : "Your account is in Visitor mode. You need approval from an admin to create templates."}</p>
          </div>
        </div>
      )}

      <section className="card" style={{ minHeight: 'auto', height: 'auto' }}>
      <div className="page-header">
        <div>
          <h2>Create New Template</h2>
          <p className="muted">Create a reusable job application email with subject, body, and CV attached.</p>
        </div>
        <button type="button" className="header-action" disabled={isDisabled}>
          <Wand2 size={16} />
          Template draft
        </button>
      </div>

      <div className="template-limit-info">
        <p>Templates used: {currentUser?.current_template_count || 0} / {currentUser?.template_limit || 2}</p>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
      {message && <div className="success-message" style={{ marginBottom: '16px' }}>{message}</div>}

      <div className="form-page-layout">
        <div className="form-main-panel">
          <form className="form" onSubmit={handleSubmit} id="create-template-form">

        <label>
          Template Role
          <input
            type="text"
            value={templateRole}
            onChange={(e) => setTemplateRole(e.target.value)}
            placeholder="e.g., software_engineer"
            required
            disabled={isDisabled}
          />
          <p className="input-hint">Unique identifier for this template role</p>
        </label>

        <label>
          Email Subject
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Application for Python Developer"
            required
            disabled={isDisabled}
          />
        </label>

        <label>
          CV (PDF)
          <div className={`file-upload-area ${isDisabled ? 'disabled' : ''}`} style={isDisabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}}>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setCvFile(e.target.files?.[0] || null)}
              required
              id="cv-upload"
              style={{ display: 'none' }}
              disabled={isDisabled}
            />
            <label htmlFor={isDisabled ? "" : "cv-upload"} className="file-upload-label" style={isDisabled ? { cursor: 'not-allowed' } : {}}>
              <UploadCloud size={24} color="#3b82f6" />
              <span className="file-upload-text">Choose file or drag your resume</span>
              <span className="file-upload-hint">PDF only, up to 5 MB</span>
              {cvFile && <span className="file-upload-name">{cvFile.name}</span>}
            </label>
          </div>
        </label>

        <button type="submit" className="primary-btn" disabled={loading || isDisabled || !cvFile} style={{ marginTop: '16px' }}>
          <UploadCloud size={18} />
          {loading ? "Creating Template..." : "Create Template"}
        </button>
          </form>
        </div>

        <div className="form-side-panel">
          <div className="dark-preview-card" style={{ height: 'auto' }}>
            <div className="dark-preview-header">
              <span>Email Body</span>
            </div>
            <textarea
              className="dark-preview-content"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Dear Hiring Manager,&#10;&#10;I hope you are doing well.&#10;&#10;I am writing to apply for..."
              required
              disabled={isDisabled}
              form="create-template-form"
            />
          </div>
        </div>
      </div>
      </section>
    </div>
  );
}
