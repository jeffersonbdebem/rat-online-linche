import { createSign, createVerify } from "node:crypto";

const ADMIN_EMAIL = "jefferson.bem@lincheti.com.br";
const DOMAIN = "@lincheti.com.br";
let certCache = { expiresAt: 0, certs: {} };
let oauthCache = { expiresAt: 0, token: null };

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    const error = new Error("Autenticação Firebase não configurada no servidor.");
    error.code = "FIREBASE_NOT_CONFIGURED";
    throw error;
  }
  try {
    const account = JSON.parse(raw);
    if (!account.project_id || !account.client_email || !account.private_key) throw new Error("Credencial incompleta");
    return { ...account, private_key: account.private_key.replace(/\\n/g, "\n") };
  } catch {
    const error = new Error("A variável FIREBASE_SERVICE_ACCOUNT não contém uma credencial JSON válida.");
    error.code = "FIREBASE_NOT_CONFIGURED";
    throw error;
  }
}

function decodePart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function getFirebaseCerts() {
  if (Date.now() < certCache.expiresAt && Object.keys(certCache.certs).length) return certCache.certs;
  const response = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!response.ok) throw new Error("Não foi possível obter certificados de validação Firebase.");
  const certs = await response.json();
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 300);
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  return certs;
}

async function verifyFirebaseToken(token, projectId) {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("Token inválido");
  const header = decodePart(parts[0]);
  const payload = decodePart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Assinatura inválida");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId ||
      payload.iss !== `https://securetoken.google.com/${projectId}` ||
      typeof payload.sub !== "string" || !payload.sub ||
      payload.sub.length > 128 ||
      !Number.isFinite(payload.exp) || payload.exp <= now ||
      !Number.isFinite(payload.iat) || payload.iat > now ||
      !Number.isFinite(payload.auth_time) || payload.auth_time > now) {
    throw new Error("Token expirado ou destinado a outro projeto");
  }

  const certs = await getFirebaseCerts();
  const certificate = certs[header.kid];
  if (!certificate) {
    certCache.expiresAt = 0;
    throw new Error("Certificado Firebase desconhecido");
  }
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(certificate, Buffer.from(parts[2], "base64url"))) {
    throw new Error("Assinatura Firebase inválida");
  }
  return payload;
}

async function getGoogleAccessToken(account) {
  if (oauthCache.token && Date.now() < oauthCache.expiresAt) return oauthCache.token;
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error("Falha ao autenticar serviço Firebase.");
  oauthCache = { token: result.access_token, expiresAt: Date.now() + Math.max(60, result.expires_in - 60) * 1000 };
  return oauthCache.token;
}

async function usuarioAtivoAdmin(account, uid) {
  const accessToken = await getGoogleAccessToken(account);
  const url = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents/usuarios/${encodeURIComponent(uid)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error("Falha ao consultar cadastro no Firestore.");
  const document = await response.json();
  const fields = document.fields || {};
  return fields.ativo?.booleanValue === true &&
    String(fields.perfil?.stringValue || "").toLowerCase() === "admin";
}

export async function requireAdmin(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ message: "Autenticação necessária." });

  let account;
  let decoded;
  try {
    account = serviceAccount();
    decoded = await verifyFirebaseToken(match[1], account.project_id);
  } catch (error) {
    if (error.code === "FIREBASE_NOT_CONFIGURED") return res.status(503).json({ message: error.message });
    return res.status(401).json({ message: "Sessão inválida ou expirada." });
  }

  const email = String(decoded.email || "").trim().toLowerCase();
  if (!email.endsWith(DOMAIN) || email !== ADMIN_EMAIL) {
    return res.status(403).json({ message: "Acesso restrito ao administrador autorizado." });
  }

  try {
    if (!(await usuarioAtivoAdmin(account, decoded.sub))) {
      return res.status(403).json({ message: "Usuário inativo ou sem perfil administrativo." });
    }
    req.authUser = { uid: decoded.sub, email, perfil: "admin" };
    return next();
  } catch (error) {
    console.error("[Auth] Falha ao validar cadastro no Firestore:", error.message);
    return res.status(503).json({ message: "Não foi possível validar o acesso agora." });
  }
}
