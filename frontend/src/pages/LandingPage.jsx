import { useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Send,
  FileText,
  Zap,
  Shield,
  Users,
  UploadCloud,
  Mail,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Clock,
  Star,
  Play,
  FileCheck,
  Layers,
  Briefcase,
} from "lucide-react";
import { getAccessToken } from "../api/tokenStorage";
import "./LandingPage.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const isLoggedIn = !!getAccessToken();

  return (
    <div className="landing-root">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo" onClick={() => navigate("/")}>
            <div className="landing-logo-mark">
              <LayoutGrid size={22} />
            </div>
            <span>Job Easy</span>
          </div>

          <nav className="landing-nav">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#templates">Templates</a>
          </nav>

          <div className="landing-header-actions">
            {isLoggedIn ? (
              <>
                <button className="landing-ghost-btn" onClick={() => navigate("/app/templates")}>
                  Dashboard
                </button>
                <button className="landing-primary-btn" onClick={() => navigate("/app/templates")}>
                  Open App <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button className="landing-ghost-btn" onClick={() => navigate("/login")}>
                  Login
                </button>
                <button className="landing-primary-btn" onClick={() => navigate("/signup")}>
                  Get Started <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="landing-hero-blob blob-1" />
          <div className="landing-hero-blob blob-2" />
          <div className="landing-hero-blob blob-3" />
        </div>

        <div className="landing-hero-inner">
          <div className="landing-hero-content">
            <div className="landing-badge">
              <Sparkles size={14} />
              <span>Trusted by 2,000+ job seekers</span>
              <span className="landing-badge-dot" />
              <span className="landing-badge-new">New: Auto-send with CV</span>
            </div>

            <h1 className="landing-h1">
              Automate your{" "}
              <span className="landing-h1-gradient">job applications</span> in
              seconds, not hours
            </h1>

            <p className="landing-hero-sub">
              Upload your CV once, create smart templates, and send tailored
              applications with attachments — tracked, managed, and approved.
              Built for visitors, customers, and hiring teams.
            </p>

            <div className="landing-hero-ctas">
              <button
                className="landing-cta-primary"
                onClick={() => navigate(isLoggedIn ? "/app/templates" : "/signup")}
              >
                <Zap size={18} />
                Start Sending Emails
              </button>
              <button className="landing-cta-secondary" onClick={() => navigate("/app/templates")}>
                <Play size={16} />
                View Templates
              </button>
            </div>

            <div className="landing-trust">
              <div className="landing-trust-avatars">
                <span>A</span>
                <span>B</span>
                <span>C</span>
              </div>
              <div className="landing-trust-text">
                <div className="landing-trust-stars">
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <span>5.0</span>
                </div>
                <span>Loved by early users — no spam, just offers</span>
              </div>
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-mock-card mock-card-main">
              <div className="mock-card-header">
                <div className="mock-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="mock-title">Send Email — Job Easy</span>
                <div className="mock-header-actions">
                  <span className="mock-pill green">
                    <CheckCircle2 size={12} /> Ready to send
                  </span>
                </div>
              </div>

              <div className="mock-card-body">
                <div className="mock-field">
                  <span className="mock-label">Template</span>
                  <div className="mock-select">
                    <FileText size={16} />
                    <span>Python Developer — Tailored Cover</span>
                    <span className="mock-badge">Yours</span>
                  </div>
                </div>

                <div className="mock-field">
                  <span className="mock-label">Recipient</span>
                  <div className="mock-input">
                    <Mail size={16} />
                    <span>hr@dreamcompany.com</span>
                  </div>
                </div>

                <div className="mock-preview">
                  <div className="mock-preview-top">
                    <div className="mock-avatar">JD</div>
                    <div>
                      <strong>John Doe — via Job Easy</strong>
                      <span>john@example.com → hr@dreamcompany.com</span>
                    </div>
                  </div>
                  <div className="mock-preview-subject">
                    <Layers size={14} />
                    Application for Python Developer — CV Attached
                  </div>
                </div>

                <button className="mock-send-btn" onClick={() => navigate("/app/send")}>
                  <Send size={18} />
                  Send Email with CV
                </button>

                <div className="mock-footer-icons">
                  <span>
                    <FileCheck size={14} /> CV.pdf verified
                  </span>
                  <span>
                    <Shield size={14} /> Resend secured
                  </span>
                </div>
              </div>
            </div>

            <div className="landing-mock-card mock-card-stats">
              <div className="mock-stat">
                <div className="mock-stat-icon orange">
                  <UploadCloud size={18} />
                </div>
                <div>
                  <strong>2 Templates</strong>
                  <span>Max 2 per customer</span>
                </div>
                <CheckCircle2 size={16} className="mock-stat-check" />
              </div>
              <div className="mock-stat">
                <div className="mock-stat-icon green">
                  <Briefcase size={18} />
                </div>
                <div>
                  <strong>Default promoted</strong>
                  <span>Your CV featured platform-wide</span>
                </div>
              </div>
            </div>

            <div className="landing-mock-card mock-card-float">
              <Clock size={16} />
              <span>Email delivered in 1.2s avg</span>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="landing-proof">
        <div className="landing-proof-inner">
          <span className="landing-proof-label">Powers hiring workflows at</span>
          <div className="landing-proof-logos">
            <span>RemoteHire</span>
            <span>•</span>
            <span>DevTeams</span>
            <span>•</span>
            <span>JobEasy HQ</span>
            <span>•</span>
            <span>LaunchPad</span>
          </div>
          <div className="landing-proof-numbers">
            <div>
              <strong>12k+</strong>
              <span>Emails sent</span>
            </div>
            <div>
              <strong>98%</strong>
              <span>Deliverability</span>
            </div>
            <div>
              <strong>2.1x</strong>
              <span>More replies</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-kicker">Features</span>
            <h2>Everything you need to win your next role</h2>
            <p>
              From visitor to customer to admin, Job Easy handles templates,
              approvals, and delivery so you focus on interviews.
            </p>
          </div>

          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon orange">
                <UploadCloud size={22} />
              </div>
              <h3>CV & Template Manager</h3>
              <p>
                Upload PDF once, create tailored cover contexts. Customers get
                2 personal templates — your promoted default stays yours.
              </p>
              <span className="landing-feature-link">
                Create template <ArrowRight size={14} />
              </span>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon green">
                <Send size={22} />
              </div>
              <h3>One-Click Email Send</h3>
              <p>
                Pick template, add HR email, send with CV attachment via Resend.
                Real-time validation and delivery feedback.
              </p>
              <span className="landing-feature-link">
                Try sending <ArrowRight size={14} />
              </span>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon blue">
                <Shield size={22} />
              </div>
              <h3>Role-Based Access</h3>
              <p>
                Visitor preview, customer send, admin approvals. JWT auth with
                refresh, per-tab session isolation.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon purple">
                <Users size={22} />
              </div>
              <h3>Admin Control Center</h3>
              <p>
                Approve requests, manage users, promote personal CVs to platform
                defaults. Collapsible sidebar stays on rail.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon amber">
                <FileText size={22} />
              </div>
              <h3>Default Templates</h3>
              <p>
                Curated defaults for guests and new users. Instant value even
                before you upload your own CV.
              </p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon slate">
                <Zap size={22} />
              </div>
              <h3>Fast & Secure</h3>
              <p>
                FastAPI backend, rate-limited, CORS locked, encrypted API keys.
                PDF previews stream securely with auth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-kicker">How it works</span>
            <h2>From zero to sent in 3 steps</h2>
          </div>

          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-number">1</div>
              <div className="landing-step-icon">
                <UploadCloud size={28} />
              </div>
              <h3>Upload CV & Context</h3>
              <p>
                Drop your PDF, pick a role like Python Developer, write your tailored
                context. Stored encrypted per user.
              </p>
              <button className="landing-step-cta" onClick={() => navigate("/app/new")}>
                New Template
              </button>
            </div>

            <div className="landing-step-line" />

            <div className="landing-step">
              <div className="landing-step-number">2</div>
              <div className="landing-step-icon">
                <Layers size={28} />
              </div>
              <h3>Get Approved (if visitor)</h3>
              <p>
                Visitors request access, configure email sender, admins approve in
                dashboard. 30s approval flow.
              </p>
              <button
                className="landing-step-cta"
                onClick={() => navigate("/app/request-access")}
              >
                Request Access
              </button>
            </div>

            <div className="landing-step-line" />

            <div className="landing-step">
              <div className="landing-step-number">3</div>
              <div className="landing-step-icon">
                <Mail size={28} />
              </div>
              <h3>Send & Track</h3>
              <p>
                Choose your owned template, enter HR email, hit send. CV attaches
                automatically. Success toast confirms delivery.
              </p>
              <button className="landing-step-cta" onClick={() => navigate("/app/send")}>
                Send Email
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Templates preview */}
      <section id="templates" className="landing-section">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-kicker">Templates</span>
            <h2>Built for every role</h2>
            <p>
              Guests see defaults. Customers see their own + defaults. Admins see all.
              Your promoted templates stay usable for you.
            </p>
          </div>

          <div className="landing-templates-grid">
            <div className="landing-template-card">
              <div className="landing-template-top">
                <span className="landing-template-badge default">Default</span>
                <FileText size={18} />
              </div>
              <h4>Full Stack Developer</h4>
              <p>Modern cover highlighting React, Node, and scalable systems experience with impact metrics.</p>
              <div className="landing-template-footer">
                <span>Used 1.2k times</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="landing-template-card featured">
              <div className="landing-template-top">
                <span className="landing-template-badge personal">Yours</span>
                <Sparkles size={18} />
              </div>
              <h4>Python Developer — AI Focus</h4>
              <p>Tailored for ML roles, emphasizes FastAPI, LLM integration, and data pipelines.</p>
              <div className="landing-template-footer">
                <span>Promoted to default ✓</span>
                <CheckCircle2 size={16} />
              </div>
            </div>

            <div className="landing-template-card">
              <div className="landing-template-top">
                <span className="landing-template-badge personal">Yours</span>
                <FileCheck size={18} />
              </div>
              <h4>Product Manager</h4>
              <p>Leadership narrative with metrics, stakeholder management, and roadmap wins.</p>
              <div className="landing-template-footer">
                <span>2 of 2 used</span>
                <Clock size={14} />
              </div>
            </div>
          </div>

          <div className="landing-templates-cta">
            <button className="landing-primary-btn" onClick={() => navigate("/app/templates")}>
              Browse All Templates <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="landing-cta-section">
        <div className="landing-cta-inner">
          <div className="landing-cta-content">
            <h2>Ready to land your dream job?</h2>
            <p>
              Join 2,000+ job seekers automating applications. Upload CV once,
              send forever. No spam, just interviews.
            </p>
          </div>
          <div className="landing-cta-actions">
            <button className="landing-cta-primary light" onClick={() => navigate("/signup")}>
              Create Free Account
            </button>
            <button className="landing-cta-secondary light" onClick={() => navigate("/login")}>
              Login to Dashboard
            </button>
          </div>

          <div className="landing-cta-meta">
            <span><CheckCircle2 size={14} /> Free for visitors to preview</span>
            <span><CheckCircle2 size={14} /> Customer approval in &lt;24h</span>
            <span><CheckCircle2 size={14} /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-logo-mark">
              <LayoutGrid size={18} />
            </div>
            <div>
              <strong>Job Easy</strong>
              <span>Automate job applications with smart templates and CV management.</span>
            </div>
          </div>

          <div className="landing-footer-links">
            <div>
              <h4>Product</h4>
              <a onClick={() => navigate("/app/templates")}>Templates</a>
              <a onClick={() => navigate("/app/send")}>Send Email</a>
              <a onClick={() => navigate("/app/new")}>New Template</a>
            </div>
            <div>
              <h4>Workflow</h4>
              <a onClick={() => navigate("/app/request-access")}>Request Access</a>
              <a onClick={() => navigate("/app/request-status")}>Request Status</a>
              <a onClick={() => navigate("/admin/dashboard")}>Admin</a>
            </div>
            <div>
              <h4>Account</h4>
              <a onClick={() => navigate("/login")}>Login</a>
              <a onClick={() => navigate("/signup")}>Register</a>
              <a href="mailto:info@jobeasy.online">Support</a>
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} Job Easy. All rights reserved.</span>
          <span>Made with ❤️ for job seekers — API: /api/v1/email/send fixed</span>
        </div>
      </footer>
    </div>
  );
}
