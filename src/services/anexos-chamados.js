import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { firebaseAdmin, FieldValue } from "../firebase-admin.js";

const BUCKET = "linche-anexos";
const MAX_BYTES = 15 * 1024 * 1024;
const TIPOS = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain"
]);
function http(status, message) { const e = new Error(message); e.status = status; return e; }
function dbPadrao() { return firebaseAdmin().db; }
let clienteSupabase;
function supabase() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw http(503, "Armazenamento de anexos não configurado no servidor. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Render.");
  if (!clienteSupabase) clienteSupabase = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return clienteSupabase;
}
async function garantirBucket(client) {
  const atual = await client.storage.getBucket(BUCKET);
  if (!atual.error) return;
  if (atual.error.statusCode !== "404" && atual.error.status !== 404) {
    throw http(502, "Não foi possível verificar o bucket de anexos no Supabase.");
  }
  const criado = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [...TIPOS]
  });
  if (criado.error && !String(criado.error.message || "").toLowerCase().includes("already")) {
    throw http(502, "Não foi possível criar o bucket privado de anexos no Supabase.");
  }
}
function validarNome(nome) {
  const limpo = String(nome || "").replace(/[\/\\\r\n\0]/g, "_").trim();
  if (!limpo || limpo.length > 180) throw http(400, "Nome de arquivo inválido.");
  return limpo;
}
function dataIso(valor) {
  return valor?.toDate?.().toISOString?.() || null;
}
export async function listarAnexosChamado(chamadoId, deps = {}) {
  const db = deps.db || dbPadrao();
  const ref = db.collection("chamados").doc(chamadoId);
  const chamado = await ref.get();
  if (!chamado.exists) throw http(404, "Chamado não encontrado.");
  const snap = await ref.collection("anexos").orderBy("criadoEm", "desc").get();
  return snap.docs.map(d => { const data = d.data(); return { id: d.id, ...data, criadoEm: dataIso(data.criadoEm) }; });
}
export async function registrarAnexoChamado(chamadoId, arquivo, categoriaInformada, usuario, deps = {}) {
  if (!arquivo?.buffer) throw http(400, "Selecione um arquivo para enviar.");
  const nome = validarNome(arquivo.originalname);
  const contentType = String(arquivo.mimetype || "").toLowerCase();
  const tamanho = Number(arquivo.size);
  const categoria = String(categoriaInformada || "documento").trim().slice(0, 40);
  if (!TIPOS.has(contentType)) throw http(400, "Tipo de arquivo não permitido.");
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > MAX_BYTES) throw http(400, "O arquivo deve ter até 15 MB.");
  const db = deps.db || dbPadrao();
  const chamadoRef = db.collection("chamados").doc(chamadoId);
  const chamado = await chamadoRef.get();
  if (!chamado.exists) throw http(404, "Chamado não encontrado.");
  if (chamado.data().status === "encerrado") throw http(409, "Reabra o chamado antes de adicionar anexos.");

  const arquivoId = randomUUID();
  const storagePath = `chamados/${chamadoId}/${arquivoId}`;
  const client = supabase();
  await garantirBucket(client);
  const enviado = await client.storage.from(BUCKET).upload(storagePath, arquivo.buffer, {
    contentType, upsert: false
  });
  if (enviado.error) {
    console.error("[anexos] upload Supabase:", enviado.error.message);
    throw http(502, "O Supabase não conseguiu armazenar o arquivo. Verifique a configuração e tente novamente.");
  }

  const anexoRef = chamadoRef.collection("anexos").doc(arquivoId);
  const agora = FieldValue.serverTimestamp();
  try {
    await db.runTransaction(async tx => {
      const atual = await tx.get(chamadoRef);
      if (!atual.exists) throw http(404, "Chamado não encontrado.");
      if (atual.data().status === "encerrado") throw http(409, "Reabra o chamado antes de adicionar anexos.");
      tx.create(anexoRef, {
        nome, contentType, tamanho, categoria, storagePath, provedor: "supabase",
        criadoPorUid: usuario.uid, criadoPorNome: usuario.nome, criadoEm: agora
      });
      tx.create(chamadoRef.collection("mensagens").doc(), {
        direcao: "interna", tipo: "evento",
        texto: `${usuario.nome} anexou o arquivo: ${nome}.`,
        autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: agora
      });
      tx.update(chamadoRef, { atualizadoEm: agora });
    });
  } catch (erro) {
    await client.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    throw erro;
  }
  return { ok: true, id: arquivoId };
}
export async function obterUrlAnexoChamado(chamadoId, anexoId, deps = {}) {
  const db = deps.db || dbPadrao();
  const ref = db.collection("chamados").doc(chamadoId);
  const chamado = await ref.get();
  if (!chamado.exists) throw http(404, "Chamado não encontrado.");
  const snap = await ref.collection("anexos").doc(anexoId).get();
  if (!snap.exists) throw http(404, "Anexo não encontrado.");
  const { storagePath, provedor } = snap.data();
  if (provedor !== "supabase" || !storagePath || !storagePath.startsWith(`chamados/${chamadoId}/`)) {
    throw http(400, "Este anexo não está armazenado no Supabase.");
  }
  const client = supabase();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) {
    console.error("[anexos] signed URL Supabase:", error?.message);
    throw http(502, "Não foi possível gerar o link seguro do anexo.");
  }
  return { ok: true, url: data.signedUrl, expiresIn: 300 };
}
