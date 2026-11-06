import { firebaseAdmin, FieldValue } from "../firebase-admin.js";

const STATUS = new Set(["novo", "em_atendimento", "aguardando_cliente", "encerrado"]);
const PRIORIDADES = new Set(["baixa", "normal", "alta", "urgente"]);
function http(status, message) { const e = new Error(message); e.status = status; return e; }
function dbPadrao() { return firebaseAdmin().db; }

export async function abrirChamadoManual(dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao();
  const clienteNome = String(dados?.clienteNome || "").trim();
  const assunto = String(dados?.assunto || "").trim();
  const telefone = String(dados?.telefone || "").trim();
  const email = String(dados?.email || "").trim();
  const descricao = String(dados?.descricao || "").trim();
  const prioridade = String(dados?.prioridade || "normal");
  if (!clienteNome) throw http(400, "Informe o nome do cliente ou solicitante.");
  if (!assunto) throw http(400, "Informe o assunto do chamado.");
  if (clienteNome.length > 160 || assunto.length > 160 || telefone.length > 40 || email.length > 160 || descricao.length > 4000) throw http(400, "Um ou mais campos excedem o tamanho permitido.");
  if (!PRIORIDADES.has(prioridade)) throw http(400, "Prioridade inválida.");

  const contadorRef = db.collection("contadores").doc("chamados");
  const chamadoRef = db.collection("chamados").doc();
  const agora = FieldValue.serverTimestamp();
  const protocolo = await db.runTransaction(async tx => {
    const contador = await tx.get(contadorRef);
    const numero = Number(contador.data()?.ultimo || 0) + 1;
    const codigo = `CH-${String(numero).padStart(6, "0")}`;
    tx.set(contadorRef, { ultimo: numero }, { merge: true });
    tx.create(chamadoRef, {
      numero, protocolo: codigo, clienteNome, assunto, telefone, email, descricao,
      origem: "manual", provedor: null, status: "novo", prioridade,
      responsavelUid: null, responsavelNome: null, naoLidas: 0,
      ultimaMensagemEm: agora, ultimaMensagemTexto: descricao || assunto,
      ultimaDirecao: "interna", criadoPorUid: usuario.uid, criadoPorNome: usuario.nome,
      criadoEm: agora, atualizadoEm: agora, encerradoEm: null
    });
    tx.create(chamadoRef.collection("mensagens").doc(), {
      direcao: "interna", tipo: "evento", texto: `Chamado aberto manualmente por ${usuario.nome}.`,
      autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: agora
    });
    if (descricao) tx.create(chamadoRef.collection("mensagens").doc(), {
      direcao: "interna", tipo: "nota", texto: descricao,
      autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: agora
    });
    return codigo;
  });
  return { ok: true, id: chamadoRef.id, protocolo };
}

export async function listarChamados({ status, limite = 200 } = {}, deps = {}) {
  const db = deps.db || dbPadrao();
  const max = Math.min(500, Math.max(1, Number(limite) || 200));
  const snap = await db.collection("chamados").orderBy("ultimaMensagemEm", "desc").limit(max).get();
  const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return status && STATUS.has(status) ? itens.filter(c => c.status === status) : itens;
}

export async function atualizarChamadoManual(id, campos, usuario, deps = {}) {
  const db = deps.db || dbPadrao();
  const permitidos = ["status", "prioridade", "responsavelUid", "responsavelNome"];
  const alteracoes = Object.fromEntries(Object.entries(campos || {}).filter(([k]) => permitidos.includes(k)));
  if (!Object.keys(alteracoes).length) throw http(400, "Nenhuma alteração válida informada.");
  if (alteracoes.status && !STATUS.has(alteracoes.status)) throw http(400, "Status inválido.");
  if (alteracoes.prioridade && !PRIORIDADES.has(alteracoes.prioridade)) throw http(400, "Prioridade inválida.");
  if (alteracoes.responsavelUid !== undefined) {
    if (alteracoes.responsavelUid !== null && alteracoes.responsavelUid !== usuario.uid) throw http(403, "Só é permitido assumir o chamado para o próprio usuário ou liberá-lo.");
    alteracoes.responsavelNome = alteracoes.responsavelUid ? usuario.nome : null;
  }
  const ref = db.collection("chamados").doc(id);
  const agora = FieldValue.serverTimestamp();
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw http(404, "Chamado não encontrado.");
    const atual = snap.data();
    const upd = { ...alteracoes, atualizadoEm: agora };
    if (alteracoes.status === "encerrado") upd.encerradoEm = agora;
    else if (alteracoes.status && atual.status === "encerrado") upd.encerradoEm = null;
    tx.update(ref, upd);
    const evento = [];
    if (alteracoes.status) evento.push(`status para ${alteracoes.status}`);
    if (alteracoes.prioridade) evento.push(`prioridade para ${alteracoes.prioridade}`);
    if (alteracoes.responsavelUid !== undefined) evento.push(alteracoes.responsavelUid ? "assumiu o chamado" : "liberou o chamado");
    tx.create(ref.collection("mensagens").doc(), {
      direcao: "interna", tipo: "evento", texto: `${usuario.nome} ${evento.join(" e ")}.`,
      autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: agora
    });
  });
  return { ok: true };
}

export async function adicionarNotaManual(id, texto, usuario, deps = {}) {
  const nota = String(texto || "").trim();
  if (!nota) throw http(400, "Digite uma nota.");
  if (nota.length > 4000) throw http(400, "Nota muito longa (máximo 4000 caracteres).");
  const db = deps.db || dbPadrao();
  const ref = db.collection("chamados").doc(id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw http(404, "Chamado não encontrado.");
    tx.create(ref.collection("mensagens").doc(), {
      direcao: "interna", tipo: "nota", texto: nota,
      autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: FieldValue.serverTimestamp()
    });
    tx.update(ref, { atualizadoEm: FieldValue.serverTimestamp() });
  });
  return { ok: true };
}