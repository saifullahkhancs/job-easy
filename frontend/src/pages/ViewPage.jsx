import { useEffect, useState } from "react";
import { fetchCvBlobUrlV2, fetchTemplateV2, fetchTemplatesV2, getCvUrlV2, getCurrentUser } from "../api/client";
import { Lock } from "lucide-react";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ViewPage() {
  const [templates, setTemplates] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [cvPreviewUrl, setCvPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("access_token");
        if (token) {
          const user = await getCurrentUser();
          setCurrentUser(user);
        }
        
        // fetchTemplatesV2 already handles guest access (returns default templates for unauthenticated users)
        const items = await fetchTemplatesV2();
        setTemplates(items);
        
        if (items.length > 0) {
          setSelectedTemplateId(items[0].id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isGuest = !currentUser;

  useEffect(() => {
    if (!selectedTemplateId) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    fetchTemplateV2(selectedTemplateId)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setCvPreviewUrl("");
      return;
    }

    let active = true;
    let objectUrl = "";
    setError("");
    setCvLoading(true);

    fetchCvBlobUrlV2(selectedTemplateId)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setCvPreviewUrl(url);
      })
      .catch((err) => {
        if (active) setError("CV preview is not available for this template.");
      })
      .finally(() => {
        if (active) setCvLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedTemplateId]);

  if (loading) return <p className="muted">Loading templates...</p>;

  return (
    <section className="card" style={{ minHeight: 'auto', height: 'auto' }}>
      {isGuest && (
        <div className="visitor-banner" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <Lock size={24} className="banner-icon" />
          <div className="banner-content">
            <h3>Public Gallery</h3>
            <p>You are viewing default templates. Login to create your own templates.</p>
          </div>
        </div>
      )}
      <h2>View Templates</h2>
      <p className="muted">Browse stored job templates and preview CV details.</p>

      {templates.length === 0 ? (
        <p className="muted">No templates yet. Upload one first.</p>
      ) : (
        <div className="view-page-container">
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="template-select">Select Job Type</label>
            <div className="input-wrapper">
              <select id="template-select" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.template_role || 'Default'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {detailLoading && <p className="muted">Loading details...</p>}

          {detail && !detailLoading && (
            <div className="detail-vertical">
              <h3>Template Details</h3>
              
              <div className="detail-horizontal">
                <div className="detail-panel">
                  <dl className="detail-list">
                    <div>
                      <dt>Template Type</dt>
                      <dd>{detail.template_role || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt>CV Type</dt>
                      <dd>{detail.title || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt>Scope</dt>
                      <dd>{detail.template_scope || 'default'}</dd>
                    </div>
                    <div>
                      <dt>CV Filename</dt>
                      <dd>{detail.filename || 'N/A'}</dd>
                    </div>
                    {detail.file_size_bytes && (
                      <div>
                        <dt>File Size</dt>
                        <dd>{formatBytes(detail.file_size_bytes)}</dd>
                      </div>
                    )}
                    {detail.created_at && (
                      <div>
                        <dt>Created At</dt>
                        <dd>{new Date(detail.created_at).toLocaleDateString()}</dd>
                      </div>
                    )}
                    {detail.updated_at && (
                      <div>
                        <dt>Last Updated</dt>
                        <dd>{new Date(detail.updated_at).toLocaleDateString()}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="detail-panel">
                  <h4>Email Body</h4>
                  <pre className="context-preview">{detail.context}</pre>
                </div>
              </div>

              <div className="cv-preview-section">
                <h3>CV Preview</h3>
                {cvLoading && <p className="muted">Loading CV preview...</p>}
                {!cvLoading && cvPreviewUrl && (
                  <iframe
                    title={`CV preview for ${detail.template_role}`}
                    src={cvPreviewUrl}
                    className="cv-preview"
                  />
                )}
                <a 
                  className="link-button" 
                  href={getCvUrlV2(selectedTemplateId)} 
                  target="_blank" 
                  rel="noreferrer"
                >
                  Open CV in new tab
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
