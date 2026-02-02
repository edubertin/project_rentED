import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../lib/api";

export default function Review() {
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [extraction, setExtraction] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const docs = await apiGet("/documents?status=needs_review");
    setDocuments(docs);
  }

  useEffect(() => {
    load();
  }, []);

  async function loadExtraction(id) {
    setSelectedId(id);
    const data = await apiGet(`/documents/${id}/extraction`);
    setExtraction(JSON.stringify(data.extras, null, 2));
  }

  async function saveReview() {
    setMessage("");
    if (!selectedId) return;
    try {
      const parsed = JSON.parse(extraction || "{}");
      await apiPut(`/documents/${selectedId}/review`, { extraction: parsed });
      setMessage("Saved and confirmed");
      await load();
    } catch (err) {
      setMessage("Invalid JSON or save failed");
    }
  }

  return (
    <div className="container">
      <nav className="nav">
        <Link href="/">Properties</Link>
        <Link href="/work-orders">Work Orders</Link>
        <Link href="/upload">Upload Document</Link>
        <Link href="/review">Review</Link>
      </nav>

      <h1>Review</h1>
      <div className="grid">
        <div className="card">
          <h3>Needs Review</h3>
          {documents.map((d) => (
            <div key={d.id} style={{ marginBottom: 8 }}>
              #{d.id} — {d.extras?.name || "document"}
              <button style={{ marginLeft: 8 }} onClick={() => loadExtraction(d.id)}>
                Open
              </button>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Extraction JSON</h3>
          <textarea rows={14} value={extraction} onChange={(e) => setExtraction(e.target.value)} />
          <div style={{ marginTop: 8 }}>
            <button onClick={saveReview}>Confirm</button>
          </div>
          {message && <p>{message}</p>}
        </div>
      </div>
    </div>
  );
}
