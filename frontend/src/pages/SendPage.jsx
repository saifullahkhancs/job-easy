import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTemplatesV2, sendEmail, getCurrentUser } from "../api/client";
import { Send, CheckCircle2, Copy, Link, Mail, Lock } from "lucide-react";

export default function SendPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const user = await getCurrentUser();
          setCurrentUser(user);
        } catch {
          setCurrentUser(null);
        }
      }

      try {
        const items = await fetchTemplatesV2();
        // Filter to show only customer's personal templates for sending
        const personalTemplates = items.filter(t => t.template_scope === "customer");
        setTemplates(personalTemplates);
        if (personalTemplates.length > 0) setSelectedTemplateId(personalTemplates[0].id);
      } catch (err) {
        setError(err.message);
      }
    };
    init();
  }, []);

  const isGuest = !currentUser;
  const isVisitor = currentUser?.role === "visitor";
  const isDisabled = isGuest || isVisitor;

  async function handleSubmit(event) {
    event.preventDefault();
    if (isDisabled) return;
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const result = await sendEmail(recipientEmail, selectedTemplateId);
      setMessage(`${result.message} to ${result.recipient}`);
      setRecipientEmail("");
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
            <p>{isGuest ? "You need to log in to send emails." : "Your account is in Visitor mode. You need approval from an admin to send emails."}</p>
          </div>
        </div>
      )}

      <section className="card" style={{ minHeight: 'auto', height: 'auto' }}>
      <div className="page-header">
        <div>
          <h2>Send Email</h2>
          <p className="muted">Choose a template, add the recipient, and send the application with its CV attachment.</p>
        </div>
        <button type="button" className="header-action" disabled={isDisabled} style={{ background: '#1e3a8a', color: 'white', border: 'none', padding: '12px', borderRadius: '16px', opacity: isDisabled ? 0.5 : 1 }}>
          <Send size={20} />
        </button>
      </div>



      {!isDisabled && templates.length === 0 ? (
        <div className="empty-state">
          <p className="muted">No personal templates available. Create a template first to send emails.</p>
        </div>
      ) : (
        <div className="form-page-layout">
          <div className="form-main-panel">
            <form className="form" onSubmit={handleSubmit}>
            <label>
              Select Template
              <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} required disabled={isDisabled}>
                {isDisabled && <option value="">— Login required —</option>}
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
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
                disabled={isDisabled}
              />
            </label>

            <button type="submit" disabled={loading || isDisabled} style={{ marginTop: '16px' }}>
              <Send size={18} />
              {loading ? "Sending..." : "Send Email"}
            </button>
            </form>
          </div>

          <div className="form-side-panel">
            <div className="dark-preview-card" style={{ height: 'auto' }}>
            <div className="dark-preview-header" style={{ marginBottom: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isDisabled ? '#94a3b8' : '#10b981' }}>
                <CheckCircle2 size={20} />
                <span style={{ color: '#fff', fontSize: '1.1rem' }}>{isDisabled ? "Login to send" : "Ready to send"}</span>
              </span>
            </div>
            
            <div className="dark-preview-content" style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
              {isDisabled
                ? "Login and get approved to send automated job application emails with your own templates and CV."
                : "The selected template includes a subject line, tailored email body, and CV attachment. Add the recipient address to complete the flow."}
            </div>

            <div style={{ display: 'flex', gap: '16px', color: '#94a3b8' }}>
              <Copy size={20} style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1 }} />
              <Link size={20} style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1 }} />
              <Mail size={20} style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1 }} />
            </div>
            </div>
          </div>
        </div>
      )}

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
    </div>
  );
}
