import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, Info, Shield, AlertCircle } from "lucide-react";
import { createEmailInfo, submitApprovalRequest, getEmailInfo } from "../api/client";
import { RoleBadge, ApprovalStatusBadge } from "../components/RoleBadge";

export default function RequestAccessPage() {
  const [step, setStep] = useState("setup"); // "setup", "confirm", "submitted"
  const [formData, setFormData] = useState({
    senderEmail: "",
    senderName: "",
    appPassword: "",
    emailProvider: "gmail",
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
            senderEmail: info.sender_email,
            senderName: info.sender_name,
            appPassword: "",
            emailProvider: info.email_provider,
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
        formData.appPassword,
        formData.emailProvider
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

  const senderPreview = `${formData.senderName} <${formData.senderEmail}>`;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Request Email Automation Access</h1>
        <p>Set up your email configuration to send automated job applications</p>
      </div>

      {step === "setup" && (
        <div className="content-card">
          <div className="info-banner">
            <Info size={20} className="banner-icon" />
            <div>
              <h3>Gmail App Password Required</h3>
              <p>You need to create an app-specific password for Gmail to enable email automation.</p>
            </div>
          </div>

          <div className="instructions-section">
            <h3>How to Create a Gmail App Password:</h3>
            <ol className="instructions-list">
              <li>Go to your Google Account settings</li>
              <li>Navigate to Security → 2-Step Verification</li>
              <li>Scroll down to "App passwords"</li>
              <li>Click "Create" and enter a name (e.g., "Job Easy")</li>
              <li>Copy the 16-character password generated</li>
            </ol>
          </div>

          <div className="security-note">
            <Shield size={20} className="note-icon" />
            <div>
              <strong>Security Note:</strong> Your app password is encrypted and cannot be seen by admin. 
              It's only used to send emails on your behalf.
            </div>
          </div>

          <form onSubmit={handleSetup} className="form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="senderEmail">Sender Email</label>
              <div className="input-wrapper">
                <Mail size={20} className="input-icon" />
                <input
                  id="senderEmail"
                  type="email"
                  value={formData.senderEmail}
                  onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                  placeholder="your-email@gmail.com"
                  required
                />
              </div>
            </div>

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
            </div>

            <div className="form-group">
              <label htmlFor="appPassword">Gmail App Password</label>
              <div className="input-wrapper">
                <Lock size={20} className="input-icon" />
                <input
                  id="appPassword"
                  type="password"
                  value={formData.appPassword}
                  onChange={(e) => setFormData({ ...formData, appPassword: e.target.value })}
                  placeholder="xxxx xxxx xxxx xxxx"
                  required
                />
              </div>
              <p className="input-hint">Enter the 16-character app password from Google</p>
            </div>

            <div className="preview-section">
              <h4>Email Preview:</h4>
              <div className="preview-box">
                <strong>{senderPreview}</strong>
              </div>
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
              <label>Sender Email:</label>
              <span>{formData.senderEmail}</span>
            </div>
            
            <div className="review-item">
              <label>Sender Name:</label>
              <span>{formData.senderName}</span>
            </div>
            
            <div className="review-item">
              <label>Email Provider:</label>
              <span>{formData.emailProvider}</span>
            </div>

            <div className="review-item">
              <label>Email Preview:</label>
              <span className="preview-text">{senderPreview}</span>
            </div>

            <div className="warning-banner">
              <AlertCircle size={20} className="banner-icon" />
              <div>
                <strong>Before Submitting:</strong>
                <ul>
                  <li>Ensure your app password is correct</li>
                  <li>Test that you can send emails from this account</li>
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
