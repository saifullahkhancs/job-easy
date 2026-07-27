import { useState, useCallback, useEffect } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";
import { getAccessToken } from "../api/tokenStorage";
import "./LandingPage.css";

const MOBILE_BREAKPOINT = 1024;
const SIDEBAR_KEY = "jobeasy.landing.sidebar.open";

function readSidebarPref() {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(SIDEBAR_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export default function LandingPage() {
  const navigate = useNavigate();
  const isLoggedIn = !!getAccessToken();
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < MOBILE_BREAKPOINT ? false : readSidebarPref();
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const apply = (m) => {
      setIsMobile(m);
      setSidebarOpen(m ? false : readSidebarPref());
    };
    const handler = (e) => apply(e.matches);
    apply(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((p) => {
      const n = !p;
      if (!isMobile) {
        try { localStorage.setItem(SIDEBAR_KEY, String(n)); } catch {}
      }
      return n;
    });
  }, [isMobile]);

  const isCollapsed = !isMobile && !sidebarOpen;
  const isDrawerOpen = isMobile && sidebarOpen;

  const landingRootClass = [
    "landing-root",
    isCollapsed ? "landing-sidebar-collapsed" : "",
    isDrawerOpen ? "landing-sidebar-drawer-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={landingRootClass}>
      {/* Topbar for mobile drawer open button */}
      <header className="landing-topbar">
        <button
          type="button"
          className="landing-sidebar-toggle-btn"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="landing-topbar-brand" onClick={() => navigate("/")}>
          <div className="landing-logo-mark small">
            <LayoutGrid size={18} />
          </div>
          <span>Job Easy</span>
        </div>
      </header>

      {/* Backdrop for mobile */}
      <div className="landing-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      {/* Sidebar visible from beginning on landing page */}
      <aside className="landing-sidebar">
        <div className="landing-sidebar-brand">
          {/* Job Easy text + icon links to start URL / , does NOT act as sidebar toggle */}
          {/* Job Easy text+icon links to start URL / only, does NOT toggle sidebar */}
          <button
            type="button"
            className="landing-sidebar-brand-link"
            onClick={() => navigate("/")}
            aria-label="Go to home landing page"
            title="Go to home (start URL)"
          >
            <div className="landing-logo-mark">
              <LayoutGrid size={22} />
            </div>
            <div className="landing-sidebar-brand-text">
              <span className="landing-sidebar-title">Job Easy</span>
            </div>
          </button>

          {/* Collapsed toggle takes place of main icon when collapsed, remains on sidebar */}
          <button
            type="button"
            className="landing-logo-mark landing-sidebar-toggle-collapsed"
            onClick={toggleSidebar}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <PanelLeftOpen size={20} />
          </button>

          <button
            type="button"
            className="landing-sidebar-collapse-btn"
            onClick={toggleSidebar}
            aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
            title={isMobile ? "Close sidebar" : "Collapse sidebar"}
          >
            {isMobile ? <X size={20} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="landing-sidebar-nav">
          <a href="#features" className="landing-sidebar-link">
            <Zap size={18} />
            <span>Features</span>
          </a>
          <a href="#how" className="landing-sidebar-link">
            <Layers size={18} />
            <span>How it works</span>
          </a>
          <a href="#templates" className="landing-sidebar-link">
            <FileText size={18} />
            <span>Templates</span>
          </a>
          {/* For visitors also show request access and request status */}
          <button onClick={() => navigate("/app/request-access")} className="landing-sidebar-link">
            <Clock size={18} />
            <span>Request Access</span>
          </button>
          <button onClick={() => navigate("/app/request-status")} className="landing-sidebar-link">
            <CheckCircle2 size={18} />
            <span>Request Status</span>
          </button>
          <button onClick={() => navigate("/app/templates")} className="landing-sidebar-link active">
            <Briefcase size={18} />
            <span>Open App</span>
          </button>
        </nav>

        <div className="landing-sidebar-footer">
          <div className="landing-sidebar-note">
            <span>Start URL</span>
            <strong>jobeasy.online /</strong>
          </div>
          <button className="landing-sidebar-cta" onClick={() => navigate("/app/templates")}>
            <span>Go to Dashboard</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </aside>

      {/* Main landing content – top nav removed per request, sidebar is main nav */}
      <div className="landing-main">

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
                <span>Trusted in early beta</span>
                <span className="landing-badge-dot" />
                <span className="landing-badge-new">Auto-send with CV attachment</span>
              </div>

              <h1 className="landing-h1">
                Automate your <span className="landing-h1-gradient">job applications</span> in seconds, not hours
              </h1>

              <p className="landing-hero-sub">
                Upload your CV once, create smart templates, and send tailored applications with attachments — tracked, managed, and approved. Built for visitors, customers, and hiring teams.
              </p>

              <div className="landing-hero-ctas">
                <button className="landing-cta-primary" onClick={() => navigate(isLoggedIn ? "/app/templates" : "/signup")}>
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
                    <span>4.9</span>
                  </div>
                  <span>
                    Early beta feedback — avatars are placeholders
                    <span className="landing-demo-note"> • demo data</span>
                  </span>
                </div>
              </div>
              <p className="landing-demo-disclaimer">* Ratings and avatars are demo placeholders. Real user reviews coming after public launch.</p>
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
                <span>
                  Fast delivery via Resend
                  <span className="landing-demo-note"> • typically seconds • demo estimate</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof bar */}
        <section className="landing-proof">
          <div className="landing-proof-inner">
            <div className="landing-proof-left">
              <span className="landing-proof-label">
                Built to support teams like <span className="landing-demo-note">(illustrative examples)</span>
              </span>
              <div className="landing-proof-logos">
                <span>RemoteHire</span>
                <span>•</span>
                <span>DevTeams</span>
                <span>•</span>
                <span>JobEasy HQ</span>
                <span>•</span>
                <span>LaunchPad</span>
              </div>
              <span className="landing-demo-disclaimer small">* Company names are demo placeholders, not actual clients.</span>
            </div>
            <div className="landing-proof-numbers">
              <div>
                <strong>~12k+</strong>
                <span>Emails (projected)</span>
              </div>
              <div>
                <strong>~98%</strong>
                <span>Deliverability (goal)</span>
              </div>
              <div>
                <strong>~2x</strong>
                <span>More replies (beta est.)</span>
              </div>
            </div>
          </div>
          <div className="landing-proof-disclaimer">* All metrics are demo projections based on internal beta, not live production analytics. Replace with real data after launch.</div>
        </section>

        {/* Features */}
        <section id="features" className="landing-section">
          <div className="landing-section-inner">
            <div className="landing-section-header">
              <span className="landing-kicker">Features</span>
              <h2>Everything you need to win your next role</h2>
              <p>From visitor to customer to admin, Job Easy handles templates, approvals, and delivery so you focus on interviews.</p>
            </div>
            <div className="landing-features-grid">
              <div className="landing-feature-card">
                <div className="landing-feature-icon orange">
                  <UploadCloud size={22} />
                </div>
                <h3>CV & Template Manager</h3>
                <p>Upload PDF once, create tailored cover contexts. Customers get 2 personal templates — your promoted default stays yours.</p>
                <span className="landing-feature-link">
                  Create template <ArrowRight size={14} />
                </span>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-icon green">
                  <Send size={22} />
                </div>
                <h3>One-Click Email Send</h3>
                <p>Pick template, add HR email, send with CV attachment via Resend. Real-time validation and delivery feedback.</p>
                <span className="landing-feature-link">
                  Try sending <ArrowRight size={14} />
                </span>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-icon blue">
                  <Shield size={22} />
                </div>
                <h3>Role-Based Access</h3>
                <p>Visitor preview, customer send, admin approvals. JWT auth with refresh, per-tab session isolation.</p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-icon purple">
                  <Users size={22} />
                </div>
                <h3>Admin Control Center</h3>
                <p>Approve requests, manage users, promote personal CVs to platform defaults. Collapsible sidebar stays on rail.</p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-icon amber">
                  <FileText size={22} />
                </div>
                <h3>Default Templates</h3>
                <p>Curated defaults for guests and new users. Instant value even before you upload your own CV.</p>
              </div>
              <div className="landing-feature-card">
                <div className="landing-feature-icon slate">
                  <Zap size={22} />
                </div>
                <h3>Fast & Secure</h3>
                <p>FastAPI backend, rate-limited, CORS locked, encrypted API keys. PDF previews stream securely with auth.</p>
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
                <p>Drop your PDF, pick a role like Python Developer, write your tailored context. Stored encrypted per user.</p>
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
                <p>Visitors request access, configure email sender, admins approve in dashboard. 30s approval flow.</p>
                <button className="landing-step-cta" onClick={() => navigate("/app/request-access")}>
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
                <p>Choose your owned template, enter HR email, hit send. CV attaches automatically. Success toast confirms delivery.</p>
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
              <p>Guests see defaults. Customers see their own + defaults. Admins see all. Your promoted templates stay usable for you.</p>
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
                  <span>~1.2k uses (sample)</span>
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
                  <span>Promoted to default ✓ (demo)</span>
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
                  <span>2 of 2 used (demo counter)</span>
                  <Clock size={14} />
                </div>
              </div>
            </div>
            <p className="landing-demo-disclaimer centered">* Template usage counts are demo placeholders.</p>
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
              <p>Join early beta automating applications. Upload CV once, send forever. No spam, just interviews. All stats are demo estimates.</p>
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
              <span>
                <CheckCircle2 size={14} /> Free preview (demo modes noted)
              </span>
              <span>
                <CheckCircle2 size={14} /> Approval in &lt;24h (target)
              </span>
              <span>
                <CheckCircle2 size={14} /> Cancel anytime
              </span>
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
                <span>Automate job applications with smart templates and CV management. Demo metrics flagged.</span>
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
            <span>Demo data flagged with * — replace with live metrics after launch.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
