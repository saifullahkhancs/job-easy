import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Eye,
  Send,
  Lock,
  AlertCircle,
  FileText,
  FilePlus,
  LayoutTemplate,
  Sparkles,
  Star,
  ArrowRight,
  Trophy,
  Pencil,
} from "lucide-react";
import { getCurrentUser, fetchTemplatesV2 } from "../api/client";
import { RoleBadge, ApprovalStatusBadge } from "../components/RoleBadge";
import { ROLES } from "../components/RoleGuard";

const TEMPLATE_LIMIT_FALLBACK = 2;

/**
 * The three navigation cards shown at the top of the Templates page.
 * They exist so a new user immediately understands where to go next.
 */
const QUICK_CARDS = [
  {
    key: "create",
    to: "/app/new",
    accent: "create",
    icon: FilePlus,
    badgeIcon: Plus,
    title: "Add a Template",
    description: "Upload a CV, write your email body and save it as a reusable template.",
    cta: "Create template",
  },
  {
    key: "view",
    to: "/app/view",
    accent: "view",
    icon: LayoutTemplate,
    badgeIcon: Eye,
    title: "Browse Templates",
    description: "Preview every template you own along with its attached CV.",
    cta: "View templates",
  },
  {
    key: "send",
    to: "/app/send",
    accent: "send",
    icon: Send,
    badgeIcon: Send,
    title: "Send an Application",
    description: "Pick a template and fire off a job application in one click.",
    cta: "Send email",
  },
];

const templateRoute = (page, templateId) =>
  `/app/${page}?template=${encodeURIComponent(templateId)}`;

/**
 * @param {object} props
 * @param {boolean} [props.disabled]      Disable every card (guest / visitor).
 * @param {string[]} [props.disabledKeys] Disable only specific cards by key.
 * @param {string} [props.disabledReason] Tooltip + label shown on disabled cards.
 */
function QuickActionCards({ disabled = false, disabledKeys = [], disabledReason, onNavigate }) {
  return (
    <div className="quick-cards-grid">
      {QUICK_CARDS.map((card) => {
        const Icon = card.icon;
        const BadgeIcon = card.badgeIcon;
        const isDisabled = disabled || disabledKeys.includes(card.key);
        return (
          <button
            type="button"
            key={card.key}
            className={`quick-card quick-card-${card.accent}${isDisabled ? " disabled" : ""}`}
            onClick={() => !isDisabled && onNavigate(card.to)}
            disabled={isDisabled}
            title={isDisabled ? disabledReason : card.cta}
          >
            <span className="quick-card-icon">
              <Icon size={26} />
              <span className="quick-card-icon-badge">
                {isDisabled ? <Lock size={12} /> : <BadgeIcon size={12} />}
              </span>
            </span>
            <span className="quick-card-body">
              <span className="quick-card-title">{card.title}</span>
              <span className="quick-card-description">{card.description}</span>
            </span>
            <span className="quick-card-cta">
              {isDisabled ? disabledReason : card.cta}
              {!isDisabled && <ArrowRight size={15} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TemplateActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      className="template-action-btn"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function TemplateCard({ template, badge, className = "", canEdit = false, canSend = false, onView, onEdit, onSend }) {
  return (
    <div className={`template-card ${className}`.trim()}>
      <div className="template-header">
        <h3>{template.title}</h3>
        {badge}
      </div>
      <p className="template-context">{template.context}</p>
      <div className="template-footer">
        <TemplateActionButton icon={Eye} label="View" onClick={() => onView(template.id)} />
        {canEdit && <TemplateActionButton icon={Pencil} label="Edit" onClick={() => onEdit(template.id)} />}
        {canSend && <TemplateActionButton icon={Send} label="Send" onClick={() => onSend(template.id)} />}
      </div>
    </div>
  );
}

function ReadOnlyTemplateCard({ template, onView }) {
  return (
    <TemplateCard
      template={template}
      className="visitor-card"
      badge={<span className="template-badge default">Default</span>}
      onView={onView}
    />
  );
}

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("access_token");

      // Fetch templates (works for guests too)
      const templatesData = await fetchTemplatesV2();
      setTemplates(Array.isArray(templatesData) ? templatesData : []);

      // Fetch user only if logged in
      if (token) {
        try {
          const user = await getCurrentUser();
          setCurrentUser(user);
        } catch {
          setCurrentUser(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError(err.message || "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  };

  const isGuest = !currentUser;
  const isVisitor = currentUser?.role === ROLES.VISITOR;
  const isCustomer = currentUser?.role === ROLES.CUSTOMER;
  const isAdmin = currentUser?.role === ROLES.ADMIN;

  const handleViewTemplate = (templateId) => navigate(templateRoute("view", templateId));
  const handleCreateTemplate = () => navigate("/app/new");
  const handleEditTemplate = (templateId) => navigate(templateRoute("update", templateId));
  const handleSendEmail = (templateId) => {
    if (templateId) {
      navigate(templateRoute("send", templateId));
      return;
    }
    navigate("/app/send");
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  // ── Guest / Visitor: same read-only gallery, different copy ───────────────
  if (isGuest || isVisitor) {
    const disabledReason = isGuest ? "Login to continue" : "Awaiting admin approval";

    return (
      <div className="page-container page-container-full-width">
        <div className="visitor-banner">
          <Lock size={24} className="banner-icon" />
          <div className="banner-content">
            <h3>{isGuest ? "Preview Mode" : "Visitor Mode"}</h3>
            <p>
              {isGuest
                ? "You are browsing the public template gallery. Log in or register to create and send your own templates."
                : "Your account is in Visitor mode. An admin needs to approve you before you can create templates."}
            </p>
          </div>
          <button
            className="primary-btn"
            onClick={() => navigate(isGuest ? "/login" : "/app/request-access")}
          >
            {isGuest ? "Login" : "Request Access"}
            <ArrowRight size={18} className="btn-icon" />
          </button>
        </div>

        <div className="page-header">
          <div>
            <h1>Templates</h1>
            <p className="page-subtitle">
              Everything you can do with templates lives here — start with one of the cards below.
            </p>
          </div>
          {!isGuest && (
            <div className="header-badges">
              <RoleBadge role={currentUser.role} />
              <ApprovalStatusBadge status={currentUser.approval_status} />
            </div>
          )}
        </div>

        <QuickActionCards disabled disabledReason={disabledReason} onNavigate={navigate} />

        <div className="section-header">
          <div>
            <h2>Template Gallery</h2>
            <p className="section-description">Default templates published by the Job Easy team.</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {templates.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} className="empty-icon" />
            <h3>No Templates Available</h3>
            <p>Default templates will appear here once added by the admin.</p>
          </div>
        ) : (
          <div className="templates-grid">
            {templates.map((template) => (
              <ReadOnlyTemplateCard
                key={template.id}
                template={template}
                onView={handleViewTemplate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div className="page-container page-container-full-width">
        <div className="page-header">
          <div>
            <h1>Templates</h1>
            <p className="page-subtitle">You are signed in as an administrator.</p>
          </div>
          <div className="header-badges">
            <RoleBadge role={currentUser.role} />
          </div>
        </div>

        <div className="info-banner">
          <AlertCircle size={20} className="banner-icon" />
          <div>
            <h3>Admin Access</h3>
            <p>Use the Admin Panel to manage default templates, users and approval requests.</p>
          </div>
        </div>

        <QuickActionCards onNavigate={navigate} />

        <div className="section-header">
          <div>
            <h2>All Templates ({templates.length})</h2>
            <p className="section-description">Every template stored on the platform.</p>
          </div>
          <button className="primary-btn" onClick={() => navigate("/admin/default-templates")}>
            Manage Defaults
            <ArrowRight size={18} className="btn-icon" />
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} className="empty-icon" />
            <h3>No Templates Yet</h3>
            <p>Templates created by customers will show up here.</p>
          </div>
        ) : (
          <div className="templates-grid">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                badge={(
                  <span className={`template-badge ${template.template_scope === "default" ? "default" : "personal"}`}>
                    {template.template_scope === "default" ? "Default" : "Customer"}
                  </span>
                )}
                onView={handleViewTemplate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Customer ──────────────────────────────────────────────────────────────
  if (isCustomer) {
    const personalTemplates = templates.filter((t) => t.template_scope === "customer");
    const defaultTemplates = templates.filter((t) => t.template_scope === "default");

    // Default templates that this customer originally authored. These still
    // count as their templates — they were simply picked by an admin as a showcase.
    // Use both `is_mine` flag and direct email match as fallback so promoted
    // templates are never mistaken for foreign defaults.
    const myPromotedTemplates = defaultTemplates.filter(
      (t) => t.is_mine || (currentUser?.email && t.user_email === currentUser.email)
    );
    const otherDefaultTemplates = defaultTemplates.filter(
      (t) => !myPromotedTemplates.some((m) => m.id === t.id)
    );

    const templateLimit = currentUser.template_limit || TEMPLATE_LIMIT_FALLBACK;
    const authoredTemplateCount = personalTemplates.length + myPromotedTemplates.length;
    const usedSlots = currentUser.current_template_count ?? authoredTemplateCount;
    const remainingSlots = Math.max(templateLimit - usedSlots, 0);
    const hasPromoted = myPromotedTemplates.length > 0;
    const allAuthoredTemplatesPromoted = hasPromoted && personalTemplates.length === 0;
    // The single source of truth for \"can create more\" is the remaining allowance.
    // When all authored templates are promoted, remainingSlots is usually 0/2,
    // which correctly blocks creation as required by the spec.
    const canCreateMore = remainingSlots > 0;

    const promotedNoun = myPromotedTemplates.length === 1 ? "CV" : "CVs";
    const promotedVerb = myPromotedTemplates.length === 1 ? "was" : "were";
    const promotedTemplatePhrase = myPromotedTemplates.length === 1 ? "a default template" : "default templates";
    const promotedPronoun = myPromotedTemplates.length === 1 ? "It is" : "They are";

    return (
      <div className="page-container page-container-full-width">
        <div className="page-header">
          <div>
            <h1>My Templates</h1>
            <p className="page-subtitle">
              Create, preview and send your job application templates.
            </p>
          </div>
          <div className="header-badges">
            <RoleBadge role={currentUser.role} />
            <ApprovalStatusBadge status={currentUser.approval_status} />
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <QuickActionCards
          disabledKeys={canCreateMore ? [] : ["create"]}
          disabledReason="Template limit reached"
          onNavigate={navigate}
        />

        {/* Congratulations banner — one or more of this customer's CVs was
            picked as a platform default. */}
        {hasPromoted && (
          <div className="congrats-banner">
            <div className="congrats-icon">
              <Trophy size={26} />
            </div>
            <div className="congrats-content">
              <h3>
                Congratulations! Your {promotedNoun} {promotedVerb} selected as {promotedTemplatePhrase}
              </h3>
              <p>
                {promotedPronoun} now live for every visitor on Job Easy. Promoted defaults still
                count toward your {templateLimit}-template allowance.
              </p>
              <p className="congrats-allowance-note">
                {remainingSlots === 0
                  ? "Your template allowance is used up. Update an existing template or ask an admin before creating another."
                  : `You can still add ${remainingSlots} more template${remainingSlots === 1 ? "" : "s"}.`}
              </p>
              <div className="congrats-chips">
                {myPromotedTemplates.map((t) => (
                  <span key={t.id} className="congrats-chip">
                    <Star size={13} fill="currentColor" />
                    {t.title}
                  </span>
                ))}
              </div>
            </div>
            {canCreateMore && (
              <button className="primary-btn" onClick={handleCreateTemplate}>
                <Plus size={18} className="btn-icon" />
                Add Another
              </button>
            )}
          </div>
        )}

        {/* Personal Templates */}
        <div className="section-header">
          <div>
            <h2>
              Personal Templates ({usedSlots}/{templateLimit})
            </h2>
            <p className="section-description">
              Templates you authored. Promoted defaults continue to use your allowance.
            </p>
          </div>
          {canCreateMore && (
            <button className="primary-btn" onClick={handleCreateTemplate}>
              <Plus size={20} className="btn-icon" />
              Create Template
            </button>
          )}
        </div>

        {personalTemplates.length === 0 ? (
          <div className="empty-state customer-empty">
            <Sparkles size={48} className="empty-icon" />
            {hasPromoted ? (
              <>
                <h3>
                  Congrats! Your email selected as default. It is now on the website and visitor can see them.
                </h3>
                {myPromotedTemplates.length >= templateLimit || remainingSlots === 0 ? (
                  <p>
                    Both of your templates have been assigned to default status by the admin, so you cannot create any more templates.
                  </p>
                ) : (
                  <p>
                    Your {promotedNoun.toLowerCase()} {promotedVerb} promoted to the public gallery and visitor can see them.
                    You {remainingSlots === 1 ? "can still create 1 more template" : `can still create ${remainingSlots} more templates`}.
                  </p>
                )}
              </>
            ) : (
              <>
                <h3>Your account is approved. No personal templates yet.</h3>
                <p>Create your first template to get started with email automation.</p>
              </>
            )}
            {canCreateMore && (
              <button className="primary-btn" onClick={handleCreateTemplate}>
                <Plus size={20} className="btn-icon" />
                {hasPromoted ? "Create Another Template" : "Create Your First Template"}
              </button>
            )}
          </div>
        ) : (
          <div className="templates-grid">
            {personalTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                badge={<span className="template-badge personal">Personal</span>}
                canEdit
                canSend
                onView={handleViewTemplate}
                onEdit={handleEditTemplate}
                onSend={handleSendEmail}
              />
            ))}
          </div>
        )}

        {/* This customer's promoted templates - ALWAYS usable */}
        {hasPromoted && (
          <>
            <div className="section-header">
              <div>
                <h2>Selected as Default ({myPromotedTemplates.length})</h2>
                <p className="section-description">
                  Your templates that the admin promoted to the public gallery. You can still view, edit and send with them.
                </p>
              </div>
            </div>
            <div className="templates-grid">
              {myPromotedTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  className="promoted-card"
                  badge={(
                    <span className="template-badge promoted">
                      <Star size={12} fill="currentColor" /> Default · Yours
                    </span>
                  )}
                  canEdit
                  canSend
                  onView={handleViewTemplate}
                  onEdit={handleEditTemplate}
                  onSend={handleSendEmail}
                />
              ))}
            </div>
          </>
        )}

        {/* Default templates from other authors */}
        {otherDefaultTemplates.length > 0 && (
          <>
            <div className="section-header">
              <div>
                <h2>Default Templates</h2>
                <p className="section-description">
                  System templates provided by the admin (read-only).
                </p>
              </div>
            </div>
            <div className="templates-grid">
              {otherDefaultTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  className="default-card"
                  badge={<span className="template-badge default">Default</span>}
                  onView={handleViewTemplate}
                />
              ))}
            </div>
          </>
        )}

        {!canCreateMore && (
          <div className="limit-warning">
            <AlertCircle size={20} className="warning-icon" />
            <p>
              You've reached your maximum of {templateLimit} authored templates. Promoted default
              templates count toward this allowance.
            </p>
          </div>
        )}

        {allAuthoredTemplatesPromoted && (
          <div className="info-banner">
            <Trophy size={20} className="banner-icon" />
            <div>
              <h3>Your templates are live publicly</h3>
              <p>
                Every template you authored is currently showcased as a default template for visitors. You can still use them to send emails.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="error-state">Unable to determine user role</div>
    </div>
  );
}
