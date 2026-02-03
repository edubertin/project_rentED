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
  const [role, setRole] = useState("property_owner");
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

  async function createUser(e) {
    e.preventDefault();
    setError("");
    try {
      const user = await apiPost("/users", {
        username: `user_${Date.now()}`,
        password: "Temp12345!",
        role,
        name: "New User",
        cell_number: "(000) 00000 0000",
        extras: {},
      });
      setOwnerUserId(String(user.id));
    } catch (err) {
      setError("Failed to create user");
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
          <h3>Create User</h3>
          <form onSubmit={createUser}>
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">admin</option>
              <option value="real_estate">real_estate</option>
              <option value="finance">finance</option>
              <option value="service_provider">service_provider</option>
              <option value="property_owner">property_owner</option>
            </select>
            <small>Admin-only. Update username/password after creation.</small>
            <div style={{ marginTop: 12 }}>
              <button type="submit">Create User</button>
            </div>
          </form>
        </div>
        <div className="card">
          <h3>Create Property</h3>
          <form onSubmit={createProperty}>
            <label>Owner User ID</label>
            <input value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} />
            <label>Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
            <small>Use the user created above or an existing user id.</small>
            <div style={{ marginTop: 12 }}>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
        <div className="card">
          <h3>List</h3>
          {properties.map((p) => (
            <div key={p.id} style={{ marginBottom: 8 }}>
              <Link href={`/properties/${p.id}`}>
                #{p.id} {p.extras?.label || "Property"}
              </Link>
              <button style={{ marginLeft: 8 }} onClick={() => removeProperty(p.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
      {error && <p style={{ color: "salmon" }}>{error}</p>}
    </div>
  );
}
