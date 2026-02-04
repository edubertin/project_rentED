import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../components/TopNav";
import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";
import { requireAuth } from "../lib/auth";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "real_estate", label: "Real Estate" },
  { value: "finance", label: "Finance" },
  { value: "service_provider", label: "Service Provider" },
  { value: "property_owner", label: "Property Owner" },
];

const emptyForm = {
  username: "",
  password: "",
  role: "real_estate",
  name: "",
  cell_number: "",
  email: "",
  cpf: "",
};

function formatCellNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 9) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 8)} ${digits.slice(8)}`;
}

function isCellNumberValid(value) {
  return /^\(\d{3}\) \d{5} \d{4}$/.test(value);
}

export default function UsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [form, setForm] = useState(emptyForm);
  const [activeUserId, setActiveUserId] = useState(null);

  useEffect(() => {
    async function load() {
      const me = await requireAuth(router);
      if (!me) return;
      setCurrentUser(me);
      if (me.role !== "admin") {
        setLoading(false);
        return;
      }
      try {
        const data = await apiGet("/users");
        setUsers(data);
      } catch (err) {
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  function openCreate() {
    setModalMode("create");
    setActiveUserId(null);
    setForm({ ...emptyForm, role: "real_estate" });
    setError("");
    setModalOpen(true);
  }

  function openEdit(user) {
    setModalMode("edit");
    setActiveUserId(user.id);
    setForm({
      username: user.username,
      password: "",
      role: user.role,
      name: user.name,
      cell_number: user.cell_number,
      email: user.email || "",
      cpf: user.cpf || "",
    });
    setError("");
    setModalOpen(true);
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");
    if (modalMode === "create") {
      if (!form.username || !form.password || !form.name || !form.cell_number || !form.email || !form.cpf) {
        setError("Fill in all required fields.");
        return;
      }
      if (!/^[A-Za-z0-9]{3,80}$/.test(form.username)) {
        setError("Username must be one word (letters/numbers only).");
        return;
      }
      if (!/^[A-Za-z ]{2,120}$/.test(form.name)) {
        setError("Name must contain letters only.");
        return;
      }
      if (!/[A-Z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password) || form.password.length < 8) {
        setError("Password must be 8+ chars and include 1 uppercase, 1 number, 1 special.");
        return;
      }
      if (!isCellNumberValid(form.cell_number)) {
        setError("Cell number must match (000) 00000 0000.");
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
        setError("Provide a valid email.");
        return;
      }
      if (form.cpf.replace(/\D/g, "").length !== 11) {
        setError("CPF must have 11 digits.");
        return;
      }
      try {
        const created = await apiPost("/users", form);
        setUsers((prev) => [...prev, created]);
        setModalOpen(false);
      } catch (err) {
        setError(err.message || "Failed to create user.");
      }
      return;
    }

    const payload = {
      username: form.username,
      role: form.role,
      name: form.name,
      cell_number: form.cell_number,
      email: form.email,
      cpf: form.cpf,
    };
    if (form.password) payload.password = form.password;
    if (!/^[A-Za-z0-9]{3,80}$/.test(form.username)) {
      setError("Username must be one word (letters/numbers only).");
      return;
    }
    if (!/^[A-Za-z ]{2,120}$/.test(form.name)) {
      setError("Name must contain letters only.");
      return;
    }
    if (form.password && (!/[A-Z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password) || form.password.length < 8)) {
      setError("Password must be 8+ chars and include 1 uppercase, 1 number, 1 special.");
      return;
    }
    if (!isCellNumberValid(form.cell_number)) {
      setError("Cell number must match (000) 00000 0000.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setError("Provide a valid email.");
      return;
    }
    if (form.cpf.replace(/\D/g, "").length !== 11) {
      setError("CPF must have 11 digits.");
      return;
    }
    try {
      const updated = await apiPut(`/users/${activeUserId}`, payload);
      setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
      setModalOpen(false);
    } catch (err) {
      setError(err.message || "Failed to update user.");
    }
  }

  async function handleDelete(userId) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      await apiDelete(`/users/${userId}`);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      setError("Failed to delete user.");
    }
  }

  return (
    <div className="container">
      <TopNav />
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Users</h2>
            <p className="muted">
              Manage access roles. Required fields: username, password, role, name, email, CPF, cell number.
            </p>
          </div>
          {currentUser?.role === "admin" && (
            <button className="btn-primary" onClick={openCreate}>
              Create User
            </button>
          )}
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : currentUser?.role !== "admin" ? (
          <p>Admin access required.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>CPF</th>
                  <th>Cell</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.name}</td>
                    <td>
                      <span className="pill">{user.role}</span>
                    </td>
                    <td>{user.email || "-"}</td>
                    <td>{user.cpf || "-"}</td>
                    <td>{user.cell_number}</td>
                    <td>
                      {user.role === "admin" ? (
                        <span className="muted">Protected</span>
                      ) : (
                        <div className="actions">
                          <button className="btn-muted" onClick={() => openEdit(user)}>
                            Edit
                          </button>
                          <button className="btn-danger" onClick={() => handleDelete(user.id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="8" className="muted">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{modalMode === "create" ? "Create user" : "Edit user"}</h3>
              <button className="btn-muted" onClick={() => setModalOpen(false)}>
                Close
              </button>
            </div>
            <form onSubmit={submitForm}>
              <label>Username</label>
              <input
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                autoComplete="username"
                placeholder="ex: MARIASILVA1"
                required
              />
              <label>Password {modalMode === "edit" && <span className="muted">(leave blank to keep)</span>}</label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete={modalMode === "create" ? "new-password" : "current-password"}
                placeholder="ex: RentED@2026"
                required={modalMode === "create"}
              />
              <small>Password: 8+ chars, 1 uppercase, 1 number, 1 special.</small>
              <label>Role</label>
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <label>Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                autoComplete="name"
                placeholder="ex: Maria Silva"
                required
              />
              <label>Email</label>
              <input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
                placeholder="ex: maria@imoveis.com"
                required
              />
              <label>CPF</label>
              <input
                value={form.cpf}
                onChange={(event) => setForm({ ...form, cpf: event.target.value })}
                placeholder="000.000.000-00"
                required
              />
              <label>Cell Number</label>
              <input
                value={form.cell_number}
                onChange={(event) =>
                  setForm({ ...form, cell_number: formatCellNumber(event.target.value) })
                }
                placeholder="(000) 00000 0000"
                autoComplete="tel"
                inputMode="numeric"
                required
              />
              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  {modalMode === "create" ? "Create user" : "Save changes"}
                </button>
                <button type="button" className="btn-muted" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
