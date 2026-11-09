import { firebaseAdmin, FieldValue } from "../firebase-admin.js";

const STATUS_TAREFA = new Set(["pendente", "em_andamento", "concluida", "cancelada"]);
function http(status, message) { const e = new Error(message); e.status = status; return e; }
function dbPadrao() { return firebaseAdmin().db; }
function validarPrazo(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) throw http(400, "Prazo inválido. Informe uma data e hora válidas.");
  return data.toISOString();
}
export async function listarTarefasChamado(chamadoId, deps = {}) {
  const db = deps.db || dbPadrao();
  const chamadoRef = db.collection("chamados").doc(chamadoId);
  const chamado = await chamadoRef.get();
  if (!chamado.exists) throw http(404, "Chamado não encontrado.");
  const snap = await chamadoRef.collection("tarefas").orderBy("criadoEm", "asc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function criarTarefaChamado(chamadoId, dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao();
  const titulo = String(dados?.titulo || "").trim();
  const descricao = String(dados?.descricao || "").trim();
  if (!titulo) throw http(400, "Informe o título da tarefa.");
  if (titulo.length > 160 || descricao.length > 2000) throw http(400, "Título ou descrição excede o limite permitido.");
  const prazo = validarPrazo(dados?.prazo);
  const responsavelUid = dados?.responsavelUid ? String(dados.responsavelUid) : null;
  if (responsavelUid && responsavelUid !== usuario.uid) throw http(403, "Nesta etapa, só é possível atribuir a tarefa a você mesmo.");
  const responsavelNome = responsavelUid ? usuario.nome : null;
  const chamadoRef = db.collection("chamados").doc(chamadoId);
  const tarefaRef = chamadoRef.collection("tarefas").doc();
  const agora = FieldValue.serverTimestamp();
  await db.runTransaction(async tx => {
    const chamado = await tx.get(chamadoRef);
    if (!chamado.exists) throw http(404, "Chamado não encontrado.");
    if (chamado.data().status === "encerrado") throw http(409, "Reabra o chamado antes de criar tarefas.");
    tx.create(tarefaRef, { titulo, descricao, status: "pendente", prazo, responsavelUid, responsavelNome, criadoPorUid: usuario.uid, criadoPorNome: usuario.nome, criadoEm: agora, atualizadoEm: agora, concluidoEm: null });
    tx.create(chamadoRef.collection("mensagens").doc(), { direcao: "interna", tipo: "evento", texto: `${usuario.nome} criou a tarefa: ${titulo}.`, autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: agora });
    tx.update(chamadoRef, { atualizadoEm: agora });
  });
  return { ok: true, id: tarefaRef.id };
}
export async function atualizarTarefaChamado(chamadoId, tarefaId, dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao();
  const chamadoRef = db.collection("chamados").doc(chamadoId);
  const tarefaRef = chamadoRef.collection("tarefas").doc(tarefaId);
  const permitidos = ["titulo", "descricao", "status", "prazo", "responsavelUid"];
  const entrada = Object.fromEntries(Object.entries(dados || {}).filter(([k]) => permitidos.includes(k)));
  if (!Object.keys(entrada).length) throw http(400, "Nenhuma alteração válida informada.");
  const upd = {};
  if (entrada.titulo !== undefined) { upd.titulo = String(entrada.titulo).trim(); if (!upd.titulo || upd.titulo.length > 160) throw http(400, "Título inválido (máximo 160 caracteres)."); }
  if (entrada.descricao !== undefined) { upd.descricao = String(entrada.descricao).trim(); if (upd.descricao.length > 2000) throw http(400, "Descrição muito longa (máximo 2000 caracteres)."); }
  if (entrada.status !== undefined) { if (!STATUS_TAREFA.has(entrada.status)) throw http(400, "Status de tarefa inválido."); upd.status = entrada.status; }
  if (entrada.prazo !== undefined) upd.prazo = validarPrazo(entrada.prazo);
  if (entrada.responsavelUid !== undefined) {
    if (entrada.responsavelUid && entrada.responsavelUid !== usuario.uid) throw http(403, "Nesta etapa, só é possível atribuir a tarefa a você mesmo.");
    upd.responsavelUid = entrada.responsavelUid || null; upd.responsavelNome = upd.responsavelUid ? usuario.nome : null;
  }
  const agora = FieldValue.serverTimestamp();
  await db.runTransaction(async tx => {
    const [chamado, tarefa] = await Promise.all([tx.get(chamadoRef), tx.get(tarefaRef)]);
    if (!chamado.exists) throw http(404, "Chamado não encontrado.");
    if (!tarefa.exists) throw http(404, "Tarefa não encontrada.");
    if (chamado.data().status === "encerrado") throw http(409, "Reabra o chamado antes de alterar tarefas.");
    const atual = tarefa.data();
    const novoStatus = upd.status || atual.status;
    upd.concluidoEm = novoStatus === "concluida" ? (atual.status === "concluida" ? atual.concluidoEm : agora) : null;
    upd.atualizadoEm = agora;
    tx.update(tarefaRef, upd);
    const partes = [];
    if (upd.titulo) partes.push("renomeou a tarefa");
    if (upd.status) partes.push(`alterou a tarefa para ${upd.status}`);
    if (upd.prazo !== undefined) partes.push("alterou o prazo da tarefa");
    if (upd.responsavelUid !== undefined) partes.push(upd.responsavelUid ? "assumiu a tarefa" : "removeu o responsável da tarefa");
    if (upd.descricao !== undefined) partes.push("atualizou a descrição da tarefa");
    tx.create(chamadoRef.collection("mensagens").doc(), { direcao: "interna", tipo: "evento", texto: `${usuario.nome} ${partes.join(" e ")}: ${upd.titulo || atual.titulo}.`, autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: agora });
    tx.update(chamadoRef, { atualizadoEm: agora });
  });
  return { ok: true };
}
