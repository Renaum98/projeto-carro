// ============================================================
//  Funções de renderização da interface
// ============================================================

import { VALIDITY, TYPE_ICONS } from "./data.js";
import {
  getStatus,
  getStatusDetail,
  getStatusLabel,
  daysUntil,
  kmUntil,
  formatDate,
} from "./utils.js";

/* ---------- KM atual (atualizado pelo app.js) ---------- */
let _currentKm = null;
export function setCurrentKmUI(km) {
  _currentKm = km;
}

/* ============================================================
   VEHICLE SELECT
   ============================================================ */

export function renderVehicleSelect(vehicles, activeId) {
  const sel = document.getElementById("vehicle-select");
  sel.innerHTML = "";

  if (vehicles.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhum veículo";
    sel.appendChild(opt);
  }

  vehicles.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.plate ? `${v.name} · ${v.plate}` : v.name;
    if (v.id === activeId) opt.selected = true;
    sel.appendChild(opt);
  });

  // Opção de adicionar novo
  const addOpt = document.createElement("option");
  addOpt.value = "__new__";
  addOpt.textContent = "+ Adicionar veículo";
  sel.appendChild(addOpt);
}

/* ============================================================
   STATS
   ============================================================ */

export function renderStats(records) {
  const total = records.length;
  const okCount = records.filter(
    (r) => getStatus(r, _currentKm) === "ok",
  ).length;
  const warningCount = records.filter(
    (r) => getStatus(r, _currentKm) === "warning",
  ).length;
  const dangerCount = records.filter(
    (r) => getStatus(r, _currentKm) === "danger",
  ).length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-ok").textContent = okCount;
  const sw = document.getElementById("stat-warning");
  if (sw) sw.textContent = warningCount;
  document.getElementById("stat-alert").textContent = dangerCount;
}

/* ============================================================
   ALERTS BAR
   ============================================================ */

export function renderAlerts(records) {
  const container = document.getElementById("alerts-container");
  container.innerHTML = "";

  records.forEach((r) => {
    const detail = getStatusDetail(r, _currentKm);
    if (detail.status === "ok") return;

    const isExpired = detail.status === "danger";
    const cls = isExpired ? "danger" : "warning";
    const icon = isExpired ? "error" : "warning";

    const lines = [];
    if (detail.reason === "date" || detail.reason === "both") {
      const days = daysUntil(r.nextDate);
      if (days !== null)
        lines.push(
          days < 0
            ? `📅 Venceu há ${Math.abs(days)} dia${Math.abs(days) !== 1 ? "s" : ""} (${formatDate(r.nextDate)})`
            : `📅 Vence em ${days} dia${days !== 1 ? "s" : ""} (${formatDate(r.nextDate)})`,
        );
    }
    if (detail.reason === "km" || detail.reason === "both") {
      const rem = kmUntil(r.nextKm, _currentKm);
      if (rem !== null)
        lines.push(
          rem <= 0
            ? `🛞 Ultrapassou em ${Math.abs(rem).toLocaleString("pt-BR")} km (previsto: ${Number(r.nextKm).toLocaleString("pt-BR")} km)`
            : `🛞 Faltam ${rem.toLocaleString("pt-BR")} km (previsto: ${Number(r.nextKm).toLocaleString("pt-BR")} km)`,
        );
    }

    const el = document.createElement("div");
    el.className = `alert-card ${cls}`;
    el.innerHTML = `
      <span class="material-icons-round">${icon}</span>
      <div class="alert-text">
        <strong>${r.label} — ${isExpired ? "Revisão vencida!" : "Revisão próxima!"}</strong>
        ${lines.join("<br>")}
      </div>`;
    container.appendChild(el);
  });
}

/* ============================================================
   RECORDS LIST
   ============================================================ */

export function renderRecords(records, filter, onDelete, onPhoto, onUnarchive) {
  const list = document.getElementById("records-list");

  const filtered =
    filter === "all"
      ? records
      : records.filter((r) => getStatus(r, _currentKm) === filter);

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-round">car_repair</span>
        <p>${
          filter === "all"
            ? "Nenhuma revisão registrada ainda.<br>Adicione a primeira pelo formulário!"
            : "Nenhum registro nesta categoria."
        }</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered
    .map((r) => {
      const detail = getStatusDetail(r, _currentKm);
      const status = detail.status;
      const icon = TYPE_ICONS[r.type] || "build";
      const days = r.nextDate ? daysUntil(r.nextDate) : null;
      const remaining = kmUntil(r.nextKm, _currentKm);

      // Badge de data — mostra a data prevista formatada
      const dateBadge = r.nextDate
        ? `<span class="material-icons-round" style="font-size:11px">event</span>${formatDate(r.nextDate)}`
        : null;

      // Badge de KM — mostra o KM alvo da próxima revisão
      const kmBadge =
        r.nextKm !== null && r.nextKm !== undefined
          ? `<span class="material-icons-round" style="font-size:11px">speed</span>${Number(r.nextKm).toLocaleString("pt-BR")} km`
          : null;

      // Linha de meta: data da revisão + km na revisão + valor
      const metaParts = [
        `<span><span class="material-icons-round">calendar_today</span>${formatDate(r.date)}</span>`,
        `<span><span class="material-icons-round">speed</span>${Number(r.km).toLocaleString("pt-BR")} km</span>`,
        r.price
          ? `<span><span class="material-icons-round">payments</span>R$ ${Number(r.price).toFixed(2)}</span>`
          : "",
      ]
        .filter(Boolean)
        .join("");

      const isArchived = !!r.archived;

      return `
    <div class="record-card status-${status} ${isArchived ? "record-archived" : ""}">
      <div class="record-icon ${status}">
        <span class="material-icons-round">${icon}</span>
      </div>
      <div class="record-body">
        <div class="record-title">
          ${r.label}
          ${isArchived ? '<span class="badge-archived">Arquivado</span>' : ""}
        </div>
        <div class="record-meta">${metaParts}</div>
        ${r.notes ? `<div class="record-notes">${r.notes}</div>` : ""}
      </div>
      <div class="record-actions">
        ${!isArchived && dateBadge ? `<div class="record-due ${status}">${dateBadge}</div>` : ""}
        ${!isArchived && kmBadge ? `<div class="record-due ${status}">${kmBadge}</div>` : ""}
        <div class="record-controls">
          ${r.photoBase64 ? `<img src="${r.photoBase64}" class="photo-thumb" data-photo-id="${r.id}" title="Ver comprovante">` : ""}
          ${
            isArchived
              ? `<button class="btn-icon-sm" data-unarchive-id="${r.id}" title="Desarquivar">
                <span class="material-icons-round" style="font-size:15px">unarchive</span>
               </button>`
              : ""
          }
          <button class="btn-danger-ghost" data-delete-id="${r.id}" title="Remover">
            <span class="material-icons-round" style="font-size:16px">delete_outline</span>
          </button>
        </div>
      </div>
    </div>`;
    })
    .join("");

  list
    .querySelectorAll("[data-delete-id]")
    .forEach((btn) =>
      btn.addEventListener("click", () => onDelete(btn.dataset.deleteId)),
    );
  list
    .querySelectorAll("[data-photo-id]")
    .forEach((img) => img.addEventListener("click", () => onPhoto(img.src)));
  list
    .querySelectorAll("[data-unarchive-id]")
    .forEach((btn) =>
      btn.addEventListener(
        "click",
        () => onUnarchive && onUnarchive(btn.dataset.unarchiveId),
      ),
    );
}

/* ============================================================
   FORMULÁRIO
   ============================================================ */

export function updateValidityHint(type) {
  const hint = document.getElementById("validity-hint");
  const hintText = document.getElementById("validity-hint-text");
  const fieldCustom = document.getElementById("field-custom");
  fieldCustom.style.display = type === "outro" ? "block" : "none";
  if (type && VALIDITY[type]) {
    hint.style.display = "flex";
    hintText.textContent = VALIDITY[type].label;
  } else {
    hint.style.display = "none";
  }
}

export function autoFillNext(type) {
  if (!type || type === "outro") return;
  const v = VALIDITY[type];
  if (!v) return;
  const dateVal = document.getElementById("f-date").value;
  const kmVal = document.getElementById("f-km").value;
  const nextDate = document.getElementById("f-next-date");
  const nextKm = document.getElementById("f-next-km");
  if (dateVal && !nextDate.value && v.months) {
    const base = new Date(dateVal + "T00:00:00");
    base.setMonth(base.getMonth() + v.months);
    nextDate.value = base.toISOString().split("T")[0];
  }
  if (kmVal && !nextKm.value && v.km) {
    nextKm.value = parseInt(kmVal) + v.km;
  }
}

/* ============================================================
   ODÔMETRO & MODAIS
   ============================================================ */

export function renderOdometer(km) {
  const el = document.getElementById("odometer-display");
  if (!el) return;
  el.textContent =
    km !== null && km !== undefined
      ? `${Number(km).toLocaleString("pt-BR")} km`
      : "— km";
}

export function openPhotoModal(src) {
  document.getElementById("modal-img").src = src;
  document.getElementById("photo-modal").classList.add("open");
}

export function closePhotoModal() {
  document.getElementById("photo-modal").classList.remove("open");
}
