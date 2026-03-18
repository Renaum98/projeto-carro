import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBqoHDqyzggBnjBgZRahReaxnlyQ0MauHk",
  authDomain: "carcare-68645.firebaseapp.com",
  projectId: "carcare-68645",
  storageBucket: "carcare-68645.firebasestorage.app",
  messagingSenderId: "666388228909",
  appId: "1:666388228909:web:01f233d7b7314fffbc01a4",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider };
