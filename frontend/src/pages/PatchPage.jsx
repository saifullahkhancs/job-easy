import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchTemplateV2, fetchTemplatesV2, updateTemplateV2, updateTemplateCvV2, getCurrentUser } from "../api/client";
import { ShieldCheck, Check, Save, Lock } from "lucide-react";
import { getAccessToken } from "../api/tokenStorage";
import {
  getTemplateOptionLabel,
  isOwnedByUser,
  sortTemplatesForDisplay,
} from "../utils/templateDisplay";

function canEditTemplate(template, user) {
  if (!user) {
    return false;
  }
  if (user.role === "admin") {
    return true;
  }
  return user.role === "customer" && Boolean(template.is_mine || isOwnedByUser(template, user));
}

export default function PatchPage() {
  const [searchParams] = useSearchParams();
  const requestedTemplateId = searchParams.get("template");
  const [templates, setTemplates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [cvFile, setCvFile] = useState(null);
  const [updateTitle, setUpdateTitle] = useState(false);
  const [updateContext, setUpdateContext] = useState(false);
  const [updateCv, setUpdateCv] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = getAccessToken();
        let user = null;
        if (token) {
          user = await getCurrentUser();
          setCurrentUser(user);
        }

        const items = await fetchTemplatesV2();
        const editable = user
          ? items.filter((template) => canEditTemplate(template, user))
          : items;
        // Same order as every other picker: mine → defaults → other users'.
        const visibleTemplates = sortTemplatesForDisplay(editable, user);
        setTemplates(visibleTemplates);

        if (visibleTemplates.length > 0) {
          const requestedTemplate = visibleTemplates.find(
            (template) => String(template.id) === requestedTemplateId
          );
          setSelectedTemplateId(String(requestedTemplate?.id || visibleTemplates[0].id));
        } else {
          setSelectedTemplateId("");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [requestedTemplateId]);

  const isGuest = !currentUser;
  const isVisitor = currentUser?.role === "visitor";
  const isDisabled = isGuest || isVisitor;

  useEffect(() => {
    if (!selectedTemplateId) return;

    fetchTemplateV2(selectedTemplateId)
      .then((detail) => {
        setTitle(detail.title);
        setContext(detail.context);
        setCvFile(null);
      })
      .catch((err) => setError(err.message));
  }, [selectedTemplateId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!selectedTemplateId) {
      setError("Choose a template to update.");
      return;
    }

    if (!updateTitle && !updateContext && !updateCv) {
      setError("Select at least one field to update.");
      return;
    }

    if (updateCv && !cvFile) {
      setError("Choose a PDF file to update the CV.");
      return;
    }

    setSubmitting(true);
    try {
      let updated_fields = [];
      if (updateTitle || updateContext) {
        const updateData = {};
        if (updateTitle) {
          updateData.title = title;
          updated_fields.push("title");
        }
        if (updateContext) {
          updateData.context = context;
          updated_fields.push("context");
        }
        await updateTemplateV2(selectedTemplateId, updateData);
      }
      if (updateCv && cvFile) {
        await updateTemplateCvV2(selectedTemplateId, cvFile);
        updated_fields.push("CV");
      }
      setMessage(`Template updated successfully. Updated: ${updated_fields.join(", ")}`);
      setUpdateTitle(false);
      setUpdateContext(false);
      setUpdateCv(false);
      setCvFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading templates...</p>;

  return (
    <div className="page-container">
      {(isGuest || isVisitor) && (
        <div className="visitor-banner">
          <Lock size={24} className="banner-icon" />
          <div className="banner-content">
            <h3>{isGuest ? "Preview Mode" : "Visitor Mode"}</h3>
            <p>{isGuest ? "You need to log in to update templates." : "Your account is in Visitor mode. You need approval from an admin to update templates."}</p>
          </div>
        </div>
      )}
      <section className="card" style={{ minHeight: 'auto', height: 'auto' }}>
      <div className="page-header">
        <div>
          <h2>Update Template</h2>
          <p className="muted">Patch only the fields you need — subject, email body, or CV.</p>
        </div>
        <button type="button" className="header-action" disabled={isDisabled} title={isDisabled ? "Login to use it" : ""} style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fef08a', opacity: isDisabled ? 0.5 : 1 }}>
          <ShieldCheck size={16} />
          Safe patch mode
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="muted">No editable templates available.</p>
      ) : (
        <div className="form-page-layout">
          <div className="form-main-panel">
            <form className="form" onSubmit={handleSubmit}>
            <label>
              Template
              <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} disabled={false}>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {getTemplateOptionLabel(template, currentUser)}
                  </option>
                ))}
              </select>
              <p className="input-hint">Role type · ownership. Your templates are listed first.</p>
            </label>

            <div className="patch-options-group">
              <label className={`patch-option-card ${updateTitle ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.checked)}
                />
                Subject
              </label>
              
              <label className={`patch-option-card ${updateContext ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={updateContext}
                  onChange={(e) => setUpdateContext(e.target.checked)}
                />
                Email Body
              </label>

              <label className={`patch-option-card ${updateCv ? 'active' : ''}`}>
                <input type="checkbox" checked={updateCv} onChange={(e) => setUpdateCv(e.target.checked)} />
                CV File
              </label>
            </div>

            <label>
              Email Subject
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!isDisabled && !updateTitle}
              />
            </label>

            <label>
              Email Body
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={8}
                disabled={!isDisabled && !updateContext}
              />
            </label>

            <label>
              New CV File
              <input
                type="file"
                accept="application/pdf"
                disabled={!isDisabled && !updateCv}
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
              />
            </label>

            <button type="submit" disabled={submitting || isDisabled || !selectedTemplateId} title={isDisabled ? "Login to use it" : ""} style={{ marginTop: '16px' }}>
              <Save size={18} />
              {submitting ? "Saving..." : "Save Changes"}
            </button>
            </form>
          </div>

          <div className="form-side-panel">
            <div className="dark-preview-card patch-summary" style={{ height: 'auto' }}>
            <div className="dark-preview-header" style={{ marginBottom: '12px' }}>
              <span style={{ color: '#fff', fontSize: '1.1rem' }}>Patch summary</span>
            </div>
            
            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
              {updateTitle && <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1', marginBottom: '8px' }}><Check size={16} color="#10b981" /> Subject will be updated</div>}
              {updateContext && <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1', marginBottom: '8px' }}><Check size={16} color="#10b981" /> Email body will be updated</div>}
              {updateCv && <div style={{ display: 'flex', gap: '8px', color: '#cbd5e1', marginBottom: '8px' }}><Check size={16} color="#10b981" /> CV file will be updated</div>}
              {!updateTitle && !updateContext && !updateCv && <div style={{ color: '#64748b' }}>No fields selected for update.</div>}
            </div>

            <div className="dark-preview-content" style={{ fontSize: '0.85rem', marginBottom: '24px' }}>
              Disabled fields stay untouched, so you can safely make targeted edits without accidentally replacing the stored subject or CV.
            </div>

            <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.05em', marginBottom: '4px' }}>CURRENT TEMPLATE</div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{templates.find(t => String(t.id) === String(selectedTemplateId))?.title || "No template selected"}</div>
            </div>
            </div>
          </div>
        </div>
      )}

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}