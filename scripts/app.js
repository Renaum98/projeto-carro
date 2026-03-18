// ============================================================
//  App — Controller principal
// ============================================================

import { TYPE_ICONS } from "./data.js";
import {
  fetchVehicles,
  addVehicle,
  deleteVehicle,
  saveCurrentKm,
  fetchRecords,
  saveRecord,
  deleteRecord,
  setArchived,
} from "./db.js";
import {
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import {
  showToast,
  setLoading,
  fileToBase64,
  getStatus,
  getStatusDetail,
  getStatusLabel,
  daysUntil,
  kmUntil,
  formatDate,
} from "./utils.js";
import {
  renderStats,
  renderAlerts,
  renderRecords,
  updateValidityHint,
  autoFillNext,
  openPhotoModal,
  closePhotoModal,
  setCurrentKmUI,
  renderOdometer,
  renderVehicleSelect,
} from "./ui.js";
import { logout } from "./auth.js";

/* ---------- Estado global ---------- */
let vehicles = [];
let activeVehicle = null;
let records = [];
let currentFilter = "ok";
let currentUser = null;
let photoDataUrl = null;
let kmSaveTimer = null;
let _editingId = null;
let _detailId = null;
let _searchTerm = "";

/* ---------- Inicialização ---------- */
export async function initApp(user) {
  currentUser = user;
  bindEvents();
  await loadVehicles();
  await requestNotificationPermission();
}

/* ============================================================
   VEÍCULOS
   ============================================================ */

async function loadVehicles() {
  try {
    setLoading(true);
    vehicles = await fetchVehicles(currentUser.uid);

    if (vehicles.length === 0) {
      renderVehicleSelect(vehicles, null);
      openVehicleModal();
      return;
    }

    const lastId = localStorage.getItem(`care_vehicle_${currentUser.uid}`);
    const found = vehicles.find((v) => v.id === lastId) || vehicles[0];
    renderVehicleSelect(vehicles, found.id);
    await switchVehicle(found);
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar veículos.", "error");
  } finally {
    setLoading(false);
  }
}

async function switchVehicle(vehicle) {
  activeVehicle = vehicle;
  localStorage.setItem(`care_vehicle_${currentUser.uid}`, vehicle.id);

  const km = vehicle.currentKm ?? null;
  setCurrentKmUI(km);
  renderOdometer(km);
  const input = document.getElementById("current-km-input");
  if (input) input.value = km !== null ? km : "";

  await loadRecords();
}

async function handleAddVehicle() {
  const name = document.getElementById("v-name").value.trim();
  const plate = document.getElementById("v-plate").value.trim();

  if (!name) return showToast("Informe o nome/modelo do veículo", "error");

  try {
    setLoading(true);
    const v = await addVehicle(currentUser.uid, { name, plate });
    vehicles.push(v);
    renderVehicleSelect(vehicles, v.id);
    closeVehicleModal();
    await switchVehicle(v);
    showToast(`${name} adicionado!`);
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar veículo.", "error");
  } finally {
    setLoading(false);
  }
}

async function handleDeleteVehicle() {
  if (!activeVehicle) return;
  if (
    !confirm(
      `Remover "${activeVehicle.name}" e todas as revisões? Essa ação não pode ser desfeita.`,
    )
  )
    return;

  try {
    setLoading(true);
    await deleteVehicle(currentUser.uid, activeVehicle.id);
    vehicles = vehicles.filter((v) => v.id !== activeVehicle.id);

    if (vehicles.length === 0) {
      activeVehicle = null;
      records = [];
      renderVehicleSelect([], null);
      renderAll();
      openVehicleModal();
    } else {
      renderVehicleSelect(vehicles, vehicles[0].id);
      await switchVehicle(vehicles[0]);
    }
    showToast("Veículo removido.");
  } catch (err) {
    console.error(err);
    showToast("Erro ao remover veículo.", "error");
  } finally {
    setLoading(false);
  }
}

/* ============================================================
   REVISÕES
   ============================================================ */

async function loadRecords() {
  if (!activeVehicle) return;
  try {
    setLoading(true);
    records = await fetchRecords(currentUser.uid, activeVehicle.id);
    renderAll();
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar revisões.", "error");
  } finally {
    setLoading(false);
  }
}

async function handleUnarchive(id) {
  try {
    await setArchived(currentUser.uid, activeVehicle.id, id, false);
    records = records.map((r) => (r.id === id ? { ...r, archived: false } : r));
    renderAll();
    showToast("Revisão reativada.");
  } catch (err) {
    showToast("Erro ao desarquivar.", "error");
  }
}

function renderAll() {
  setCurrentKmUI(activeVehicle?.currentKm ?? null);
  renderStats(records);
  renderAlerts(records);
  renderRecords(
    records,
    currentFilter,
    handleDelete,
    handleUnarchive,
    openDetailModal,
    _searchTerm,
  );
}

async function handleSave() {
  if (!activeVehicle)
    return showToast("Selecione um veículo primeiro.", "error");

  const label = document.getElementById("f-type").value.trim();
  const date = document.getElementById("f-date").value;
  const km = document.getElementById("f-km").value;
  const nextDate = document.getElementById("f-next-date").value;
  const nextKm = document.getElementById("f-next-km").value;
  const price = document.getElementById("f-price").value;
  const notes = document.getElementById("f-notes").value.trim();

  if (!label) return showToast("Informe o tipo de manutenção", "error");
  if (!date) return showToast("Informe a data da revisão", "error");
  if (!km) return showToast("Informe o KM atual", "error");

  const record = {
    type: resolveTypeKey(label),
    label,
    date,
    km: parseInt(km),
    nextDate: nextDate || null,
    nextKm: nextKm ? parseInt(nextKm) : null,
    price: price ? parseFloat(price.replace(/[^0-9]/g, "")) / 100 : null,
    notes,
  };

  try {
    setLoading(true);

    if (_editingId) {
      await updateDoc(
        doc(
          db,
          "users",
          currentUser.uid,
          "vehicles",
          activeVehicle.id,
          "records",
          _editingId,
        ),
        { ...record, updatedAt: serverTimestamp() },
      );
      records = records.map((r) =>
        r.id === _editingId ? { ...r, ...record } : r,
      );
      showToast("Revisão atualizada!");
    } else {
      const saved = await saveRecord(
        currentUser.uid,
        activeVehicle.id,
        record,
        photoDataUrl,
        records,
      );
      if (saved.archivedPreviousId) {
        records = records.map((r) =>
          r.id === saved.archivedPreviousId ? { ...r, archived: true } : r,
        );
      }
      records.unshift(saved);
      showToast("Revisão salva com sucesso!");
    }

    renderAll();
    resetForm();
    closeFormModal();
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar. Tente novamente.", "error");
  } finally {
    setLoading(false);
  }
}

async function handleDelete(id) {
  if (!confirm("Remover este registro?")) return;
  try {
    setLoading(true);
    await deleteRecord(currentUser.uid, activeVehicle.id, id);
    records = records.filter((r) => r.id !== id);
    renderAll();
    showToast("Registro removido");
  } catch (err) {
    console.error(err);
    showToast("Erro ao remover.", "error");
  } finally {
    setLoading(false);
  }
}

/* ============================================================
   MODAL DE DETALHE DO CARD
   ============================================================ */

function openDetailModal(id) {
  const r = records.find((r) => r.id === id);
  if (!r) return;
  _detailId = id;

  const detail = getStatusDetail(r, activeVehicle?.currentKm ?? null);
  const status = detail.status;
  const icon = TYPE_ICONS[r.type] || "build";

  const iconEl = document.getElementById("detail-icon");
  iconEl.className = `detail-icon ${status}`;
  document.getElementById("detail-icon-name").textContent = icon;
  document.getElementById("detail-title").textContent = r.label;

  const statusEl = document.getElementById("detail-status-label");
  statusEl.className = `detail-status ${status}`;
  statusEl.textContent = r.archived ? "Arquivado" : getStatusLabel(status);

  const fields = [
    { label: "Data da revisão", value: formatDate(r.date) },
    {
      label: "KM na revisão",
      value: r.km ? `${Number(r.km).toLocaleString("pt-BR")} km` : "—",
    },
    { label: "Próxima revisão", value: formatDate(r.nextDate) },
    {
      label: "Próximo KM",
      value: r.nextKm ? `${Number(r.nextKm).toLocaleString("pt-BR")} km` : "—",
    },
    {
      label: "Valor pago",
      value: r.price
        ? `R$ ${Number(r.price).toFixed(2).replace(".", ",")}`
        : "—",
    },
    { label: "Observações", value: r.notes || "—", full: true },
  ];

  document.getElementById("detail-grid").innerHTML = fields
    .map(
      (f) => `
    <div class="detail-field ${f.full ? "full" : ""}">
      <div class="detail-field-label">${f.label}</div>
      <div class="detail-field-value">${f.value}</div>
    </div>`,
    )
    .join("");

  const photoEl = document.getElementById("detail-photo");
  if (r.photoBase64) {
    photoEl.src = r.photoBase64;
    photoEl.style.display = "block";
  } else {
    photoEl.style.display = "none";
  }

  document.getElementById("detail-btn-download").disabled = !r.photoBase64;
  document.getElementById("detail-btn-unarchive").style.display = r.archived
    ? "flex"
    : "none";

  document.getElementById("detail-modal").classList.add("open");
}

function closeDetailModal() {
  document.getElementById("detail-modal").classList.remove("open");
  _detailId = null;
}

/* ============================================================
   ODÔMETRO
   ============================================================ */

function handleKmInput(e) {
  if (!activeVehicle) return;
  const val = parseInt(e.target.value);
  if (isNaN(val) || val < 0) return;

  activeVehicle.currentKm = val;
  setCurrentKmUI(val);
  renderOdometer(val);
  renderAll();

  clearTimeout(kmSaveTimer);
  kmSaveTimer = setTimeout(async () => {
    try {
      await saveCurrentKm(currentUser.uid, activeVehicle.id, val);
      showToast(`Odômetro: ${val.toLocaleString("pt-BR")} km`);
      scheduleNotifications();
    } catch (err) {
      showToast("Erro ao salvar KM.", "error");
    }
  }, 800);
}

/* ============================================================
   NOTIFICAÇÕES
   ============================================================ */

async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  let permission = Notification.permission;
  if (permission === "default")
    permission = await Notification.requestPermission();
  if (permission === "granted") scheduleNotifications();
}

function scheduleNotifications() {
  const km = activeVehicle?.currentKm ?? null;
  const expired = records.filter((r) => getStatus(r, km) === "danger");
  const vName = activeVehicle?.name || "seu carro";

  if (expired.length > 0) {
    fireNotification({
      title: `🔴 ${vName} — ${expired.length} revisão(ões) vencida(s)!`,
      body: expired.map((r) => `• ${r.label}`).join("\n"),
      tag: `care-expired-${activeVehicle?.id}`,
    });
  }
}

function fireNotification({ title, body, tag }) {
  try {
    const n = new Notification(title, { body, tag, silent: false });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (err) {
    console.warn(err);
  }
}

/* ============================================================
   MODAIS — VEÍCULO
   ============================================================ */

function openVehicleModal() {
  document.getElementById("vehicle-modal").classList.add("open");
  document.getElementById("v-name").focus();
}

function closeVehicleModal() {
  if (vehicles.length === 0) return;
  document.getElementById("vehicle-modal").classList.remove("open");
  ["v-name", "v-plate"].forEach((id) => {
    document.getElementById(id).value = "";
  });
}

/* ============================================================
   MODAIS — FORMULÁRIO DE REVISÃO
   ============================================================ */

function openFormModal(record = null) {
  _editingId = record?.id || null;

  const title = document.querySelector("#form-modal h3");
  if (title) title.textContent = record ? "Editar revisão" : "Nova revisão";

  if (record) {
    document.getElementById("f-type").value = record.label || "";
    document.getElementById("f-date").value = record.date || "";
    document.getElementById("f-km").value = record.km || "";
    document.getElementById("f-next-date").value = record.nextDate || "";
    document.getElementById("f-next-km").value = record.nextKm || "";
    document.getElementById("f-notes").value = record.notes || "";
    if (record.price) {
      const cents = Math.round(record.price * 100);
      const reais = Math.floor(cents / 100);
      const dec = String(cents % 100).padStart(2, "0");
      document.getElementById("f-price").value =
        `R$ ${reais.toLocaleString("pt-BR")},${dec}`;
    } else {
      document.getElementById("f-price").value = "";
    }
    updateValidityHint(record.type);
  } else {
    document.getElementById("f-date").value = new Date()
      .toISOString()
      .split("T")[0];
    const kmInput = document.getElementById("f-km");
    if (activeVehicle?.currentKm && !kmInput.value) {
      kmInput.value = activeVehicle.currentKm;
    }
  }

  document.getElementById("form-modal").classList.add("open");
  setTimeout(() => document.getElementById("f-type").focus(), 100);
}

function closeFormModal() {
  document.getElementById("form-modal").classList.remove("open");
  resetForm();
}

function resetForm() {
  [
    "f-type",
    "f-date",
    "f-km",
    "f-next-date",
    "f-next-km",
    "f-price",
    "f-notes",
  ].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("file-name-label").textContent = "";
  document.getElementById("validity-hint").style.display = "none";
  photoDataUrl = null;
  _editingId = null;
  document.getElementById("f-date").value = new Date()
    .toISOString()
    .split("T")[0];
}

function exportData() {
  const data = JSON.stringify({ vehicle: activeVehicle, records }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `care_${activeVehicle?.name || "backup"}_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  showToast("Backup exportado!");
}

/* ============================================================
   AUTOCOMPLETE — TIPO DE MANUTENÇÃO
   ============================================================ */

const TYPE_SUGGESTIONS = [
  { label: "Troca de óleo", icon: "oil_barrel", key: "oleo" },
  { label: "Filtro de óleo", icon: "settings", key: "filtro_oleo" },
  { label: "Filtro de ar", icon: "air", key: "filtro_ar" },
  {
    label: "Filtro de combustível",
    icon: "local_gas_station",
    key: "filtro_combustivel",
  },
  {
    label: "Troca de pastilha de freio",
    icon: "emergency_heat",
    key: "pastilha",
  },
  {
    label: "Disco de freio",
    icon: "settings_input_component",
    key: "disco_freio",
  },
  { label: "Troca de velas", icon: "bolt", key: "velas" },
  { label: "Correia dentada", icon: "link", key: "correia" },
  { label: "Fluido de freio", icon: "water_drop", key: "fluido_freio" },
  {
    label: "Fluido de arrefecimento",
    icon: "thermostat",
    key: "fluido_arrefecimento",
  },
  {
    label: "Alinhamento e balanceamento",
    icon: "tire_repair",
    key: "alinhamento",
  },
  { label: "Troca de pneu", icon: "tire_repair", key: "pneu" },
  { label: "Bateria", icon: "battery_charging_full", key: "bateria" },
  { label: "Revisão ar-condicionado", icon: "ac_unit", key: "ar_cond" },
  { label: "Revisão geral", icon: "build_circle", key: "revisao_geral" },
];

const TYPE_KEY_MAP = Object.fromEntries(
  TYPE_SUGGESTIONS.map((s) => [s.label.toLowerCase(), s.key]),
);

function resolveTypeKey(label) {
  return TYPE_KEY_MAP[label.trim().toLowerCase()] || "outro";
}

function initTypeAutocomplete() {
  const input = document.getElementById("f-type");
  const listEl = document.getElementById("type-suggestions");
  let activeIdx = -1;

  function render(term) {
    const filtered = term
      ? TYPE_SUGGESTIONS.filter((s) =>
          s.label.toLowerCase().includes(term.toLowerCase()),
        )
      : TYPE_SUGGESTIONS;

    if (filtered.length === 0) {
      close();
      return;
    }

    listEl.innerHTML = filtered
      .map((s) => {
        const hl = term
          ? s.label.replace(new RegExp(`(${term})`, "gi"), "<mark>$1</mark>")
          : s.label;
        return `<div class="type-suggestion-item" data-label="${s.label}" data-key="${s.key}">
        <span class="material-icons-round">${s.icon}</span>${hl}
      </div>`;
      })
      .join("");

    listEl.querySelectorAll(".type-suggestion-item").forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        pick(item.dataset.label, item.dataset.key);
      });
    });

    activeIdx = -1;
    listEl.classList.add("open");
  }

  function pick(label, key) {
    input.value = label;
    close();
    updateValidityHint(key);
    autoFillNext(key);
  }

  function close() {
    listEl.classList.remove("open");
    listEl.innerHTML = "";
    activeIdx = -1;
  }

  input.addEventListener("focus", () => render(input.value));
  input.addEventListener("input", () => render(input.value));
  input.addEventListener("blur", () => setTimeout(close, 150));

  input.addEventListener("keydown", (e) => {
    const items = listEl.querySelectorAll(".type-suggestion-item");
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      const item = items[activeIdx];
      pick(item.dataset.label, item.dataset.key);
      return;
    } else if (e.key === "Escape") {
      close();
      return;
    } else {
      return;
    }
    items.forEach((el, i) => el.classList.toggle("active", i === activeIdx));
    items[activeIdx]?.scrollIntoView({ block: "nearest" });
  });
}

/* ============================================================
   BIND DE EVENTOS
   ============================================================ */

function bindEvents() {
  // Header
  document.getElementById("btn-logout").addEventListener("click", logout);
  document.getElementById("btn-export").addEventListener("click", exportData);

  // Odômetro
  document
    .getElementById("current-km-input")
    .addEventListener("input", handleKmInput);

  // Select de veículo
  document
    .getElementById("vehicle-select")
    .addEventListener("change", async (e) => {
      const val = e.target.value;
      if (val === "__new__") {
        e.target.value = activeVehicle?.id || "";
        openVehicleModal();
        return;
      }
      const v = vehicles.find((v) => v.id === val);
      if (v) await switchVehicle(v);
    });
  document
    .getElementById("btn-delete-vehicle")
    .addEventListener("click", handleDeleteVehicle);

  // Modal veículo
  document
    .getElementById("btn-add-vehicle-confirm")
    .addEventListener("click", handleAddVehicle);
  document
    .getElementById("btn-cancel-vehicle")
    .addEventListener("click", closeVehicleModal);
  document.getElementById("vehicle-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("vehicle-modal"))
      closeVehicleModal();
  });
  document.getElementById("v-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAddVehicle();
  });

  // Botão nova revisão
  document
    .getElementById("btn-open-form")
    .addEventListener("click", () => openFormModal());

  // Modal formulário
  document.getElementById("btn-save").addEventListener("click", handleSave);
  document
    .getElementById("btn-cancel-form")
    .addEventListener("click", closeFormModal);
  document
    .getElementById("btn-close-form")
    .addEventListener("click", closeFormModal);
  document.getElementById("form-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("form-modal")) closeFormModal();
  });

  // Máscara de moeda
  document.getElementById("f-price").addEventListener("input", (e) => {
    let digits = e.target.value.replace(/\D/g, "");
    if (digits.length > 10) digits = digits.slice(0, 10);
    const cents = parseInt(digits || "0", 10);
    const reais = Math.floor(cents / 100);
    const dec = String(cents % 100).padStart(2, "0");
    const reaisFormatted = reais.toLocaleString("pt-BR");
    e.target.value = digits.length === 0 ? "" : `R$ ${reaisFormatted},${dec}`;
  });

  // Autocomplete de tipo de manutenção
  initTypeAutocomplete();
  document
    .getElementById("f-date")
    .addEventListener("change", () =>
      autoFillNext(resolveTypeKey(document.getElementById("f-type").value)),
    );
  document
    .getElementById("f-km")
    .addEventListener("change", () =>
      autoFillNext(resolveTypeKey(document.getElementById("f-type").value)),
    );

  // Upload foto
  document.getElementById("f-photo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById("file-name-label").textContent = file.name;
    photoDataUrl = await fileToBase64(file);
  });

  // Filtros
  document.getElementById("filter-bar").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document
      .querySelectorAll(".chip")
      .forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderRecords(
      records,
      currentFilter,
      handleDelete,
      handleUnarchive,
      openDetailModal,
      _searchTerm,
    );
  });

  // Modal foto (ampliada)
  document
    .getElementById("btn-close-modal")
    .addEventListener("click", closePhotoModal);
  document.getElementById("photo-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("photo-modal")) closePhotoModal();
  });

  // Modal detalhe
  document
    .getElementById("btn-close-detail")
    .addEventListener("click", closeDetailModal);
  document.getElementById("detail-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("detail-modal"))
      closeDetailModal();
  });
  document.getElementById("detail-photo").addEventListener("click", () => {
    const r = records.find((r) => r.id === _detailId);
    if (r?.photoBase64) openPhotoModal(r.photoBase64);
  });
  document.getElementById("detail-btn-edit").addEventListener("click", () => {
    const r = records.find((r) => r.id === _detailId);
    closeDetailModal();
    if (r) openFormModal(r);
  });
  document
    .getElementById("detail-btn-delete")
    .addEventListener("click", async () => {
      const id = _detailId;
      closeDetailModal();
      await handleDelete(id);
    });
  document
    .getElementById("detail-btn-download")
    .addEventListener("click", () => {
      const r = records.find((r) => r.id === _detailId);
      if (!r?.photoBase64) return;
      const a = document.createElement("a");
      a.href = r.photoBase64;
      a.download = `comprovante_${r.label}_${r.date}.jpg`;
      a.click();
    });
  document
    .getElementById("detail-btn-unarchive")
    .addEventListener("click", async () => {
      const id = _detailId;
      closeDetailModal();
      await handleUnarchive(id);
    });

  // Pesquisa
  const searchInput = document.getElementById("search-input");
  const searchClear = document.getElementById("search-clear");
  searchInput.addEventListener("input", (e) => {
    _searchTerm = e.target.value.trim().toLowerCase();
    searchClear.style.display = _searchTerm ? "flex" : "none";
    renderRecords(
      records,
      currentFilter,
      handleDelete,
      handleUnarchive,
      openDetailModal,
      _searchTerm,
    );
  });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    _searchTerm = "";
    searchClear.style.display = "none";
    renderRecords(
      records,
      currentFilter,
      handleDelete,
      handleUnarchive,
      openDetailModal,
      _searchTerm,
    );
  });

  document.getElementById("f-date").value = new Date()
    .toISOString()
    .split("T")[0];
}
