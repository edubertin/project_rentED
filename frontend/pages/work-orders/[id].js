import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../../components/TopNav";
import { API_BASE, apiDelete, apiGet, apiPost } from "../../lib/api";

export default function WorkOrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [portalLink, setPortalLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [proofPhoto, setProofPhoto] = useState(null);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiGet(`/work-orders/${id}`);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load work order.");
    } finally {
      setLoading(false);
    }
  }

  async function approveQuote(quoteId) {
    try {
      await apiPost(`/work-orders/${id}/approve-quote/${quoteId}`, { approved_amount: Number(approvedAmount) });
      setApprovedAmount("");
      load();
    } catch (err) {
      setError(err.message || "Failed to approve quote.");
    }
  }

  async function selectInterest(interestId) {
    try {
      const resp = await apiPost(`/work-orders/${id}/select-interest/${interestId}`, {});
      if (resp.portal_link) setPortalLink(resp.portal_link);
      load();
    } catch (err) {
      setError(err.message || "Failed to select provider.");
    }
  }

  async function requestRework() {
    try {
      await apiPost(`/work-orders/${id}/request-rework`, {});
      load();
    } catch (err) {
      setError(err.message || "Failed to request rework.");
    }
  }

  async function approveProof() {
    try {
      await apiPost(`/work-orders/${id}/approve-proof`, {});
      load();
    } catch (err) {
      setError(err.message || "Failed to approve proof.");
    }
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  async function deleteWorkOrder() {
    try {
      await apiDelete(`/work-orders/${id}`);
      router.push("/work-orders");
    } catch (err) {
      setError(err.message || "Failed to delete work order.");
    } finally {
      setConfirmDelete(false);
    }
  }

  if (!data) {
    return (
      <div className="container">
        <TopNav />
        <div className="card">
          <p className="muted">{loading ? "Loading..." : "No work order found."}</p>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  const { work_order, quotes, interests, proofs } = data;

  return (
    <div className="container">
      <TopNav />
      <div className="card">
        <div className="card-header">
          <div>
            <h2>{work_order.title}</h2>
            <p className="muted">{work_order.description}</p>
          </div>
          <div className="actions">
            <div className={`pill ${work_order.status === "closed" ? "pill--closed" : ""}`}>
              {work_order.status}
            </div>
            <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="detail-grid">
          <div>
            <span className="detail-label">Type</span>
            <span className="detail-value">{work_order.type}</span>
          </div>
          <div>
            <span className="detail-label">Property</span>
            <span className="detail-value">{work_order.extras?.property_tag || work_order.property_id}</span>
          </div>
          <div>
            <span className="detail-label">Offer / Approved Amount</span>
            <span className="detail-value">
              {work_order.approved_amount || work_order.offer_amount
                ? `R$ ${Number(work_order.approved_amount || work_order.offer_amount).toFixed(2)}`
                : "-"}
            </span>
          </div>
          <div>
            <span className="detail-label">Created</span>
            <span className="detail-value">{work_order.created_at}</span>
          </div>
          {work_order.status === "closed" && (
            <div>
              <span className="detail-label">Closed at</span>
              <span className="detail-value">{formatDate(work_order.updated_at)}</span>
            </div>
          )}
        </div>
      </div>

      {portalLink && work_order.status !== "closed" && (
        <div className="card">
          <h3>Execution link</h3>
          <div className="input-group">
            <input value={portalLink} readOnly />
            <button className="btn-primary" onClick={() => navigator.clipboard.writeText(portalLink)}>
              Copy
            </button>
            <a
              className="btn-link"
              href={portalLink}
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
          </div>
        </div>
      )}

      {work_order.type === "quote" && (
        <div className="card">
          <h3>Quotes</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Total</th>
                  <th>Status</th>
                  {work_order.status !== "closed" && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(work_order.status === "closed"
                  ? quotes.filter((quote) => quote.status === "approved")
                  : quotes
                ).map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.provider_name}<br /><small>{quote.provider_phone}</small></td>
                    <td>R$ {Number(quote.total_amount).toFixed(2)}</td>
                    <td><span className="pill">{quote.status}</span></td>
                    {work_order.status !== "closed" ? (
                      <td className="actions-cell">
                        <div className="actions">
                          <input
                            style={{ width: 110 }}
                            placeholder="Approved"
                            value={approvedAmount}
                            onChange={(e) => setApprovedAmount(e.target.value)}
                          />
                          <button onClick={() => approveQuote(quote.id)} className="btn-primary">
                            Approve
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td />
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {work_order.type === "fixed" && (
        <div className="card">
          <h3>Interests</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Status</th>
                  {work_order.status !== "closed" && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(work_order.status === "closed"
                  ? interests.filter((interest) => interest.id === work_order.assigned_interest_id)
                  : interests
                ).map((interest) => (
                  <tr key={interest.id}>
                    <td>{interest.provider_name}<br /><small>{interest.provider_phone}</small></td>
                    <td><span className="pill">{interest.status}</span></td>
                    {work_order.status !== "closed" ? (
                      <td className="actions-cell">
                        <div className="actions">
                          <button onClick={() => selectInterest(interest.id)} className="btn-primary">
                            Select
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td />
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Proofs</h3>
            <p className="muted">Approval closes the work order.</p>
          </div>
          <div className="actions">
            <button onClick={requestRework}>Request rework</button>
            <button className="btn-primary" onClick={approveProof}>Approve proof</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Pix</th>
                <th>Status</th>
                <th>Photo</th>
              </tr>
            </thead>
            <tbody>
              {proofs.map((proof) => (
                <tr key={proof.id}>
                  <td>{proof.provider_name}<br /><small>{proof.provider_phone}</small></td>
                  <td>{proof.pix_key_type}: {proof.pix_key_value}</td>
                  <td><span className="pill">{proof.status}</span></td>
                  <td>
                    <button
                      className="btn-link"
                      onClick={() => setProofPhoto(`${API_BASE}/documents/${proof.document_id}/download`)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {proofPhoto && (
        <div className="modal-overlay" onClick={() => setProofPhoto(null)}>
          <div className="modal photo-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Proof photo</h3>
              <button onClick={() => setProofPhoto(null)}>Close</button>
            </div>
            <img src={proofPhoto} alt="Proof" />
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="modal-header">
              <h3>Delete work order?</h3>
              <button onClick={() => setConfirmDelete(false)}>Close</button>
            </div>
            <p className="muted">This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn-danger" onClick={deleteWorkOrder}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
