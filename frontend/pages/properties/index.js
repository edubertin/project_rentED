import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../../components/TopNav";
import { apiDelete, apiGet, apiPost } from "../../lib/api";
import { requireAuth } from "../../lib/auth";

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const data = await apiGet("/properties");
      setProperties(data);
    } catch (err) {
      setError("Failed to load properties");
    }
  }

  useEffect(() => {
    (async () => {
      const user = await requireAuth(router);
      if (user) {
        load();
      }
    })();
  }, [router]);

  async function createProperty(e) {
    e.preventDefault();
    setError("");
    if (!ownerUserId) {
      setError("owner_user_id is required");
      return;
    }
    try {
      await apiPost("/properties", {
        owner_user_id: Number(ownerUserId),
        extras: { label: label || "Property" },
      });
      setOwnerUserId("");
      setLabel("");
      await load();
    } catch (err) {
      setError("Failed to create property");
    }
  }

  async function removeProperty(id) {
    setError("");
    try {
      await apiDelete(`/properties/${id}`);
      await load();
    } catch (err) {
      setError("Failed to delete property");
    }
  }

  return (
    <div className="container">
      <TopNav />

      <h1>Properties</h1>
      <div className="grid">
        <div className="card">
          <div className="card-header">
            <h3>Create Property</h3>
          </div>
          <form onSubmit={createProperty}>
            <label>Owner User ID</label>
            <input value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} />
            <label>Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
            <small className="muted">Use an existing user id from the Users page.</small>
            <div style={{ marginTop: 12 }}>
              <button type="submit" className="btn-primary">Create</button>
            </div>
          </form>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>List</h3>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Label</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      <Link href={`/properties/${p.id}`}>
                        {p.extras?.label || "Property"}
                      </Link>
                    </td>
                    <td>
                      <button className="btn-danger" onClick={() => removeProperty(p.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {properties.length === 0 && (
                  <tr>
                    <td colSpan="3" className="muted">
                      No properties yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
