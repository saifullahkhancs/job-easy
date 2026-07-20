import { useEffect, useState } from "react";
import { fetchCvBlobUrl, fetchTemplate, fetchTemplates, getCvUrl } from "../api/client";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ViewPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [detail, setDetail] = useState(null);
  const [cvPreviewUrl, setCvPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTemplates()
      .then((items) => {
        setTemplates(items);
        if (items.length > 0) setSelectedType(items[0].type);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedType) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    fetchTemplate(selectedType)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selectedType]);

  useEffect(() => {
    if (!selectedType) {
      setCvPreviewUrl("");
      return;
    }

    let active = true;
    let objectUrl = "";
    setCvLoading(true);

    fetchCvBlobUrl(selectedType)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setCvPreviewUrl(url);
      })
      .catch((err) => {
        if (active) setError(err.message);
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
  }, [selectedType]);

  if (loading) return <p className="muted">Loading templates...</p>;

  return (
    <section className="card">
      <h2>View Templates</h2>
      <p className="muted">Browse stored job templates and preview CV details.</p>

      {templates.length === 0 ? (
        <p className="muted">No templates yet. Upload one first.</p>
      ) : (
        <>
          <label>
            Select Job Type
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              {templates.map((template) => (
                <option key={template.type} value={template.type}>
                  {template.type}
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
                    <dd>{detail.type}</dd>
                  </div>
                  <div>
                    <dt>Subject</dt>
                    <dd>{detail.title}</dd>
                  </div>
                  <div>
                    <dt>CV File</dt>
                    <dd>{detail.filename}</dd>
                  </div>
                  <div>
                    <dt>File Size</dt>
                    <dd>{formatBytes(detail.file_size_bytes)}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3>Email Body</h3>
                <pre className="context-preview">{detail.context}</pre>
              </div>

              <div className="full-width">
                <h3>CV Preview</h3>
                {cvLoading && <p className="muted">Loading CV preview...</p>}
                {!cvLoading && cvPreviewUrl && (
                  <iframe
                    title={`CV preview for ${detail.type}`}
                    src={cvPreviewUrl}
                    className="cv-preview"
                  />
                )}
                <a className="link-button" href={getCvUrl(selectedType)} target="_blank" rel="noreferrer">
                  Open CV in new tab
                </a>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
