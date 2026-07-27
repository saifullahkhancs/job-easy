import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  ArrowRight,
  ArrowLeft,
  Info,
  CheckCircle,
  AlertCircle,
  Mail,
  ShieldCheck,
  Send,
  Sparkles,
  Clock,
  PartyPopper,
} from "lucide-react";
import { createEmailInfo, submitApprovalRequest, getEmailInfo } from "../api/client";
import { getAccessToken } from "../api/tokenStorage";

const PLATFORM_EMAIL = "info@jobeasy.online";

const STEPS = [
  { key: "setup", label: "Configure", icon: User },
  { key: "confirm", label: "Review", icon: ShieldCheck },
  { key: "submitted", label: "Submitted", icon: PartyPopper },
];

function StepIndicator({ current }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="stepper">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const state =
          index < currentIndex ? "done" : index === currentIndex ? "active" : "upcoming";
        return (
          <li key={step.key} className={`stepper-item stepper-${state}`}>
            <span className="stepper-bullet">
              {state === "done" ? <CheckCircle size={16} /> : <Icon size={16} />}
            </span>
            <span className="stepper-label">{step.label}</span>
            {index < STEPS.length - 1 && <span className="stepper-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function RequestAccessPage() {
  const [step, setStep] = useState("setup");
  const [formData, setFormData] = useState({ senderName: "", senderEmail: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailInfoId, setEmailInfoId] = useState(null);
  const [existingEmailInfo, setExistingEmailInfo] = useState(null);
  const navigate = useNavigate();
  const isGuest = !getAccessToken();

  useEffect(() => {
    const checkExistingEmailInfo = async () => {
      if (!getAccessToken()) {
        setFormData({ senderName: "Visitor Demo", senderEmail: PLATFORM_EMAIL });
        return;
      }

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
      } catch {
        // No existing email info — that's fine, the user is setting it up now.
      }
    };
    checkExistingEmailInfo();
  }, []);

  const handleSetup = async (e) => {
    e.preventDefault();

    if (isGuest) {
      setError("This is a visitor preview. Please login or register before submitting a real access request; approvals are managed by the admin.");
      return;
    }

    if (existingEmailInfo) {
      setStep("confirm");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await createEmailInfo(PLATFORM_EMAIL, formData.senderName, "", "resend");
      setEmailInfoId(data.id);
      setStep("confirm");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (isGuest) {
      setError("Login or register to submit a real request. Visitor previews are sample-only and managed by the admin.");
      return;
    }

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

  const previewName = formData.senderName || "Your Name";

  return (
    <div className="page-container page-container-full-width">
      <section className="card" style={{ minHeight: "auto", height: "auto" }}>
        {/* Slate accent header, matching the rest of the app */}
        <div className="page-accent-header accent-request">
          <div>
            <h2>Request Email Automation Access</h2>
            <p>Set up your sender identity, then send it to an admin for approval.</p>
          </div>
          <div className="page-accent-badge">
            <ShieldCheck size={22} />
          </div>
        </div>

        {isGuest && (
          <div className="visitor-banner" style={{ marginBottom: "24px" }}>
            <Info size={20} className="banner-icon" />
            <div className="banner-content">
              <h3>Visitor Preview</h3>
              <p>
                You can view this request flow as a visitor. To submit a real request, login or
                create an account. Approval is managed only by the admin.
              </p>
            </div>
            <div className="login-prompt-actions">
              <button className="login-prompt-login-btn" onClick={() => navigate("/login")}>Login</button>
              <button className="login-prompt-register-btn" onClick={() => navigate("/signup")}>Register</button>
            </div>
          </div>
        )}

        <StepIndicator current={step} />

        {error && (
          <div className="error-message" style={{ marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {/* ── Step 1: Configure ───────────────────────────────────────────── */}
        {step === "setup" && (
          <div className="form-page-layout">
            <div className="form-main-panel">
              <div className="info-banner" style={{ marginBottom: "24px" }}>
                <Info size={20} className="banner-icon" />
                <div>
                  <h3>Email Automation Setup</h3>
                  <p>Choose the display name recruiters will see on your applications.</p>
                </div>
              </div>

              <form onSubmit={handleSetup} className="form">
                <label>
                  Sender Display Name
                  <div className="input-wrapper">
                    <User size={18} className="input-icon" />
                    <input
                      id="senderName"
                      type="text"
                      value={formData.senderName}
                      onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                      placeholder="John Doe"
                      required
                      disabled={isGuest}
                    />
                  </div>
                  <p className="input-hint">This name appears as the sender in every email.</p>
                </label>

                <button type="submit" className="primary-btn" disabled={loading || isGuest}>
                  {loading ? "Saving..." : isGuest ? "Login to Submit Request" : "Continue to Review"}
                  {!loading && <ArrowRight size={18} className="btn-icon" />}
                </button>
              </form>
            </div>

            <div className="form-side-panel">
              {/* Live email preview */}
              <div className="email-preview-card">
                <div className="email-preview-top">
                  <span className="email-preview-dot" style={{ background: "#ef4444" }} />
                  <span className="email-preview-dot" style={{ background: "#f59e0b" }} />
                  <span className="email-preview-dot" style={{ background: "#10b981" }} />
                  <span className="email-preview-title">Email Preview</span>
                </div>
                <div className="email-preview-body">
                  <div className="email-preview-avatar">
                    {previewName.charAt(0).toUpperCase()}
                  </div>
                  <div className="email-preview-meta">
                    <strong>{previewName}</strong>
                    <span>&lt;{PLATFORM_EMAIL}&gt;</span>
                  </div>
                </div>
                <div className="email-preview-subject">
                  <Mail size={14} />
                  Application for Software Engineer
                </div>
              </div>

              <div className="fact-card">
                <div className="fact-card-header">
                  <Sparkles size={16} />
                  How sending works today
                </div>
                <ul className="fact-list">
                  <li>Applications currently send from our own verified email on Resend's free tier.</li>
                  <li>Your display name is shown as the sender.</li>
                  <li>The free tier has a daily sending quota, so availability can be limited.</li>
                  <li>Sending from your own email — Gmail SMTP or your own Resend — is coming once the app is fully supported.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Review ──────────────────────────────────────────────── */}
        {step === "confirm" && (
          <div className="form-page-layout">
            <div className="form-main-panel">
              <h3 className="review-heading">Review Your Email Configuration</h3>

              <div className="review-list">
                <div className="review-row">
                  <span className="review-label">
                    <User size={15} /> Sender Display Name
                  </span>
                  <span className="review-value">{formData.senderName || "—"}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">
                    <Mail size={15} /> Email From
                  </span>
                  <span className="review-value">{PLATFORM_EMAIL}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">
                    <Send size={15} /> Appears As
                  </span>
                  <span className="review-value">
                    {previewName} &lt;{PLATFORM_EMAIL}&gt;
                  </span>
                </div>
              </div>

              <div className="limit-warning" style={{ marginTop: "24px" }}>
                <AlertCircle size={20} className="warning-icon" />
                <div>
                  <strong style={{ color: "#92400e" }}>Before submitting</strong>
                  <ul className="tight-list">
                    <li>Double-check that your display name is spelled correctly.</li>
                    <li>Emails will be sent from the platform address above on Resend's free-tier quota.</li>
                    <li>An admin reviews every request manually.</li>
                  </ul>
                </div>
              </div>

              <div className="action-buttons">
                <button type="button" className="secondary-btn" onClick={() => setStep("setup")}>
                  <ArrowLeft size={18} />
                  Back to Edit
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleSubmitRequest}
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Submit Approval Request"}
                  {!loading && <ArrowRight size={18} className="btn-icon" />}
                </button>
              </div>
            </div>

            <div className="form-side-panel">
              <div className="fact-card">
                <div className="fact-card-header">
                  <Clock size={16} />
                  What happens next
                </div>
                <ol className="timeline-list">
                  <li>
                    <strong>Admin review</strong>
                    <span>Your configuration is checked by our team.</span>
                  </li>
                  <li>
                    <strong>Decision</strong>
                    <span>You'll be notified once it's approved or rejected.</span>
                  </li>
                  <li>
                    <strong>Full access</strong>
                    <span>Create templates and send applications right away.</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Submitted ───────────────────────────────────────────── */}
        {step === "submitted" && (
          <div className="result-panel result-success">
            <div className="result-icon-ring">
              <CheckCircle size={44} />
            </div>
            <h2>Request Submitted Successfully</h2>
            <p>
              Your email automation request is now in the review queue. We'll let you know as soon
              as an admin makes a decision.
            </p>

            <div className="result-steps">
              <div className="result-step">
                <span className="result-step-index">1</span>
                <div>
                  <strong>Admin reviews your configuration</strong>
                  <p>Usually within one business day.</p>
                </div>
              </div>
              <div className="result-step">
                <span className="result-step-index">2</span>
                <div>
                  <strong>You get a decision</strong>
                  <p>Approved or rejected, with notes if anything needs fixing.</p>
                </div>
              </div>
              <div className="result-step">
                <span className="result-step-index">3</span>
                <div>
                  <strong>Start automating</strong>
                  <p>Create templates and send job applications instantly.</p>
                </div>
              </div>
            </div>

            <div className="action-buttons centered">
              <button
                type="button"
                className="primary-btn"
                onClick={() => navigate("/app/request-status")}
              >
                Check Request Status
                <ArrowRight size={18} className="btn-icon" />
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigate("/app/templates")}
              >
                Return to Templates
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
