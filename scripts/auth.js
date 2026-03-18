// ============================================================
//  Autenticação — Google Login
// ============================================================

import { auth, provider } from "./firebase-config.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showToast, setLoading } from "./utils.js";
import { initApp } from "./app.js";

/* ---------- Estado global do usuário ---------- */
export let currentUser = null;

/* ---------- Login com Google ---------- */
export async function loginWithGoogle() {
  try {
    setLoading(true);
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    showToast("Erro ao fazer login. Tente novamente.", "error");
  } finally {
    setLoading(false);
  }
}

/* ---------- Logout ---------- */
export async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
    showToast("Erro ao sair.", "error");
  }
}

/* ---------- Observador de estado de autenticação ---------- */
export function initAuth() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      showAuthenticatedUI(user);
      initApp(user);
    } else {
      showLoginUI();
    }
  });
}

/* ---------- Renderiza tela de login ---------- */
function showLoginUI() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app-screen").style.display = "none";
}

/* ---------- Renderiza app após login ---------- */
function showAuthenticatedUI(user) {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "block";

  // Só o primeiro nome no header compacto
  const firstName = (user.displayName || "Usuário").split(" ")[0];
  const nameEl = document.getElementById("user-name");
  if (nameEl) nameEl.textContent = firstName;
}
