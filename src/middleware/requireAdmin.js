import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const ADMIN_EMAIL = "jefferson.bem@lincheti.com.br";
const DOMAIN = "@lincheti.com.br";

function getFirebaseAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    const error = new Error("Autenticação Firebase não configurada no servidor.");
    error.code = "FIREBASE_NOT_CONFIGURED";
    throw error;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    const error = new Error("A variável FIREBASE_SERVICE_ACCOUNT não contém JSON válido.");
    error.code = "FIREBASE_NOT_CONFIGURED";
    throw error;
  }

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    const error = new Error("A credencial Firebase Admin está incompleta.");
    error.code = "FIREBASE_NOT_CONFIGURED";
    throw error;
  }

  const app = getApps()[0] || initializeApp({
    credential: cert({
      ...serviceAccount,
      private_key: serviceAccount.private_key.replace(/\\n/g, "\n")
    })
  });

  return {
    auth: getAuth(app),
    db: getFirestore(app)
  };
}

export async function requireAdmin(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ message: "Autenticação necessária." });
  }

  let decoded;
  let admin;
  try {
    admin = getFirebaseAdmin();
    decoded = await admin.auth.verifyIdToken(match[1]);
  } catch (error) {
    if (error.code === "FIREBASE_NOT_CONFIGURED") {
      return res.status(503).json({ message: error.message });
    }
    return res.status(401).json({ message: "Sessão inválida ou expirada." });
  }

  const email = String(decoded.email || "").trim().toLowerCase();
  if (!email.endsWith(DOMAIN) || email !== ADMIN_EMAIL) {
    return res.status(403).json({ message: "Acesso restrito ao administrador autorizado." });
  }

  if (!decoded.email_verified && email !== ADMIN_EMAIL) {
    return res.status(403).json({ message: "Confirme seu e-mail corporativo para continuar." });
  }

  try {
    const userSnapshot = await admin.db.collection("usuarios").doc(decoded.uid).get();
    if (!userSnapshot.exists) {
      return res.status(403).json({ message: "Usuário sem cadastro aprovado." });
    }

    const profile = userSnapshot.data() || {};
    if (profile.ativo !== true || String(profile.perfil || "").toLowerCase() !== "admin") {
      return res.status(403).json({ message: "Usuário inativo ou sem perfil administrativo." });
    }

    req.authUser = { uid: decoded.uid, email, perfil: "admin" };
    return next();
  } catch (error) {
    console.error("[Auth] Falha ao validar cadastro no Firestore:", error.message);
    return res.status(503).json({ message: "Não foi possível validar o acesso agora." });
  }
}
