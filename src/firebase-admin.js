import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

export { FieldValue };

function credencial() {
  const texto = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!texto) {
    const erro = new Error("Credencial Firebase Admin não configurada.");
    erro.code = "FIREBASE_NOT_CONFIGURED";
    throw erro;
  }
  const conta = JSON.parse(texto);
  if (conta.private_key) conta.private_key = conta.private_key.replace(/\\n/g, "\n");
  return conta;
}

export function firebaseAdmin() {
  if (!getApps().length) {
    const conta = credencial();
    initializeApp({ credential: cert(conta), storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${conta.project_id}.firebasestorage.app` });
  }
  const app = getApps()[0];
  return { db: getFirestore(app), auth: getAuth(app), bucket: getStorage(app).bucket() };
}

export function firebaseAdminConfigurado() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT);
}