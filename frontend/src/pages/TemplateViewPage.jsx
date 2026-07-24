import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LayoutTemplate } from "lucide-react";
import { fetchCvBlobUrlV2, fetchTemplateV2, fetchTemplatesV2, getCvUrlV2 } from "../api/client";

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TemplateViewPage() {
  const { id } = useParams();

  const isLoggedIn = !!localStorage.getItem("access_token");

  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(id || "");
  const [detail, setDetail] = useState(null);
  const [cvPreviewUrl, setCvPreviewUrl] = useState("");
  const [cvOpenUrl, setCvOpenUrl] = useState("");

  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [error, setError] = useState("");

  // Load all templates for the dropdown (works for guests — returns default templates)
  useEffect(() => {
    fetchTemplatesV2()
      .then((items) => {
        setTemplates(items);
        if (!id && items.length > 0) {
          setSelectedId(String(items[0].id));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setListLoading(false));
  }, []);

  // Load detail whenever selected id changes
  // For guests: build detail from the list item (no auth needed)
  // For logged-in users: fetch full detail via authenticated endpoint
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    if (!isLoggedIn) {
      // Guests: use the data already in the list (no CV preview)
      const item = templates.find((t) => String(t.id) === String(selectedId));
      setDetail(item || null);
      return;
    }

    setDetailLoading(true);
    setDetail(null);
    fetchTemplateV2(selectedId)
      .then((data) => setDetail(data))
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selectedId, isLoggedIn, templates]);

  // Load CV blob URL — only for logged-in users
  useEffect(() => {
    if (!selectedId || !isLoggedIn) {
      setCvPreviewUrl("");
      setCvOpenUrl("");
      return;
    }

    let active = true;
    let objectUrl = "";
    setCvPreviewUrl("");
    setCvLoading(true);

    fetchCvBlobUrlV2(selectedId)
      .then((url) => {
        if (!active) { URL.revokeObjectURL(url); return; }
        objectUrl = url;
        setCvPreviewUrl(url);
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => { if (active) setCvLoading(false); });

    getCvUrlV2(selectedId).then((url) => {
      if (active) setCvOpenUrl(url);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedId, isLoggedIn]);

  if (listLoading) return <p className="muted">Loading templates...</p>;

  return (
    <div style={{ padding: "32px", alignSelf: "start" }}>
      <section className="card" style={{ minHeight: "auto", height: "auto" }}>

        {/* Blue accent header — View Templates */}
        <div className="page-accent-header accent-view">
          <div>
            <h2>View Templates</h2>
            <p>Browse stored job templates and preview CV details.</p>
          </div>
          <div className="page-accent-badge">
            <LayoutTemplate size={22} />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {templates.length === 0 ? (
          <p className="muted">No templates available yet.</p>
        ) : (
          <>
            <label>
              Select Job Type
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.template_role || t.title}
                  </option>
                ))}
              </select>
            </label>

            {detailLoading && <p className="muted">Loading details...</p>}

            {detail && !detailLoading && (
              <div className="detail-grid">
                <div>
                  <h3>Template Details</h3>
                  <dl className="detail-list">
                    <div>
                      <dt>Type</dt>
                      <dd>{detail.template_role}</dd>
                    </div>
                    <div>
                      <dt>Subject</dt>
                      <dd>{detail.title}</dd>
                    </div>
                    {detail.filename && (
                      <div>
                        <dt>CV File</dt>
                        <dd>{detail.filename}</dd>
                      </div>
                    )}
                    {detail.file_size_bytes != null && (
                      <div>
                        <dt>File Size</dt>
                        <dd>{formatBytes(detail.file_size_bytes)}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h3>Email Body</h3>
                  <pre className="context-preview">{detail.context}</pre>
                </div>

                <div className="full-width">
                  <h3>CV Preview</h3>
                  {!isLoggedIn && (
                    <p className="muted">Log in to preview the CV.</p>
                  )}
                  {isLoggedIn && cvLoading && (
                    <p className="muted">Loading CV preview...</p>
                  )}
                  {isLoggedIn && !cvLoading && cvPreviewUrl && (
                    <iframe
                      title={`CV preview for ${detail.title}`}
                      src={cvPreviewUrl}
                      className="cv-preview"
                    />
                  )}
                  {isLoggedIn && !cvLoading && !cvPreviewUrl && (
                    <p className="muted">CV preview not available.</p>
                  )}
                  {isLoggedIn && cvOpenUrl && (
                    <a className="link-button" href={cvOpenUrl} target="_blank" rel="noreferrer">
                      Open CV in new tab
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
