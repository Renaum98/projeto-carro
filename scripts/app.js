// ============================================================
//  App — Controller principal
// ============================================================

import { TYPE_LABELS } from "./data.js";
import {
  fetchVehicles,
  addVehicle,
  deleteVehicle,
  saveCurrentKm,
  fetchRecords,
  saveRecord,
  deleteRecord,
} from "./db.js";
import {
  showToast,
  setLoading,
  fileToBase64,
  getStatus,
  getStatusDetail,
  daysUntil,
  kmUntil,
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
let vehicles = []; // todos os veículos do usuário
let activeVehicle = null; // veículo selecionado { id, name, ... }
let records = []; // revisões do veículo ativo
let currentFilter = "all";
let currentUser = null;
let photoDataUrl = null;
let kmSaveTimer = null;

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
      // Nenhum carro cadastrado — abre modal de criação
      renderVehicleSelect(vehicles, null);
      openVehicleModal();
      return;
    }

    // Restaura último veículo ativo (salvo no localStorage)
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

/** Troca o veículo ativo e recarrega tudo */
async function switchVehicle(vehicle) {
  activeVehicle = vehicle;
  localStorage.setItem(`care_vehicle_${currentUser.uid}`, vehicle.id);

  // Atualiza odômetro
  const km = vehicle.currentKm ?? null;
  setCurrentKmUI(km);
  renderOdometer(km);
  const input = document.getElementById("current-km-input");
  if (input) input.value = km !== null ? km : "";

  // Carrega revisões deste veículo
  await loadRecords();
}

async function handleAddVehicle() {
  const name = document.getElementById("v-name").value.trim();
  const plate = document.getElementById("v-plate").value.trim();
  const year = document.getElementById("v-year").value.trim();
  const color = document.getElementById("v-color").value.trim();

  if (!name) return showToast("Informe o nome/modelo do veículo", "error");

  try {
    setLoading(true);
    const v = await addVehicle(currentUser.uid, { name, plate, year, color });
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

function renderAll() {
  setCurrentKmUI(activeVehicle?.currentKm ?? null);
  renderStats(records);
  renderAlerts(records);
  renderRecords(records, currentFilter, handleDelete, openPhotoModal);
}

async function handleSave() {
  if (!activeVehicle)
    return showToast("Selecione um veículo primeiro.", "error");

  const type = document.getElementById("f-type").value;
  const custom = document.getElementById("f-custom").value.trim();
  const date = document.getElementById("f-date").value;
  const km = document.getElementById("f-km").value;
  const nextDate = document.getElementById("f-next-date").value;
  const nextKm = document.getElementById("f-next-km").value;
  const price = document.getElementById("f-price").value;
  const notes = document.getElementById("f-notes").value.trim();

  if (!type) return showToast("Selecione o tipo de manutenção", "error");
  if (!date) return showToast("Informe a data da revisão", "error");
  if (!km) return showToast("Informe o KM atual", "error");
  if (type === "outro" && !custom)
    return showToast("Informe o nome da manutenção", "error");

  const record = {
    type,
    label: type === "outro" ? custom : TYPE_LABELS[type],
    date,
    km: parseInt(km),
    nextDate: nextDate || null,
    nextKm: nextKm ? parseInt(nextKm) : null,
    price: price ? parseFloat(price) : null,
    notes,
  };

  try {
    setLoading(true);
    const saved = await saveRecord(
      currentUser.uid,
      activeVehicle.id,
      record,
      photoDataUrl,
    );
    records.unshift(saved);
    renderAll();
    resetForm();
    showToast("Revisão salva com sucesso!");
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
  const warning = records.filter((r) => getStatus(r, km) === "warning");
  const vName = activeVehicle?.name || "seu carro";

  if (expired.length > 0) {
    fireNotification({
      title: `🔴 ${vName} — ${expired.length} revisão(ões) vencida(s)!`,
      body: expired.map((r) => `• ${r.label}`).join("\n"),
      tag: `care-expired-${activeVehicle?.id}`,
    });
  }
  warning.forEach((r) => {
    const detail = getStatusDetail(r, km);
    const days = daysUntil(r.nextDate);
    const remaining = kmUntil(r.nextKm, km);
    const parts = [];
    if ((detail.reason === "date" || detail.reason === "both") && days !== null)
      parts.push(days === 0 ? "Vence hoje!" : `${days}d restantes`);
    if (
      (detail.reason === "km" || detail.reason === "both") &&
      remaining !== null
    )
      parts.push(`${remaining.toLocaleString("pt-BR")} km restantes`);
    fireNotification({
      title: `🟡 ${vName} — ${r.label}`,
      body: parts.join(" · ") || "Revisão próxima.",
      tag: `care-warn-${activeVehicle?.id}-${r.id}`,
    });
  });
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
   MODAL — NOVO VEÍCULO
   ============================================================ */

function openVehicleModal() {
  document.getElementById("vehicle-modal").classList.add("open");
  document.getElementById("v-name").focus();
}
function closeVehicleModal() {
  // Não fecha se não houver nenhum veículo cadastrado
  if (vehicles.length === 0) return;
  document.getElementById("vehicle-modal").classList.remove("open");
  ["v-name", "v-plate", "v-year", "v-color"].forEach((id) => {
    document.getElementById(id).value = "";
  });
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function openFormModal() {
  document.getElementById("form-modal").classList.add("open");
  // Pre-fill date with today
  document.getElementById("f-date").value = new Date()
    .toISOString()
    .split("T")[0];
  // Pre-fill km with current vehicle odometer
  const kmInput = document.getElementById("f-km");
  if (activeVehicle?.currentKm && !kmInput.value) {
    kmInput.value = activeVehicle.currentKm;
    autoFillNext(document.getElementById("f-type").value);
  }
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
    "f-custom",
  ].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("file-name-label").textContent = "";
  document.getElementById("validity-hint").style.display = "none";
  document.getElementById("field-custom").style.display = "none";
  photoDataUrl = null;
  // Form modal
  document
    .getElementById("btn-open-form")
    .addEventListener("click", openFormModal);
  document
    .getElementById("btn-cancel-form")
    .addEventListener("click", closeFormModal);
  document
    .getElementById("btn-close-form")
    .addEventListener("click", closeFormModal);
  document.getElementById("form-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("form-modal")) closeFormModal();
  });

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
   BIND DE EVENTOS
   ============================================================ */

function bindEvents() {
  document.getElementById("btn-save").addEventListener("click", handleSave);
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

  // Botão remover veículo
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

  // Form revisão
  document.getElementById("f-type").addEventListener("change", () => {
    const type = document.getElementById("f-type").value;
    updateValidityHint(type);
    autoFillNext(type);
  });
  document
    .getElementById("f-date")
    .addEventListener("change", () =>
      autoFillNext(document.getElementById("f-type").value),
    );
  document
    .getElementById("f-km")
    .addEventListener("change", () =>
      autoFillNext(document.getElementById("f-type").value),
    );

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
    renderRecords(records, currentFilter, handleDelete, openPhotoModal);
  });

  // Modal foto
  document
    .getElementById("btn-close-modal")
    .addEventListener("click", closePhotoModal);
  document.getElementById("photo-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("photo-modal")) closePhotoModal();
  });

  // Form modal
  document
    .getElementById("btn-open-form")
    .addEventListener("click", openFormModal);
  document
    .getElementById("btn-cancel-form")
    .addEventListener("click", closeFormModal);
  document
    .getElementById("btn-close-form")
    .addEventListener("click", closeFormModal);
  document.getElementById("form-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("form-modal")) closeFormModal();
  });

  document.getElementById("f-date").value = new Date()
    .toISOString()
    .split("T")[0];
}
