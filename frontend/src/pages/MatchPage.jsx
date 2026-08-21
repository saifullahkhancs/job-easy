import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Lock,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { getCurrentUser, matchJobDescription } from "../api/client";
import { getAccessToken } from "../api/tokenStorage";

// Mirrors the backend's AI_MATCH_MIN_CHARS / AI_MATCH_MAX_CHARS. The backend
// re-validates these server-side; these values only drive the UI affordances.
const MIN_CHARS = 120;
const MAX_CHARS = 12000;

function scoreTone(score) {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function ScoreBadge({ score }) {
  return (
    <span className={`match-score match-score-${scoreTone(score)}`}>
      <span className="match-score-value">{score}</span>
      <span className="match-score-label">/100</span>
    </span>
  );
}

export default function MatchPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [detectedEmail, setDetectedEmail] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setCurrentUser(null);
      return;
    }
    getCurrentUser()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  const isGuest = !currentUser;
  const charCount = jobDescription.length;
  const canSubmit = jobDescription.trim().length >= MIN_CHARS && !loading && !isGuest;

  // The single highest-scoring template — the backend already returns the
  // ranked list sorted by score, so the top match is just the first item.
  const topMatch = result?.matches?.length ? result.matches[0] : null;
  const trimmedRecipient = detectedEmail.trim();

  function buildSendLink(templateId) {
    const params = new URLSearchParams({ template: String(templateId) });
    if (trimmedRecipient) params.set("recipient", trimmedRecipient);
    return `/app/send?${params.toString()}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    // Guard duplicate submissions: one in-flight AI call at a time.
    if (loading || isGuest) return;
    if (jobDescription.trim().length < MIN_CHARS) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await matchJobDescription(jobDescription);
      setResult(data);
      setDetectedEmail(data.contact_email || "");
    } catch (err) {
      setError({ code: err.code || "unknown", message: err.message || "Something went wrong." });
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    setError(null);
    setResult(null);
  }

  return (
    <div className="page-container page-container-full-width">
      {isGuest && (
        <div className="visitor-banner">
          <Lock size={24} className="banner-icon" />
          <div className="banner-content">
            <h3>Preview Mode</h3>
            <p>Log in to match your saved templates against a job description.</p>
          </div>
          <button className="primary-btn" onClick={() => navigate("/login")}>
            Login
            <ArrowRight size={18} className="btn-icon" />
          </button>
        </div>
      )}

      <section className="card" style={{ minHeight: "auto", height: "auto" }}>
        <div className="page-accent-header accent-match">
          <div>
            <h2>Match Template</h2>
            <p>Paste a job description — we'll rank your templates and find the recruiter's email.</p>
          </div>
          <div className="page-accent-badge">
            <Sparkles size={22} />
          </div>
        </div>

        {!loading && !result && !error && (
          <div className="form-page-layout">
            <div className="form-main-panel">
              <form className="form" onSubmit={handleSubmit}>
                <label>
                  Job Description
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the full job description here — responsibilities, required skills, and any contact or application email…"
                    rows={12}
                    maxLength={MAX_CHARS}
                    disabled={isGuest || loading}
                  />
                </label>

                <div className="char-hint">
                  <span className={charCount >= MIN_CHARS ? "char-hint-ok" : ""}>
                    {charCount < MIN_CHARS
                      ? `${MIN_CHARS - charCount} more characters needed`
                      : "Ready to analyse"}
                  </span>
                  <span className="muted">
                    {charCount} / {MAX_CHARS} characters
                  </span>
                </div>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={!canSubmit}
                  title={isGuest ? "Login to use it" : jobDescription.trim().length < MIN_CHARS ? `Paste at least ${MIN_CHARS} characters` : ""}
                >
                  <Sparkles size={18} />
                  {loading ? "Analysing…" : "Match My Templates"}
                </button>
              </form>
            </div>

            <div className="form-side-panel">
              <div className="fact-card">
                <div className="fact-card-header">
                  <Sparkles size={16} />
                  How matching works
                </div>
                <ul className="fact-list">
                  <li>Every CV you own is scored 0–100 against the job description.</li>
                  <li>We also pull out the recruiter's contact email if the posting lists one.</li>
                  <li>One analysis per submission keeps us inside our shared free AI allowance.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading state ─────────────────────────────────────────────── */}
        {loading && (
          <div className="matcher-state-card matcher-loading">
            <div className="matcher-state-icon matcher-state-icon-spin">
              <RefreshCw size={26} className="spinning" />
            </div>
            <h3>Analysing your job description…</h3>
            <p>
              We're comparing it against your templates and scanning for a contact email.
              This is a live AI call, so it can take a few seconds.
            </p>
          </div>
        )}

        {/* ── Daily quota reached ────────────────────────────────────────── */}
        {!loading && error?.code === "daily_limit_reached" && (
          <div className="matcher-state-card matcher-state-quota">
            <div className="matcher-state-icon">
              <Lock size={26} />
            </div>
            <h3>Daily AI limit reached</h3>
            <p>{error.message}</p>
            <p className="muted">
              The limit protects our shared free-tier allowance. You can keep sending
              emails with your templates in the meantime.
            </p>
            <div className="action-buttons centered">
              <button type="button" className="secondary-btn" onClick={() => navigate("/app/send")}>
                <Send size={18} />
                Go to Send Email
              </button>
            </div>
          </div>
        )}

        {/* ── AI temporarily at capacity / unavailable ───────────────────── */}
        {!loading && error?.code === "ai_unavailable" && (
          <div className="matcher-state-card matcher-state-capacity">
            <div className="matcher-state-icon">
              <AlertTriangle size={26} />
            </div>
            <h3>AI is temporarily unavailable</h3>
            <p>{error.message}</p>
            <div className="action-buttons centered">
              <button type="button" className="secondary-btn" onClick={handleRetry}>
                <RefreshCw size={18} />
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* ── Generic failure ────────────────────────────────────────────── */}
        {!loading && error && error.code !== "daily_limit_reached" && error.code !== "ai_unavailable" && (
          <div className="matcher-state-card matcher-state-error">
            <div className="matcher-state-icon">
              <AlertTriangle size={26} />
            </div>
            <h3>Something went wrong</h3>
            <p>{error.message}</p>
            <div className="action-buttons centered">
              <button type="button" className="secondary-btn" onClick={handleRetry}>
                <RefreshCw size={18} />
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* ── No templates to score ──────────────────────────────────────── */}
        {!loading && !error && result && result.matches.length === 0 && (
          <div className="empty-state">
            <Sparkles size={48} className="empty-icon" />
            <h3>No Templates to Match Yet</h3>
            <p>Create a template first, then come back to score it against job descriptions.</p>
            <button className="primary-btn" onClick={() => navigate("/app/new")} style={{ marginTop: "16px" }}>
              Create Your First Template
              <ArrowRight size={18} className="btn-icon" />
            </button>
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────────────── */}
        {!loading && !error && result && result.matches.length > 0 && (
          <div className="match-results">
            <div className="match-results-header">
              <div>
                <h3>Template Rankings</h3>
                <p className="muted">Highest match first — use any template in the send flow.</p>
              </div>
              <span className="quota-left">
                {result.remaining_today} of {result.daily_limit} AI matches left today
              </span>
            </div>

            {detectedEmail && topMatch && (
              <div className="contact-email-card">
                <div className="contact-email-label">
                  <Mail size={18} />
                  <span>Detected contact email</span>
                </div>
                <div className="contact-email-controls">
                  <input
                    type="email"
                    value={detectedEmail}
                    onChange={(e) => setDetectedEmail(e.target.value)}
                    aria-label="Detected contact email"
                  />
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setDetectedEmail("")}
                    title="Clear detected email"
                  >
                    <X size={16} />
                    Clear
                  </button>
                </div>
                <div className="contact-email-cta">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => navigate(buildSendLink(topMatch.template_id))}
                  >
                    <Send size={18} />
                    Send with top match
                  </button>
                  <span className="contact-email-cta-hint">
                    Opens the send page with “{topMatch.title}”
                    {trimmedRecipient ? ` and ${trimmedRecipient}` : ""} already filled in —
                    you still review before sending.
                  </span>
                </div>
              </div>
            )}

            <div className="match-cards">
              {result.matches.map((match, index) => (
                <div className="match-card" key={match.template_id}>
                  <span className="match-card-rank">{index + 1}</span>
                  <div className="match-card-main">
                    <div className="match-card-title-row">
                      <h4>{match.title}</h4>
                      <ScoreBadge score={match.score} />
                    </div>
                    <div className="match-card-meta">
                      <span className="match-card-role">{match.template_role}</span>
                      <span className="match-card-ownership">{match.ownership_label}</span>
                    </div>
                    <p className="match-reason">{match.reason}</p>
                  </div>
                  <div className="match-card-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => navigate(buildSendLink(match.template_id))}
                    >
                      <Send size={16} />
                      Use this template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
