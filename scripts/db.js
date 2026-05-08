// ============================================================
//  Operações no Firestore
//
//  Estrutura:
//  users/{uid}/vehicles/{vehicleId}          → dados do veículo
//  users/{uid}/vehicles/{vehicleId}/records/{recordId} → revisões
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { compressImage } from "./utils.js";

/* ============================================================
   VEÍCULOS
   ============================================================ */

const vehiclesRef = (uid) => collection(db, "users", uid, "vehicles");
const vehicleDoc = (uid, vid) => doc(db, "users", uid, "vehicles", vid);

/** Retorna todos os veículos do usuário */
export async function fetchVehicles(uid) {
  const q = query(vehiclesRef(uid), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Cria um novo veículo */
export async function addVehicle(uid, { name, plate }) {
  const ref = await addDoc(vehiclesRef(uid), {
    name,
    plate: plate || "",
    currentKm: null,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: ref.id, ...snap.data() };
}

/** Atualiza o KM atual de um veículo */
export async function saveCurrentKm(uid, vehicleId, km) {
  await updateDoc(vehicleDoc(uid, vehicleId), {
    currentKm: km,
    updatedAt: serverTimestamp(),
  });
}

/** Remove um veículo e todas as suas revisões */
export async function deleteVehicle(uid, vehicleId) {
  // Remove revisões
  const recs = await getDocs(recordsRef(uid, vehicleId));
  await Promise.all(recs.docs.map((d) => deleteDoc(d.ref)));
  // Remove o veículo
  await deleteDoc(vehicleDoc(uid, vehicleId));
}

/* ============================================================
   REVISÕES (aninhadas no veículo)
   ============================================================ */

const recordsRef = (uid, vid) =>
  collection(db, "users", uid, "vehicles", vid, "records");

const recordDoc = (uid, vid, rid) =>
  doc(db, "users", uid, "vehicles", vid, "records", rid);

/** Busca revisões de um veículo */
export async function fetchRecords(uid, vehicleId) {
  const q = query(recordsRef(uid, vehicleId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Salva nova revisão.
 * Antes de salvar, arquiva automaticamente a revisão ativa
 * mais recente do mesmo tipo (se existir), para que ela
 * suma dos alertas mas continue no histórico.
 */
export async function saveRecord(
  uid,
  vehicleId,
  record,
  photoDataUrl,
  existingRecords,
) {
  // Encontra a revisão mais recente do mesmo tipo que NÃO está arquivada.
  // Para o tipo genérico "outro" (rótulos livres), também exige que o label
  // coincida — senão serviços diferentes que caem em "outro" arquivariam uns aos outros.
  const norm = (s) => (s || "").trim().toLowerCase();
  const previous = (existingRecords || [])
    .filter((r) => {
      if (r.archived || r.type !== record.type) return false;
      if (record.type === "outro") return norm(r.label) === norm(record.label);
      return true;
    })
    .sort(
      (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
    )[0];

  // Arquiva a anterior
  if (previous) {
    await updateDoc(recordDoc(uid, vehicleId, previous.id), { archived: true });
  }

  const photoBase64 = photoDataUrl
    ? await compressImage(photoDataUrl, 800)
    : null;

  const ref = await addDoc(recordsRef(uid, vehicleId), {
    ...record,
    photoBase64,
    archived: false,
    createdAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    ...record,
    photoBase64,
    archived: false,
    archivedPreviousId: previous?.id || null,
  };
}

/**
 * Atualiza uma revisão existente.
 * Só sobrescreve a foto se uma nova foi selecionada — caso contrário,
 * a foto antiga é preservada.
 */
export async function updateRecord(
  uid,
  vehicleId,
  recordId,
  record,
  photoDataUrl,
) {
  const payload = { ...record, updatedAt: serverTimestamp() };

  let photoBase64 = null;
  if (photoDataUrl) {
    photoBase64 = await compressImage(photoDataUrl, 800);
    payload.photoBase64 = photoBase64;
  }

  await updateDoc(recordDoc(uid, vehicleId, recordId), payload);
  return { photoBase64 };
}

/** Arquiva/desarquiva manualmente uma revisão */
export async function setArchived(uid, vehicleId, recordId, archived) {
  await updateDoc(recordDoc(uid, vehicleId, recordId), { archived });
}

/** Remove uma revisão */
export async function deleteRecord(uid, vehicleId, recordId) {
  await deleteDoc(recordDoc(uid, vehicleId, recordId));
}
