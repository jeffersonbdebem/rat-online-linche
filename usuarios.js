import { auth, db } from "./firebase-config.js";
import { exigirAcesso, ADMIN_EMAIL } from "./auth-service.js";
import { collection, doc, getDocs, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const sessao=await exigirAcesso(["admin"]);
if(String(sessao.user.email||"").toLowerCase()!==ADMIN_EMAIL) window.location.replace("dashboard.html?acesso=negado");

let usuarios=[];
const lista=document.getElementById("listaUsuarios");
const busca=document.getElementById("buscaUsuario");
const filtro=document.getElementById("filtroUsuarioStatus");
document.getElementById("btnAtualizarUsuarios").addEventListener("click",carregarUsuarios);
busca.addEventListener("input",renderizar);
filtro.addEventListener("change",renderizar);
await carregarUsuarios();

async function carregarUsuarios(){
  lista.innerHTML='<div class="empty-state">Carregando usuários...</div>';
  try{
    const r=await getDocs(collection(db,"usuarios"));
    usuarios=r.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.nome||a.email||"").localeCompare(String(b.nome||b.email||""),"pt-BR"));
    atualizarMetricas();renderizar();
  }catch(e){console.error(e);lista.innerHTML='<div class="empty-state">Não foi possível carregar os usuários.</div>';}
}
function atualizarMetricas(){
  document.getElementById("metricUsuariosAtivos").textContent=usuarios.filter(u=>u.ativo!==false).length;
  document.getElementById("metricUsuariosInativos").textContent=usuarios.filter(u=>u.ativo===false).length;
  document.getElementById("metricUsuariosTotal").textContent=usuarios.length;
}
function renderizar(){
  const termo=busca.value.trim().toLowerCase(),status=filtro.value;
  const itens=usuarios.filter(u=>{
    if(status==="ativo"&&u.ativo===false)return false;
    if(status==="inativo"&&u.ativo!==false)return false;
    if(!termo)return true;
    return [u.nome,u.cargo,u.email,u.perfil].filter(Boolean).join(" ").toLowerCase().includes(termo);
  });
  if(!itens.length){lista.innerHTML='<div class="empty-state">Nenhum usuário encontrado.</div>';return;}
  lista.innerHTML=itens.map(cardUsuario).join("");
  lista.querySelectorAll("[data-salvar]").forEach(b=>b.addEventListener("click",()=>salvarUsuario(b.dataset.salvar)));
  lista.querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",()=>alternarStatus(b.dataset.status)));
  lista.querySelectorAll("[data-reset]").forEach(b=>b.addEventListener("click",()=>resetSenha(b.dataset.reset)));
}
function cardUsuario(u){
  const email=String(u.email||"").toLowerCase(),admin=email===ADMIN_EMAIL,perfil=admin?"admin":normalizarPerfil(u.perfil),ativo=admin?true:u.ativo!==false;
  return `<article class="access-request-card user-admin-card">
  <div class="access-request-main"><div class="access-avatar">${iniciais(u.nome)}</div><div class="access-request-data"><div class="access-request-title"><strong>${esc(u.nome||"Sem nome")}</strong><span class="access-status ${ativo?"aprovado":"recusado"}">${ativo?"Ativo":"Inativo"}</span>${admin?'<span class="admin-fixed-badge">ADMIN</span>':""}</div><p>${esc(u.cargo||"Cargo não informado")}</p><small>${esc(u.email||"")}</small></div></div>
  <div class="user-edit-grid"><label>Nome<input id="nome-${u.id}" value="${attr(u.nome||"")}"></label><label>Cargo<input id="cargo-${u.id}" value="${attr(u.cargo||"")}"></label><label>Perfil<select id="perfil-${u.id}" ${admin?"disabled":""}>${admin?'<option value="admin" selected>Administrador</option>':`<option value="analista" ${perfil==="analista"?"selected":""}>Analista</option><option value="gestor" ${perfil==="gestor"?"selected":""}>Gestor</option><option value="consulta" ${perfil==="consulta"?"selected":""}>Consulta</option>`}</select></label></div>
  <div class="user-admin-actions"><button class="primary" type="button" data-salvar="${u.id}">Salvar</button>${!admin?`<button class="${ativo?"danger":"secondary"}" type="button" data-status="${u.id}">${ativo?"Desativar":"Ativar"}</button>`:""}<button class="secondary" type="button" data-reset="${u.id}">Reset de senha</button></div>
  </article>`;
}
async function salvarUsuario(id){
  const u=usuarios.find(x=>x.id===id);if(!u)return;
  const admin=String(u.email||"").toLowerCase()===ADMIN_EMAIL;
  const nome=document.getElementById(`nome-${id}`).value.trim();
  const cargo=document.getElementById(`cargo-${id}`).value.trim();
  const perfil=admin?"admin":normalizarPerfil(document.getElementById(`perfil-${id}`).value);
  if(!nome){toast("Informe o nome do usuário.",true);return;}
  try{await updateDoc(doc(db,"usuarios",id),{nome,cargo,perfil,...(admin?{ativo:true}:{}),atualizadoEm:serverTimestamp(),atualizadoPorUid:sessao.user.uid,atualizadoPorEmail:sessao.user.email});toast("Usuário atualizado.");await carregarUsuarios();}catch(e){console.error(e);toast("Não foi possível atualizar o usuário.",true);}
}
async function alternarStatus(id){
  const u=usuarios.find(x=>x.id===id);if(!u)return;
  if(String(u.email||"").toLowerCase()===ADMIN_EMAIL){toast("O administrador principal não pode ser desativado.",true);return;}
  const novo=u.ativo===false;if(!confirm(`${novo?"Ativar":"Desativar"} o acesso de ${u.nome||u.email}?`))return;
  try{await updateDoc(doc(db,"usuarios",id),{ativo:novo,atualizadoEm:serverTimestamp(),atualizadoPorUid:sessao.user.uid,atualizadoPorEmail:sessao.user.email});toast(novo?"Usuário ativado.":"Usuário desativado.");await carregarUsuarios();}catch(e){console.error(e);toast("Não foi possível alterar o status.",true);}
}
async function resetSenha(id){
  const u=usuarios.find(x=>x.id===id);if(!u?.email)return;
  if(!confirm(`Enviar e-mail de redefinição de senha para ${u.email}?`))return;
  try{await sendPasswordResetEmail(auth,u.email);toast(`Reset enviado para ${u.email}.`);}catch(e){console.error(e);toast("Não foi possível enviar o reset de senha.",true);}
}
function normalizarPerfil(p=""){const v=String(p).trim().toLowerCase();return["gestor","analista","consulta"].includes(v)?v:"analista";}
function iniciais(n=""){return String(n).trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()).join("")||"TI";}
function esc(t=""){const d=document.createElement("div");d.textContent=t;return d.innerHTML;}
function attr(t=""){return esc(String(t)).replace(/"/g,"&quot;");}
function toast(m,e=false){const el=document.getElementById("toastUsuarios");el.textContent=m;el.className=`toast show${e?" error":""}`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className="toast",2800);}
