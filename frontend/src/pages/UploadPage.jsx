import { useEffect, useState } from "react";
import { createTemplate, fetchJobTypes } from "../api/client";
import { UploadCloud, Wand2 } from "lucide-react";

export default function UploadPage() {
  const [jobTypes, setJobTypes] = useState([]);
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [cvFile, setCvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJobTypes()
      .then((types) => {
        setJobTypes(types);
        if (types.length > 0) setType(types[0]);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const formData = new FormData();
    formData.append("type", type);
    formData.append("title", title);
    formData.append("context", context);
    if (cvFile) formData.append("cv_pdf", cvFile);

    try {
      const result = await createTemplate(formData);
      setMessage(result.message);
      setTitle("");
      setContext("");
      setCvFile(null);
      event.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h2>Upload New Template</h2>
          <p className="muted">Create a reusable job application email with subject, body, and CV attached in one place.</p>
        </div>
        <button type="button" className="header-action">
          <Wand2 size={16} />
          Template draft
        </button>
      </div>

      <form id="upload-form" className="form" onSubmit={handleSubmit} style={{ display: 'none' }}></form>

      <div className="split-layout">
        <div className="form">
          <label>
            Job Type
            <select value={type} onChange={(e) => setType(e.target.value)} form="upload-form" required>
              {jobTypes.map((jobType) => (
                <option key={jobType} value={jobType}>
                  {jobType}
                </option>
              ))}
            </select>
          </label>

          <label>
            Email Subject
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Application for Python Developer"
              form="upload-form"
              required
            />
          </label>

          <label>
            CV (PDF)
            <div style={{ border: '1px dashed #cbd5e1', padding: '24px', borderRadius: '12px', textAlign: 'center', background: '#f8fafc', marginTop: '4px' }}>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                form="upload-form"
                required
                style={{ display: 'none' }}
                id="cv-upload"
              />
              <label htmlFor="cv-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                <UploadCloud size={24} color="#3b82f6" />
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Choose file or drag your resume</span>
                <span style={{ fontSize: '0.85rem' }}>PDF or DOCX, up to 5 MB</span>
                {cvFile && <span style={{ color: '#10b981', marginTop: '8px' }}>{cvFile.name}</span>}
              </label>
            </div>
          </label>

          <div className="update_submit_button">
            <button type="submit" form="upload-form" disabled={loading || !cvFile}>
              <UploadCloud size={18} />
              {loading ? "Uploading..." : "Upload Template"}
            </button>
          </div>

        </div>

        <div>
          <div className="dark-preview-card" style={{ height: '100%' }}>
            <div className="dark-preview-header">
              <span>Email Body</span>
              <div className="dark-preview-dots">
                <span className="dot-green"></span>
                <span className="dot-yellow"></span>
                <span className="dot-red"></span>
              </div>
            </div>

            <textarea
              className="dark-preview-content"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Dear Hiring Manager,&#10;&#10;I hope you are doing well.&#10;&#10;I am writing to apply for..."
              form="upload-form"
              required
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                padding: 0,
                minHeight: '200px',
                resize: 'none',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
