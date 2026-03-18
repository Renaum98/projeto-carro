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
export async function addVehicle(uid, { name, plate, year, color }) {
  const ref = await addDoc(vehiclesRef(uid), {
    name,
    plate: plate || "",
    year: year || "",
    color: color || "",
    currentKm: null,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, name, plate, year, color, currentKm: null };
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

/** Salva nova revisão */
export async function saveRecord(uid, vehicleId, record, photoDataUrl) {
  const photoBase64 = photoDataUrl
    ? await compressImage(photoDataUrl, 800)
    : null;

  const ref = await addDoc(recordsRef(uid, vehicleId), {
    ...record,
    photoBase64,
    createdAt: serverTimestamp(),
  });

  return { id: ref.id, ...record, photoBase64 };
}

/** Remove uma revisão */
export async function deleteRecord(uid, vehicleId, recordId) {
  await deleteDoc(recordDoc(uid, vehicleId, recordId));
}
