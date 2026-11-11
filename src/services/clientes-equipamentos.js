import { firebaseAdmin, FieldValue } from "../firebase-admin.js";

function http(status, message) { const e = new Error(message); e.status = status; return e; }
function dbPadrao() { return firebaseAdmin().db; }
function texto(valor, campo, max = 160, obrigatorio = false) {
  const v = String(valor ?? "").trim();
  if (obrigatorio && !v) throw http(400, `Informe ${campo}.`);
  if (v.length > max) throw http(400, `${campo} excede o limite de ${max} caracteres.`);
  return v;
}
function limite(valor, padrao = 200) { return Math.min(500, Math.max(1, Number(valor) || padrao)); }
function dadosCliente(dados, atual = {}) {
  const d = { ...atual };
  for (const [campo, max, obrigatorio] of [
    ["nome",160,true],["razaoSocial",180,false],["documento",30,false],
    ["telefone",40,false],["telefoneAlternativo",40,false],["email",160,false],
    ["contato",120,false],["cep",12,false],["logradouro",180,false],
    ["numero",30,false],["complemento",100,false],["bairro",100,false],
    ["cidade",100,false],["uf",2,false],["observacoes",2000,false]
  ]) if (dados[campo] !== undefined || !atual.nome) d[campo] = texto(dados[campo] ?? (atual[campo] || ""), campo, max, obrigatorio);
  if (dados.ativo !== undefined) d.ativo = Boolean(dados.ativo);
  else if (d.ativo === undefined) d.ativo = true;
  return d;
}
function dadosEquipamento(dados, atual = {}) {
  const d = { ...atual };
  for (const [campo,max,obrigatorio] of [
    ["clienteId",128,true],["nome",160,true],["tipo",100,false],
    ["fabricante",100,false],["modelo",120,false],["numeroSerie",120,false],
    ["patrimonio",80,false],["localizacao",160,false],["observacoes",2000,false]
  ]) if (dados[campo] !== undefined || !atual.nome) d[campo] = texto(dados[campo] ?? (atual[campo] || ""), campo, max, obrigatorio);
  if (dados.ativo !== undefined) d.ativo = Boolean(dados.ativo);
  else if (d.ativo === undefined) d.ativo = true;
  return d;
}
async function clienteExiste(db, id) {
  const snap = await db.collection("clientes").doc(id).get();
  if (!snap.exists) throw http(404, "Cliente não encontrado.");
  if (snap.data().ativo === false) throw http(409, "Este cliente está inativo.");
  return snap.data();
}
export async function listarClientes({ busca, limite: qtd } = {}, deps = {}) {
  const db = deps.db || dbPadrao();
  const snap = await db.collection("clientes").limit(limite(qtd)).get();
  let itens = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  if (busca) {
    const termo = String(busca).toLocaleLowerCase("pt-BR");
    itens = itens.filter(c => [c.nome,c.razaoSocial,c.documento,c.email,c.telefone].some(v => String(v || "").toLocaleLowerCase("pt-BR").includes(termo)));
  }
  return itens.sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}
export async function obterCliente(id, deps = {}) {
  const db = deps.db || dbPadrao();
  const snap = await db.collection("clientes").doc(id).get();
  if (!snap.exists) throw http(404, "Cliente não encontrado.");
  return { id:snap.id, ...snap.data() };
}
export async function criarCliente(dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao(), ref = db.collection("clientes").doc();
  const cliente = dadosCliente(dados || {});
  const agora = FieldValue.serverTimestamp();
  await ref.create({ ...cliente, criadoPorUid:usuario.uid, criadoPorNome:usuario.nome, criadoEm:agora, atualizadoEm:agora });
  return { ok:true, id:ref.id };
}
export async function atualizarCliente(id, dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao(), ref = db.collection("clientes").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw http(404, "Cliente não encontrado.");
  const cliente = dadosCliente(dados || {}, snap.data());
  await ref.update({ ...cliente, atualizadoEm:FieldValue.serverTimestamp(), atualizadoPorUid:usuario.uid });
  return { ok:true };
}
export async function listarEquipamentos({ clienteId, busca, limite: qtd } = {}, deps = {}) {
  const db = deps.db || dbPadrao();
  let query = db.collection("equipamentos");
  if (clienteId) query = query.where("clienteId", "==", String(clienteId));
  const snap = await query.limit(limite(qtd, 300)).get();
  let itens = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  if (busca) {
    const termo = String(busca).toLocaleLowerCase("pt-BR");
    itens = itens.filter(e => [e.nome,e.tipo,e.fabricante,e.modelo,e.numeroSerie,e.patrimonio].some(v => String(v || "").toLocaleLowerCase("pt-BR").includes(termo)));
  }
  return itens.sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}
export async function obterEquipamento(id, deps = {}) {
  const db = deps.db || dbPadrao(), snap = await db.collection("equipamentos").doc(id).get();
  if (!snap.exists) throw http(404, "Equipamento não encontrado.");
  return { id:snap.id, ...snap.data() };
}
export async function criarEquipamento(dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao(), equipamento = dadosEquipamento(dados || {});
  const cliente = await clienteExiste(db, equipamento.clienteId);
  const ref = db.collection("equipamentos").doc(), agora = FieldValue.serverTimestamp();
  await ref.create({ ...equipamento, clienteNome:cliente.nome, criadoPorUid:usuario.uid, criadoPorNome:usuario.nome, criadoEm:agora, atualizadoEm:agora });
  return { ok:true, id:ref.id };
}
export async function atualizarEquipamento(id, dados, usuario, deps = {}) {
  const db = deps.db || dbPadrao(), ref = db.collection("equipamentos").doc(id), snap = await ref.get();
  if (!snap.exists) throw http(404, "Equipamento não encontrado.");
  const equipamento = dadosEquipamento(dados || {}, snap.data());
  const cliente = await clienteExiste(db, equipamento.clienteId);
  await ref.update({ ...equipamento, clienteNome:cliente.nome, atualizadoEm:FieldValue.serverTimestamp(), atualizadoPorUid:usuario.uid });
  return { ok:true };
}
export async function listarChamadosEquipamento(id, deps = {}) {
  const db = deps.db || dbPadrao();
  const equipamento = await obterEquipamento(id, { db });
  const snap = await db.collection("chamados").where("equipamentoId", "==", id).limit(200).get();
  const chamados = snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => {
    const data = v => v?.toDate ? v.toDate().getTime() : new Date(v || 0).getTime();
    return data(b.criadoEm) - data(a.criadoEm);
  });
  return { equipamento, chamados };
}
