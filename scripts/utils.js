// ============================================================
//  Funções utilitárias
// ============================================================

/**
 * Retorna o status combinado de um registro levando em conta
 * TANTO a data quanto o KM atual do carro.
 * Retorna o pior status entre os dois critérios.
 *   'ok' | 'warning' | 'danger'
 */
export function getStatus(record, currentKm = null) {
  const dateStatus = getDateStatus(record);
  const kmStatus = getKmStatus(record, currentKm);

  // Prioridade: danger > warning > ok
  const priority = { danger: 2, warning: 1, ok: 0 };
  return priority[dateStatus] >= priority[kmStatus] ? dateStatus : kmStatus;
}

/** Status baseado apenas na data */
export function getDateStatus(record) {
  if (!record.nextDate) return "ok";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nd = new Date(record.nextDate + "T00:00:00");
  const diff = (nd - today) / 86400000;
  if (diff < 0) return "danger";
  if (diff <= 30) return "warning";
  return "ok";
}

/**
 * Status baseado apenas no KM.
 * - danger  → KM atual >= KM previsto para revisão
 * - warning → KM atual >= KM previsto − 500 km (margem de alerta)
 * - ok      → dentro do limite
 */
export function getKmStatus(record, currentKm) {
  if (!record.nextKm || currentKm === null || currentKm === undefined)
    return "ok";
  const km = Number(currentKm);
  const due = Number(record.nextKm);
  if (km >= due) return "danger";
  if (km >= due - 500) return "warning";
  return "ok";
}

/**
 * Retorna um objeto descrevendo o motivo do alerta para exibição.
 * { reason: 'date'|'km'|'both'|null, dateStatus, kmStatus }
 */
export function getStatusDetail(record, currentKm = null) {
  const dateStatus = getDateStatus(record);
  const kmStatus = getKmStatus(record, currentKm);
  const priority = { danger: 2, warning: 1, ok: 0 };

  let reason = null;
  if (dateStatus !== "ok" && kmStatus !== "ok") reason = "both";
  else if (dateStatus !== "ok") reason = "date";
  else if (kmStatus !== "ok") reason = "km";

  const overall =
    priority[dateStatus] >= priority[kmStatus] ? dateStatus : kmStatus;
  return { status: overall, reason, dateStatus, kmStatus };
}

/** Rótulo legível do status */
export function getStatusLabel(s) {
  if (s === "danger") return "Vencido";
  if (s === "warning") return "Vence em breve";
  return "Em dia";
}

/** Dias restantes até uma data (negativo = atrasado) */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}

/** KMs restantes até a próxima revisão (negativo = ultrapassado) */
export function kmUntil(nextKm, currentKm) {
  if (!nextKm || currentKm === null) return null;
  return Number(nextKm) - Number(currentKm);
}

/** Formata 'YYYY-MM-DD' → 'DD/MM/YYYY' */
export function formatDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/** Converte File para base64 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime uma imagem base64 para no máximo `maxKB` kilobytes.
 * Reduz dimensões e qualidade JPEG progressivamente até caber.
 */
export function compressImage(dataUrl, maxKB = 800) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      const MAX_DIM = 1200;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length > maxKB * 1024 * 1.37 && quality > 0.2) {
        quality -= 0.1;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(result);
    };
    img.src = dataUrl;
  });
}

/** Exibe/esconde loader global */
export function setLoading(visible) {
  document.getElementById("global-loader").style.display = visible
    ? "flex"
    : "none";
}

/** Toast de feedback */
let toastTimer;
export function showToast(msg, type = "ok") {
  const toast = document.getElementById("toast");
  const label = document.getElementById("toast-msg");
  label.textContent = msg;
  toast.style.background = type === "error" ? "var(--danger)" : "var(--ok)";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
