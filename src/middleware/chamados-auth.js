import { firebaseAdmin } from "../firebase-admin.js";

const DOMINIO = "@lincheti.com.br";
const ADMIN_EMAIL = "jefferson.bem@lincheti.com.br";
const PERFIS = new Set(["admin", "gestor", "analista"]);

export async function exigirAcessoChamados(req, res, next) {
  const token = String(req.headers.authorization || "").match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ ok: false, message: "Não autenticado." });
  try {
    const { auth, db } = firebaseAdmin();
    const decoded = await auth.verifyIdToken(token);
    const email = String(decoded.email || "").toLowerCase();
    if (!email.endsWith(DOMINIO)) return res.status(403).json({ ok: false, message: "Domínio não autorizado." });
    const snap = await db.collection("usuarios").doc(decoded.uid).get();
    const cadastro = snap.data() || {};
    if (!snap.exists || cadastro.ativo !== true) return res.status(403).json({ ok: false, message: "Usuário inativo ou sem cadastro." });
    const perfil = email === ADMIN_EMAIL ? "admin" : String(cadastro.perfil || "").toLowerCase();
    if (!PERFIS.has(perfil)) return res.status(403).json({ ok: false, message: "Perfil sem permissão de atendimento." });
    req.usuario = { uid: decoded.uid, email, perfil, nome: cadastro.nome || email };
    return next();
  } catch (erro) {
    if (erro.code === "FIREBASE_NOT_CONFIGURED") return res.status(503).json({ ok: false, message: erro.message });
    console.error("[chamados-auth] falha ao validar sessão:", erro.message);
    return res.status(401).json({ ok: false, message: "Token inválido ou expirado." });
  }
}