import Link from "next/link";
import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "../lib/api";

export default function Home() {
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
    load();
  }, []);

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
      <nav className="nav">
        <Link href="/">Properties</Link>
        <Link href="/work-orders">Work Orders</Link>
        <Link href="/upload">Upload Document</Link>
      </nav>

      <h1>Properties</h1>
      <div className="grid">
        <div className="card">
          <h3>Create Property</h3>
          <form onSubmit={createProperty}>
            <label>Owner User ID</label>
            <input value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} />
            <label>Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
            <small>TODO: replace owner_user_id with real user selector.</small>
            <div style={{ marginTop: 12 }}>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
        <div className="card">
          <h3>List</h3>
          {properties.map((p) => (
            <div key={p.id} style={{ marginBottom: 8 }}>
              <Link href={`/properties/${p.id}`}>#{p.id} {p.extras?.label || "Property"}</Link>
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
