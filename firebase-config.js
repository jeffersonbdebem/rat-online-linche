import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEt-D8IxZrEXD8zC4UFb_JWRu_vlCNsck",
  authDomain: "rat-online-linche.firebaseapp.com",
  projectId: "rat-online-linche",
  storageBucket: "rat-online-linche.firebasestorage.app",
  messagingSenderId: "520764323201",
  appId: "1:520764323201:web:5eec67f1716bad9fe86480",
  measurementId: "G-3FM4LQD82S"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
