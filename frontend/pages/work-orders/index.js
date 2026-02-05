import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../../components/TopNav";
import { apiGet } from "../../lib/api";

const STATUS_OPTIONS = [
  "quote_requested",
  "quote_submitted",
  "approved_for_execution",
  "offer_open",
  "assigned",
  "proof_submitted",
  "rework_requested",
  "closed",
  "canceled",
];

export default function WorkOrders() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    type: "",
    propertyId: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [props, orders] = await Promise.all([
        apiGet("/properties"),
        apiGet("/work-orders"),
      ]);
      setProperties(props);
      setWorkOrders(orders);
    } catch (err) {
      setError(err.message || "Failed to load work orders.");
    } finally {
      setLoading(false);
    }
  }

  async function applyFilters() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.status) params.append("status", filters.status);
      if (filters.type) params.append("type", filters.type);
      if (filters.propertyId) params.append("property_id", filters.propertyId);
      const orders = await apiGet(`/work-orders?${params.toString()}`);
      setWorkOrders(orders);
    } catch (err) {
      setError(err.message || "Failed to filter work orders.");
    } finally {
      setLoading(false);
    }
  }

  const propertyMap = useMemo(() => {
    const map = {};
    properties.forEach((prop) => {
      map[prop.id] = prop;
    });
    return map;
  }, [properties]);

  return (
    <div className="container">
      <TopNav />
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Work Orders</h2>
            <p className="muted">Track quotes, approvals, and proof submissions.</p>
          </div>
          <button className="btn-primary btn-large" onClick={() => router.push("/work-orders/new")}>
            Create Work Order
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {loading ? (
          <p className="muted">Loading work orders...</p>
        ) : workOrders.length === 0 ? (
          <div style={{ marginTop: 20 }} />
        ) : (
          <>
            <div className="form-grid">
              <div>
                <label>Search</label>
                <input
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Title or description"
                />
              </div>
              <div>
                <label>Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                >
                  <option value="">All types</option>
                  <option value="quote">Quote</option>
                  <option value="fixed">Fixed offer</option>
                </select>
              </div>
              <div>
                <label>Property</label>
                <select
                  value={filters.propertyId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, propertyId: e.target.value }))}
                >
                  <option value="">All properties</option>
                  {properties.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.extras?.tag || prop.extras?.label || `Property ${prop.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-span-2" style={{ display: "flex", gap: 12 }}>
                <button className="btn-primary" onClick={applyFilters}>Apply filters</button>
                <button className="btn-muted" onClick={loadData}>Reset</button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((item) => {
                    const prop = propertyMap[item.property_id];
                    const propertyLabel = item.extras?.property_tag || prop?.extras?.tag || `Property ${item.property_id}`;
                    const amount = item.approved_amount || item.offer_amount;
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.title}</td>
                        <td>{propertyLabel}</td>
                        <td><span className="pill">{item.type}</span></td>
                      <td>
                        <span className={`pill ${item.status === "closed" ? "pill--closed" : ""}`}>
                          {item.status}
                        </span>
                      </td>
                        <td>{amount ? `R$ ${Number(amount).toFixed(2)}` : "-"}</td>
                        <td className="actions-cell">
                          <div className="actions">
                            <button onClick={() => router.push(`/work-orders/${item.id}`)}>View</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
