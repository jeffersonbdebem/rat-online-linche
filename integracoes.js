import { exigirAcesso, ADMIN_EMAIL } from "./auth-service.js";
const sessao=await exigirAcesso(["admin"]);
if(String(sessao.user.email||"").toLowerCase()!==ADMIN_EMAIL)window.location.replace("dashboard.html?acesso=negado");
const API_BASE=localStorage.getItem("lincheApiBase")||"http://localhost:3000";
const backendStatus=document.getElementById("backendStatus"),mspBadge=document.getElementById("mspBadge"),mspUltimaSync=document.getElementById("mspUltimaSync"),modalMsp=document.getElementById("modalMsp");
document.getElementById("backendUrlExibida").textContent=API_BASE;
document.getElementById("btnMspConfig").onclick=()=>modalMsp.classList.remove("hidden");
document.getElementById("btnFecharMsp").onclick=fecharModal;
document.getElementById("btnFecharMsp2").onclick=fecharModal;
document.getElementById("btnMspTestar").onclick=testarMsp;
document.getElementById("btnTestarModalMsp").onclick=testarMsp;
document.getElementById("btnConsultarMsp").onclick=consultarMsp;
modalMsp.onclick=e=>{if(e.target===modalMsp)fecharModal()};
await verificarBackend();
async function verificarBackend(){try{const r=await fetch(`${API_BASE}/api/health`,{cache:"no-store"});if(!r.ok)throw 0;const d=await r.json();backendStatus.innerHTML=`<span class="integration-status-dot online"></span><div><strong>Backend Linche</strong><small>Online • ${esc(d.version||"API")}</small></div>`;await carregarStatusMsp()}catch(e){backendStatus.innerHTML='<span class="integration-status-dot offline"></span><div><strong>Backend Linche</strong><small>Não conectado</small></div>';definirStatusMsp("offline","Backend offline")}}
async function carregarStatusMsp(){try{const r=await fetch(`${API_BASE}/api/integrations/mspdesk/status`,{cache:"no-store"}),d=await r.json();if(d.configured&&d.connected){definirStatusMsp("online","Conectado");document.getElementById("integracoesConectadas").textContent="1";mspUltimaSync.textContent=d.lastSync||"Ainda não sincronizado"}else if(d.configured){definirStatusMsp("warning","Configuração pendente");document.getElementById("integracoesAtencao").textContent="1"}else definirStatusMsp("neutral","Não configurado")}catch(e){definirStatusMsp("offline","Indisponível")}}
async function testarMsp(){toast("Testando conexão com o MSP Desk...");try{const r=await fetch(`${API_BASE}/api/integrations/mspdesk/test`,{method:"POST",headers:{"Content-Type":"application/json"}}),d=await r.json();if(!r.ok)throw new Error(d.message||"Falha");if(d.connected){definirStatusMsp("online","Conectado");toast("MSP Desk conectado com sucesso.")}else{definirStatusMsp("warning","Não conectado");toast(d.message||"MSP Desk ainda não configurado.",true)}}catch(e){toast("Backend ou MSP Desk indisponível.",true)}}
function definirStatusMsp(c,t){mspBadge.className=`integration-badge ${c}`;mspBadge.textContent=t}
function fecharModal(){modalMsp.classList.add("hidden")}
function toast(m,e=false){const x=document.getElementById("toastIntegracao");x.textContent=m;x.className=`toast show${e?" error":""}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>x.className="toast",2800)}
function esc(t=""){const d=document.createElement("div");d.textContent=String(t);return d.innerHTML}

async function consultarMsp(){
  toast("Consultando chamados do MSP Desk...");
  try{
    const r=await fetch(`${API_BASE}/api/integrations/mspdesk/tickets?page=0&size=20`,{cache:"no-store"});
    const d=await r.json();
    if(!r.ok) throw new Error(d.message||"Falha na consulta");
    toast(`${d.totalNaPagina||0} chamado(s) retornado(s) pelo MSP Desk.`);
    console.info("Linche Field • MSP Desk • chamados",d);
    definirStatusMsp("online","Conectado • leitura OK");
  }catch(e){toast(e.message||"Não foi possível consultar o MSP Desk.",true)}
}
