import { exigirAcesso } from "./auth-service.js";

const sessao = await exigirAcesso(["admin","gestor","analista","consulta"]);
const podeEditar = ["admin","gestor"].includes(sessao.perfil.perfil);
const API = "https://rat-online-linche.onrender.com/api";
const form = document.getElementById("equipamentoForm");
const tabela = document.getElementById("equipamentosTabela");
const total = document.getElementById("totalEquipamentos");
const selectCliente = document.getElementById("clienteId");
const filtroCliente = document.getElementById("filtroCliente");
const busca = document.getElementById("buscaEquipamento");
let clientes = [];
let equipamentos = [];

async function api(path, options={}) {
  const token = await sessao.user.getIdToken();
  const response = await fetch(API + path, {
    ...options,
    headers: {...(options.body ? {"Content-Type":"application/json"} : {}), ...options.headers, Authorization:"Bearer " + token}
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Falha HTTP " + response.status);
  return data;
}
function esc(v) {
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function val(id) { return document.getElementById(id)?.value?.trim() || ""; }
function set(id,v) { const el=document.getElementById(id); if(el) el.value=v ?? ""; }

async function carregarClientes() {
  const r = await api("/clientes?limite=500");
  clientes = r.clientes || [];
  const ativos = clientes.filter(c => c.ativo !== false);
  selectCliente.innerHTML = '<option value="">Selecione um cliente</option>' +
    ativos.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("");
  filtroCliente.innerHTML = '<option value="">Todos os clientes</option>' +
    clientes.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}${c.ativo===false?" (inativo)":""}</option>`).join("");
}
async function carregarEquipamentos() {
  tabela.innerHTML = '<tr><td colspan="7">Carregando equipamentos...</td></tr>';
  try {
    const r = await api("/equipamentos?limite=500");
    equipamentos = (r.equipamentos || []).map(e => ({
      ...e,
      clienteNome: e.clienteNome || clientes.find(c=>c.id===e.clienteId)?.nome || "Cliente não identificado"
    }));
    total.textContent = equipamentos.length;
    render();
  } catch(e) {
    console.error(e);
    tabela.innerHTML = '<tr><td colspan="7">Erro ao carregar: '+esc(e.message)+'</td></tr>';
  }
}
function render() {
  const termo=busca.value.toLocaleLowerCase("pt-BR").trim();
  const cliente=filtroCliente.value;
  const lista=equipamentos.filter(e=>{
    const texto=[e.nome,e.tipo,e.fabricante,e.modelo,e.numeroSerie,e.patrimonio,e.clienteNome].join(" ").toLocaleLowerCase("pt-BR");
    return texto.includes(termo) && (!cliente || e.clienteId===cliente);
  });
  if(!lista.length){tabela.innerHTML='<tr><td colspan="7">Nenhum equipamento encontrado.</td></tr>';return;}
  tabela.innerHTML=lista.map(e=>`<tr>
    <td><strong>${esc(e.nome)}</strong><br><small>${esc(e.fabricante)}</small></td>
    <td>${esc(e.clienteNome)}</td>
    <td>${esc([e.tipo,e.modelo].filter(Boolean).join(" / "))}</td>
    <td>${esc(e.numeroSerie)}</td><td>${esc(e.patrimonio)}</td>
    <td>${e.ativo===false?"Inativo":"Ativo"}</td>
    <td><div class="table-actions">
      ${podeEditar?`<button class="secondary small" data-edit="${esc(e.id)}">Editar</button>`: ""}
      <button class="secondary small" data-history="${esc(e.id)}">Chamados</button>
      ${podeEditar && e.ativo!==false?`<button class="danger small" data-disable="${esc(e.id)}">Inativar</button>`:""}
    </div></td></tr>`).join("");
  tabela.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editar(b.dataset.edit)));
  tabela.querySelectorAll("[data-history]").forEach(b=>b.addEventListener("click",()=>historico(b.dataset.history)));
  tabela.querySelectorAll("[data-disable]").forEach(b=>b.addEventListener("click",()=>inativar(b.dataset.disable)));
}
function editar(id) {
  const e=equipamentos.find(x=>x.id===id);if(!e)return;
  document.getElementById("tituloFormEquipamento").textContent="Editar Equipamento";
  const clienteAtual=clientes.find(c=>c.id===e.clienteId);
  if(clienteAtual && ![...selectCliente.options].some(o=>o.value===clienteAtual.id)){
    selectCliente.insertAdjacentHTML("beforeend",`<option value="${esc(clienteAtual.id)}">${esc(clienteAtual.nome)} (inativo)</option>`);
  }
  set("equipamentoId",e.id);set("clienteId",e.clienteId);set("nomeEquipamento",e.nome);
  set("tipo",e.tipo);set("fabricante",e.fabricante);set("modelo",e.modelo);
  set("numeroSerie",e.numeroSerie);set("patrimonio",e.patrimonio);set("localizacao",e.localizacao);
  set("ativoEquipamento",e.ativo===false?"false":"true");set("observacoesEquipamento",e.observacoes);
  window.scrollTo({top:0,behavior:"smooth"});
}
function dadosForm() {
  return {clienteId:val("clienteId"),nome:val("nomeEquipamento"),tipo:val("tipo"),
    fabricante:val("fabricante"),modelo:val("modelo"),numeroSerie:val("numeroSerie"),
    patrimonio:val("patrimonio"),localizacao:val("localizacao"),
    ativo:val("ativoEquipamento")!=="false",observacoes:val("observacoesEquipamento")};
}
form.addEventListener("submit",async event=>{
  event.preventDefault();if(!podeEditar)return;
  const id=val("equipamentoId"),dados=dadosForm();
  if(!dados.clienteId)return alert("Selecione um cliente ativo.");
  if(!dados.nome)return alert("Informe o nome do equipamento.");
  const botao=form.querySelector('[type="submit"]'),original=botao.textContent;
  botao.disabled=true;botao.textContent="Salvando...";
  try{
    if(id){await api("/equipamentos/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify(dados)});alert("Equipamento atualizado.");}
    else{await api("/equipamentos",{method:"POST",body:JSON.stringify(dados)});alert("Equipamento cadastrado.");}
    limpar();await carregarClientes();await carregarEquipamentos();
  }catch(e){console.error(e);alert("Não foi possível salvar: "+e.message);}
  finally{botao.disabled=false;botao.textContent=original;}
});
function limpar(){form.reset();set("equipamentoId","");document.getElementById("tituloFormEquipamento").textContent="Cadastrar Equipamento";selectCliente.querySelectorAll('option[data-temporaria="true"]').forEach(o=>o.remove());}
document.getElementById("cancelarEquipamento").addEventListener("click",limpar);
busca.addEventListener("input",render);filtroCliente.addEventListener("change",render);
async function inativar(id){
  const e=equipamentos.find(x=>x.id===id);if(!e)return;
  if(!confirm(`Confirma inativar o equipamento "${e.nome}"? O histórico de chamados será preservado.`))return;
  try{await api("/equipamentos/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({ativo:false})});alert("Equipamento inativado.");await carregarEquipamentos();}
  catch(err){console.error(err);alert("Não foi possível inativar: "+err.message);}
}
async function historico(id){
  const painel=document.getElementById("painelHistorico"),corpo=document.getElementById("historicoTabela");
  painel.hidden=false;corpo.innerHTML='<tr><td colspan="5">Carregando histórico...</td></tr>';
  try{
    const r=await api("/equipamentos/"+encodeURIComponent(id)+"/chamados");
    const e=r.equipamento||equipamentos.find(x=>x.id===id);
    document.getElementById("tituloHistorico").textContent="Histórico de chamados";
    document.getElementById("subtituloHistorico").textContent=e?.nome||"";
    const lista=r.chamados||[];
    if(!lista.length){corpo.innerHTML='<tr><td colspan="5">Nenhum chamado vinculado a este equipamento.</td></tr>';return;}
    corpo.innerHTML=lista.map(c=>`<tr><td>${esc(c.protocolo||c.id)}</td><td>${esc(c.assunto)}</td><td>${esc(c.status)}</td><td>${esc(c.prioridade)}</td><td>${esc(dataTexto(c.criadoEm))}</td></tr>`).join("");
  }catch(err){console.error(err);corpo.innerHTML='<tr><td colspan="5">Erro ao consultar histórico: '+esc(err.message)+'</td></tr>';}
  painel.scrollIntoView({behavior:"smooth",block:"start"});
}
function dataTexto(v){
  if(!v)return "—";
  if(v._seconds)return new Date(v._seconds*1000).toLocaleDateString("pt-BR");
  const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("pt-BR");
}
document.getElementById("fecharHistorico").addEventListener("click",()=>{document.getElementById("painelHistorico").hidden=true;});
if(!podeEditar){
  document.querySelectorAll("#equipamentoForm input,#equipamentoForm select,#equipamentoForm button").forEach(e=>e.disabled=true);
  document.getElementById("tituloFormEquipamento").textContent="Equipamentos — somente consulta";
}
try{await carregarClientes();await carregarEquipamentos();}
catch(e){console.error(e);tabela.innerHTML='<tr><td colspan="7">Falha na inicialização: '+esc(e.message)+'</td></tr>';}
