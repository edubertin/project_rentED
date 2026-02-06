import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TopNav from "../../components/TopNav";
import { API_BASE, apiDelete, apiGet, apiPost, apiPut } from "../../lib/api";
import { requireAuth } from "../../lib/auth";

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [owners, setOwners] = useState([]);
  const [photoPreview, setPhotoPreview] = useState("");
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [rentedFile, setRentedFile] = useState(null);
  const [rentedFields, setRentedFields] = useState({});
  const [rentedSelections, setRentedSelections] = useState(new Set());
  const [rentedLoading, setRentedLoading] = useState(false);
  const [rentedApplied, setRentedApplied] = useState(false);
  const [editRentedFile, setEditRentedFile] = useState(null);
  const [editRentedFields, setEditRentedFields] = useState({});
  const [editRentedSelections, setEditRentedSelections] = useState(new Set());
  const [editRentedLoading, setEditRentedLoading] = useState(false);
  const [editRentedApplied, setEditRentedApplied] = useState(false);
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showRentedOnly, setShowRentedOnly] = useState(false);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState({
    tag: "",
    is_rented: false,
    owner_name: "",
    real_estate_name: "",
    contract_title: "",
    document_platform: "",
    document_code: "",
    landlord_address: "",
    administrator_name: "",
    administrator_creci: "",
    administrator_address: "",
    admin_fee_percent: "",
    guarantee_provider_name: "",
    guarantee_provider_cnpj: "",
    guarantee_provider_address: "",
    guarantee_annex_reference: "",
    payment_method: "",
    includes_condominium: false,
    includes_iptu: false,
    late_fee_percent: "",
    interest_percent_month: "",
    tolerance_rule: "",
    breach_penalty_months: "",
    forum_city: "",
    forum_state: "",
    signed_city: "",
    signed_state: "",
    property_address: "",
    rent_currency: "BRL",
    rent_amount_display: "",
    rent_amount_value: 0,
    desired_rent_display: "",
    desired_rent_value: 0,
    current_rent_display: "",
    current_rent_value: 0,
    bedrooms: "",
    bathrooms: "",
    parking_spaces: "",
    assessed_value: "",
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
    owner_email: "",
    owner_cpf: "",
    owner_cell_number: "",
    contract_fields: {},
  });
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
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
    setLoading(true);
    try {
      const data = await apiGet("/properties");
      setProperties(data);
    } catch (err) {
      setError(err.message || "Failed to load properties");
    } finally {
      setLoading(false);
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

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick(event) {
      if (event.target.closest(".kebab-menu") || event.target.closest(".kebab-trigger")) return;
      setMenuOpenId(null);
    }
    function handleKey(event) {
      if (event.key === "Escape") setMenuOpenId(null);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuOpenId]);

  useEffect(() => {
    if (!filtersOpen) return;
    function handleKey(event) {
      if (event.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filtersOpen]);

  function toggleMenu(propertyId) {
    setMenuOpenId((current) => (current === propertyId ? null : propertyId));
  }

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
        contract_title: "",
        document_platform: "",
        document_code: "",
        landlord_address: "",
        administrator_name: "",
        administrator_creci: "",
        administrator_address: "",
        admin_fee_percent: "",
        guarantee_provider_name: "",
        guarantee_provider_cnpj: "",
        guarantee_provider_address: "",
        guarantee_annex_reference: "",
        payment_method: "",
        includes_condominium: false,
        includes_iptu: false,
        late_fee_percent: "",
        interest_percent_month: "",
        tolerance_rule: "",
        breach_penalty_months: "",
        forum_city: "",
        forum_state: "",
        signed_city: "",
        signed_state: "",
        property_address: "",
        rent_currency: "BRL",
        rent_amount_display: "",
        rent_amount_value: 0,
        desired_rent_display: "",
        desired_rent_value: 0,
        current_rent_display: "",
        current_rent_value: 0,
        bedrooms: "",
        bathrooms: "",
        parking_spaces: "",
        assessed_value: "",
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
      owner_email: "",
      owner_cpf: "",
      owner_cell_number: "",
      contract_fields: {},
    });
    setCreatePhotos([]);
    setRentedFile(null);
    setRentedFields({});
    setRentedSelections(new Set());
    setRentedApplied(false);
    setEditRentedFile(null);
    setEditRentedFields({});
    setEditRentedSelections(new Set());
    setEditRentedApplied(false);
    setError("");
    setModalOpen(true);
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
      contract_title: extras.contract_title || "",
      document_platform: extras.document_platform || "",
      document_code: extras.document_code || "",
      landlord_address: extras.landlord_address || "",
      administrator_name: extras.administrator_name || "",
      administrator_creci: extras.administrator_creci || "",
      administrator_address: extras.administrator_address || "",
      admin_fee_percent: extras.admin_fee_percent || "",
      guarantee_provider_name: extras.guarantee_provider_name || "",
      guarantee_provider_cnpj: extras.guarantee_provider_cnpj || "",
      guarantee_provider_address: extras.guarantee_provider_address || "",
      guarantee_annex_reference: extras.guarantee_annex_reference || "",
      payment_method: extras.payment_method || "",
      includes_condominium: Boolean(extras.includes_condominium),
      includes_iptu: Boolean(extras.includes_iptu),
      late_fee_percent: extras.late_fee_percent || "",
      interest_percent_month: extras.interest_percent_month || "",
      tolerance_rule: extras.tolerance_rule || "",
      breach_penalty_months: extras.breach_penalty_months || "",
      forum_city: extras.forum_city || "",
      forum_state: extras.forum_state || "",
      signed_city: extras.signed_city || "",
      signed_state: extras.signed_state || "",
      property_address: extras.property_address || "",
      rent_currency: extras.rent_currency || "BRL",
      rent_amount_value: Number(extras.rent_amount_value || 0),
      rent_amount_display: extras.rent_amount_display
        || (extras.rent_amount_value
          ? formatFromCents(Number(extras.rent_amount_value), extras.rent_currency || "BRL")
          : (extras.rent_amount || "")),
      desired_rent_value: Number(
        extras.desired_rent_value
          || (!extras.is_rented && extras.rent_amount_value ? extras.rent_amount_value : 0)
      ),
      desired_rent_display: extras.desired_rent_display
        || (extras.desired_rent_value
          ? formatFromCents(Number(extras.desired_rent_value), extras.rent_currency || "BRL")
          : ""),
      current_rent_value: Number(
        extras.current_rent_value
          || (extras.is_rented && extras.rent_amount_value ? extras.rent_amount_value : 0)
      ),
      current_rent_display: extras.current_rent_display
        || (extras.current_rent_value
          ? formatFromCents(Number(extras.current_rent_value), extras.rent_currency || "BRL")
          : ""),
      bedrooms: extras.bedrooms || "",
      bathrooms: extras.bathrooms || "",
      parking_spaces: extras.parking_spaces || "",
      assessed_value: extras.assessed_value || "",
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
      owner_email: extras.owner_contact?.email || "",
      owner_cpf: extras.owner_contact?.cpf || "",
      owner_cell_number: extras.owner_contact?.cell_number || "",
      contract_fields: extras.contract_fields || {},
      photos: extras.photos || [],
    });
    setEditPhotos([]);
    setEditExistingPhotos((property.extras?.photos || []).length);
    setRentedFile(null);
    setRentedFields({});
    setRentedSelections(new Set());
    setRentedApplied(false);
    setEditRentedFile(null);
    const existingContractFields = extras.contract_fields || {};
    const existingKeys = Object.keys(existingContractFields);
    setEditRentedFields(existingContractFields);
    setEditRentedSelections(new Set(existingKeys));
    setEditRentedApplied(existingKeys.length > 0);
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

  function applyRentedSelections(selected, fields, base, opts = {}) {
    const next = { ...base };
    const contractFields = opts.replace ? {} : { ...(base.contract_fields || {}) };
    Object.entries(fields || {}).forEach(([key, value]) => {
      if (!selected.has(key)) {
        if (key in next) next[key] = "";
        if (opts.replace) return;
        delete contractFields[key];
        return;
      }
      contractFields[key] = value ?? null;
      if (key === "witnesses" && Array.isArray(value)) {
        next.witnesses = value.join("; ");
        return;
      }
      if (key === "sensitive_topics" && Array.isArray(value)) {
        next.sensitive_topics = value.join("; ");
        return;
      }
      if (key in next) {
        next[key] = value ?? "";
      }
    });
    next.contract_fields = contractFields;
    return next;
  }

  async function runRentedSuggestions() {
    if (!rentedFile) {
      setError("Select a contract file to analyze.");
      return;
    }
    setRentedLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", rentedFile);
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
      const suggested = new Set(Object.keys(fields));
      setRentedFields(fields);
      setRentedSelections(suggested);
      setRentedApplied(false);
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setRentedLoading(false);
    }
  }

  async function runEditRentedSuggestions() {
    if (!editRentedFile) {
      setError("Select a contract file to analyze.");
      return;
    }
    setEditRentedLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", editRentedFile);
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
      const suggested = new Set(Object.keys(fields));
      setEditRentedFields(fields);
      setEditRentedSelections(suggested);
      setEditRentedApplied(false);
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setEditRentedLoading(false);
    }
  }

  function toggleRentedField(field) {
    const next = new Set(rentedSelections);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    setRentedSelections(next);
  }

  function toggleEditRentedField(field) {
    const next = new Set(editRentedSelections);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    setEditRentedSelections(next);
  }

  function applyRentedFields() {
    const rentSource =
      rentedFields.rent_amount
      || rentedFields.current_rent
      || rentedFields.current_rent_value
      || rentedFields.rent_amount_value
      || rentedFields.rent
      || "";
    const rentSourceText = String(rentSource);
    const inferredLang = Object.values(rentedFields || {})
      .join(" ")
      .toLowerCase();
    const inferredCurrency = inferredLang.includes("cpf")
      || inferredLang.includes("cep")
      || inferredLang.includes("rua")
      || inferredLang.includes("imóvel")
      || inferredLang.includes("locador")
      || inferredLang.includes("locatário")
      || inferredLang.includes("locataria")
      ? "BRL"
      : "USD";
    const currencyFromFields =
      rentedFields.rent_currency
      || rentedFields.currency
      || (rentSourceText.includes("R$") ? "BRL" : (rentSourceText.includes("$") ? "USD" : ""))
      || inferredCurrency;
    const rent = parseCurrency(rentSourceText);
    const nextForm = applyRentedSelections(rentedSelections, rentedFields, {
      ...form,
      is_rented: true,
      real_estate_name: rentedFields.real_estate_name || form.real_estate_name,
      tenant_name: rentedFields.tenant_name || form.tenant_name,
      tenant_cpf: rentedFields.tenant_cpf || form.tenant_cpf,
      tenant_rg: rentedFields.tenant_rg || form.tenant_rg,
      tenant_address: rentedFields.tenant_address || form.tenant_address,
      landlord_name: rentedFields.landlord_name || form.landlord_name,
      landlord_cpf: rentedFields.landlord_cpf || form.landlord_cpf,
      landlord_rg: rentedFields.landlord_rg || form.landlord_rg,
      guarantor_name: rentedFields.guarantor_name || form.guarantor_name,
      guarantor_cpf: rentedFields.guarantor_cpf || form.guarantor_cpf,
      guarantor_rg: rentedFields.guarantor_rg || form.guarantor_rg,
      property_address: rentedFields.property_address || form.property_address,
      rent_currency: currencyFromFields || rent.currency || form.rent_currency,
      current_rent_value: rent.cents,
      current_rent_display: formatFromCents(
        rent.cents,
        currencyFromFields || rent.currency || form.rent_currency
      ),
    }, { replace: false });
    if (!nextForm.current_rent_value && rentedFields.current_rent_value) {
      nextForm.current_rent_value = Number(rentedFields.current_rent_value);
      nextForm.current_rent_display = formatFromCents(nextForm.current_rent_value, nextForm.rent_currency);
    }
    if (!nextForm.admin_fee_percent && rentedFields.admin_fee_percent) {
      nextForm.admin_fee_percent = rentedFields.admin_fee_percent;
    }
    setForm(nextForm);
    setRentedApplied(true);
  }

  function applyEditRentedFields() {
    const editRentSource = String(editRentedFields.rent_amount || editRentedFields.rent || "");
    const inferredLang = Object.values(editRentedFields || {})
      .join(" ")
      .toLowerCase();
    const inferredCurrency = inferredLang.includes("cpf")
      || inferredLang.includes("cep")
      || inferredLang.includes("rua")
      || inferredLang.includes("imóvel")
      || inferredLang.includes("locador")
      || inferredLang.includes("locatário")
      || inferredLang.includes("locataria")
      ? "BRL"
      : "USD";
    const currencyFromFields =
      editRentedFields.rent_currency
      || editRentedFields.currency
      || (editRentSource.includes("R$") ? "BRL" : (editRentSource.includes("$") ? "USD" : ""))
      || inferredCurrency;
    const rent = parseCurrency(editRentSource);
    const nextForm = applyRentedSelections(editRentedSelections, editRentedFields, {
      ...editForm,
      is_rented: true,
      real_estate_name: editRentedFields.real_estate_name || editForm.real_estate_name,
      tenant_name: editRentedFields.tenant_name || editForm.tenant_name,
      tenant_cpf: editRentedFields.tenant_cpf || editForm.tenant_cpf,
      tenant_rg: editRentedFields.tenant_rg || editForm.tenant_rg,
      tenant_address: editRentedFields.tenant_address || editForm.tenant_address,
      landlord_name: editRentedFields.landlord_name || editForm.landlord_name,
      landlord_cpf: editRentedFields.landlord_cpf || editForm.landlord_cpf,
      landlord_rg: editRentedFields.landlord_rg || editForm.landlord_rg,
      guarantor_name: editRentedFields.guarantor_name || editForm.guarantor_name,
      guarantor_cpf: editRentedFields.guarantor_cpf || editForm.guarantor_cpf,
      guarantor_rg: editRentedFields.guarantor_rg || editForm.guarantor_rg,
      property_address: editRentedFields.property_address || editForm.property_address,
      rent_currency: currencyFromFields || rent.currency || editForm.rent_currency,
      current_rent_value: rent.cents,
      current_rent_display: formatFromCents(
        rent.cents,
        currencyFromFields || rent.currency || editForm.rent_currency
      ),
    }, { replace: true });
    if (!nextForm.admin_fee_percent && editRentedFields.admin_fee_percent) {
      nextForm.admin_fee_percent = editRentedFields.admin_fee_percent;
    }
    setEditForm(nextForm);
    setEditRentedApplied(true);
  }

  function handleConfirmOverwrite() {
    setConfirmOverwriteOpen(true);
  }

  function applyEditRentedFieldsConfirmed() {
    setConfirmOverwriteOpen(false);
    applyEditRentedFields();
  }

  function buildPropertyExtras(source, ownerNameOverride) {
    const rentAmountValue = source.is_rented ? source.current_rent_value : source.desired_rent_value;
    const rentAmountDisplay = source.is_rented ? source.current_rent_display : source.desired_rent_display;
    return {
      ...source,
      tag: source.tag.trim(),
      owner_name: ownerNameOverride ?? source.owner_name,
      rent_amount_value: rentAmountValue,
      rent_amount_display: rentAmountDisplay,
      contract_fields: source.contract_fields || {},
    };
  }

  async function createProperty(e) {
    e.preventDefault();
    setError("");
    if (!form.tag.trim()) {
      setError("Tag is required.");
      return;
    }
    if (!form.property_address.trim()) {
      setError("Property address is required.");
      return;
    }
    if (form.bedrooms === "" || Number(form.bedrooms) < 0) {
      setError("Bedrooms is required.");
      return;
    }
    if (form.bathrooms === "" || Number(form.bathrooms) < 0) {
      setError("Bathrooms is required.");
      return;
    }
    if (form.parking_spaces === "" || Number(form.parking_spaces) < 0) {
      setError("Parking spaces is required.");
      return;
    }
    if (form.is_rented && !form.current_rent_value) {
      setError("Current rent is required.");
      return;
    }
    if (!form.is_rented && !form.desired_rent_value) {
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
      const ownerName = currentUser?.role === "admin"
        ? form.owner_name
        : currentUser?.name || form.owner_name;
      const baseExtras = buildPropertyExtras(form, ownerName);
      const created = await apiPost("/properties", {
        owner_user_id: currentUser?.role === "admin" ? Number(ownerUserId) : currentUser?.id,
        extras: baseExtras,
      });
      const photoResult = await uploadPhotos(created.id, createPhotos);
      const extrasWithPhotos = {
        ...baseExtras,
        photos: photoResult?.extras?.photos || baseExtras.photos || [],
      };
      if (rentedFile) {
        const doc = await uploadContract(created.id, rentedFile);
        await apiPut(`/properties/${created.id}`, {
          extras: {
            ...extrasWithPhotos,
            contract_document_id: doc.id,
            contract_file_name: doc.extras?.name || rentedFile.name,
          },
        });
        setRentedFile(null);
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
    if (!editForm.property_address.trim()) {
      setError("Property address is required.");
      return;
    }
    if (editForm.bedrooms === "" || Number(editForm.bedrooms) < 0) {
      setError("Bedrooms is required.");
      return;
    }
    if (editForm.bathrooms === "" || Number(editForm.bathrooms) < 0) {
      setError("Bathrooms is required.");
      return;
    }
    if (editForm.parking_spaces === "" || Number(editForm.parking_spaces) < 0) {
      setError("Parking spaces is required.");
      return;
    }
    if (editForm.is_rented && !editForm.current_rent_value) {
      setError("Current rent is required.");
      return;
    }
    if (!editForm.is_rented && !editForm.desired_rent_value) {
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
        rent_amount_value: editForm.is_rented ? editForm.current_rent_value : editForm.desired_rent_value,
        rent_amount_display: editForm.is_rented ? editForm.current_rent_display : editForm.desired_rent_display,
        photos: editForm.photos || [],
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

  function requestDelete(property) {
    setDeleteTarget({
      id: property.id,
      label: property.extras?.tag || property.extras?.label || `Property #${property.id}`,
    });
    setConfirmDeleteOpen(true);
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

  async function confirmDelete() {
    if (!deleteTarget?.id) return;
    setConfirmDeleteOpen(false);
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    await removeProperty(targetId);
  }

  const selectedOwner =
    currentUser?.role === "admin"
      ? owners.find((owner) => String(owner.id) === String(ownerUserId))
      : currentUser;
  const editSelectedOwner =
    currentUser?.role === "admin"
      ? owners.find((owner) => String(owner.id) === String(editOwnerId))
      : currentUser;

  function openUserDetails(user) {
    if (!user) return;
    setUserDetails(user);
    setUserDetailsOpen(true);
  }

  const rentSummary = properties.reduce(
    (acc, prop) => {
      const extras = prop.extras || {};
      const isRented =
        extras.is_rented === true ||
        extras.is_rented === "true" ||
        extras.rented === true ||
        extras.rented === "true";
      if (!isRented) return acc;
      const value = Number(extras.current_rent_value || 0);
      if (!value) return acc;
      const currency = extras.rent_currency || "BRL";
      acc[currency] = (acc[currency] || 0) + value;
      return acc;
    },
    {}
  );

  const rentEntries = Object.entries(rentSummary);

  function formatSummary(entries) {
    if (!entries.length) return "—";
    return entries
      .map(([currency, cents]) => formatFromCents(Number(cents), currency))
      .join(" • ");
  }

  function renderRentSummary() {
    return {
      label: "Monthly rent",
      value: formatSummary(rentEntries),
    };
  }

  const rentedSpan2Fields = new Set([
    "tenant_address",
    "administrator_address",
    "guarantee_provider_address",
    "landlord_address",
    "contract_title",
    "document_numbers",
    "witnesses",
    "notes",
    "sensitive_topics",
    "tolerance_rule",
    "property_address",
  ]);

  const rentedFieldKeys = Object.keys(rentedFields).length
    ? Object.keys(rentedFields)
    : Object.keys(form.contract_fields || {});
  const rentedDisplayFields = rentedApplied
    ? rentedFieldKeys.filter((field) => {
        if (Object.keys(rentedFields).length && !rentedSelections.has(field)) return false;
        const currentValue = Object.prototype.hasOwnProperty.call(form, field)
          ? form[field]
          : form.contract_fields?.[field];
        if (currentValue === null || currentValue === undefined) return false;
        if (typeof currentValue === "boolean") return currentValue;
        return String(currentValue).trim() !== "";
      })
    : [];

  function updateRentedField(field, value) {
    if (Object.prototype.hasOwnProperty.call(form, field)) {
      setForm({ ...form, [field]: value });
      return;
    }
    setForm({
      ...form,
      contract_fields: { ...(form.contract_fields || {}), [field]: value },
    });
  }

  const editRentedFieldKeys = Object.keys(editRentedFields).length
    ? Object.keys(editRentedFields)
    : Object.keys(editForm.contract_fields || {});
  const editRentedDisplayFields = editRentedApplied
    ? editRentedFieldKeys.filter((field) => {
        if (Object.keys(editRentedFields).length && !editRentedSelections.has(field)) return false;
        const currentValue = Object.prototype.hasOwnProperty.call(editForm, field)
          ? editForm[field]
          : editForm.contract_fields?.[field];
        if (currentValue === null || currentValue === undefined) return false;
        if (typeof currentValue === "boolean") return currentValue;
        return String(currentValue).trim() !== "";
      })
    : [];

  function updateEditRentedField(field, value) {
    if (Object.prototype.hasOwnProperty.call(editForm, field)) {
      setEditForm({ ...editForm, [field]: value });
      return;
    }
    setEditForm({
      ...editForm,
      contract_fields: { ...(editForm.contract_fields || {}), [field]: value },
    });
  }

  const filteredProperties = properties.filter((p) => {
    if (showRentedOnly && !p.extras?.is_rented) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const extras = p.extras || {};
    const tag = String(extras.tag || extras.label || "").toLowerCase();
    const address = String(extras.property_address || "").toLowerCase();
    const ownerName = String(extras.owner_name || "").toLowerCase();
    return tag.includes(query) || address.includes(query) || ownerName.includes(query);
  });

  return (
    <div className="container">
      <TopNav />

      <div className="card-wrap">
        <div className="card card--properties">
        <div className="card-header properties-header">
          <div className="properties-header-main">
            <h2>Properties</h2>
            <p className="muted">
              {currentUser?.role === "admin"
                ? "Admins can view all properties."
                : "Property owners only see properties assigned to them."}
            </p>
          </div>
        </div>
        <div className="properties-toolbar">
          <div className="wo-toolbar">
            <div className="wo-search">
              <label className="sr-only" htmlFor="properties-search">Search</label>
              <input
                id="properties-search"
                type="search"
                placeholder="Search by tag, owner, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="wo-toolbar-actions">
              <button className="wo-filters-btn" onClick={() => setFiltersOpen(true)} aria-label="Open filters">
                Filters
                {showRentedOnly && <span className="wo-filters-count">1</span>}
              </button>
              <button className="btn-primary wo-create-btn" onClick={openCreate}>
                Create Property
              </button>
            </div>
          </div>
        </div>
        {filtersOpen && (
          <div className="wo-filters-overlay" onClick={() => setFiltersOpen(false)}>
            <div
              className="wo-filters-panel"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="wo-filters-header">
                <div>
                  <h3>Filters</h3>
                  <p className="muted">Filter properties by status.</p>
                </div>
                <button onClick={() => setFiltersOpen(false)}>Close</button>
              </div>
              <div className="form-grid">
                <div className="form-span-2">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={showRentedOnly}
                      onChange={(e) => setShowRentedOnly(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                    <span>Rented only</span>
                  </label>
                </div>
              </div>
              <div className="wo-filters-actions">
                <button
                  className="btn-muted"
                  onClick={() => {
                    setShowRentedOnly(false);
                    setSearchQuery("");
                  }}
                >
                  Reset
                </button>
                <button className="btn-primary" onClick={() => setFiltersOpen(false)}>Done</button>
              </div>
            </div>
          </div>
        )}
          <div className="table-wrap property-table">
            <table className="table">
              <thead>
                <tr>
                  {currentUser?.role === "admin" && <th>ID</th>}
                  <th>Photo</th>
                  <th>Properties</th>
                  <th>Status</th>
                  {currentUser?.role === "admin" && <th>Owner ID</th>}
                  <th className="actions-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  Array.from({ length: 3 }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="table-row">
                      <td colSpan={currentUser?.role === "admin" ? 6 : 4}>
                        <div className="skeleton-line" />
                      </td>
                    </tr>
                  ))
                )}
                {!loading && filteredProperties.map((p) => {
                  const photos = p.extras?.photos || [];
                  const firstPhoto = photos[0]?.url;
                  const isMenuOpen = menuOpenId === p.id;
                  const rowClass = p.extras?.is_rented
                    ? `table-row rented-row${isMenuOpen ? " table-row--active" : ""}`
                    : `table-row${isMenuOpen ? " table-row--active" : ""}`;
                  return (
                  <tr key={p.id} className={rowClass} data-rented={p.extras?.is_rented ? "true" : "false"}>
                    {currentUser?.role === "admin" && <td>{p.id}</td>}
                    <td>
                      {firstPhoto ? (
                        <button
                          type="button"
                          className="thumb-button"
                          onClick={() => setPhotoPreview(`${API_BASE}${firstPhoto}`)}
                        >
                          <img
                            className="property-thumb"
                            src={`${API_BASE}${firstPhoto}`}
                            alt={p.extras?.tag || p.extras?.label || "Property"}
                          />
                        </button>
                      ) : (
                        <span className="muted">No photo</span>
                      )}
                    </td>
                    <td>
                      {p.extras?.is_rented && <div className="rented-watermark desktop-only">rented</div>}
                      {!p.extras?.is_rented && (
                        <div className="rented-watermark rented-watermark--available desktop-only">available</div>
                      )}
                      <Link href={`/properties/${p.id}`}>
                        {p.extras?.tag || p.extras?.label || "Property"}
                      </Link>
                      {p.extras?.property_address && (
                        <div className="property-subline">{p.extras.property_address}</div>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${p.extras?.is_rented ? "is-rented" : "is-available"}`}>
                        {p.extras?.is_rented ? "RENTED" : "AVAILABLE"}
                      </span>
                    </td>
                    {currentUser?.role === "admin" && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() =>
                            openUserDetails(
                              owners.find((owner) => owner.id === p.owner_user_id)
                            )
                          }
                        >
                          {p.owner_user_id}
                        </button>
                      </td>
                    )}
                      <td className="actions-cell">
                        <div className="kebab">
                          <button
                            className="kebab-trigger"
                            type="button"
                            aria-label="Open actions"
                            onClick={() => toggleMenu(p.id)}
                          >
                            ⋯
                          </button>
                          {menuOpenId === p.id && (
                            <div className="kebab-menu">
                              <button type="button" onClick={() => { openEdit(p); setMenuOpenId(null); }}>
                                Edit
                              </button>
                              <button className="danger" type="button" onClick={() => { requestDelete(p); setMenuOpenId(null); }}>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && filteredProperties.length === 0 && (
                  <tr>
                    <td colSpan={currentUser?.role === "admin" ? 6 : 4} className="muted">
                    No properties found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!loading && filteredProperties.length === 0 && (
            <div className="property-cards-empty mobile-only">No properties found.</div>
          )}
          <div className="property-cards mobile-only">
            {loading && (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={`card-skeleton-${index}`} className="property-card skeleton-card">
                  <div className="skeleton-thumb" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </div>
                </div>
              ))
            )}
            {!loading && filteredProperties.map((p) => {
              const photos = p.extras?.photos || [];
              const firstPhoto = photos[0]?.url;
              return (
                <div key={p.id} className="property-card">
                  <button
                    type="button"
                    className="property-card-thumb"
                    onClick={() => firstPhoto && setPhotoPreview(`${API_BASE}${firstPhoto}`)}
                    aria-label="Open property photo"
                  >
                    {firstPhoto ? (
                      <img src={`${API_BASE}${firstPhoto}`} alt={p.extras?.tag || "Property"} />
                    ) : (
                      <div className="property-thumb-empty">No photo</div>
                    )}
                  </button>
                  <div className="property-card-body">
                    <div className="property-card-header">
                      <div>
                        <div className="property-card-title">
                          {p.extras?.tag || p.extras?.label || "Property"}
                        </div>
                        <span className={`status-badge ${p.extras?.is_rented ? "is-rented" : "is-available"}`}>
                          {p.extras?.is_rented ? "RENTED" : "AVAILABLE"}
                        </span>
                      </div>
                      <div className="kebab">
                        <button
                          className="kebab-trigger"
                          type="button"
                          aria-label="Open actions"
                          onClick={() => toggleMenu(p.id)}
                        >
                          ⋯
                        </button>
                        {menuOpenId === p.id && (
                          <div className="kebab-menu">
                            <button type="button" onClick={() => { openEdit(p); setMenuOpenId(null); }}>
                              Edit
                            </button>
                            <button className="danger" type="button" onClick={() => { requestDelete(p); setMenuOpenId(null); }}>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {p.extras?.property_address && (
                      <button
                        type="button"
                        className="property-card-subline"
                        onClick={() => firstPhoto && setPhotoPreview(`${API_BASE}${firstPhoto}`)}
                        aria-label="Open property photo"
                      >
                        {p.extras.property_address}
                      </button>
                    )}
                    {currentUser?.role === "admin" && (
                      <span className="owner-chip">Owner #{p.owner_user_id}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {error && <p className="error">{error}</p>}
        </div>
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
                                    setForm({
                                      ...form,
                                      owner_name: owner.name,
                                      owner_email: owner.email || "",
                                      owner_cpf: owner.cpf || "",
                                      owner_cell_number: owner.cell_number || "",
                                    });
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
                    <div className="form-span-2">
                      <label>Owner Email</label>
                      <input
                        value={currentUser?.role === "admin" ? form.owner_email : currentUser?.email || form.owner_email}
                        onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                        readOnly={currentUser?.role !== "admin"}
                      />
                    </div>
                    <div>
                      <label>Owner CPF</label>
                      <input
                        value={currentUser?.role === "admin" ? form.owner_cpf : currentUser?.cpf || form.owner_cpf}
                        onChange={(e) => setForm({ ...form, owner_cpf: e.target.value })}
                        readOnly={currentUser?.role !== "admin"}
                      />
                    </div>
                    <div>
                      <label>Owner Phone</label>
                      <input
                        value={currentUser?.role === "admin" ? form.owner_cell_number : currentUser?.cell_number || form.owner_cell_number}
                        onChange={(e) => setForm({ ...form, owner_cell_number: e.target.value })}
                        readOnly={currentUser?.role !== "admin"}
                      />
                    </div>
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
                      <label>{form.is_rented ? "Current Rent" : "Desired Rent"}</label>
                      <div className="input-group">
                        <select
                          value={form.rent_currency}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              rent_currency: e.target.value,
                              desired_rent_display: formatFromCents(form.desired_rent_value, e.target.value),
                              current_rent_display: formatFromCents(form.current_rent_value, e.target.value),
                            })
                          }
                        >
                          <option value="BRL">R$</option>
                          <option value="USD">$</option>
                        </select>
                        <input
                          inputMode="numeric"
                          value={form.is_rented ? form.current_rent_display : form.desired_rent_display}
                          onChange={(e) =>
                            {
                              const result = formatCurrency(e.target.value, form.rent_currency);
                              setForm({
                                ...form,
                                desired_rent_display: form.is_rented ? form.desired_rent_display : result.display,
                                desired_rent_value: form.is_rented ? form.desired_rent_value : result.cents,
                                current_rent_display: form.is_rented ? result.display : form.current_rent_display,
                                current_rent_value: form.is_rented ? result.cents : form.current_rent_value,
                              });
                            }
                          }
                        />
                      </div>
                      {form.is_rented && form.admin_fee_percent && form.current_rent_value ? (
                        <small className="muted">
                          Admin fee {form.admin_fee_percent}% • Net{" "}
                          {formatFromCents(
                            Math.max(
                              form.current_rent_value -
                                Math.round(
                                  form.current_rent_value *
                                    (Number(String(form.admin_fee_percent).replace("%", "")) || 0) /
                                    100
                                ),
                              0
                            ),
                            form.rent_currency
                          )}
                        </small>
                      ) : null}
                    </div>
                    <div>
                      <label>Bedrooms</label>
                      <input
                        inputMode="numeric"
                        value={form.bedrooms}
                        onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Bathrooms</label>
                      <input
                        inputMode="numeric"
                        value={form.bathrooms}
                        onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Parking Spaces</label>
                      <input
                        inputMode="numeric"
                        value={form.parking_spaces}
                        onChange={(e) => setForm({ ...form, parking_spaces: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Assessed Value (optional)</label>
                      <input
                        value={form.assessed_value}
                        onChange={(e) => setForm({ ...form, assessed_value: e.target.value })}
                      />
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
                        <div className="form-span-2">
                          <label>Rental contract (LLM)</label>
                          <input
                            type="file"
                            onChange={(e) => setRentedFile(e.target.files?.[0] || null)}
                          />
                          <button
                            type="button"
                            className="btn-muted"
                            onClick={runRentedSuggestions}
                            disabled={rentedLoading}
                          >
                            {rentedLoading ? "Analyzing..." : "Suggest fields"}
                          </button>
                          {Object.keys(rentedFields).length > 0 && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={applyRentedFields}
                              disabled={!rentedSelections.size}
                              style={{ marginLeft: 8 }}
                            >
                              Apply fields
                            </button>
                          )}
                          {rentedFile && (
                            <small className="muted">Contract file: {rentedFile.name}</small>
                          )}
                        </div>
                        {Object.keys(rentedFields).length > 0 && (
                          <div className="form-span-2">
                            <label>LLM fields</label>
                            <small className="muted">
                              Select the fields to apply. Unmapped fields will be stored under
                              contract_fields.
                            </small>
                            <div className="owner-options llm-fields">
                              {Object.keys(rentedFields).map((field) => (
                                <label key={field} className="form-check llm-field">
                                  <input
                                    type="checkbox"
                                    checked={rentedSelections.has(field)}
                                    onChange={() => toggleRentedField(field)}
                                  />
                                  <span>
                                    {field}
                                    {!Object.prototype.hasOwnProperty.call(form, field) && (
                                      <em className="muted"> (extra)</em>
                                    )}
                                  </span>
                                  <small className="muted">
                                    {Array.isArray(rentedFields[field])
                                      ? rentedFields[field].join("; ")
                                      : String(rentedFields[field] ?? "")}
                                  </small>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {rentedApplied && rentedDisplayFields.length > 0 && (
                          <>
                            <div className="form-section">
                              <strong>Rental Details</strong>
                            </div>
                            {rentedDisplayFields.map((field) => {
                              const currentValue = Object.prototype.hasOwnProperty.call(form, field)
                                ? form[field]
                                : form.contract_fields?.[field];
                              if (typeof currentValue === "boolean") {
                                return (
                                  <div key={field} className="form-check">
                                    <input
                                      type="checkbox"
                                      checked={currentValue}
                                      onChange={(e) => updateRentedField(field, e.target.checked)}
                                    />
                                    <span>{field.replace(/_/g, " ")}</span>
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={field}
                                  className={rentedSpan2Fields.has(field) ? "form-span-2" : undefined}
                                >
                                  <label>{field.replace(/_/g, " ")}</label>
                                  <input
                                    value={currentValue ?? ""}
                                    onChange={(e) => updateRentedField(field, e.target.value)}
                                  />
                                </div>
                              );
                            })}
                          </>
                        )}
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
                                    setEditForm({
                                      ...editForm,
                                      owner_name: owner.name,
                                      owner_email: owner.email || "",
                                      owner_cpf: owner.cpf || "",
                                      owner_cell_number: owner.cell_number || "",
                                    });
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
                    <div className="form-span-2">
                      <label>Owner Email</label>
                      <input
                        value={currentUser?.role === "admin" ? editForm.owner_email : editForm.owner_email}
                        onChange={(e) => setEditForm({ ...editForm, owner_email: e.target.value })}
                        readOnly={currentUser?.role !== "admin"}
                      />
                    </div>
                    <div>
                      <label>Owner CPF</label>
                      <input
                        value={currentUser?.role === "admin" ? editForm.owner_cpf : editForm.owner_cpf}
                        onChange={(e) => setEditForm({ ...editForm, owner_cpf: e.target.value })}
                        readOnly={currentUser?.role !== "admin"}
                      />
                    </div>
                    <div>
                      <label>Owner Phone</label>
                      <input
                        value={currentUser?.role === "admin" ? editForm.owner_cell_number : editForm.owner_cell_number}
                        onChange={(e) => setEditForm({ ...editForm, owner_cell_number: e.target.value })}
                        readOnly={currentUser?.role !== "admin"}
                      />
                    </div>
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
                      <label>{editForm.is_rented ? "Current Rent" : "Desired Rent"}</label>
                      <div className="input-group">
                        <select
                          value={editForm.rent_currency}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              rent_currency: e.target.value,
                              desired_rent_display: formatFromCents(editForm.desired_rent_value, e.target.value),
                              current_rent_display: formatFromCents(editForm.current_rent_value, e.target.value),
                            })
                          }
                        >
                          <option value="BRL">R$</option>
                          <option value="USD">$</option>
                        </select>
                        <input
                          inputMode="numeric"
                          value={editForm.is_rented ? editForm.current_rent_display : editForm.desired_rent_display}
                          onChange={(e) =>
                            {
                              const result = formatCurrency(e.target.value, editForm.rent_currency);
                              setEditForm({
                                ...editForm,
                                desired_rent_display: editForm.is_rented ? editForm.desired_rent_display : result.display,
                                desired_rent_value: editForm.is_rented ? editForm.desired_rent_value : result.cents,
                                current_rent_display: editForm.is_rented ? result.display : editForm.current_rent_display,
                                current_rent_value: editForm.is_rented ? result.cents : editForm.current_rent_value,
                              });
                            }
                          }
                        />
                      </div>
                      {editForm.is_rented && editForm.admin_fee_percent && editForm.current_rent_value ? (
                        <small className="muted">
                          Admin fee {editForm.admin_fee_percent}% • Net{" "}
                          {formatFromCents(
                            Math.max(
                              editForm.current_rent_value -
                                Math.round(
                                  editForm.current_rent_value *
                                    (Number(String(editForm.admin_fee_percent).replace("%", "")) || 0) /
                                    100
                                ),
                              0
                            ),
                            editForm.rent_currency
                          )}
                        </small>
                      ) : null}
                    </div>
                    <div>
                      <label>Bedrooms</label>
                      <input
                        inputMode="numeric"
                        value={editForm.bedrooms}
                        onChange={(e) => setEditForm({ ...editForm, bedrooms: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Bathrooms</label>
                      <input
                        inputMode="numeric"
                        value={editForm.bathrooms}
                        onChange={(e) => setEditForm({ ...editForm, bathrooms: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Parking Spaces</label>
                      <input
                        inputMode="numeric"
                        value={editForm.parking_spaces}
                        onChange={(e) => setEditForm({ ...editForm, parking_spaces: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Assessed Value (optional)</label>
                      <input
                        value={editForm.assessed_value}
                        onChange={(e) => setEditForm({ ...editForm, assessed_value: e.target.value })}
                      />
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
                        <div className="form-span-2">
                          <label>Rental contract (LLM)</label>
                          <input
                            type="file"
                            onChange={(e) => setEditRentedFile(e.target.files?.[0] || null)}
                          />
                          <button
                            type="button"
                            className="btn-muted"
                            onClick={runEditRentedSuggestions}
                            disabled={editRentedLoading}
                          >
                            {editRentedLoading ? "Analyzing..." : "Suggest fields"}
                          </button>
                          {Object.keys(editRentedFields).length > 0 && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleConfirmOverwrite}
                              disabled={!editRentedSelections.size}
                              style={{ marginLeft: 8 }}
                            >
                              Apply fields
                            </button>
                          )}
                          {editRentedFile && (
                            <small className="muted">Contract file: {editRentedFile.name}</small>
                          )}
                        </div>
                        {Object.keys(editRentedFields).length > 0 && (
                          <div className="form-span-2">
                            <label>LLM fields</label>
                            <small className="muted">
                              Applying a new contract will replace existing contract data.
                            </small>
                            <small className="muted">
                              Select the fields to apply. Unmapped fields will be stored under
                              contract_fields.
                            </small>
                            <div className="owner-options llm-fields">
                              {Object.keys(editRentedFields).map((field) => (
                                <label key={field} className="form-check llm-field">
                                  <input
                                    type="checkbox"
                                    checked={editRentedSelections.has(field)}
                                    onChange={() => toggleEditRentedField(field)}
                                  />
                                  <span>
                                    {field}
                                    {!Object.prototype.hasOwnProperty.call(editForm, field) && (
                                      <em className="muted"> (extra)</em>
                                    )}
                                  </span>
                                  <small className="muted">
                                    {Array.isArray(editRentedFields[field])
                                      ? editRentedFields[field].join("; ")
                                      : String(editRentedFields[field] ?? "")}
                                  </small>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        {editRentedApplied && editRentedDisplayFields.length > 0 && (
                          <>
                            <div className="form-section">
                              <strong>Rental Details</strong>
                            </div>
                            {editRentedDisplayFields.map((field) => {
                              const currentValue = Object.prototype.hasOwnProperty.call(editForm, field)
                                ? editForm[field]
                                : editForm.contract_fields?.[field];
                              if (typeof currentValue === "boolean") {
                                return (
                                  <div key={field} className="form-check">
                                    <input
                                      type="checkbox"
                                      checked={currentValue}
                                      onChange={(e) => updateEditRentedField(field, e.target.checked)}
                                    />
                                    <span>{field.replace(/_/g, " ")}</span>
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={field}
                                  className={rentedSpan2Fields.has(field) ? "form-span-2" : undefined}
                                >
                                  <label>{field.replace(/_/g, " ")}</label>
                                  <input
                                    value={currentValue ?? ""}
                                    onChange={(e) => updateEditRentedField(field, e.target.value)}
                                  />
                                </div>
                              );
                            })}
                          </>
                        )}
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
      {photoPreview && (
        <div className="modal-overlay" onClick={() => setPhotoPreview("")}>
          <div className="modal photo-modal" onClick={(e) => e.stopPropagation()}>
            <img src={photoPreview} alt="Property" />
            <div className="modal-actions">
              <button className="btn-muted" type="button" onClick={() => setPhotoPreview("")}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmOverwriteOpen && (
        <div className="modal-overlay" onClick={() => setConfirmOverwriteOpen(false)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Replace contract data?</h3>
              <button className="btn-muted" onClick={() => setConfirmOverwriteOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p>
                Applying this contract will replace all existing contract fields for this
                property. This action cannot be undone.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-danger" type="button" onClick={applyEditRentedFieldsConfirmed}>
                Replace & Apply
              </button>
              <button className="btn-muted" type="button" onClick={() => setConfirmOverwriteOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteOpen && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteOpen(false)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete property?</h3>
              <button className="btn-muted" onClick={() => setConfirmDeleteOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p>
                This will permanently delete{" "}
                <strong>{deleteTarget?.label || "this property"}</strong> and its
                related data. This action cannot be undone.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-danger" type="button" onClick={confirmDelete}>
                Delete
              </button>
              <button className="btn-muted" type="button" onClick={() => setConfirmDeleteOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {userDetailsOpen && userDetails && (
        <div className="modal-overlay" onClick={() => setUserDetailsOpen(false)}>
          <div className="modal user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>User details</h3>
              <button className="btn-muted" onClick={() => setUserDetailsOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div>
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{userDetails.name}</span>
                </div>
                <div>
                  <span className="detail-label">Username</span>
                  <span className="detail-value">{userDetails.username}</span>
                </div>
                <div>
                  <span className="detail-label">Role</span>
                  <span className="detail-value">{userDetails.role}</span>
                </div>
                <div>
                  <span className="detail-label">CPF</span>
                  <span className="detail-value">{userDetails.cpf || "-"}</span>
                </div>
                <div>
                  <span className="detail-label">Cell</span>
                  <span className="detail-value">{userDetails.cell_number || "-"}</span>
                </div>
                <div>
                  <span className="detail-label">User ID</span>
                  <span className="detail-value">{userDetails.id}</span>
                </div>
                <div className="detail-span-2">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{userDetails.email || "-"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
