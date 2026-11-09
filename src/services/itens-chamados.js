import { firebaseAdmin, FieldValue } from "../firebase-admin.js";

const STATUS_ITEM = new Set(["a_comprar", "comprado", "utilizado", "cancelado"]);
const UNIDADES = new Set(["un", "peça", "kit", "m", "cm", "kg", "g", "l", "cx", "par", "serviço"]);
function http(status, message) { const e = new Error(message); e.status = status; return e; }
function dbPadrao() { return firebaseAdmin().db; }
function numero(valor, nome, minimo = 0) {
  if (valor === undefined || valor === null || valor === "") return minimo;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < minimo || n > 100000000) throw http(400, `${nome} inválido.`);
  return n;
}
function validar(dados) {
  const nome = String(dados?.nome || "").trim();
  const descricao = String(dados?.descricao || "").trim();
  const fornecedor = String(dados?.fornecedor || "").trim();
  const unidade = String(dados?.unidade || "un").trim().toLowerCase();
  const quantidade = numero(dados?.quantidade, "Quantidade", 0.0001);
  const custoUnitario = numero(dados?.custoUnitario, "Custo unitário", 0);
  const status = String(dados?.status || "a_comprar");
  if (!nome) throw http(400, "Informe o nome do item.");
  if (nome.length > 160 || descricao.length > 1000 || fornecedor.length > 160) throw http(400, "Um dos campos excede o limite permitido.");
  if (!UNIDADES.has(unidade)) throw http(400, "Unidade inválida.");
  if (!STATUS_ITEM.has(status)) throw http(400, "Situação do item inválida.");
  return { nome, descricao, fornecedor, unidade, quantidade, custoUnitario, custoTotal: Number((quantidade * custoUnitario).toFixed(2)), status };
}
export async function listarItensChamado(chamadoId, deps = {}) {
  const db = deps.db || dbPadrao();
  const chamadoRef = db.collection("chamados").doc(chamadoId);
  const chamado = await chamadoRef.get();
  if (!chamado.exists) throw http(404, "Chamado não encontrado.");
  const snap = await chamadoRef.collection("itens").orderBy("criadoEm", "asc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function criarItemChamado(chamadoId, dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao();
  const item = validar(dados);
  const chamadoRef = db.collection("chamados").doc(chamadoId);
  const itemRef = chamadoRef.collection("itens").doc();
  const agora = FieldValue.serverTimestamp();
  await db.runTransaction(async tx => {
    const chamado = await tx.get(chamadoRef);
    if (!chamado.exists) throw http(404, "Chamado não encontrado.");
    if (chamado.data().status === "encerrado") throw http(409, "Reabra o chamado antes de adicionar itens.");
    tx.create(itemRef, { ...item, criadoPorUid: usuario.uid, criadoPorNome: usuario.nome, criadoEm: agora, atualizadoEm: agora });
    tx.create(chamadoRef.collection("mensagens").doc(), {
      direcao: "interna", tipo: "evento",
      texto: `${usuario.nome} adicionou o item: ${item.nome} (${item.quantidade} ${item.unidade}) — ${item.status === "comprado" ? "comprado" : item.status === "utilizado" ? "utilizado" : item.status === "cancelado" ? "cancelado" : "a comprar"}.`,
      autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: agora
    });
    tx.update(chamadoRef, { atualizadoEm: agora });
  });
  return { ok: true, id: itemRef.id };
}
export async function atualizarItemChamado(chamadoId, itemId, dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao();
  const chamadoRef = db.collection("chamados").doc(chamadoId);
  const itemRef = chamadoRef.collection("itens").doc(itemId);
  const permitidos = ["nome", "descricao", "fornecedor", "unidade", "quantidade", "custoUnitario", "status"];
  const entrada = Object.fromEntries(Object.entries(dados || {}).filter(([k]) => permitidos.includes(k)));
  if (!Object.keys(entrada).length) throw http(400, "Nenhuma alteração válida informada.");
  const agora = FieldValue.serverTimestamp();
  await db.runTransaction(async tx => {
    const [chamado, snap] = await Promise.all([tx.get(chamadoRef), tx.get(itemRef)]);
    if (!chamado.exists) throw http(404, "Chamado não encontrado.");
    if (!snap.exists) throw http(404, "Item não encontrado.");
    if (chamado.data().status === "encerrado") throw http(409, "Reabra o chamado antes de alterar itens.");
    const atual = snap.data();
    const novo = validar({ ...atual, ...entrada });
    tx.update(itemRef, { ...novo, atualizadoEm: agora });
    const partes = [];
    if (entrada.status) partes.push(`alterou a situação para ${entrada.status}`);
    if (["quantidade", "unidade", "custoUnitario"].some(k => entrada[k] !== undefined)) partes.push("atualizou quantidade ou custo");
    if (entrada.nome || entrada.descricao || entrada.fornecedor) partes.push("atualizou os dados do item");
    tx.create(chamadoRef.collection("mensagens").doc(), {
      direcao: "interna", tipo: "evento",
      texto: `${usuario.nome} ${partes.join(" e ") || "atualizou o item"}: ${novo.nome}.`,
      autorUid: usuario.uid, autorNome: usuario.nome, criadoEm: agora
    });
    tx.update(chamadoRef, { atualizadoEm: agora });
  });
  return { ok: true };
}
