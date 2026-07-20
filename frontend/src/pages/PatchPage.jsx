import { useEffect, useState } from "react";
import { fetchTemplate, fetchTemplates, patchTemplate } from "../api/client";
import { ShieldCheck, Check, Save } from "lucide-react";

export default function PatchPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedType, setSelectedType] = useState("");
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
    fetchTemplates()
      .then((items) => {
        setTemplates(items);
        if (items.length > 0) setSelectedType(items[0].type);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedType) return;

    fetchTemplate(selectedType)
      .then((detail) => {
        setTitle(detail.title);
        setContext(detail.context);
        setCvFile(null);
        setUpdateTitle(false);
        setUpdateContext(false);
        setUpdateCv(false);
      })
      .catch((err) => setError(err.message));
  }, [selectedType]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!updateTitle && !updateContext && !updateCv) {
      setError("Select at least one field to update.");
      return;
    }

    const formData = new FormData();
    if (updateTitle) formData.append("title", title);
    if (updateContext) formData.append("context", context);
    if (updateCv && cvFile) formData.append("cv_pdf", cvFile);

    if (updateCv && !cvFile) {
      setError("Choose a PDF file to update the CV.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await patchTemplate(selectedType, formData);
      setMessage(`${result.message} Updated: ${result.updated_fields.join(", ")}`);
      setUpdateTitle(false);
      setUpdateContext(false);
      setUpdateCv(false);
      setCvFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading templates...</p>;

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h2>Update Template</h2>
          <p className="muted">Patch only the fields you need — subject, email body, or CV.</p>
        </div>
        <button type="button" className="header-action" style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fef08a' }}>
          <ShieldCheck size={16} />
          Safe patch mode
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="muted">No templates yet. Upload one first.</p>
      ) : (
        <div className="split-layout">
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Job Type
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                {templates.map((template) => (
                  <option key={template.type} value={template.type}>
                    {template.type}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <label className="checkbox-row" style={{ flex: 1, borderColor: updateTitle ? '#3b82f6' : '#cbd5e1', background: updateTitle ? '#eff6ff' : '#fdfbfb' }}>
                <input
                  type="checkbox"
                  checked={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.checked)}
                />
                Subject
              </label>
              
              <label className="checkbox-row" style={{ flex: 1, borderColor: updateContext ? '#3b82f6' : '#cbd5e1', background: updateContext ? '#eff6ff' : '#fdfbfb' }}>
                <input
                  type="checkbox"
                  checked={updateContext}
                  onChange={(e) => setUpdateContext(e.target.checked)}
                />
                Email body
              </label>

              <label className="checkbox-row" style={{ flex: 1, borderColor: updateCv ? '#3b82f6' : '#cbd5e1', background: updateCv ? '#eff6ff' : '#fdfbfb' }}>
                <input type="checkbox" checked={updateCv} onChange={(e) => setUpdateCv(e.target.checked)} />
                CV file
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
              <input
                type="file"
                accept="application/pdf"
                disabled={!updateCv}
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
              />
            </label>

            <button type="submit" disabled={submitting} style={{ marginTop: '16px' }}>
              <Save size={18} />
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </form>

          <div className="dark-preview-card" style={{ height: 'auto', alignSelf: 'start' }}>
            <div className="dark-preview-header" style={{ marginBottom: '12px' }}>
              <span style={{ color: '#fff', fontSize: '1.1rem' }}>Patch summary</span>
            </div>
            
            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
              {updateTitle && <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1', marginBottom: '8px' }}><Check size={16} color="#10b981" /> Subject will be updated</div>}
              {updateContext && <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1', marginBottom: '8px' }}><Check size={16} color="#10b981" /> Email body will be updated</div>}
              {updateCv && <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1', marginBottom: '8px' }}><Check size={16} color="#10b981" /> CV file will be updated</div>}
              {!updateTitle && !updateContext && !updateCv && <div style={{ color: '#64748b' }}>No fields selected for update.</div>}
            </div>

            <div className="dark-preview-content" style={{ fontSize: '0.85rem', marginBottom: '24px' }}>
              Disabled fields stay untouched, so you can safely make targeted edits without accidentally replacing the stored subject or CV.
            </div>

            <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.05em', marginBottom: '4px' }}>CURRENT TEMPLATE</div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{selectedType} · {templates.find(t => t.type === selectedType)?.cv_filename || "CV file attached"}</div>
            </div>
          </div>
        </div>
      )}

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
