import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const data = await apiGet("/work-orders");
      setWorkOrders(data);
    } catch (err) {
      setError("Failed to load work orders");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createWorkOrder(e) {
    e.preventDefault();
    if (!propertyId) {
      setError("property_id is required");
      return;
    }
    try {
      await apiPost("/work-orders", {
        property_id: Number(propertyId),
        extras: { title: title || "Work Order" },
      });
      setPropertyId("");
      setTitle("");
      await load();
    } catch (err) {
      setError("Failed to create work order");
    }
  }

  return (
    <div className="container">
      <nav className="nav">
        <Link href="/">Properties</Link>
        <Link href="/work-orders">Work Orders</Link>
        <Link href="/upload">Upload Document</Link>
        <Link href="/review">Review</Link>
      </nav>

      <h1>Work Orders</h1>
      <div className="grid">
        <div className="card">
          <h3>Create Work Order</h3>
          <form onSubmit={createWorkOrder}>
            <label>Property ID</label>
            <input value={propertyId} onChange={(e) => setPropertyId(e.target.value)} />
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
            <div style={{ marginTop: 12 }}>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
        <div className="card">
          <h3>List</h3>
          {workOrders.map((w) => (
            <div key={w.id}>
              #{w.id} — property {w.property_id} — {w.extras?.title || "work"}
            </div>
          ))}
        </div>
      </div>
      {error && <p style={{ color: "salmon" }}>{error}</p>}
    </div>
  );
}
