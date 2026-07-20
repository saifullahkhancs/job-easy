import { useEffect, useState } from "react";
import { fetchTemplates, sendEmail } from "../api/client";
import { Send, CheckCircle2, Copy, Link, Mail } from "lucide-react";

export default function SendPage() {
  const [templates, setTemplates] = useState([]);
  const [type, setType] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTemplates()
      .then((items) => {
        setTemplates(items);
        if (items.length > 0) setType(items[0].type);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const result = await sendEmail(recipientEmail, type);
      setMessage(`${result.message} to ${result.recipient}`);
      setRecipientEmail("");
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
          <h2>Send Email</h2>
          <p className="muted">Choose a stored template, add the recipient, and send the application with its CV attachment.</p>
        </div>
        <button type="button" className="header-action" style={{ background: '#1e3a8a', color: 'white', border: 'none', padding: '12px', borderRadius: '16px' }}>
          <Send size={20} />
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="muted">No templates available. Upload a template first.</p>
      ) : (
        <div className="split-layout">
          <form className="form" onSubmit={handleSubmit} style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px' }}>
            <label>
              Job Type
              <select value={type} onChange={(e) => setType(e.target.value)} required>
                {templates.map((template) => (
                  <option key={template.type} value={template.type}>
                    {template.type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Recipient Email
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="hr@company.com"
                required
              />
            </label>

            <button type="submit" disabled={loading} style={{ marginTop: '16px' }}>
              <Send size={18} />
              {loading ? "Sending..." : "Send Email"}
            </button>
          </form>

          <div className="dark-preview-card" style={{ height: 'auto', alignSelf: 'start' }}>
            <div className="dark-preview-header" style={{ marginBottom: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                <CheckCircle2 size={20} />
                <span style={{ color: '#fff', fontSize: '1.1rem' }}>Ready to send</span>
              </span>
            </div>
            
            <div className="dark-preview-content" style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
              The selected template includes a subject line, tailored email body, and CV attachment. Add the recipient address to complete the flow.
            </div>

            <div style={{ display: 'flex', gap: '16px', color: '#94a3b8' }}>
              <Copy size={20} style={{ cursor: 'pointer' }} />
              <Link size={20} style={{ cursor: 'pointer' }} />
              <Mail size={20} style={{ cursor: 'pointer' }} />
            </div>
          </div>
        </div>
      )}

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
