import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { API_BASE } from "../../../lib/api";

const emptyLine = () => ({ kind: "labor", name: "", qty: 1, unit: "", unit_price: "" });

export default function WorkOrderPortal() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    provider_name: "",
    provider_phone: "",
    pix_key_type: "cpf",
    pix_key_value: "",
    pix_receiver_name: "",
    note: "",
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/work-orders/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Invalid or expired link.");
      }
      const payload = await res.json();
      setData(payload);
    } catch (err) {
      setError(err.message || "Failed to load portal.");
    } finally {
      setLoading(false);
    }
  }

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateLine(idx, key, value) {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, [key]: value } : line)));
  }

  function parseMoney(value) {
    if (value === null || value === undefined) return 0;
    const normalized = String(value)
      .replace(/[^0-9,.-]/g, "")
      .replace(/\.(?=.*\.)/g, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const qty = parseMoney(line.qty);
      const price = parseMoney(line.unit_price);
      return sum + qty * price;
    }, 0);
  }, [lines]);

  async function submitInterest() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/work-orders/${token}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_name: form.provider_name,
          provider_phone: form.provider_phone,
          note: form.note,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Failed to submit interest.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Failed to submit interest.");
    }
  }

  async function submitQuote() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/work-orders/${token}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_name: form.provider_name,
          provider_phone: form.provider_phone,
          lines,
          total_amount: total,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Failed to submit quote.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Failed to submit quote.");
    }
  }

  async function submitProof() {
    setError("");
    try {
      const formData = new FormData();
      formData.append("provider_name", form.provider_name);
      formData.append("provider_phone", form.provider_phone);
      formData.append("pix_key_type", form.pix_key_type);
      formData.append("pix_key_value", form.pix_key_value);
      formData.append("pix_receiver_name", form.pix_receiver_name);
      if (file) formData.append("file", file);
      const res = await fetch(`${API_BASE}/portal/work-orders/${token}/submit-proof`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Failed to submit proof.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Failed to submit proof.");
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card"><p className="muted">Loading portal...</p></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container">
        <div className="card"><p className="error">{error || "Invalid link."}</p></div>
      </div>
    );
  }

  const { work_order, allowed_action } = data;

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>{work_order.title}</h2>
            <p className="muted">{work_order.description}</p>
          </div>
          <span className="pill">{work_order.status}</span>
        </div>
        <p><strong>Address:</strong> {work_order.property_address_full || work_order.extras?.property_address || "-"}</p>
        {error && <p className="error">{error}</p>}
        {submitted && <p className="muted">Submission received. Thank you.</p>}
      </div>

      {allowed_action === "submit_interest" && !submitted && (
        <div className="card">
          <h3>Submit Interest</h3>
          <div className="form-grid">
            <div>
              <label>Name</label>
              <input value={form.provider_name} onChange={(e) => updateForm("provider_name", e.target.value)} />
            </div>
            <div>
              <label>Phone</label>
              <input value={form.provider_phone} onChange={(e) => updateForm("provider_phone", e.target.value)} />
            </div>
            <div className="form-span-2">
              <label>Note (optional)</label>
              <textarea rows={3} value={form.note} onChange={(e) => updateForm("note", e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-primary" onClick={submitInterest}>Send interest</button>
          </div>
        </div>
      )}

      {allowed_action === "submit_quote" && !submitted && (
        <div className="card">
          <h3>Submit Quote</h3>
          <div className="form-grid">
            <div>
              <label>Name</label>
              <input value={form.provider_name} onChange={(e) => updateForm("provider_name", e.target.value)} />
            </div>
            <div>
              <label>Phone</label>
              <input value={form.provider_phone} onChange={(e) => updateForm("provider_phone", e.target.value)} />
            </div>
          </div>
          <div className="form-section">
            <h4>Line items</h4>
            {lines.map((line, idx) => (
              <div key={idx} className="form-grid">
                <div>
                  <label>Kind</label>
                  <select value={line.kind} onChange={(e) => updateLine(idx, "kind", e.target.value)}>
                    <option value="labor">Labor</option>
                    <option value="material">Material</option>
                  </select>
                </div>
                <div>
                  <label>Name</label>
                  <input value={line.name} onChange={(e) => updateLine(idx, "name", e.target.value)} />
                </div>
                <div>
                  <label>Qty</label>
                  <input value={line.qty} onChange={(e) => updateLine(idx, "qty", e.target.value)} />
                </div>
                <div>
                  <label>Unit</label>
                  <input value={line.unit} onChange={(e) => updateLine(idx, "unit", e.target.value)} />
                </div>
                <div>
                  <label>Unit price</label>
                  <input value={line.unit_price} onChange={(e) => updateLine(idx, "unit_price", e.target.value)} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="modal-actions">
              <button onClick={() => setLines((prev) => [...prev, emptyLine()])}>Add line</button>
              <span className="pill">Total: R$ {total.toFixed(2)}</span>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-primary" onClick={submitQuote}>Submit quote</button>
          </div>
        </div>
      )}

      {allowed_action === "submit_proof" && !submitted && (
        <div className="card">
          <h3>Submit Proof + Pix</h3>
          <div className="form-grid">
            <div>
              <label>Name</label>
              <input value={form.provider_name} onChange={(e) => updateForm("provider_name", e.target.value)} />
            </div>
            <div>
              <label>Phone</label>
              <input value={form.provider_phone} onChange={(e) => updateForm("provider_phone", e.target.value)} />
            </div>
            <div>
              <label>Pix key type</label>
              <select value={form.pix_key_type} onChange={(e) => updateForm("pix_key_type", e.target.value)}>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="random">Random</option>
              </select>
            </div>
            <div>
              <label>Pix key</label>
              <input value={form.pix_key_value} onChange={(e) => updateForm("pix_key_value", e.target.value)} />
            </div>
            <div className="form-span-2">
              <label>Pix receiver name</label>
              <input value={form.pix_receiver_name} onChange={(e) => updateForm("pix_receiver_name", e.target.value)} />
            </div>
            <div className="form-span-2">
              <label>Proof photo (required)</label>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-primary" onClick={submitProof}>Submit proof</button>
          </div>
        </div>
      )}

      {allowed_action === "read_only" && (
        <div className="card">
          <p className="muted">This work order is not open for actions at the moment.</p>
        </div>
      )}
    </div>
  );
}
