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
    <div className="page-container">
      <section className="card" style={{ minHeight: 'auto', height: 'auto' }}>
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

        {message && <div className="success-message" style={{ marginBottom: '24px' }}>{message}</div>}
        {error && <div className="error-message" style={{ marginBottom: '24px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-page-layout">
            <div className="form-main-panel">
              <div className="form">
                <label>
                  Job Type
                  <select value={type} onChange={(e) => setType(e.target.value)} required>
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
                      style={{ display: 'none' }}
                      id="cv-upload"
                    />
                    <label htmlFor="cv-upload" className="file-upload-label">
                      <UploadCloud size={24} className="file-upload-icon" />
                      <span className="file-upload-text">Choose file or drag your resume</span>
                      <span className="file-upload-hint">PDF only, up to 5 MB</span>
                      {cvFile && <span className="file-upload-name">{cvFile.name}</span>}
                    </label>
                  </div>
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" disabled={loading || !cvFile}>
                  <UploadCloud size={18} />
                  {loading ? "Uploading..." : "Upload Template"}
                </button>
              </div>
            </div>

            <div className="form-side-panel">
              <div className="dark-preview-card" style={{ height: 'auto' }}>
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
                  required
                />
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
