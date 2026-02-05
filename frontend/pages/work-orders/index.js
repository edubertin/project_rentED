import { useEffect, useMemo, useRef, useState } from "react";
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

function WorkOrdersToolbar({ search, onSearchChange, onOpenFilters, onCreate, activeCount }) {
  return (
    <div className="wo-toolbar">
      <div className="wo-search">
        <label className="sr-only" htmlFor="wo-search">Search</label>
        <input
          id="wo-search"
          placeholder="Title or description"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="wo-toolbar-actions">
        <button className="wo-filters-btn" onClick={onOpenFilters} aria-label="Open filters">
          Filters
          {activeCount > 0 && <span className="wo-filters-count">{activeCount}</span>}
        </button>
        <button className="btn-primary wo-create-btn" onClick={onCreate}>
          Create Work Order
        </button>
      </div>
    </div>
  );
}

function WorkOrdersFiltersPanel({
  isOpen,
  onClose,
  filters,
  properties,
  onFilterChange,
  onReset,
}) {
  const panelRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    if (firstFieldRef.current) {
      firstFieldRef.current.focus();
    }
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="wo-filters-overlay" onClick={onClose}>
      <div
        className="wo-filters-panel"
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="wo-filters-header">
          <div>
            <h3>Filters</h3>
            <p className="muted">Refine work orders by status or property.</p>
          </div>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="form-grid">
          <div>
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              ref={firstFieldRef}
              value={filters.status}
              onChange={(event) => onFilterChange("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-type">Type</label>
            <select
              id="filter-type"
              value={filters.type}
              onChange={(event) => onFilterChange("type", event.target.value)}
            >
              <option value="">All types</option>
              <option value="quote">Quote</option>
              <option value="fixed">Fixed offer</option>
            </select>
          </div>
          <div className="form-span-2">
            <label htmlFor="filter-property">Property</label>
            <select
              id="filter-property"
              value={filters.propertyId}
              onChange={(event) => onFilterChange("propertyId", event.target.value)}
            >
              <option value="">All properties</option>
              {properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.extras?.tag || prop.extras?.label || `Property ${prop.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="wo-filters-actions">
          <button className="btn-muted" onClick={onReset}>Reset</button>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    const query = router.query || {};
    setFilters((prev) => ({
      ...prev,
      search: query.q ? String(query.q) : "",
      status: query.status ? String(query.status) : "",
      type: query.type ? String(query.type) : "",
      propertyId: query.property_id ? String(query.property_id) : "",
    }));
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

  async function applyFilters(nextFilters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (nextFilters.search) params.append("search", nextFilters.search);
      if (nextFilters.status) params.append("status", nextFilters.status);
      if (nextFilters.type) params.append("type", nextFilters.type);
      if (nextFilters.propertyId) params.append("property_id", nextFilters.propertyId);
      const orders = await apiGet(`/work-orders?${params.toString()}`);
      setWorkOrders(orders);
      router.replace(
        {
          pathname: "/work-orders",
          query: {
            ...(nextFilters.search ? { q: nextFilters.search } : {}),
            ...(nextFilters.status ? { status: nextFilters.status } : {}),
            ...(nextFilters.type ? { type: nextFilters.type } : {}),
            ...(nextFilters.propertyId ? { property_id: nextFilters.propertyId } : {}),
          },
        },
        undefined,
        { shallow: true }
      );
    } catch (err) {
      setError(err.message || "Failed to filter work orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyFilters(filters);
    }, filters.search ? 300 : 150);
    return () => clearTimeout(debounceRef.current);
  }, [filters.search, filters.status, filters.type, filters.propertyId]);

  const activeFiltersCount = [
    filters.search,
    filters.status,
    filters.type,
    filters.propertyId,
  ].filter(Boolean).length;

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters({
      search: "",
      status: "",
      type: "",
      propertyId: "",
    });
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
      <div className="card card--work-orders">
        <div className="card-header">
          <div>
            <h2>Work Orders</h2>
            <p className="muted">Track quotes, approvals, and proof submissions.</p>
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        <WorkOrdersToolbar
          search={filters.search}
          onSearchChange={(value) => updateFilter("search", value)}
          onOpenFilters={() => setFiltersOpen(true)}
          onCreate={() => router.push("/work-orders/new")}
          activeCount={activeFiltersCount}
        />
        <WorkOrdersFiltersPanel
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filters={filters}
          properties={properties}
          onFilterChange={updateFilter}
          onReset={resetFilters}
        />

        {loading ? (
          <p className="muted">Loading work orders...</p>
        ) : workOrders.length === 0 ? (
          <div className="empty-state">
            <p className="muted">No work orders yet.</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
