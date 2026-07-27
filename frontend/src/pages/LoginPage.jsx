import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  ArrowRight,
  MailCheck,
  AlertCircle,
  Send,
  Shield,
  User,
  LayoutDashboard,
  Smartphone,
} from "lucide-react";
import { login, getCurrentUser, verifyEmail, resendVerification } from "../api/client";
import { getAccessToken, setTokens } from "../api/tokenStorage";

export default function LoginPage() {
  const [view, setView] = useState("login"); // 'login' or 'verify'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminDestination, setAdminDestination] = useState("app"); // "admin" or "app"
  const [selectedQuickLogin, setSelectedQuickLogin] = useState("customer"); // "admin" or "customer"
  const navigate = useNavigate();

  useEffect(() => {
    // Use per-tab sessionStorage – allows admin in one tab, customer in another.
    // Previously this used localStorage which is shared across tabs, so logging
    // in as a second user overwrote the first tab's token and made it appear logged out.
    const token = getAccessToken();
    if (token) {
      navigate("/app/templates");
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const data = await login(email, password);
      // Store in sessionStorage for tab isolation (see tokenStorage.js)
      setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
      
      // Fetch user to check role and redirect accordingly
      const user = await getCurrentUser();
      if (user.role === "admin") {
        // Admin can choose to go to admin dashboard or app
        if (adminDestination === "admin") {
          navigate("/admin");
        } else {
          navigate("/app/templates");
        }
      } else {
        navigate("/app/templates");
      }
    } catch (err) {
      // Handle the specific case where the user is not verified
      if (err.message.includes("User not verified") || err.message.includes("new verification code has been sent")) {
        setView("verify");
        setMessage("A new verification code has been sent. Please check your email.");
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await verifyEmail(email, code);
      setMessage("Account verified successfully! Please log in.");
      setView("login");
      setCode("");
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await resendVerification(email);
      setMessage("A new verification code has been sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  if (view === "verify") {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <MailCheck className="auth-icon" />
          <h2>Check your email</h2>
          <p className="muted">
            We've sent a 5-digit verification code to <strong>{email}</strong>.
          </p>
          <form onSubmit={handleVerifySubmit} className="auth-form">
            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}
            <label htmlFor="code">Verification Code</label>
            <input id="code" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="12345" required maxLength="5" className="auth-input" />
            <button type="submit" disabled={loading} className="auth-submit-btn">
              {loading ? "Verifying..." : "Verify Account"}
            </button>
          </form>
          <div className="auth-footer">
            <p>Didn't receive the code?</p>
            <button onClick={handleResend} disabled={loading} className="link-button">
              <Send size={14} /> {loading ? "Sending..." : "Resend Code"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>

        <div className="quick-login-buttons">
          <button 
            type="button" 
            className={`quick-login-btn ${selectedQuickLogin === "admin" ? "active" : ""}`}
            onClick={() => {
              setEmail("admin@example.com");
              setPassword("admin123");
              setAdminDestination("admin");
              setSelectedQuickLogin("admin");
            }}
          >
            <Shield size={16} />
            <span>Login as Admin</span>
          </button>
          <button 
            type="button" 
            className={`quick-login-btn ${selectedQuickLogin === "customer" ? "active" : ""}`}
            onClick={() => {
              setEmail("customer@example.com");
              setPassword("customer123");
              setSelectedQuickLogin("customer");
            }}
          >
            <User size={16} />
            <span>Login as Customer</span>
          </button>
        </div>

        {email === "admin@example.com" && (
          <div className="admin-destination-selector">
            <div className="toggle-switch">
              <button
                type="button"
                className={`toggle-option ${adminDestination === "admin" ? "active" : ""}`}
                onClick={() => setAdminDestination("admin")}
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                className={`toggle-option ${adminDestination === "app" ? "active" : ""}`}
                onClick={() => setAdminDestination("app")}
              >
                <Smartphone size={16} />
                <span>App</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <Mail size={20} className="input-icon" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock size={20} className="input-icon" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <ArrowRight size={20} className="btn-icon" />}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
          <p>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
