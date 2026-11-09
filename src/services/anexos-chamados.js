import { firebaseAdmin, FieldValue } from "../firebase-admin.js";

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
function storageBucket() { return firebaseAdmin().bucket; }
function validarIdArquivo(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ""));
}
function validarNome(nome) {
  const limpo = String(nome || "").replace(/[\\/\\r\\n\\0]/g, "_").trim();
  if (!limpo || limpo.length > 180) throw http(400, "Nome de arquivo inválido.");
  return limpo;
}
export async function listarAnexosChamado(chamadoId, deps = {}) {
  const db = deps.db || dbPadrao();
  const ref = db.collection("chamados").doc(chamadoId);
  const chamado = await ref.get();
  if (!chamado.exists) throw http(404, "Chamado não encontrado.");
  const snap = await ref.collection("anexos").orderBy("criadoEm", "desc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function registrarAnexoChamado(chamadoId, dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao();
  const arquivoId = String(dados?.arquivoId || "");
  if (!validarIdArquivo(arquivoId)) throw http(400, "Identificador do arquivo inválido.");
  const nome = validarNome(dados?.nome);
  const contentType = String(dados?.contentType || "").toLowerCase();
  const tamanho = Number(dados?.tamanho);
  const categoria = String(dados?.categoria || "documento").trim().slice(0, 40);
  if (!TIPOS.has(contentType)) throw http(400, "Tipo de arquivo não permitido.");
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > MAX_BYTES) throw http(400, "O arquivo deve ter até 15 MB.");
  const storagePath = `chamados/${chamadoId}/${arquivoId}`;
  const bucket = storageBucket();
  const arquivo = bucket.file(storagePath);
  let metadata;
  try { [metadata] = await arquivo.getMetadata(); }
  catch { throw http(400, "Arquivo não encontrado no armazenamento. Envie novamente."); }
  if (Number(metadata.size) !== tamanho || metadata.contentType !== contentType) throw http(400, "Os dados do arquivo enviado não conferem.");
  const chamadoRef = db.collection("chamados").doc(chamadoId);
  const anexoRef = chamadoRef.collection("anexos").doc(arquivoId);
  const agora = FieldValue.serverTimestamp();
  await db.runTransaction(async tx => {
    const [chamado, existente] = await Promise.all([tx.get(chamadoRef), tx.get(anexoRef)]);
    if (!chamado.exists) throw http(404, "Chamado não encontrado.");
    if (chamado.data().status === "encerrado") throw http(409, "Reabra o chamado antes de adicionar anexos.");
    if (existente.exists) throw http(409, "Este arquivo já foi registrado no chamado.");
    tx.create(anexoRef, {
      nome, contentType, tamanho, categoria, storagePath,
      criadoPorUid: usuario.uid, criadoPorNome: usuario.nome,
      criadoEm: agora
    });
    tx.create(chamadoRef.collection("mensagens").doc(), {
      direcao: "interna", tipo: "evento",
      texto: `${usuario.nome} anexou o arquivo: ${nome}.`,
      autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: agora
    });
    tx.update(chamadoRef, { atualizadoEm: agora });
  });
  return { ok: true, id: arquivoId };
}
export async function obterUrlAnexoChamado(chamadoId, anexoId, deps = {}) {
  const db = deps.db || dbPadrao();
  const ref = db.collection("chamados").doc(chamadoId);
  const chamado = await ref.get();
  if (!chamado.exists) throw http(404, "Chamado não encontrado.");
  const snap = await ref.collection("anexos").doc(anexoId).get();
  if (!snap.exists) throw http(404, "Anexo não encontrado.");
  const { storagePath } = snap.data();
  if (!storagePath || !storagePath.startsWith(`chamados/${chamadoId}/`)) throw http(400, "Caminho do anexo inválido.");
  const [url] = await storageBucket().file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 5 * 60 * 1000
  });
  return { ok: true, url, expiresIn: 300 };
}
