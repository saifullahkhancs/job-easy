import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchTemplatesV2, sendEmail, getCurrentUser } from "../api/client";
import { Send, CheckCircle2, Copy, Link, Mail, Lock } from "lucide-react";
import { getAccessToken } from "../api/tokenStorage";
import {
  canSendWithTemplate,
  getTemplateOptionLabel,
  sortTemplatesForDisplay,
} from "../utils/templateDisplay";

export default function SendPage() {
  const [searchParams] = useSearchParams();
  const requestedTemplateId = searchParams.get("template");
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
      let fetchedUser = null;

      const token = getAccessToken();
      if (token) {
        try {
          const user = await getCurrentUser();
          fetchedUser = user;
          setCurrentUser(user);
        } catch {
          setCurrentUser(null);
        }
      }

      try {
        const items = await fetchTemplatesV2();
        // Order the picker the way users expect to read it: their own
        // templates first, then platform defaults, then other users'.
        const sendableTemplates = sortTemplatesForDisplay(items, fetchedUser);
        setTemplates(sendableTemplates);
        if (sendableTemplates.length > 0) {
          const requestedTemplate = sendableTemplates.find(
            (template) => String(template.id) === requestedTemplateId
          );
          // Default to a template this user is actually allowed to send with
          // (the backend rejects other people's templates for customers).
          const firstUsable =
            sendableTemplates.find((template) => canSendWithTemplate(template, fetchedUser)) ||
            sendableTemplates[0];
          setSelectedTemplateId(String(requestedTemplate?.id || firstUsable.id));
        } else {
          setSelectedTemplateId("");
        }
      } catch (err) {
        setError(err.message);
      }
    };
    init();
  }, [requestedTemplateId]);

  const isGuest = !currentUser;
  const isVisitor = currentUser?.role === "visitor";
  const isAdmin = currentUser?.role === "admin";
  const needsAdminAccess = isAdmin && currentUser?.approval_status !== "approved";
  const isDisabled = isGuest || isVisitor || needsAdminAccess;
  const accessMessage = needsAdminAccess
    ? currentUser?.approval_status === "pending"
      ? "Your email access request is pending admin approval."
      : "Request email access before sending."
    : isVisitor
      ? "Your account needs approval before sending emails."
      : "You need to log in to send emails.";

  const selectedTemplate = templates.find((t) => String(t.id) === String(selectedTemplateId));
  // Customers may only send with templates they authored. Flag it up front
  // instead of letting the request come back as a 403.
  const selectedNotSendable =
    Boolean(currentUser) &&
    Boolean(selectedTemplate) &&
    !isDisabled &&
    !canSendWithTemplate(selectedTemplate, currentUser);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isDisabled) return;
    if (selectedNotSendable) {
      setError("You can only send emails with your own templates. Pick one labelled “Owned by you”.");
      return;
    }
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
      {(isGuest || isVisitor || needsAdminAccess) && (
        <div className="visitor-banner">
          <Lock size={24} className="banner-icon" />
          <div className="banner-content">
            <h3>{isGuest ? "Preview Mode" : "Visitor Mode"}</h3>
            <p>{isGuest ? "You need to log in to send emails." : accessMessage}</p>
            {needsAdminAccess && (
              <button type="button" className="primary-btn" onClick={() => navigate("/app/request-access")}>
                {currentUser?.approval_status === "pending" ? "View Request Status" : "Request Access"}
              </button>
            )}
          </div>
        </div>
      )}

      <section className="card" style={{ minHeight: 'auto', height: 'auto' }}>
      <div className="page-header">
        <div>
          <h2>Send Email</h2>
          <p className="muted">Choose a template, add the recipient, and send the application with its CV attachment.</p>
        </div>
        <button type="button" className="header-action" disabled={isDisabled} title={isDisabled ? "Login to use it" : ""} style={{ background: '#1e3a8a', color: 'white', border: 'none', padding: '12px', borderRadius: '16px', opacity: isDisabled ? 0.5 : 1 }}>
          <Send size={20} />
        </button>
      </div>



      {templates.length === 0 ? (
        <div className="empty-state">
          <p className="muted">No personal templates available. Create a template first to send emails.</p>
          <p className="muted" style={{ marginTop: "8px", fontSize: "0.85rem" }}>
            If your templates were promoted to default by an admin, they still count as yours and should appear here. Try refreshing or check the Templates page.
          </p>
        </div>
      ) : (
        <div className="form-page-layout">
          <div className="form-main-panel">
            <form className="form" onSubmit={handleSubmit}>
            <label>
              Select Template
              <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} required disabled={false}>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {getTemplateOptionLabel(template, currentUser)}
                  </option>
                ))}
              </select>
              <p className="input-hint">Role type · ownership. Your templates are listed first.</p>
              {selectedNotSendable && (
                <p className="input-hint" style={{ color: "#b45309" }}>
                  This template belongs to someone else. Choose one labelled “Owned by you” to send.
                </p>
              )}
            </label>

            <label>
              Recipient Email
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="hr@company.com"
                required
                disabled={false}
              />
            </label>

            <button
              type="submit"
              disabled={loading || isDisabled || !selectedTemplateId || selectedNotSendable}
              title={
                isDisabled
                  ? "Login to use it"
                  : selectedNotSendable
                    ? "You can only send with your own templates"
                    : ""
              }
              style={{ marginTop: '16px' }}
            >
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
