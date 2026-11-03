import { exigirAcesso, ADMIN_EMAIL } from "./auth-service.js";

const sessao = await exigirAcesso(["admin"]);

if (String(sessao.user.email || "").toLowerCase() !== ADMIN_EMAIL) {
  window.location.replace("dashboard.html?acesso=negado");
}

const API_BASE = "https://rat-online-linche.onrender.com";

const backendStatus = document.getElementById("backendStatus");
const mspBadge = document.getElementById("mspBadge");
const mspUltimaSync = document.getElementById("mspUltimaSync");
const mspSyncIndicator = document.getElementById("mspSyncIndicator");
const modalMsp = document.getElementById("modalMsp");
const modalMspStatus = document.getElementById("modalMspStatus");
const integracoesConectadas = document.getElementById("integracoesConectadas");
const integracoesAtencao = document.getElementById("integracoesAtencao");
const integrationResults = document.getElementById("integrationResults");
const integrationResultsBody = document.getElementById("integrationResultsBody");
const integrationResultsMeta = document.getElementById("integrationResultsMeta");
const integrationPagination = document.getElementById("integrationPagination");
const integrationPaginationInfo = document.getElementById("integrationPaginationInfo");
const btnMspAnterior = document.getElementById("btnMspAnterior");
const btnMspProxima = document.getElementById("btnMspProxima");
const mspPageSize = document.getElementById("mspPageSize");

let mspPaginaAtual = 0;
let mspTotal = null;
let mspTemProxima = false;

const backendUrlEl = document.getElementById("backendUrlExibida");
if (backendUrlEl) backendUrlEl.textContent = API_BASE;

document.getElementById("btnMspConfig").onclick = abrirModal;
document.getElementById("btnFecharMsp").onclick = fecharModal;
document.getElementById("btnFecharMsp2").onclick = fecharModal;
document.getElementById("btnMspTestar").onclick = testarMsp;
document.getElementById("btnTestarModalMsp").onclick = testarMsp;
document.getElementById("btnConsultarMsp").onclick = () => consultarMsp(0);
document.getElementById("btnLimparResultados").onclick = limparResultados;
if (btnMspAnterior) btnMspAnterior.onclick = () => consultarMsp(Math.max(0, mspPaginaAtual - 1));
if (btnMspProxima) btnMspProxima.onclick = () => consultarMsp(mspPaginaAtual + 1);
if (mspPageSize) mspPageSize.onchange = () => consultarMsp(0);

modalMsp.addEventListener("click", event => {
  if (event.target === modalMsp) fecharModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !modalMsp.classList.contains("hidden")) {
    fecharModal();
  }
});

await verificarBackend();

async function verificarBackend() {
  setBackendStatus("checking", "Verificando conexão...");

  try {
    const response = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
    if (!response.ok) throw new Error("Backend offline");

    const data = await response.json();
    setBackendStatus("online", `Online • ${esc(data.version || "API")}`);
    await carregarStatusMsp();
  } catch (error) {
    setBackendStatus("offline", "Não conectado");
    definirStatusMsp("offline", "Backend offline");
    setModalStatus("offline", "Backend indisponível", "Não foi possível validar o conector.");
    atualizarResumo(false, true);
  }
}

async function carregarStatusMsp() {
  try {
    const response = await fetch(`${API_BASE}/api/integrations/mspdesk/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store"
    });

    const data = await response.json();

    if (data.connected) {
      definirStatusMsp("online", "Conectado");
      atualizarResumo(true);
      atualizarUltimaSync(data.lastSync);
      setModalStatus("online", "MSP Desk conectado", data.message || "Comunicação validada com sucesso.");
    } else {
      definirStatusMsp(data.configured === false ? "warning" : "offline", data.configured === false ? "Não configurado" : "Não conectado");
      atualizarResumo(false, true);
      setModalStatus(data.configured === false ? "warning" : "offline", "MSP Desk não conectado", data.message || "Verifique a configuração do backend.");
    }
  } catch (error) {
    definirStatusMsp("offline", "Indisponível");
    atualizarResumo(false, true);
    setModalStatus("offline", "MSP Desk indisponível", "Não foi possível consultar o status do conector.");
  }
}

async function testarMsp() {
  setButtonsBusy(true);
  toast("Testando conexão com o MSP Desk...");
  setModalStatus("checking", "Testando integração", "Aguardando resposta do MSP Desk...");

  try {
    const response = await fetch(`${API_BASE}/api/integrations/mspdesk/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok && !data.connected) {
      throw new Error(data.message || "Falha na conexão");
    }

    if (data.connected) {
      definirStatusMsp("online", "Conectado");
      atualizarResumo(true);
      atualizarUltimaSync(data.lastSync);
      setModalStatus("online", "MSP Desk conectado", data.message || "Comunicação validada com sucesso.");
      toast("MSP Desk conectado com sucesso.");
    } else {
      definirStatusMsp(data.configured === false ? "warning" : "offline", data.configured === false ? "Não configurado" : "Não conectado");
      atualizarResumo(false, true);
      setModalStatus(data.configured === false ? "warning" : "offline", "MSP Desk não conectado", data.message || "Verifique a configuração do backend.");
      toast(data.message || "MSP Desk ainda não configurado.", true);
    }
  } catch (error) {
    definirStatusMsp("offline", "Indisponível");
    atualizarResumo(false, true);
    setModalStatus("offline", "Falha na comunicação", error.message || "Backend ou MSP Desk indisponível.");
    toast(error.message || "Backend ou MSP Desk indisponível.", true);
  } finally {
    setButtonsBusy(false);
  }
}

async function consultarMsp(page = 0) {
  setButtonsBusy(true);
  toast(`Consultando chamados do MSP Desk · página ${page + 1}...`);

  try {
    const size = Math.min(100, Math.max(1, Number(mspPageSize?.value || 20)));
    const response = await fetch(`${API_BASE}/api/integrations/mspdesk/tickets?page=${page}&size=${size}`, {
      cache: "no-store"
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Falha na consulta");

    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    mspPaginaAtual = Number(data.page) || 0;
    mspTotal = Number.isFinite(Number(data.total)) ? Number(data.total) : null;
    mspTemProxima = Boolean(data.hasNext);

    renderizarResultados(tickets, size);
    atualizarPaginacao();

    definirStatusMsp("online", "Conectado • leitura OK");
    atualizarResumo(true);
    atualizarUltimaSync(new Date().toISOString());
    setModalStatus("online", "Leitura realizada", `${tickets.length} chamado(s) retornado(s) pelo relatório.`);
    toast(`${tickets.length} chamado(s) retornado(s) pelo MSP Desk.`);

    integrationResults.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setModalStatus("offline", "Falha na consulta", error.message || "Não foi possível consultar o MSP Desk.");
    toast(error.message || "Não foi possível consultar o MSP Desk.", true);
  } finally {
    setButtonsBusy(false);
  }
}

function renderizarResultados(tickets, size = 20) {
  integrationResults.hidden = false;

  const totalTexto = mspTotal !== null ? ` · ${mspTotal} no total` : "";
  integrationResultsMeta.textContent = `${tickets.length} registro(s) na página ${mspPaginaAtual + 1}${totalTexto} · leitura somente.`;

  if (!tickets.length) {
    integrationResultsBody.innerHTML = `
      <tr><td colspan="6" class="integration-empty">O MSP Desk respondeu, mas não retornou chamados nesta página.</td></tr>
    `;
    return;
  }

  integrationResultsBody.innerHTML = tickets.map(ticket => {
    const numero = ticket.numeroTicket || ticket.idTicket || "—";
    const href = ticket.urlTicket || "https://api.mspdesk.com.br/login";
    return `
      <tr>
        <td>
          <a class="ticket-link" href="${escAttr(href)}" target="_blank" rel="noopener noreferrer" title="Abrir no MSP Desk">
            <strong>${esc(numero)}</strong><span aria-hidden="true">↗</span>
          </a>
        </td>
        <td title="${escAttr(ticket.assunto)}">${esc(truncar(ticket.assunto, 54) || "—")}</td>
        <td>${esc(truncar(ticket.cliente, 28) || "—")}</td>
        <td><span class="result-status">${esc(ticket.status || "—")}</span></td>
        <td>${esc(ticket.prioridade || "—")}</td>
        <td>${esc(ticket.agente || "—")}</td>
      </tr>
    `;
  }).join("");
}

function atualizarPaginacao() {
  if (!integrationPagination) return;
  integrationPagination.hidden = false;
  if (integrationPaginationInfo) {
    const totalTexto = mspTotal !== null ? ` · ${mspTotal} total` : "";
    integrationPaginationInfo.textContent = `Página ${mspPaginaAtual + 1}${totalTexto}`;
  }
  if (btnMspAnterior) btnMspAnterior.disabled = mspPaginaAtual <= 0;
  if (btnMspProxima) btnMspProxima.disabled = !mspTemProxima;
}

function limparResultados() {
  integrationResults.hidden = true;
  integrationResultsBody.innerHTML = "";
  integrationResultsMeta.textContent = "Aguardando consulta.";
  mspPaginaAtual = 0;
  mspTotal = null;
  mspTemProxima = false;
  if (integrationPagination) integrationPagination.hidden = true;
}

function atualizarResumo(conectado, atencao = false) {
  integracoesConectadas.textContent = conectado ? "1" : "0";
  integracoesAtencao.textContent = atencao ? "1" : "0";
}

function definirStatusMsp(classe, texto) {
  mspBadge.className = `integration-badge ${classe}`;
  mspBadge.textContent = texto;
  mspSyncIndicator.className = `sync-indicator ${classe}`;
}

function atualizarUltimaSync(valor) {
  mspUltimaSync.textContent = valor ? formatarData(valor) : "Agora";
}

function setBackendStatus(classe, texto) {
  backendStatus.innerHTML = `
    <span class="integration-status-dot ${classe}"></span>
    <div>
      <strong>Backend Linche</strong>
      <small>${esc(texto)}</small>
    </div>
  `;
}

function setModalStatus(classe, titulo, detalhe) {
  if (!modalMspStatus) return;
  modalMspStatus.innerHTML = `
    <span class="integration-status-dot ${classe}"></span>
    <div>
      <strong>${esc(titulo)}</strong>
      <small>${esc(detalhe)}</small>
    </div>
  `;
}

function abrirModal() {
  modalMsp.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function fecharModal() {
  modalMsp.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function setButtonsBusy(busy) {
  [
    document.getElementById("btnMspTestar"),
    document.getElementById("btnTestarModalMsp"),
    document.getElementById("btnConsultarMsp")
  ].forEach(button => {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle("is-loading", busy);
  });
}

function toast(mensagem, erro = false) {
  const element = document.getElementById("toastIntegracao");
  element.textContent = mensagem;
  element.className = `toast show${erro ? " error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.className = "toast";
  }, 3200);
}

function esc(texto = "") {
  const element = document.createElement("div");
  element.textContent = String(texto ?? "");
  return element.innerHTML;
}

function escAttr(texto = "") {
  return esc(texto).replace(/`/g, "&#96;");
}

function truncar(texto = "", limite = 50) {
  const value = String(texto ?? "");
  return value.length > limite ? `${value.slice(0, limite - 1)}…` : value;
}

function formatarData(valor) {
  const date = new Date(valor);
  if (Number.isNaN(date.getTime())) return valor || "Agora";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
