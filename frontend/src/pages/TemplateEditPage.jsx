import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchTemplateV2, updateTemplateV2, updateTemplateCvV2 } from "../api/client";
import { Save, UploadCloud, ArrowLeft, ShieldCheck } from "lucide-react";

export default function TemplateEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [templateRole, setTemplateRole] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [cvFile, setCvFile] = useState(null);
  const [updateTitle, setUpdateTitle] = useState(false);
  const [updateContext, setUpdateContext] = useState(false);
  const [updateCv, setUpdateCv] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const templateData = await fetchTemplateV2(id);
      setTemplate(templateData);
      setTitle(templateData.title);
      setContext(templateData.context);
      setTemplateRole(templateData.template_role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!updateTitle && !updateContext && !updateCv) {
      setError("Select at least one field to update.");
      return;
    }

    setSubmitting(true);
    try {
      // Update metadata
      if (updateTitle || updateContext) {
        const updateData = {};
        if (updateTitle) updateData.title = title;
        if (updateContext) updateData.context = context;
        
        await updateTemplateV2(id, updateData);
      }

      // Update CV
      if (updateCv && cvFile) {
        await updateTemplateCvV2(id, cvFile);
      }

      if (updateCv && !cvFile) {
        setError("Choose a PDF file to update the CV.");
        setSubmitting(false);
        return;
      }

      setMessage("Template updated successfully!");
      setUpdateTitle(false);
      setUpdateContext(false);
      setUpdateCv(false);
      setCvFile(null);
      
      // Refresh template data
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="page-container">
        <div className="error-state">Template not found</div>
      </div>
    );
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
          <h2>Edit Template</h2>
          <p className="muted">Update only the fields you need — subject, email body, or CV.</p>
        </div>
        <button type="button" className="header-action" style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fef08a' }}>
          <ShieldCheck size={16} />
          Safe patch mode
        </button>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <label>
          Template Role
          <input
            type="text"
            value={templateRole}
            disabled
          />
          <p className="input-hint">Template role cannot be changed after creation</p>
        </label>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={updateTitle}
              onChange={(e) => setUpdateTitle(e.target.checked)}
            />
            Update Subject
          </label>
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={updateContext}
              onChange={(e) => setUpdateContext(e.target.checked)}
            />
            Update Email Body
          </label>

          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={updateCv} 
              onChange={(e) => setUpdateCv(e.target.checked)} 
            />
            Update CV File
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
              style={{ display: 'none' }}
            />
            <label htmlFor="cv-upload-edit" className="file-upload-label" style={{ opacity: updateCv ? 1 : 0.5 }}>
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

        <button type="submit" className="primary-btn" disabled={submitting}>
          <Save size={18} />
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <div className="patch-summary">
        <h3>Patch Summary</h3>
        <div className="patch-items">
          {updateTitle && <div className="patch-item"><span className="patch-icon">✓</span> Subject will be updated</div>}
          {updateContext && <div className="patch-item"><span className="patch-icon">✓</span> Email body will be updated</div>}
          {updateCv && <div className="patch-item"><span className="patch-icon">✓</span> CV file will be updated</div>}
          {!updateTitle && !updateContext && !updateCv && <div className="patch-item disabled">No fields selected for update</div>}
        </div>
        <p className="patch-note">Disabled fields stay untouched, so you can safely make targeted edits without accidentally replacing stored data.</p>
      </div>
    </div>
  );
}
