import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../../components/TopNav";
import { API_BASE, apiGet, apiPost } from "../../lib/api";
import { requireAuth } from "../../lib/auth";

export default function PropertyDetail() {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(null);
  const [property, setProperty] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [workTitle, setWorkTitle] = useState("");
  const [error, setError] = useState("");

  function buildDocumentUrl(doc) {
    const url = doc.extras?.url;
    if (url) return `${API_BASE}${url}`;
    const path = doc.extras?.path || "";
    const filename = path.split("/").pop();
    if (!filename) return "";
    return `${API_BASE}/uploads/${filename}`;
  }

  useEffect(() => {
    (async () => {
      const user = await requireAuth(router);
      if (user) {
        const id = router.query.id;
        if (id) setPropertyId(id);
      }
    })();
  }, [router]);

  async function loadAll(id) {
    if (!id) return;
    setError("");
    try {
      const [props, docs, wos] = await Promise.all([
        apiGet("/properties"),
        apiGet("/documents"),
        apiGet("/work-orders"),
      ]);
      setProperty(props.find((p) => String(p.id) === String(id)) || null);
      setDocuments(docs.filter((d) => String(d.property_id) === String(id)));
      setWorkOrders(wos.filter((w) => String(w.property_id) === String(id)));
    } catch (err) {
      setError("Failed to load data");
    }
  }

  useEffect(() => {
    if (propertyId) loadAll(propertyId);
  }, [propertyId]);

  async function createWorkOrder(e) {
    e.preventDefault();
    if (!propertyId) return;
    try {
      await apiPost("/work-orders", {
        property_id: Number(propertyId),
        extras: { title: workTitle || "Work Order" },
      });
      setWorkTitle("");
      await loadAll(propertyId);
    } catch (err) {
      setError("Failed to create work order");
    }
  }

  return (
    <div className="container">
      <TopNav />

      <h1>Property Detail</h1>
      {property ? (
        <div className="card">
          <div>ID: {property.id}</div>
          <div>Tag: {property.extras?.tag || property.extras?.label || "Property"}</div>
          <div>Owner: {property.owner_user_id}</div>
        </div>
      ) : (
        <div className="card">Property not found.</div>
      )}

      <div className="grid">
        <div className="card">
          <h3>Documents</h3>
          {documents.map((d) => (
            <div key={d.id}>
              #{d.id} -{" "}
              {buildDocumentUrl(d) ? (
                <a href={buildDocumentUrl(d)} target="_blank" rel="noreferrer">
                  {d.extras?.name || "document"}
                </a>
              ) : (
                d.extras?.name || "document"
              )}{" "}
              ({d.extras?.status})
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Work Orders</h3>
          {workOrders.map((w) => (
            <div key={w.id}>
              #{w.id} - {w.extras?.title || "work"}
            </div>
          ))}
          <form onSubmit={createWorkOrder} style={{ marginTop: 12 }}>
            <label>Title</label>
            <input value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} />
            <div style={{ marginTop: 8 }}>
              <button type="submit">Create OS</button>
            </div>
          </form>
        </div>
      </div>
      {error && <p style={{ color: "salmon" }}>{error}</p>}
    </div>
  );
}
