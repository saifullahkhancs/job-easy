import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  Briefcase,
  CalendarClock,
  Mail,
  Printer,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { LEGAL_DOCS, getLegalDoc } from "../legal";
import "./LegalPage.css";

const DEFAULT_DOC_TITLE = "JobEasy — Automate Your Job Applications";
// Offset that keeps a heading clear of the sticky bar when we jump to an anchor.
const SCROLL_OFFSET = 96;

/**
 * Public legal document page (Terms of Service, Privacy Policy).
 *
 * One renderer, one document per route: `doc` picks which content module from
 * src/legal to show. The copy itself lives in those modules so that legal text
 * can be edited without touching layout.
 */
export default function LegalPage({ doc = "terms" }) {
  const data = getLegalDoc(doc) || getLegalDoc("terms");
  const location = useLocation();
  const navigate = useNavigate();
  const articleRef = useRef(null);
  const [activeId, setActiveId] = useState(data.sections[0]?.id ?? "");

  // Keep the browser title/description in sync with the document being read.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${data.title} — Job Easy`;

    let meta = document.querySelector('meta[name="description"]');
    const hadMeta = !!meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    const previousDescription = meta.getAttribute("content") || "";
    meta.setAttribute("content", data.subtitle);

    return () => {
      document.title = previousTitle || DEFAULT_DOC_TITLE;
      if (hadMeta) meta.setAttribute("content", previousDescription);
    };
  }, [data]);

  // Deep links such as /privacy#your-rights should land on that section, even
  // on a fresh page load where the element mounts after this effect runs.
  useEffect(() => {
    const hash = decodeURIComponent(location.hash || "").replace(/^#/, "");
    if (!hash) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
        window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, data]);

  // Highlight the section currently being read in the table of contents.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const nodes = articleRef.current
        ? Array.from(articleRef.current.querySelectorAll("[data-legal-section]"))
        : [];
      if (nodes.length === 0) return;
      const line = window.scrollY + SCROLL_OFFSET + 8;
      let current = nodes[0].id;
      nodes.forEach((node) => {
        if (node.offsetTop <= line) current = node.id;
      });
      setActiveId((prev) => (prev === current ? prev : current));
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
  }, [data]);

  const goToSection = useCallback((event, id) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    setActiveId(id);
    if (window.history?.replaceState) window.history.replaceState(null, "", `#${id}`);
  }, []);

  // In-article links to other pages of the app (/terms, /privacy, /signup)
  // should use client-side routing instead of reloading the SPA.
  const handleArticleClick = useCallback(
    (event) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        anchor.target === "_blank" ||
        !href.startsWith("/")
      ) {
        return;
      }
      event.preventDefault();
      navigate(href);
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    [navigate]
  );

  const switchTo = (path) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div className="legal-root">
      <header className="legal-topbar">
        <div className="legal-topbar-inner">
          <Link to="/" className="legal-brand">
            <span className="legal-brand-mark">
              <Briefcase size={18} />
            </span>
            <span>Job Easy</span>
          </Link>
          <div className="legal-topbar-actions">
            <button type="button" className="legal-ghost-btn" onClick={() => window.print()}>
              <Printer size={16} />
              <span className="legal-btn-label">Print</span>
            </button>
            <button type="button" className="legal-ghost-btn" onClick={() => switchTo("/")}>
              <ArrowLeft size={16} />
              <span className="legal-btn-label">Back to site</span>
            </button>
          </div>
        </div>
      </header>

      <main className="legal-main">
        <section className="legal-hero">
          <div className="legal-hero-inner">
            <span className="legal-kicker">
              <Scale size={13} />
              {data.kicker}
            </span>
            <h1 className="legal-h1">{data.heading}</h1>
            <p className="legal-lede">{data.subtitle}</p>
            <div className="legal-hero-meta">
              <span className="legal-meta-item">
                <CalendarClock size={14} />
                Last updated {data.updated}
              </span>
              <span className="legal-meta-item">
                <ShieldCheck size={14} />
                {data.sections.length} sections · plain language first
              </span>
              <nav className="legal-switch" aria-label="Switch legal document">
                {LEGAL_DOCS.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={entry.key === data.key ? "is-active" : ""}
                    onClick={() => switchTo(entry.path)}
                    aria-current={entry.key === data.key ? "page" : undefined}
                  >
                    {entry.title}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </section>

        <div className="legal-body">
          <aside className="legal-aside" aria-label="On this page">
            <div className="legal-aside-inner">
              <h2 className="legal-aside-title">On this page</h2>
              <ol className="legal-toc">
                {data.sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={activeId === section.id ? "is-active" : ""}
                      aria-current={activeId === section.id ? "true" : undefined}
                      onClick={(event) => goToSection(event, section.id)}
                    >
                      <span className="legal-toc-number">{index + 1}</span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>

              <div className="legal-aside-card">
                <strong>
                  <Mail size={14} />
                  Talk to a human
                </strong>
                <p>
                  Privacy or terms questions, deletion requests, or complaints all go to the same
                  inbox — we answer from the address on your account.
                </p>
                <a href="mailto:info@jobeasy.online">info@jobeasy.online</a>
              </div>
            </div>
          </aside>

          <article className="legal-article" ref={articleRef} onClick={handleArticleClick}>
            {data.note ? (
              <p className="legal-note" role="note">
                <strong>Draft notice — </strong>
                {data.note}
              </p>
            ) : null}

            <div className="legal-sections" key={data.key}>
              {data.sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  data-legal-section
                  className="legal-section"
                  aria-labelledby={`${section.id}-title`}
                >
                  <h2 id={`${section.id}-title`} tabIndex={-1}>
                    <span className="legal-section-number">{index + 1}</span>
                    {section.title}
                  </h2>
                  <div className="legal-section-body">{section.body}</div>
                </section>
              ))}
            </div>

            <footer className="legal-article-footer">
              <div className="legal-related">
                <span>Read next</span>
                <button type="button" onClick={() => switchTo(data.related.path)}>
                  {data.related.label} <ArrowUp size={14} className="legal-arrow" />
                </button>
              </div>
              <p className="legal-stamp">
                Version effective {data.updated}. This version replaces any we showed you before.
              </p>
            </footer>
          </article>
        </div>
      </main>

      <footer className="legal-footer">
        <div className="legal-footer-inner">
          <span>© {new Date().getFullYear()} Job Easy · jobeasy.online</span>
          <nav className="legal-footer-links" aria-label="Legal links">
            {LEGAL_DOCS.map((entry) => (
              <a
                key={entry.key}
                href={entry.path}
                className={entry.key === data.key ? "is-active" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  switchTo(entry.path);
                }}
              >
                {entry.title}
              </a>
            ))}
            <a href="mailto:info@jobeasy.online">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
