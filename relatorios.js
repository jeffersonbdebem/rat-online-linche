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

let rats = [];
let ratsFiltradas = [];

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  carregarRats();
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
