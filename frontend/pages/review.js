import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../components/TopNav";
import { API_BASE, apiGet } from "../lib/api";
import { requireAuth } from "../lib/auth";

export default function Review() {
  const router = useRouter();
  const [activityLog, setActivityLog] = useState([]);
  const [documents, setDocuments] = useState([]);

  async function load() {
    const logs = await apiGet("/activity-log");
    setActivityLog(logs);
    const docs = await apiGet("/documents");
    setDocuments(docs);
  }

  useEffect(() => {
    (async () => {
      const user = await requireAuth(router);
      if (user) {
        load();
      }
    })();
  }, [router]);

  function formatEvent(event) {
    return String(event || "event").replace(/_/g, " ");
  }

  function formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  function buildDocumentUrl(doc) {
    if (!doc?.id) return "";
    return `${API_BASE}/documents/${doc.id}/download`;
  }

  return (
    <div className="container">
      <TopNav />

      <h1>Review</h1>
      <div className="card log-card">
        <div className="log-header">
          <div>
            <h3>Activity Log</h3>
            <p className="muted">All actions recorded for audit and review.</p>
          </div>
          <span className="pill">{activityLog.length} events</span>
        </div>
        <div className="log-scroll">
          {activityLog.length === 0 && <p className="muted">No recent activity.</p>}
          {activityLog.map((item) => (
            <div key={item.id} className="log-row">
              <div>
                <div className="log-title">{formatEvent(item.extras?.event)}</div>
                <div className="log-meta">
                  {item.extras?.property_id && <span>Property #{item.extras.property_id}</span>}
                  {item.extras?.document_id && <span>Doc #{item.extras.document_id}</span>}
                  {item.extras?.username && <span>{item.extras.username}</span>}
                </div>
              </div>
              <div className="log-time">{formatTime(item.extras?.timestamp)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card log-card">
        <div className="log-header">
          <div>
            <h3>Files</h3>
            <p className="muted">Documents indexed for this account.</p>
          </div>
          <span className="pill">{documents.length} files</span>
        </div>
        {documents.length === 0 && <p className="muted">No documents yet.</p>}
        {documents.map((doc) => (
          <div key={doc.id} className="log-row">
            <div>
              <div className="log-title">{doc.extras?.name || `document-${doc.id}`}</div>
              <div className="log-meta">
                {doc.property_id && (
                  <span>
                    {doc.extras?.property_tag || "Property"} #{doc.property_id}
                  </span>
                )}
              </div>
            </div>
            <div className="log-time">
              <a
                href={buildDocumentUrl(doc)}
                className="btn-link"
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
