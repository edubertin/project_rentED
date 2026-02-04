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
  const [activePhoto, setActivePhoto] = useState(0);
  const [error, setError] = useState("");

  function buildDocumentUrl(doc) {
    if (!doc?.id) return "";
    return `${API_BASE}/documents/${doc.id}/download`;
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
        apiGet(`/documents?property_id=${id}`),
        apiGet("/work-orders"),
      ]);
      setProperty(props.find((p) => String(p.id) === String(id)) || null);
      setDocuments(docs);
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

  const photos = property?.extras?.photos || [];
  const activePhotoItem = photos[activePhoto] || null;
  const extras = property?.extras || {};
  const beds = extras.bedrooms ?? "";
  const baths = extras.bathrooms ?? "";
  const parking = extras.parking_spaces ?? "";
  function formatRent(cents, currency) {
    if (!cents) return "";
    const amount = Number(cents) / 100;
    const locale = currency === "USD" ? "en-US" : "pt-BR";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  const rentCurrency = extras.rent_currency || "BRL";
  const rentAmount = extras.is_rented
    ? extras.current_rent_display
        || extras.rent_amount_display
        || formatRent(extras.current_rent_value || extras.rent_amount_value, rentCurrency)
    : extras.desired_rent_display
        || formatRent(extras.desired_rent_value, rentCurrency);
  const adminFeePercent = Number(String(extras.admin_fee_percent || "").replace("%", ""));
  const rentCents = extras.current_rent_value || extras.rent_amount_value || extras.desired_rent_value;
  const netAmount = extras.is_rented && rentCents && adminFeePercent
    ? formatRent(Math.max(rentCents - Math.round(rentCents * adminFeePercent / 100), 0), rentCurrency)
    : "";

  return (
    <div className="container">
      <TopNav />

      <h1>Property Detail</h1>
      {property ? (
        <div className="card property-detail">
          <div className="property-hero">
            <div className="property-gallery">
              {activePhotoItem ? (
                <img
                  className="property-hero-image"
                  src={`${API_BASE}${activePhotoItem.url}`}
                  alt={property.extras?.tag || "Property"}
                />
              ) : (
                <div className="property-hero-empty">No photos yet</div>
              )}
              {photos.length > 1 && (
                <div className="gallery-controls">
                  <button
                    type="button"
                    className="btn-muted"
                    onClick={() => setActivePhoto((prev) => (prev - 1 + photos.length) % photos.length)}
                  >
                    Prev
                  </button>
                  <span className="muted">
                    {activePhoto + 1} / {photos.length}
                  </span>
                  <button
                    type="button"
                    className="btn-muted"
                    onClick={() => setActivePhoto((prev) => (prev + 1) % photos.length)}
                  >
                    Next
                  </button>
                </div>
              )}
              {photos.length > 1 && (
                <div className="gallery-thumbs">
                  {photos.map((photo, idx) => (
                    <button
                      type="button"
                      key={photo.url || idx}
                      className={`thumb-button ${idx === activePhoto ? "thumb-active" : ""}`}
                      onClick={() => setActivePhoto(idx)}
                    >
                      <img src={`${API_BASE}${photo.url}`} alt="thumb" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="property-summary">
              <h2>{property.extras?.tag || property.extras?.label || "Property"}</h2>
              <p className="muted">{property.extras?.property_address || "Address not provided."}</p>
              <div className="property-stats">
                <div className="stat">
                  <span className="stat-icon" aria-hidden="true">B</span>
                  <span>{beds || "-"}</span>
                  <small className="muted">Bedrooms</small>
                </div>
                <div className="stat">
                  <span className="stat-icon" aria-hidden="true">W</span>
                  <span>{baths || "-"}</span>
                  <small className="muted">Bathrooms</small>
                </div>
                <div className="stat">
                  <span className="stat-icon" aria-hidden="true">P</span>
                  <span>{parking || "-"}</span>
                  <small className="muted">Parking</small>
                </div>
              </div>
              <div className="property-footer">
                {rentAmount ? (
                  <div className="rent-amount">
                    <span className="rent-label">
                      {property.extras?.is_rented ? "Current Rent" : "Desired Rent"}
                    </span>
                    <span className="rent-value">{rentAmount}</span>
                    {property.extras?.is_rented && adminFeePercent ? (
                      <small className="muted">
                        Admin fee {adminFeePercent}% • Net {netAmount || "-"}
                      </small>
                    ) : null}
                  </div>
                ) : (
                  <div className="pill">
                    {property.extras?.is_rented ? "Rented" : "Available"}
                  </div>
                )}
              </div>
              {property.extras?.is_rented && (
                <div className="rented-badge">_rented</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">Property not found.</div>
      )}

      <div className="grid">
        <div className="card">
          <h3>Documents</h3>
          {documents.length === 0 && <p className="muted">No documents yet.</p>}
          {documents.map((d) => (
            <div key={d.id} className="doc-row">
              <span>{d.extras?.name || `document-${d.id}`}</span>
              {buildDocumentUrl(d) && (
                <a href={buildDocumentUrl(d)} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Work Orders</h3>
          <p className="muted">We will implement work orders soon.</p>
        </div>
      </div>
      {error && <p style={{ color: "salmon" }}>{error}</p>}
    </div>
  );
}
