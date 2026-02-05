import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../../components/TopNav";
import { apiGet, apiPost } from "../../lib/api";

export default function NewWorkOrder() {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    property_id: "",
    type: "quote",
    title: "",
    description: "",
    offer_amount: "",
  });
  const [portalLink, setPortalLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet("/properties").then(setProperties).catch(() => setProperties([]));
  }, []);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      const payload = {
        property_id: Number(form.property_id),
        type: form.type,
        title: form.title,
        description: form.description,
        offer_amount: form.type === "fixed" ? Number(form.offer_amount) : null,
      };
      const resp = await apiPost("/work-orders", payload);
      setPortalLink(resp.portal_links?.portal || "");
      setStep(4);
    } catch (err) {
      setError(err.message || "Failed to create work order.");
    } finally {
      setLoading(false);
    }
  }

  function canNext() {
    if (step === 1) return !!form.property_id;
    if (step === 2) return !!form.type;
    if (step === 3) return form.title && form.description && (form.type !== "fixed" || form.offer_amount);
    return true;
  }

  return (
    <div className="container">
      <TopNav />
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Create Work Order</h2>
            <p className="muted">Set up a quote or fixed-offer job.</p>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {step === 1 && (
          <div className="form-grid">
            <div className="form-span-2">
              <label>Select property</label>
              <select value={form.property_id} onChange={(e) => updateField("property_id", e.target.value)}>
                <option value="">Choose property</option>
                {properties.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.extras?.tag || prop.extras?.label || `Property ${prop.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <div>
              <label>Type</label>
              <select value={form.type} onChange={(e) => updateField("type", e.target.value)}>
                <option value="quote">Quote (Orcamento)</option>
                <option value="fixed">Fixed offer</option>
              </select>
            </div>
            <div>
              <label>Offer amount (fixed)</label>
              <input
                value={form.offer_amount}
                onChange={(e) => updateField("offer_amount", e.target.value)}
                disabled={form.type !== "fixed"}
                placeholder="Ex: 1200.00"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form-grid">
            <div className="form-span-2">
              <label>Title</label>
              <input value={form.title} onChange={(e) => updateField("title", e.target.value)} />
            </div>
            <div className="form-span-2">
              <label>Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="muted">Share this portal link with the provider:</p>
            <div style={{ marginTop: 8 }}>
              <small>{portalLink ? `${typeof window !== "undefined" ? window.location.origin : ""}${portalLink}` : ""}</small>
            </div>
            <div className="input-group" style={{ marginTop: 12 }}>
              <input value={portalLink} readOnly />
              <button
                className="btn-primary"
                onClick={() =>
                  navigator.clipboard.writeText(
                    portalLink ? `${window.location.origin}${portalLink}` : ""
                  )
                }
              >
                Copy
              </button>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
              <button onClick={() => router.push("/work-orders")}>Back to list</button>
              <button className="btn-primary" onClick={() => router.push(`/work-orders/${portalLink.split("/").pop()}`)} disabled>
                View details
              </button>
            </div>
          </div>
        )}

        {step < 4 && (
          <div className="modal-actions" style={{ marginTop: 18 }}>
            {step > 1 && <button onClick={() => setStep(step - 1)}>Back</button>}
            {step < 3 && (
              <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Next
              </button>
            )}
            {step === 3 && (
              <button className="btn-primary" onClick={handleCreate} disabled={!canNext() || loading}>
                {loading ? "Creating..." : "Create"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
