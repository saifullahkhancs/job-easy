import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, Info, CheckCircle, AlertCircle } from "lucide-react";
import { createEmailInfo, submitApprovalRequest, getEmailInfo } from "../api/client";
import { RoleBadge, ApprovalStatusBadge } from "../components/RoleBadge";

export default function RequestAccessPage() {
  const [step, setStep] = useState("setup"); // "setup", "confirm", "submitted"
  const [formData, setFormData] = useState({
    senderName: "",
    senderEmail: "", // Only for display, not used for sending
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailInfoId, setEmailInfoId] = useState(null);
  const [existingEmailInfo, setExistingEmailInfo] = useState(null);
  const navigate = useNavigate();

  // Check if email info already exists
  useState(() => {
    const checkExistingEmailInfo = async () => {
      try {
        const info = await getEmailInfo();
        setExistingEmailInfo(info);
        if (info) {
          setEmailInfoId(info.id);
          setFormData({
            senderName: info.sender_name || "",
            senderEmail: info.sender_email || "",
          });
        }
      } catch (error) {
        // No existing email info, that's fine
      }
    };
    checkExistingEmailInfo();
  });

  const handleSetup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await createEmailInfo(
        formData.senderEmail,
        formData.senderName,
        "", // No API key needed - using platform's Resend
        "resend"
      );
      setEmailInfoId(data.id);
      setStep("confirm");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    setError("");
    setLoading(true);

    try {
      await submitApprovalRequest(emailInfoId);
      setStep("submitted");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
        <h1>Request Email Automation Access</h1>
        <p>Set up your email configuration to send automated job applications</p>
        </div>
      </div>

      {step === "setup" && (
        <div className="content-card">
          <div className="info-banner">
            <Info size={20} className="banner-icon" />
            <div>
              <h3>Email Automation Setup</h3>
              <p>Configure your email display name for sending job applications.</p>
            </div>
          </div>

          <div className="instructions-section">
            <h3>Free Tier Information:</h3>
            <p className="note-text">
              For now, we are using Resend's free tier with our own email to send job applications.
              This allows us to provide email automation without requiring you to set up your own SMTP credentials.
            </p>
            <p className="note-text">
              <strong>Note:</strong> When the app is fully supported, you'll be able to use your own email service (Gmail SMTP or Resend) with custom credentials.
            </p>
            <p className="note-text">
              Resend free tier provides limited daily quota for email sending.
            </p>
          </div>

          <div className="security-note">
            <CheckCircle size={20} className="note-icon" />
            <div>
              <strong>Current Setup:</strong> 
              <ul>
                <li>Emails are sent from our verified Resend email</li>
                <li>Your display name will be shown as the sender</li>
                <li>Daily sending limits apply due to free tier</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleSetup} className="form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="senderName">Sender Display Name</label>
              <div className="input-wrapper">
                <User size={20} className="input-icon" />
                <input
                  id="senderName"
                  type="text"
                  value={formData.senderName}
                  onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <p className="input-hint">This name will be displayed as the sender in emails</p>
            </div>

            <div className="preview-section">
              <h4>Email Preview:</h4>
              <div className="preview-box">
                <strong>{formData.senderName || "Your Name"} &lt;info@jobeasy.online&gt;</strong>
              </div>
              <p className="preview-note">Emails will be sent from our platform email with your display name</p>
            </div>

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? "Saving..." : "Continue to Review"}
              {!loading && <ArrowRight size={20} className="btn-icon" />}
            </button>
          </form>
        </div>
      )}

      {step === "confirm" && (
        <div className="content-card">
          <div className="confirm-section">
            <h2>Review Your Email Configuration</h2>
            
            <div className="review-item">
              <label>Sender Display Name:</label>
              <span>{formData.senderName}</span>
            </div>
            
            <div className="review-item">
              <label>Email From:</label>
              <span>info@jobeasy.online (Platform Email)</span>
            </div>

            <div className="review-item">
              <label>Email Preview:</label>
              <span className="preview-text">{formData.senderName || "Your Name"} &lt;info@jobeasy.online&gt;</span>
            </div>

            <div className="warning-banner">
              <AlertCircle size={20} className="banner-icon" />
              <div>
                <strong>Before Submitting:</strong>
                <ul>
                  <li>Ensure your display name is correct</li>
                  <li>Emails will be sent from our platform email</li>
                  <li>Once submitted, an admin will review your request</li>
                </ul>
              </div>
            </div>

            <div className="action-buttons">
              <button 
                type="button" 
                className="secondary-btn"
                onClick={() => setStep("setup")}
              >
                Back to Edit
              </button>
              <button 
                type="button" 
                className="primary-btn"
                onClick={handleSubmitRequest}
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Approval Request"}
                {!loading && <ArrowRight size={20} className="btn-icon" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "submitted" && (
        <div className="content-card">
          <div className="success-state">
            <div className="success-icon">✓</div>
            <h2>Request Submitted Successfully</h2>
            <p>Your email automation request has been submitted for admin review.</p>
            
            <div className="next-steps">
              <h3>What happens next:</h3>
              <ul>
                <li>An admin will review your email configuration</li>
                <li>You'll be notified once your request is approved or rejected</li>
                <li>Upon approval, you'll gain access to create templates and send emails</li>
              </ul>
            </div>

            <div className="action-buttons">
              <button 
                type="button" 
                className="primary-btn"
                onClick={() => navigate("/app/request-status")}
              >
                Check Request Status
              </button>
              <button 
                type="button" 
                className="secondary-btn"
                onClick={() => navigate("/app")}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
