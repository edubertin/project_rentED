import { useState } from "react";
import TopNav from "../components/TopNav";
import { API_BASE } from "../lib/api";

export default function Upload() {
  const [propertyId, setPropertyId] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  async function upload(e) {
    e.preventDefault();
    setMessage("");
    if (!propertyId || !file) {
      setMessage("property_id and file are required");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/documents/upload?property_id=${propertyId}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      setMessage("Upload failed");
      return;
    }
    const data = await res.json();
    setMessage(`Uploaded document #${data.id}`);
  }

  return (
    <div className="container">
      <TopNav />

      <h1>Upload Document</h1>
      <div className="card">
        <form onSubmit={upload}>
          <label>Property ID</label>
          <input value={propertyId} onChange={(e) => setPropertyId(e.target.value)} />
          <label>File</label>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <div style={{ marginTop: 12 }}>
            <button type="submit">Upload</button>
          </div>
        </form>
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
