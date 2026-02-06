import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../components/TopNav";
import { API_BASE, apiGet } from "../lib/api";
import { requireAuth } from "../lib/auth";

export default function Review() {
  const router = useRouter();
  const [activityLog, setActivityLog] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDate, setSelectedDate] = useState("all");
  const [currentUser, setCurrentUser] = useState(null);

  async function load() {
    const logs = await apiGet("/event-logs");
    setActivityLog(logs);
    const docs = await apiGet("/documents");
    setDocuments(docs);
  }

  useEffect(() => {
    (async () => {
      const user = await requireAuth(router);
      if (user) {
        setCurrentUser(user);
        load();
      }
    })();
  }, [router]);

  function formatEvent(event) {
    return String(event || "event").replace(/_/g, " ").toUpperCase();
  }

  function formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  function formatDateKey(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  const dateOptions = Array.from(
    new Set(activityLog.map((item) => formatDateKey(item.extras?.timestamp)).filter(Boolean))
  ).sort((a, b) => (a < b ? 1 : -1));

  const scopedEvents = currentUser?.role === "admin"
    ? activityLog
    : activityLog.filter((item) => item.actor_id === currentUser?.id);

  const filteredEvents =
    selectedDate === "all"
      ? scopedEvents
      : scopedEvents.filter((item) => formatDateKey(item.extras?.timestamp) === selectedDate);

  function buildDocumentUrl(doc) {
    if (!doc?.id) return "";
    return `${API_BASE}/documents/${doc.id}/download`;
  }

  return (
    <div className="container">
      <TopNav />

      <div />
      <div className="card log-card">
        <div className="log-header">
          <div>
            <h3>Event Logs</h3>
            <p className="muted">Structured business events for audit and timeline review.</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
              <option value="all">All dates</option>
              {dateOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="pill">{filteredEvents.length} events</span>
          </div>
        </div>
        <div className="log-scroll">
          {filteredEvents.length === 0 && <p className="muted">No events for this date.</p>}
          {filteredEvents.map((item) => (
            <div key={item.id} className="log-row">
              <div>
                <div className="log-title">{formatEvent(item.event_type)}</div>
                <div className="log-meta">
                  {item.entity_type && item.entity_id ? (
                    <span className="pill">{item.entity_type} #{item.entity_id}</span>
                  ) : null}
                  {item.actor_type && <span className="pill">{item.actor_type}</span>}
                  <span className="pill">id #{item.id}</span>
                </div>
              </div>
              <div className="log-time">{formatTime(item.created_at)}</div>
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
        <div className="files-scroll">
          {documents.length === 0 && <p className="muted">No documents yet.</p>}
          <div className="files-grid">
            {documents.map((doc) => (
              <div key={doc.id} className="file-card">
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
                <div className="file-actions">
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
      </div>
    </div>
  );
}
