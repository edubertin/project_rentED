import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../../components/TopNav";
import { API_BASE, apiDelete, apiGet, apiPost, apiPut } from "../../lib/api";
import { requireAuth } from "../../lib/auth";

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [owners, setOwners] = useState([]);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [form, setForm] = useState({
    tag: "",
    is_rented: false,
    owner_name: "",
    real_estate_name: "",
    property_address: "",
    rent_currency: "BRL",
    rent_amount_display: "",
    rent_amount_value: 0,
    payment_day: "",
    tenant_name: "",
    tenant_cpf: "",
    tenant_rg: "",
    tenant_address: "",
    landlord_name: "",
    landlord_cpf: "",
    landlord_rg: "",
    guarantor_name: "",
    guarantor_cpf: "",
    guarantor_rg: "",
    security_deposit_amount: "",
    security_deposit_type: "",
    agency_fee_amount: "",
    agency_fee_type: "",
    start_date: "",
    end_date: "",
    term_months: "",
    early_termination_fee: "",
    late_fee: "",
    indexation_type: "",
    indexation_rate: "",
    sign_date: "",
    contract_number: "",
    document_numbers: "",
    witnesses: "",
    notes: "",
    sensitive_topics: "",
  });
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importFileName, setImportFileName] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [activePropertyId, setActivePropertyId] = useState(null);
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editOwnerQuery, setEditOwnerQuery] = useState("");
  const [editForm, setEditForm] = useState({ ...form });
  const [createPhotos, setCreatePhotos] = useState([]);
  const [editPhotos, setEditPhotos] = useState([]);
  const [editExistingPhotos, setEditExistingPhotos] = useState(0);

  function formatCurrency(value, currency) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return { display: "", cents: 0 };
    const cents = Number(digits);
    const amount = cents / 100;
    const locale = currency === "BRL" ? "pt-BR" : "en-US";
    const display = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return { display, cents };
  }

  function formatFromCents(cents, currency) {
    if (!cents) return "";
    const amount = Number(cents) / 100;
    const locale = currency === "BRL" ? "pt-BR" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function parseCurrency(value) {
    if (!value) return { currency: "BRL", cents: 0, display: "" };
    const raw = String(value);
    const currency = raw.includes("$") && !raw.includes("R$") ? "USD" : "BRL";
    const digits = raw.replace(/\D/g, "");
    if (!digits) return { currency, cents: 0, display: "" };
    const cents = Number(digits);
    return { currency, cents, display: formatFromCents(cents, currency) };
  }

  async function load() {
    setError("");
    try {
      const data = await apiGet("/properties");
      setProperties(data);
    } catch (err) {
      setError(err.message || "Failed to load properties");
    }
  }

  useEffect(() => {
    (async () => {
      const user = await requireAuth(router);
      if (user) {
        setCurrentUser(user);
        if (user.role === "admin") {
          try {
            const data = await apiGet("/users");
            setOwners(data);
          } catch (err) {
            setError(err.message || "Failed to load owners");
          }
        }
        load();
      }
    })();
  }, [router]);

  function openCreate() {
    setModalMode("create");
    setActivePropertyId(null);
    setOwnerUserId("");
    setOwnerQuery("");
      setForm({
        ...form,
        tag: "",
        is_rented: false,
        owner_name: currentUser?.role === "admin" ? "" : currentUser?.name || "",
        real_estate_name: "",
        property_address: "",
        rent_currency: "BRL",
        rent_amount_display: "",
        rent_amount_value: 0,
        payment_day: "",
      tenant_name: "",
      tenant_cpf: "",
      tenant_rg: "",
      tenant_address: "",
      landlord_name: "",
      landlord_cpf: "",
      landlord_rg: "",
      guarantor_name: "",
      guarantor_cpf: "",
      guarantor_rg: "",
      security_deposit_amount: "",
      security_deposit_type: "",
      agency_fee_amount: "",
      agency_fee_type: "",
      start_date: "",
      end_date: "",
      term_months: "",
      early_termination_fee: "",
      late_fee: "",
      indexation_type: "",
      indexation_rate: "",
      sign_date: "",
      contract_number: "",
      document_numbers: "",
      witnesses: "",
      notes: "",
      sensitive_topics: "",
    });
    setCreatePhotos([]);
    setError("");
    setModalOpen(true);
  }

  function openImport() {
    setImportFile(null);
    setImportFileName("");
    setImportOpen(true);
    setError("");
  }

  function openEdit(property) {
    setModalMode("edit");
    setActivePropertyId(property.id);
    const extras = property.extras || {};
    setEditOwnerId(String(property.owner_user_id || ""));
    setEditOwnerQuery("");
    setEditForm({
      tag: extras.tag || extras.label || "",
      is_rented: Boolean(extras.is_rented),
      owner_name: extras.owner_name || "",
      real_estate_name: extras.real_estate_name || "",
      property_address: extras.property_address || "",
      rent_currency: extras.rent_currency || "BRL",
      rent_amount_value: Number(extras.rent_amount_value || 0),
      rent_amount_display: extras.rent_amount_display
        || (extras.rent_amount_value
          ? formatFromCents(Number(extras.rent_amount_value), extras.rent_currency || "BRL")
          : (extras.rent_amount || "")),
      payment_day: extras.payment_day || "",
      tenant_name: extras.tenant_name || "",
      tenant_cpf: extras.tenant_cpf || "",
      tenant_rg: extras.tenant_rg || "",
      tenant_address: extras.tenant_address || "",
      landlord_name: extras.landlord_name || "",
      landlord_cpf: extras.landlord_cpf || "",
      landlord_rg: extras.landlord_rg || "",
      guarantor_name: extras.guarantor_name || "",
      guarantor_cpf: extras.guarantor_cpf || "",
      guarantor_rg: extras.guarantor_rg || "",
      security_deposit_amount: extras.security_deposit_amount || "",
      security_deposit_type: extras.security_deposit_type || "",
      agency_fee_amount: extras.agency_fee_amount || "",
      agency_fee_type: extras.agency_fee_type || "",
      start_date: extras.start_date || "",
      end_date: extras.end_date || "",
      term_months: extras.term_months || "",
      early_termination_fee: extras.early_termination_fee || "",
      late_fee: extras.late_fee || "",
      indexation_type: extras.indexation_type || "",
      indexation_rate: extras.indexation_rate || "",
      sign_date: extras.sign_date || "",
      contract_number: extras.contract_number || "",
      document_numbers: extras.document_numbers || "",
      witnesses: extras.witnesses || "",
      notes: extras.notes || "",
      sensitive_topics: extras.sensitive_topics || "",
    });
    setEditPhotos([]);
    setEditExistingPhotos((property.extras?.photos || []).length);
    setError("");
    setModalOpen(true);
  }

  async function uploadPhotos(propertyId, files) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || "Failed to upload photos");
    }
    return res.json();
  }

  async function uploadContract(propertyId, file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/documents/upload?property_id=${propertyId}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || "Failed to upload contract");
    }
    return res.json();
  }

  async function createProperty(e) {
    e.preventDefault();
    setError("");
    if (!form.tag.trim()) {
      setError("Tag is required.");
      return;
    }
    if (!form.rent_amount_value) {
      setError("Desired rent is required.");
      return;
    }
    if (!createPhotos.length) {
      setError("At least one photo is required.");
      return;
    }
    if (currentUser?.role === "admin" && !ownerUserId) {
      setError("owner_user_id is required");
      return;
    }
    try {
      const created = await apiPost("/properties", {
        owner_user_id: currentUser?.role === "admin" ? Number(ownerUserId) : currentUser?.id,
        extras: {
          ...form,
          tag: form.tag.trim(),
          owner_name: currentUser?.role === "admin"
            ? form.owner_name
            : currentUser?.name || form.owner_name,
          rent_amount_display: form.rent_amount_display,
        },
      });
      await uploadPhotos(created.id, createPhotos);
      if (importFile) {
        await uploadContract(created.id, importFile);
        setImportFile(null);
        setImportFileName("");
      }
      setOwnerUserId("");
      setCreatePhotos([]);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.message || "Failed to create property");
    }
  }

  async function updateProperty(e) {
    e.preventDefault();
    setError("");
    if (!editForm.tag.trim()) {
      setError("Tag is required.");
      return;
    }
    if (!editForm.rent_amount_value) {
      setError("Desired rent is required.");
      return;
    }
    if (editPhotos.length && editExistingPhotos + editPhotos.length > 10) {
      setError("You can upload up to 10 photos per property.");
      return;
    }
    const payload = {
      extras: {
        ...editForm,
        tag: editForm.tag.trim(),
        rent_amount_display: editForm.rent_amount_display,
      },
    };
    if (currentUser?.role === "admin" && editOwnerId) {
      payload.owner_user_id = Number(editOwnerId);
    }
    try {
      await apiPut(`/properties/${activePropertyId}`, payload);
      if (editPhotos.length) {
        await uploadPhotos(activePropertyId, editPhotos);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.message || "Failed to update property");
    }
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importFile) {
      setError("Select a document to import.");
      return;
    }
    setImportLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch(`${API_BASE}/properties/import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Import failed");
      }
      const data = await res.json();
      const fields = data.fields || {};
      const rent = parseCurrency(fields.rent_amount || fields.rent || "");
      setForm({
        ...form,
        tag: fields.contract_number || fields.property_address || "",
        is_rented: Boolean(fields.tenant_name || fields.rent_amount),
        owner_name: fields.landlord_name || form.owner_name,
        real_estate_name: fields.real_estate_name || "",
        property_address: fields.property_address || "",
        rent_currency: rent.currency,
        rent_amount_value: rent.cents,
        rent_amount_display: rent.display,
        payment_day: fields.payment_day || "",
        tenant_name: fields.tenant_name || "",
        tenant_cpf: fields.tenant_cpf || "",
        tenant_rg: fields.tenant_rg || "",
        tenant_address: fields.tenant_address || "",
        landlord_name: fields.landlord_name || "",
        landlord_cpf: fields.landlord_cpf || "",
        landlord_rg: fields.landlord_rg || "",
        guarantor_name: fields.guarantor_name || "",
        guarantor_cpf: fields.guarantor_cpf || "",
        guarantor_rg: fields.guarantor_rg || "",
        security_deposit_amount: fields.security_deposit_amount || "",
        security_deposit_type: fields.security_deposit_type || "",
        agency_fee_amount: fields.agency_fee_amount || "",
        agency_fee_type: fields.agency_fee_type || "",
        start_date: fields.start_date || "",
        end_date: fields.end_date || "",
        term_months: fields.term_months || "",
        early_termination_fee: fields.early_termination_fee || "",
        late_fee: fields.late_fee || "",
        indexation_type: fields.indexation_type || "",
        indexation_rate: fields.indexation_rate || "",
        sign_date: fields.sign_date || "",
        contract_number: fields.contract_number || "",
        document_numbers: fields.document_numbers || "",
        witnesses: Array.isArray(fields.witnesses)
          ? fields.witnesses.join("; ")
          : fields.witnesses || "",
        notes: fields.notes || "",
        sensitive_topics: Array.isArray(fields.sensitive_topics)
          ? fields.sensitive_topics.join("; ")
          : fields.sensitive_topics || "",
      });
      setImportFileName(importFile.name);
      setImportOpen(false);
      setModalOpen(true);
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setImportLoading(false);
    }
  }

  async function removeProperty(id) {
    setError("");
    try {
      await apiDelete(`/properties/${id}`);
      await load();
    } catch (err) {
      setError(err.message || "Failed to delete property");
    }
  }

  return (
    <div className="container">
      <TopNav />

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Properties</h2>
            <p className="muted">
              {currentUser?.role === "admin"
                ? "Admins can view all properties."
                : "Property owners only see properties assigned to them."}
            </p>
          </div>
          <div className="actions">
            <button className="btn-muted" onClick={openImport}>Import Property</button>
            <button className="btn-primary" onClick={openCreate}>Create Property</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Photo</th>
                <th>Label</th>
                {currentUser?.role === "admin" && <th>Owner ID</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => {
                const photos = p.extras?.photos || [];
                const firstPhoto = photos[0]?.url;
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      {firstPhoto ? (
                        <img
                          className="property-thumb"
                          src={`${API_BASE}${firstPhoto}`}
                          alt={p.extras?.tag || p.extras?.label || "Property"}
                        />
                      ) : (
                        <span className="muted">No photo</span>
                      )}
                    </td>
                    <td>
                      <Link href={`/properties/${p.id}`}>
                        {p.extras?.tag || p.extras?.label || "Property"}
                      </Link>
                    </td>
                    {currentUser?.role === "admin" && <td>{p.owner_user_id}</td>}
                    <td>
                      <div className="actions">
                        <button className="btn-muted" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                        <button className="btn-danger" onClick={() => removeProperty(p.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {properties.length === 0 && (
                <tr>
                  <td colSpan={currentUser?.role === "admin" ? 5 : 4} className="muted">
                    No properties yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{modalMode === "create" ? "Create property" : "Edit property"}</h3>
              <button className="btn-muted" onClick={() => setModalOpen(false)}>
                Close
              </button>
            </div>
            {modalMode === "create" ? (
              <form onSubmit={createProperty}>
                <div className="modal-body">
                  <div className="form-grid">
                    {currentUser?.role === "admin" ? (
                      <div className="form-span-2">
                        <label>Owner</label>
                        <input
                          value={ownerQuery}
                          onChange={(e) => setOwnerQuery(e.target.value)}
                          placeholder="Search by name or username"
                        />
                        {ownerQuery && (
                          <div className="owner-options">
                            {owners
                              .filter((owner) => {
                                const term = ownerQuery.toLowerCase();
                                return (
                                  owner.name.toLowerCase().includes(term) ||
                                  owner.username.toLowerCase().includes(term)
                                );
                              })
                              .slice(0, 6)
                              .map((owner) => (
                                <button
                                  type="button"
                                  key={owner.id}
                                  className="owner-option"
                                  onClick={() => {
                                    setOwnerUserId(String(owner.id));
                                    setForm({ ...form, owner_name: owner.name });
                                    setOwnerQuery(`${owner.name} (${owner.username})`);
                                  }}
                                >
                                  {owner.name} ({owner.username})
                                </button>
                              ))}
                          </div>
                        )}
                        {ownerUserId && (
                          <small className="muted">Selected owner id: {ownerUserId}</small>
                        )}
                      </div>
                    ) : (
                      <div className="form-span-2">
                        <label>Owner</label>
                        <input value={currentUser?.name || ""} readOnly />
                      </div>
                    )}
                    <div>
                      <label>Tag</label>
                      <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
                    </div>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        checked={form.is_rented}
                        onChange={(e) => setForm({ ...form, is_rented: e.target.checked })}
                      />
                      <span>Rented</span>
                    </div>
                    <div>
                      <label>Owner Name</label>
                      <input
                        value={form.owner_name}
                        onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                        readOnly={currentUser?.role !== "admin"}
                      />
                    </div>
                    <div>
                      <label>Property Address</label>
                      <input value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
                    </div>
                    <div>
                      <label>{form.is_rented ? "Rent Amount" : "Desired Rent"}</label>
                      <div className="input-group">
                        <select
                          value={form.rent_currency}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              rent_currency: e.target.value,
                              rent_amount_display: formatFromCents(form.rent_amount_value, e.target.value),
                            })
                          }
                        >
                          <option value="BRL">R$</option>
                          <option value="USD">$</option>
                        </select>
                        <input
                          inputMode="numeric"
                          value={form.rent_amount_display}
                          onChange={(e) =>
                            {
                              const result = formatCurrency(e.target.value, form.rent_currency);
                              setForm({
                                ...form,
                                rent_amount_display: result.display,
                                rent_amount_value: result.cents,
                              });
                            }
                          }
                        />
                      </div>
                    </div>
                    <div className="form-span-2">
                      <label>Photos (1-10)</label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setCreatePhotos(Array.from(e.target.files || []))}
                      />
                      <small className="muted">
                        {createPhotos.length
                          ? `${createPhotos.length} selected`
                          : "At least one photo is required."}
                      </small>
                    </div>
                    {form.is_rented && (
                      <>
                        <div className="form-section">
                          <strong>Rental Details</strong>
                        </div>
                        <div>
                          <label>Real Estate Name</label>
                          <input value={form.real_estate_name} onChange={(e) => setForm({ ...form, real_estate_name: e.target.value })} />
                        </div>
                        <div>
                          <label>Tenant Name</label>
                          <input value={form.tenant_name} onChange={(e) => setForm({ ...form, tenant_name: e.target.value })} />
                        </div>
                        <div>
                          <label>Tenant CPF</label>
                          <input value={form.tenant_cpf} onChange={(e) => setForm({ ...form, tenant_cpf: e.target.value })} />
                        </div>
                        <div>
                          <label>Tenant RG</label>
                          <input value={form.tenant_rg} onChange={(e) => setForm({ ...form, tenant_rg: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Tenant Address</label>
                          <input value={form.tenant_address} onChange={(e) => setForm({ ...form, tenant_address: e.target.value })} />
                        </div>
                        <div>
                          <label>Payment Day</label>
                          <input value={form.payment_day} onChange={(e) => setForm({ ...form, payment_day: e.target.value })} />
                        </div>
                        <div>
                          <label>Security Deposit Amount</label>
                          <input value={form.security_deposit_amount} onChange={(e) => setForm({ ...form, security_deposit_amount: e.target.value })} />
                        </div>
                        <div>
                          <label>Security Deposit Type</label>
                          <input value={form.security_deposit_type} onChange={(e) => setForm({ ...form, security_deposit_type: e.target.value })} />
                        </div>
                        <div>
                          <label>Agency Fee Amount</label>
                          <input value={form.agency_fee_amount} onChange={(e) => setForm({ ...form, agency_fee_amount: e.target.value })} />
                        </div>
                        <div>
                          <label>Agency Fee Type</label>
                          <input value={form.agency_fee_type} onChange={(e) => setForm({ ...form, agency_fee_type: e.target.value })} />
                        </div>
                        <div>
                          <label>Start Date</label>
                          <input value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                        </div>
                        <div>
                          <label>End Date</label>
                          <input value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                        </div>
                        <div>
                          <label>Term Months</label>
                          <input value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })} />
                        </div>
                        <div>
                          <label>Early Termination Fee</label>
                          <input value={form.early_termination_fee} onChange={(e) => setForm({ ...form, early_termination_fee: e.target.value })} />
                        </div>
                        <div>
                          <label>Late Fee</label>
                          <input value={form.late_fee} onChange={(e) => setForm({ ...form, late_fee: e.target.value })} />
                        </div>
                        <div>
                          <label>Indexation Type</label>
                          <input value={form.indexation_type} onChange={(e) => setForm({ ...form, indexation_type: e.target.value })} />
                        </div>
                        <div>
                          <label>Indexation Rate</label>
                          <input value={form.indexation_rate} onChange={(e) => setForm({ ...form, indexation_rate: e.target.value })} />
                        </div>
                        <div>
                          <label>Sign Date</label>
                          <input value={form.sign_date} onChange={(e) => setForm({ ...form, sign_date: e.target.value })} />
                        </div>
                        <div>
                          <label>Contract Number</label>
                          <input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Document Numbers</label>
                          <input value={form.document_numbers} onChange={(e) => setForm({ ...form, document_numbers: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Witnesses</label>
                          <input value={form.witnesses} onChange={(e) => setForm({ ...form, witnesses: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Notes</label>
                          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Sensitive Topics</label>
                          <input value={form.sensitive_topics} onChange={(e) => setForm({ ...form, sensitive_topics: e.target.value })} />
                        </div>
                      </>
                    )}
                    <div className="form-span-2">
                      <small className="muted">
                        {currentUser?.role === "admin"
                          ? "Choose an owner id from Users."
                          : "This property will be assigned to your account."}
                      </small>
                    </div>
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary">Create</button>
                  <button type="button" className="btn-muted" onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                </div>
                {importFileName && (
                  <small className="muted">
                    Source contract will be attached: {importFileName}
                  </small>
                )}
              </form>
            ) : (
              <form onSubmit={updateProperty}>
                <div className="modal-body">
                  <div className="form-grid">
                    {currentUser?.role === "admin" ? (
                      <div className="form-span-2">
                        <label>Owner</label>
                        <input
                          value={editOwnerQuery}
                          onChange={(e) => setEditOwnerQuery(e.target.value)}
                          placeholder="Search by name or username"
                        />
                        {editOwnerQuery && (
                          <div className="owner-options">
                            {owners
                              .filter((owner) => {
                                const term = editOwnerQuery.toLowerCase();
                                return (
                                  owner.name.toLowerCase().includes(term) ||
                                  owner.username.toLowerCase().includes(term)
                                );
                              })
                              .slice(0, 6)
                              .map((owner) => (
                                <button
                                  type="button"
                                  key={owner.id}
                                  className="owner-option"
                                  onClick={() => {
                                    setEditOwnerId(String(owner.id));
                                    setEditForm({ ...editForm, owner_name: owner.name });
                                    setEditOwnerQuery(`${owner.name} (${owner.username})`);
                                  }}
                                >
                                  {owner.name} ({owner.username})
                                </button>
                              ))}
                          </div>
                        )}
                        {editOwnerId && (
                          <small className="muted">Selected owner id: {editOwnerId}</small>
                        )}
                      </div>
                    ) : (
                      <div className="form-span-2">
                        <label>Owner</label>
                        <input value={currentUser?.name || ""} readOnly />
                      </div>
                    )}
                    <div>
                      <label>Tag</label>
                      <input value={editForm.tag} onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })} />
                    </div>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        checked={editForm.is_rented}
                        onChange={(e) => setEditForm({ ...editForm, is_rented: e.target.checked })}
                      />
                      <span>Rented</span>
                    </div>
                    <div>
                      <label>Owner Name</label>
                      <input
                        value={editForm.owner_name}
                        onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                        readOnly={currentUser?.role !== "admin"}
                      />
                    </div>
                    <div>
                      <label>Property Address</label>
                      <input value={editForm.property_address} onChange={(e) => setEditForm({ ...editForm, property_address: e.target.value })} />
                    </div>
                    <div>
                      <label>{editForm.is_rented ? "Rent Amount" : "Desired Rent"}</label>
                      <div className="input-group">
                        <select
                          value={editForm.rent_currency}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              rent_currency: e.target.value,
                              rent_amount_display: formatFromCents(editForm.rent_amount_value, e.target.value),
                            })
                          }
                        >
                          <option value="BRL">R$</option>
                          <option value="USD">$</option>
                        </select>
                        <input
                          inputMode="numeric"
                          value={editForm.rent_amount_display}
                          onChange={(e) =>
                            {
                              const result = formatCurrency(e.target.value, editForm.rent_currency);
                              setEditForm({
                                ...editForm,
                                rent_amount_display: result.display,
                                rent_amount_value: result.cents,
                              });
                            }
                          }
                        />
                      </div>
                    </div>
                    <div className="form-span-2">
                      <label>Add Photos (optional)</label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => setEditPhotos(Array.from(e.target.files || []))}
                      />
                      <small className="muted">
                        {editExistingPhotos} existing, {editPhotos.length} selected. Max 10 total.
                      </small>
                    </div>
                    {editForm.is_rented && (
                      <>
                        <div className="form-section">
                          <strong>Rental Details</strong>
                        </div>
                        <div>
                          <label>Real Estate Name</label>
                          <input value={editForm.real_estate_name} onChange={(e) => setEditForm({ ...editForm, real_estate_name: e.target.value })} />
                        </div>
                        <div>
                          <label>Tenant Name</label>
                          <input value={editForm.tenant_name} onChange={(e) => setEditForm({ ...editForm, tenant_name: e.target.value })} />
                        </div>
                        <div>
                          <label>Tenant CPF</label>
                          <input value={editForm.tenant_cpf} onChange={(e) => setEditForm({ ...editForm, tenant_cpf: e.target.value })} />
                        </div>
                        <div>
                          <label>Tenant RG</label>
                          <input value={editForm.tenant_rg} onChange={(e) => setEditForm({ ...editForm, tenant_rg: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Tenant Address</label>
                          <input value={editForm.tenant_address} onChange={(e) => setEditForm({ ...editForm, tenant_address: e.target.value })} />
                        </div>
                        <div>
                          <label>Payment Day</label>
                          <input value={editForm.payment_day} onChange={(e) => setEditForm({ ...editForm, payment_day: e.target.value })} />
                        </div>
                        <div>
                          <label>Security Deposit Amount</label>
                          <input value={editForm.security_deposit_amount} onChange={(e) => setEditForm({ ...editForm, security_deposit_amount: e.target.value })} />
                        </div>
                        <div>
                          <label>Security Deposit Type</label>
                          <input value={editForm.security_deposit_type} onChange={(e) => setEditForm({ ...editForm, security_deposit_type: e.target.value })} />
                        </div>
                        <div>
                          <label>Agency Fee Amount</label>
                          <input value={editForm.agency_fee_amount} onChange={(e) => setEditForm({ ...editForm, agency_fee_amount: e.target.value })} />
                        </div>
                        <div>
                          <label>Agency Fee Type</label>
                          <input value={editForm.agency_fee_type} onChange={(e) => setEditForm({ ...editForm, agency_fee_type: e.target.value })} />
                        </div>
                        <div>
                          <label>Start Date</label>
                          <input value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
                        </div>
                        <div>
                          <label>End Date</label>
                          <input value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
                        </div>
                        <div>
                          <label>Term Months</label>
                          <input value={editForm.term_months} onChange={(e) => setEditForm({ ...editForm, term_months: e.target.value })} />
                        </div>
                        <div>
                          <label>Early Termination Fee</label>
                          <input value={editForm.early_termination_fee} onChange={(e) => setEditForm({ ...editForm, early_termination_fee: e.target.value })} />
                        </div>
                        <div>
                          <label>Late Fee</label>
                          <input value={editForm.late_fee} onChange={(e) => setEditForm({ ...editForm, late_fee: e.target.value })} />
                        </div>
                        <div>
                          <label>Indexation Type</label>
                          <input value={editForm.indexation_type} onChange={(e) => setEditForm({ ...editForm, indexation_type: e.target.value })} />
                        </div>
                        <div>
                          <label>Indexation Rate</label>
                          <input value={editForm.indexation_rate} onChange={(e) => setEditForm({ ...editForm, indexation_rate: e.target.value })} />
                        </div>
                        <div>
                          <label>Sign Date</label>
                          <input value={editForm.sign_date} onChange={(e) => setEditForm({ ...editForm, sign_date: e.target.value })} />
                        </div>
                        <div>
                          <label>Contract Number</label>
                          <input value={editForm.contract_number} onChange={(e) => setEditForm({ ...editForm, contract_number: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Document Numbers</label>
                          <input value={editForm.document_numbers} onChange={(e) => setEditForm({ ...editForm, document_numbers: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Witnesses</label>
                          <input value={editForm.witnesses} onChange={(e) => setEditForm({ ...editForm, witnesses: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Notes</label>
                          <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                        </div>
                        <div className="form-span-2">
                          <label>Sensitive Topics</label>
                          <input value={editForm.sensitive_topics} onChange={(e) => setEditForm({ ...editForm, sensitive_topics: e.target.value })} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-primary">Save</button>
                  <button type="button" className="btn-muted" onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}
      {importOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Import property from contract</h3>
              <button className="btn-muted" onClick={() => setImportOpen(false)}>
                Close
              </button>
            </div>
            <form onSubmit={handleImport}>
              <div className="modal-body">
                <label>Contract file</label>
                <input
                  type="file"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <small className="muted">
                  We will extract fields and prefill the property form.
                </small>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={importLoading}>
                  {importLoading ? "Importing..." : "Import"}
                </button>
                <button type="button" className="btn-muted" onClick={() => setImportOpen(false)}>
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
