import { exigirAcesso } from "./auth-service.js";
const sessao = await exigirAcesso(["admin","gestor","consulta"]);

import { db, auth } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const btnSair = document.getElementById("btnSair");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");
const btnExportarCsv = document.getElementById("btnExportarCsv");

const dataInicial = document.getElementById("dataInicial");
const dataFinal = document.getElementById("dataFinal");
const filtroStatus = document.getElementById("filtroStatus");
const filtroCliente = document.getElementById("filtroCliente");
const filtroTecnico = document.getElementById("filtroTecnico");
const filtroAtendimento = document.getElementById("filtroAtendimento");

const totalFiltrado = document.getElementById("totalFiltrado");
const metricTotal = document.getElementById("metricTotal");
const metricAprovacao = document.getElementById("metricAprovacao");
const metricPeca = document.getElementById("metricPeca");
const metricPronto = document.getElementById("metricPronto");

const statusResumo = document.getElementById("statusResumo");
const atendimentoResumo = document.getElementById("atendimentoResumo");
const clientesResumo = document.getElementById("clientesResumo");
const tecnicosResumo = document.getElementById("tecnicosResumo");
const tabelaRats = document.getElementById("tabelaRats");


const API_CHAMADOS="https://rat-online-linche.onrender.com/api";
const chamadoDataInicial=document.getElementById("chamadoDataInicial"),chamadoDataFinal=document.getElementById("chamadoDataFinal"),chamadoFiltroStatus=document.getElementById("chamadoFiltroStatus"),chamadoFiltroPrioridade=document.getElementById("chamadoFiltroPrioridade"),chamadoFiltroCliente=document.getElementById("chamadoFiltroCliente"),chamadoFiltroResponsavel=document.getElementById("chamadoFiltroResponsavel"),chamadosRelatorioTabela=document.getElementById("chamadosRelatorioTabela");
let chamadosRelatorio=[],chamadosRelatorioFiltrados=[];
\nlet rats = [];
let ratsFiltradas = [];

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  carregarRats();\n  carregarChamadosRelatorio();
});

btnSair?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

[
  dataInicial,
  dataFinal,
  filtroStatus,
  filtroCliente,
  filtroTecnico,
  filtroAtendimento
].forEach((campo) => {
  campo.addEventListener("input", aplicarFiltros);
  campo.addEventListener("change", aplicarFiltros);
});

btnLimparFiltros.addEventListener("click", () => {
  dataInicial.value = "";
  dataFinal.value = "";
  filtroStatus.value = "";
  filtroCliente.value = "";
  filtroTecnico.value = "";
  filtroAtendimento.value = "";
  aplicarFiltros();
});

btnExportarCsv.addEventListener("click", exportarCsv);

async function carregarRats() {
  try {
    const consulta = query(collection(db, "rats"), orderBy("criadoEm", "desc"));
    const snapshot = await getDocs(consulta);

    rats = snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data()
    }));

    aplicarFiltros();

  } catch (erro) {
    console.error("Erro ao carregar RATs:", erro);
    tabelaRats.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar RATs. Verifique as permissões do Firestore.</td>
      </tr>
    `;
  }
}

function aplicarFiltros() {
  const inicio = dataInicial.value ? new Date(dataInicial.value + "T00:00:00") : null;
  const fim = dataFinal.value ? new Date(dataFinal.value + "T23:59:59") : null;

  const status = filtroStatus.value.toLowerCase();
  const cliente = filtroCliente.value.toLowerCase().trim();
  const tecnico = filtroTecnico.value.toLowerCase().trim();
  const atendimento = filtroAtendimento.value.toLowerCase();

  ratsFiltradas = rats.filter((rat) => {
    const dataRat = obterDataRat(rat);

    const bateDataInicial = !inicio || !dataRat || dataRat >= inicio;
    const bateDataFinal = !fim || !dataRat || dataRat <= fim;

    const bateStatus = !status || String(rat.status || "").toLowerCase() === status;
    const bateCliente = !cliente || String(rat.cliente || "").toLowerCase().includes(cliente);
    const bateTecnico = !tecnico || String(rat.tecnicos || rat.tecnico || "").toLowerCase().includes(tecnico);
    const bateAtendimento = !atendimento || String(rat.atendimento || "").toLowerCase() === atendimento;

    return bateDataInicial && bateDataFinal && bateStatus && bateCliente && bateTecnico && bateAtendimento;
  });

  renderizarResumo();
  renderizarTabela();
}

function renderizarResumo() {
  totalFiltrado.innerText = String(ratsFiltradas.length);
  metricTotal.innerText = String(ratsFiltradas.length);

  metricAprovacao.innerText = contarPorCampo(ratsFiltradas, "status", "Aguardando Aprovação");
  metricPeca.innerText = contarPorCampo(ratsFiltradas, "status", "Aguardando Peça");
  metricPronto.innerText = contarPorCampo(ratsFiltradas, "status", "Pronto");

  renderizarListaResumo(statusResumo, agruparPorCampo(ratsFiltradas, "status"), "Nenhum status encontrado");
  renderizarListaResumo(atendimentoResumo, agruparPorCampo(ratsFiltradas, "atendimento"), "Nenhum tipo encontrado");
  renderizarListaResumo(clientesResumo, agruparPorCampo(ratsFiltradas, "cliente", 10), "Nenhum cliente encontrado");
  renderizarListaResumo(tecnicosResumo, agruparPorCampoTecnico(ratsFiltradas, 10), "Nenhum técnico encontrado");
}

function renderizarTabela() {
  if (ratsFiltradas.length === 0) {
    tabelaRats.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma RAT encontrada para os filtros informados.</td>
      </tr>
    `;
    return;
  }

  tabelaRats.innerHTML = ratsFiltradas.map((rat) => `
    <tr>
      <td><strong>${escapar(rat.numero || "")}</strong></td>
      <td>${escapar(rat.cliente || "")}</td>
      <td>${escapar(rat.tecnicos || rat.tecnico || "")}</td>
      <td>${escapar(rat.status || "")}</td>
      <td>${escapar(rat.atendimento || "")}</td>
      <td>${escapar(formatarData(obterDataRat(rat)))}</td>
      <td>${escapar(rat.problema || "")}</td>
    </tr>
  `).join("");
}

function contarPorCampo(lista, campo, valor) {
  return String(lista.filter((item) => String(item[campo] || "") === valor).length);
}

function agruparPorCampo(lista, campo, limite = 999) {
  const mapa = new Map();

  lista.forEach((item) => {
    const chave = String(item[campo] || "Não informado").trim() || "Não informado";
    mapa.set(chave, (mapa.get(chave) || 0) + 1);
  });

  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite);
}

function agruparPorCampoTecnico(lista, limite = 999) {
  const mapa = new Map();

  lista.forEach((item) => {
    const tecnico = String(item.tecnicos || item.tecnico || "Não informado").trim() || "Não informado";
    mapa.set(tecnico, (mapa.get(tecnico) || 0) + 1);
  });

  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite);
}

function renderizarListaResumo(container, itens, mensagemVazia) {
  if (itens.length === 0) {
    container.innerHTML = `<p>${mensagemVazia}</p>`;
    return;
  }

  const maior = Math.max(...itens.map(([, total]) => total), 1);

  container.innerHTML = itens.map(([nome, total]) => {
    const percentual = Math.round((total / maior) * 100);

    return `
      <div class="report-item">
        <div class="report-line">
          <strong>${escapar(nome)}</strong>
          <span>${total}</span>
        </div>
        <div class="report-bar">
          <div class="report-bar-fill" style="width:${percentual}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function exportarCsv() {
  if (ratsFiltradas.length === 0) {
    alert("Não há RATs para exportar.");
    return;
  }

  const linhas = [
    ["RAT", "Cliente", "Documento", "Solicitante", "Email", "Fone", "Tecnico", "Status", "Atendimento", "Data", "Tag", "Valor", "Problema", "Solucao", "Observacao"]
  ];

  ratsFiltradas.forEach((rat) => {
    linhas.push([
      rat.numero || "",
      rat.cliente || "",
      rat.documento || "",
      rat.solicitante || "",
      rat.email || "",
      rat.fone || "",
      rat.tecnicos || rat.tecnico || "",
      rat.status || "",
      rat.atendimento || "",
      formatarData(obterDataRat(rat)),
      rat.tag || "",
      rat.valor || "",
      rat.problema || "",
      rat.solucao || "",
      rat.obs || ""
    ]);
  });

  const csv = linhas.map((linha) =>
    linha.map((campo) => `"${String(campo).replaceAll('"', '""')}"`).join(";")
  ).join("\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio-rats-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function obterDataRat(rat) {
  if (rat.criadoEm?.toDate) return rat.criadoEm.toDate();
  if (rat.abertura) {
    const data = new Date(rat.abertura);
    if (!isNaN(data)) return data;
  }
  return null;
}

function formatarData(data) {
  if (!data) return "";
  return data.toLocaleString("pt-BR");
}

function escapar(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

[ chamadoDataInicial,chamadoDataFinal,chamadoFiltroStatus,chamadoFiltroPrioridade,chamadoFiltroCliente,chamadoFiltroResponsavel ].forEach(c=>{c.addEventListener("input",aplicarFiltrosChamados);c.addEventListener("change",aplicarFiltrosChamados);});
document.getElementById("btnLimparFiltrosChamados").addEventListener("click",()=>{[chamadoDataInicial,chamadoDataFinal,chamadoFiltroStatus,chamadoFiltroPrioridade,chamadoFiltroCliente,chamadoFiltroResponsavel].forEach(c=>c.value="");aplicarFiltrosChamados();});
document.getElementById("btnExportarChamados").addEventListener("click",exportarChamadosCsv);
async function carregarChamadosRelatorio(){try{const token=await sessao.user.getIdToken();const resp=await fetch(API_CHAMADOS+"/chamados?limite=500",{headers:{Authorization:"Bearer "+token}});const data=await resp.json().catch(()=>({}));if(!resp.ok)throw new Error(data.message||"Falha HTTP "+resp.status);chamadosRelatorio=Array.isArray(data.chamados)?data.chamados:[];aplicarFiltrosChamados();document.getElementById("chamadosRelatorioAtualizado").textContent="Atualizado em "+new Date().toLocaleString("pt-BR");}catch(e){console.error("Erro ao carregar relatório de chamados:",e);chamadosRelatorioTabela.innerHTML='<tr><td colspan="7">Não foi possível carregar os chamados: '+escapar(e.message)+'</td></tr>';}}
function obterDataChamado(c){const v=c.criadoEm;if(!v)return null;if(typeof v.toDate==="function")return v.toDate();if(typeof v._seconds==="number")return new Date(v._seconds*1000);if(typeof v.seconds==="number")return new Date(v.seconds*1000);const d=new Date(v);return Number.isNaN(d.getTime())?null:d;}
function aplicarFiltrosChamados(){const ini=chamadoDataInicial.value?new Date(chamadoDataInicial.value+"T00:00:00"):null,fim=chamadoDataFinal.value?new Date(chamadoDataFinal.value+"T23:59:59"):null,st=chamadoFiltroStatus.value,pr=chamadoFiltroPrioridade.value,cl=chamadoFiltroCliente.value.toLocaleLowerCase("pt-BR").trim(),re=chamadoFiltroResponsavel.value.toLocaleLowerCase("pt-BR").trim();chamadosRelatorioFiltrados=chamadosRelatorio.filter(c=>{const d=obterDataChamado(c);return(!ini||(d&&d>=ini))&&(!fim||(d&&d<=fim))&&(!st||c.status===st)&&(!pr||c.prioridade===pr)&&(!cl||String(c.clienteNome||"").toLocaleLowerCase("pt-BR").includes(cl))&&(!re||String(c.responsavelNome||"Não atribuído").toLocaleLowerCase("pt-BR").includes(re));});renderizarResumoChamados();}
function agruparChamados(campo){const map=new Map();chamadosRelatorioFiltrados.forEach(c=>{const n=String(c[campo]||"Não informado").trim()||"Não informado";map.set(n,(map.get(n)||0)+1);});return[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);}
function renderizarResumoChamados(){const l=chamadosRelatorioFiltrados,st={novo:"Novo",em_atendimento:"Em atendimento",aguardando_cliente:"Aguardando cliente",encerrado:"Encerrado"},pr={urgente:"Urgente",alta:"Alta",normal:"Normal",baixa:"Baixa"};document.getElementById("chMetricTotal").textContent=l.length;document.getElementById("chMetricAbertos").textContent=l.filter(c=>c.status!=="encerrado").length;document.getElementById("chMetricAguardando").textContent=l.filter(c=>c.status==="aguardando_cliente").length;document.getElementById("chMetricUrgentes").textContent=l.filter(c=>c.prioridade==="urgente").length;const draw=(id,items,labels={})=>renderizarListaResumo(document.getElementById(id),items.map(([n,v])=>[labels[n]||n,v]),"Nenhum chamado encontrado");draw("chStatusResumo",agruparChamados("status"),st);draw("chPrioridadeResumo",agruparChamados("prioridade"),pr);draw("chClientesResumo",agruparChamados("clienteNome"));draw("chResponsaveisResumo",agruparChamados("responsavelNome"));if(!l.length){chamadosRelatorioTabela.innerHTML='<tr><td colspan="7">Nenhum chamado encontrado para os filtros informados.</td></tr>';return;}chamadosRelatorioTabela.innerHTML=l.map(c=>{const d=obterDataChamado(c);return'<tr><td><strong>'+escapar(c.protocolo||"")+'</strong></td><td>'+escapar(c.clienteNome||"")+'<br><small>'+escapar(c.equipamentoNome||"Sem equipamento")+'</small></td><td>'+escapar(c.assunto||"")+'</td><td>'+escapar(st[c.status]||c.status||"")+'</td><td>'+escapar(pr[c.prioridade]||c.prioridade||"")+'</td><td>'+escapar(c.responsavelNome||"Não atribuído")+'</td><td>'+escapar(d?d.toLocaleString("pt-BR"):"—")+'</td></tr>';}).join("");}
function exportarChamadosCsv(){if(!chamadosRelatorioFiltrados.length){alert("Não há chamados para exportar.");return;}const rows=[["Protocolo","Cliente","Equipamento","Assunto","Status","Prioridade","Responsável","Abertura"]];chamadosRelatorioFiltrados.forEach(c=>{const d=obterDataChamado(c);rows.push([c.protocolo||"",c.clienteNome||"",c.equipamentoNome||"",c.assunto||"",c.status||"",c.prioridade||"",c.responsavelNome||"",d?d.toLocaleString("pt-BR"):""]);});const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(";")).join("\\n");const blob=new Blob(["\\ufeff"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="relatorio-chamados-"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(url);}
