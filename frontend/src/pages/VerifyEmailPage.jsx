import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { verifyEmail, resendVerification } from "../api/client";
import { MailCheck, AlertCircle, Send } from "lucide-react";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await verifyEmail(email, code);
      setMessage("Account verified successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await resendVerification(email);
      setMessage("A new verification code has been sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  }

  if (!email) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <AlertCircle className="auth-icon" />
          <h2>Missing Information</h2>
          <p className="muted">
            No email address was provided. Please return to the login page and try again.
          </p>
          <button onClick={() => navigate("/login")} className="auth-button">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <MailCheck className="auth-icon" />
        <h2>Check your email</h2>
        <p className="muted">
          We've sent a 5-digit verification code to <strong>{email}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="code">Verification Code</label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="12345"
            required
            maxLength="5"
            className="auth-input"
          />
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? "Verifying..." : "Verify Account"}
          </button>
        </form>

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}

        <div className="auth-footer">
          <p>Didn't receive the code?</p>
          <button onClick={handleResend} disabled={loading} className="link-button">
            <Send size={14} />
            {loading ? "Sending..." : "Resend Code"}
          </button>
        </div>
      </div>
    </div>
  );
}