import { useState, useCallback, useEffect, useRef } from "react";
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
  Menu,
  X,
} from "lucide-react";
import { getCurrentUser, logout } from "../api/client";
import { getAccessToken } from "../api/tokenStorage";
import MainSidebar from "../components/MainSidebar";
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
  const [currentUser, setCurrentUser] = useState(null);
  const isLoggedIn = !!getAccessToken();
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < MOBILE_BREAKPOINT ? false : readSidebarPref();
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setCurrentUser(null);
      return;
    }

    getCurrentUser()
      .then(setCurrentUser)
      .catch(() => {
        logout();
        setCurrentUser(null);
      });
  }, []);

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

  // Enable scroll-reveal animations. We only hide/reveal elements while JS is
  // running (via the .js-anim marker), so all content stays visible if JS is off.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.documentElement.classList.add("js-anim");

    const targets = Array.from(document.querySelectorAll('[data-reveal="scroll"]'));
    if (!("IntersectionObserver" in window) || targets.length === 0) {
      targets.forEach((el) => el.classList.add("revealed"));
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!isMobile || !sidebarOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const lock = isMobile && sidebarOpen;
    document.body.style.overflow = lock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((p) => {
      const n = !p;
      if (!isMobile) {
        try { localStorage.setItem(SIDEBAR_KEY, String(n)); } catch {}
      }
      return n;
    });
  }, [isMobile]);

  // Drive the thin reading-progress bar at the top of the landing page.
  // Purely decorative — it never hides or alters any content.
  const progressRef = useRef(null);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const top = window.scrollY || doc.scrollTop || 0;
      const height = doc.scrollHeight - doc.clientHeight;
      const ratio = height > 0 ? Math.min(1, Math.max(0, top / height)) : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${ratio})`;
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    navigate("/app/templates", { replace: true });
  };

  const isCollapsed = !isMobile && !sidebarOpen;
  const isDrawerOpen = isMobile && sidebarOpen;

  const landingRootClass = [
    "landing-root",
    "app-layout",
    isCollapsed ? "sidebar-collapsed" : "",
    isDrawerOpen ? "sidebar-drawer-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={landingRootClass}>
      {/* Thin reading-progress bar (decorative) */}
      <div className="landing-scroll-progress" ref={progressRef} aria-hidden="true" />

      {/* Topbar for mobile drawer open button */}
      <header className="landing-topbar">
        <button
          type="button"
          className="landing-sidebar-toggle-btn"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={sidebarOpen}
          aria-controls="landing-main-sidebar"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="landing-topbar-brand" onClick={() => navigate("/")}>
          <div className="landing-logo-mark small">
            <Briefcase size={18} />
          </div>
          <span>Job Easy</span>
        </div>
      </header>

      {/* Backdrop for mobile */}
      <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <MainSidebar
        id="landing-main-sidebar"
        currentUser={currentUser}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        onLogout={handleLogout}
      />

      {/* Main landing content */}
      <div className="landing-main">
        <header className="landing-header landing-main-navbar">
          <div className="landing-header-inner landing-header-inner-left">
            <nav className="landing-nav landing-nav-left" aria-label="Landing page sections">
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="#templates">Templates</a>
            </nav>
            <div className="landing-header-actions landing-header-actions-left">
              <button className="landing-ghost-btn" onClick={() => navigate("/app/templates")}>
                <LayoutGrid size={16} />
                App
              </button>
              <button className="landing-primary-btn" onClick={() => navigate("/admin/dashboard")}>
                <Shield size={16} />
                Dashboard
              </button>
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
              <div className="landing-badge" data-reveal="hero">
                <Sparkles size={14} />
                <span>Trusted in early beta</span>
                <span className="landing-badge-dot" />
                <span className="landing-badge-new">Auto-send with CV attachment</span>
              </div>

              <h1 className="landing-h1" data-reveal="hero">
                Automate your <span className="landing-h1-gradient">job applications</span> in seconds, not hours
              </h1>

              <p className="landing-hero-sub" data-reveal="hero">
                Upload your CV once, create smart templates, and send tailored applications with attachments — tracked, managed, and approved. Built for visitors, customers, and hiring teams.
              </p>

              <div className="landing-hero-ctas" data-reveal="hero">
                <button className="landing-cta-primary" onClick={() => navigate(isLoggedIn ? "/app/templates" : "/signup")}>
                  <Zap size={18} />
                  Start Sending Emails
                </button>
                <button className="landing-cta-secondary" onClick={() => navigate("/app/templates")}>
                  <Play size={16} />
                  View Templates
                </button>
              </div>

              <div className="landing-trust" data-reveal="hero">
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
            </div>

            <div className="landing-mock-card mock-card-float">
              <Clock size={16} />
              <span>
                Fast delivery via Resend • typically seconds
              </span>
            </div>
          </div>
        </section>

        {/* Social proof bar */}
        <section className="landing-proof" data-reveal="scroll">
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
        </section>

        {/* Features */}
        <section id="features" className="landing-section">
          <div className="landing-section-inner">
            <div className="landing-section-header" data-reveal="scroll">
              <span className="landing-kicker">Features</span>
              <h2>Everything you need to win your next role</h2>
              <p>From visitor to customer to admin, Job Easy handles templates, approvals, and delivery so you focus on interviews.</p>
            </div>
            <div className="landing-features-grid" data-reveal="scroll">
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
            <div className="landing-section-header" data-reveal="scroll">
              <span className="landing-kicker">How it works</span>
              <h2>From zero to sent in 3 steps</h2>
            </div>
            <div className="landing-steps" data-reveal="scroll">
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
            <div className="landing-section-header" data-reveal="scroll">
              <span className="landing-kicker">Templates</span>
              <h2>Built for every role</h2>
              <p>Guests see defaults. Customers see their own + defaults. Admins see all. Your promoted templates stay usable for you.</p>
            </div>
            <div className="landing-templates-grid" data-reveal="scroll">
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
          <div className="landing-cta-inner" data-reveal="scroll">
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
          <div className="landing-footer-inner" data-reveal="scroll">
            <div className="landing-footer-brand">
              <div className="landing-logo-mark">
                <Briefcase size={18} />
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
