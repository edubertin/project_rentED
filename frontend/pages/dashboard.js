import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import TopNav from "../components/TopNav";
import { apiGet } from "../lib/api";
import { requireAuth } from "../lib/auth";

const LeafletMap = dynamic(() => import("../components/LeafletMap"), { ssr: false });

export default function DashboardPage() {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [workOrders, setWorkOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const user = await requireAuth(router);
      if (!user) return;
      try {
        const data = await apiGet("/properties");
        setProperties(data);
        const defaultProperty = pickDefaultProperty(data, user.role);
        if (defaultProperty) {
          setSelectedId(String(defaultProperty.id));
        }
      } catch (err) {
        setError(err.message || "Failed to load properties.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!selectedId) {
      setWorkOrders([]);
      return;
    }
    (async () => {
      try {
        const orders = await apiGet(`/work-orders?property_id=${selectedId}`);
        setWorkOrders(
          orders.sort((a, b) => (a.status === "closed" ? 1 : -1))
        );
      } catch (err) {
        setError(err.message || "Failed to load work orders.");
      }
    })();
  }, [selectedId]);

  const filteredProperties = useMemo(() => {
    if (!search) return properties;
    const query = search.toLowerCase();
    return properties.filter((p) =>
      String(p.extras?.tag || p.extras?.label || "")
        .toLowerCase()
        .includes(query) ||
      String(p.extras?.property_address || "")
        .toLowerCase()
        .includes(query)
    );
  }, [properties, search]);

  const selectedProperty = properties.find((p) => String(p.id) === selectedId);
  const photoUrl = selectedProperty?.extras?.photos?.[0]?.url;

  return (
    <div className="container dashboard-page">
      <TopNav />
      <div className="dashboard-header" />

      <div className="dashboard-search card">
        <input
          type="search"
          placeholder="Buscar casa, atualiza em baixo quando selecionada"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Select a property</option>
          {filteredProperties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.extras?.tag || property.extras?.label || `Property ${property.id}`}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="dashboard-grid">
        <div className="dashboard-card dashboard-property-card">
          {loading ? (
            <div className="dashboard-placeholder">Loading property...</div>
          ) : selectedProperty ? (
            <>
              <div className="dashboard-photo">
                {photoUrl ? (
                  <img src={`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"}${photoUrl}`} alt="Property" />
                ) : (
                  <div className="dashboard-placeholder">No photo</div>
                )}
              </div>
              <div className="dashboard-photo-meta">
                <div>
                  <strong>{selectedProperty.extras?.tag || "Property"}</strong>
                  <span className="muted">
                    {selectedProperty.extras?.bedrooms || 0} bd •{" "}
                    {selectedProperty.extras?.bathrooms || 0} ba •{" "}
                    {selectedProperty.extras?.parking_spaces || 0} parking
                  </span>
                </div>
                <span className="dashboard-rent">
                  {selectedProperty.extras?.current_rent_display || selectedProperty.extras?.desired_rent_display || "R$ 0,00"}
                </span>
              </div>
            </>
          ) : (
            <div className="dashboard-placeholder">Select a property to preview.</div>
          )}
        </div>

        <div className="dashboard-card dashboard-map-card">
          <LeafletMap property={selectedProperty} />
          <div className="map-address">
            {selectedProperty?.extras?.property_address || "Select a property to view address."}
          </div>
        </div>
      </div>

      <div className="dashboard-card">
        <h3>Work orders</h3>
        <div className="table-wrap">
          {workOrders.length === 0 ? (
            <p className="muted">No work orders for this property.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <tr key={wo.id}>
                    <td>{wo.id}</td>
                    <td>{wo.title}</td>
                    <td><span className="pill">{wo.status}</span></td>
                    <td><span className="pill">{wo.type}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function pickDefaultProperty(props, role) {
  if (!props || props.length === 0) return null;
  const rented = props
    .filter((p) => p.extras?.is_rented)
    .sort((a, b) => (b.extras?.current_rent_value || 0) - (a.extras?.current_rent_value || 0));
  if (role === "admin" && rented.length) return rented[0];
  if (rented.length) return rented[0];
  return props[0];
}
