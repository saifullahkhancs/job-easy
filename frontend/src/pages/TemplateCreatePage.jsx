import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTemplateV2, getCurrentUser } from "../api/client";
import { UploadCloud, Wand2, ArrowLeft } from "lucide-react";

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
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      setError(err.message);
    }
  };

  async function handleSubmit(event) {
    event.preventDefault();
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
    <div className="page-container">
      <div className="page-header">
        <button 
          className="back-btn"
          onClick={() => navigate("/app/templates")}
        >
          <ArrowLeft size={20} />
          Back to Templates
        </button>
        <div>
          <h2>Create New Template</h2>
          <p className="muted">Create a reusable job application email with subject, body, and CV attached.</p>
        </div>
        <button type="button" className="header-action">
          <Wand2 size={16} />
          Template draft
        </button>
      </div>

      <div className="template-limit-info">
        <p>Templates used: {currentUser?.current_template_count || 0} / {currentUser?.template_limit || 2}</p>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <label>
          Template Role
          <input
            type="text"
            value={templateRole}
            onChange={(e) => setTemplateRole(e.target.value)}
            placeholder="e.g., software_engineer"
            required
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
          />
        </label>

        <label>
          Email Body
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Dear Hiring Manager,&#10;&#10;I hope you are doing well.&#10;&#10;I am writing to apply for..."
            rows={8}
            required
          />
        </label>

        <label>
          CV (PDF)
          <div className="file-upload-area">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setCvFile(e.target.files?.[0] || null)}
              required
              id="cv-upload"
              style={{ display: 'none' }}
            />
            <label htmlFor="cv-upload" className="file-upload-label">
              <UploadCloud size={24} color="#3b82f6" />
              <span className="file-upload-text">Choose file or drag your resume</span>
              <span className="file-upload-hint">PDF only, up to 5 MB</span>
              {cvFile && <span className="file-upload-name">{cvFile.name}</span>}
            </label>
          </div>
        </label>

        <button type="submit" className="primary-btn" disabled={loading || !cvFile}>
          <UploadCloud size={18} />
          {loading ? "Creating Template..." : "Create Template"}
        </button>
      </form>
    </div>
  );
}
