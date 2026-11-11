import { exigirAcesso } from "./auth-service.js";

const sessao = await exigirAcesso(["admin","gestor","analista","consulta"]);
const podeEditar = ["admin","gestor"].includes(sessao.perfil.perfil);
const API = "https://rat-online-linche.onrender.com/api";
const form = document.getElementById("clienteForm");
const tabela = document.getElementById("clientesTabela");
const total = document.getElementById("totalClientes");
const busca = document.getElementById("buscaCliente");
const filtro = document.getElementById("filtroStatus");
const arquivoCsv = document.getElementById("arquivoClientesCsv");
let clientes = [];

if (!podeEditar) {
  document.querySelectorAll("#clienteForm input,#clienteForm select,#clienteForm textarea,#clienteForm button").forEach(e => e.disabled = true);
  document.getElementById("tituloForm").textContent = "Cadastro de Cliente — somente consulta";
  document.getElementById("btnImportarClientes").disabled = true;
}

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
function normalizar(c) {
  return {...c, nome:c.nome || c.razaoSocial || "", documento:c.documento || c.cnpj || "",
    logradouro:c.logradouro || c.endereco || "", telefone:c.telefone || c.fone || "",
    observacoes:c.observacoes || c.observacao || ""};
}
async function carregar() {
  tabela.innerHTML = '<tr><td colspan="7">Carregando clientes...</td></tr>';
  try {
    const r = await api("/clientes?limite=500");
    clientes = (r.clientes || []).map(normalizar);
    total.textContent = clientes.length;
    render();
  } catch(e) {
    console.error(e);
    tabela.innerHTML = '<tr><td colspan="7">Erro ao carregar: ' + esc(e.message) + '</td></tr>';
  }
}
function render() {
  const termo = busca.value.toLocaleLowerCase("pt-BR").trim();
  const st = filtro.value;
  const lista = clientes.filter(c => {
    const texto = [c.nome,c.documento,c.cidade,c.contato,c.email,c.telefone].join(" ").toLocaleLowerCase("pt-BR");
    return texto.includes(termo) && (st==="todos" || (st==="ativos" && c.ativo!==false) || (st==="inativos" && c.ativo===false));
  });
  if (!lista.length) { tabela.innerHTML='<tr><td colspan="7">Nenhum cliente encontrado.</td></tr>'; return; }
  tabela.innerHTML = lista.map(c => `<tr>
    <td><strong>${esc(c.nome)}</strong></td><td>${esc(c.documento)}</td><td>${esc(c.cidade)}</td>
    <td>${esc(c.contato)}</td><td>${esc(c.telefone)}</td><td>${c.ativo===false?"Inativo":"Ativo"}</td>
    <td>${podeEditar ? `<button class="secondary small" data-edit="${esc(c.id)}">Editar</button>` : "Consulta"}</td></tr>`).join("");
  tabela.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click",()=>editar(b.dataset.edit)));
}
function editar(id) {
  const c=clientes.find(x=>x.id===id); if(!c)return;
  document.getElementById("tituloForm").textContent="Editar Cliente";
  set("clienteId",c.id); set("razaoSocial",c.nome); set("cnpj",c.documento);
  set("endereco",[c.logradouro,c.bairro].filter(Boolean).join(" / "));
  set("cidade",c.cidade); set("cep",c.cep); set("contato",c.contato); set("email",c.email);
  set("fone",c.telefone); set("ativo",c.ativo===false?"false":"true"); set("observacao",c.observacoes);
  window.scrollTo({top:0,behavior:"smooth"});
}
function dadosForm() {
  return {nome:val("razaoSocial"),documento:val("cnpj"),logradouro:val("endereco"),cidade:val("cidade"),
    cep:val("cep"),contato:val("contato"),email:val("email"),telefone:val("fone"),
    ativo:val("ativo")!=="false",observacoes:val("observacao")};
}
form.addEventListener("submit",async e=>{
  e.preventDefault(); if(!podeEditar)return;
  const id=val("clienteId"), dados=dadosForm();
  if(!dados.nome){alert("Informe o nome ou razão social.");return;}
  const botao=form.querySelector('[type="submit"]'); const original=botao.textContent;
  botao.disabled=true;botao.textContent="Salvando...";
  try {
    if(id) { await api("/clientes/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify(dados)}); alert("Cliente atualizado com sucesso."); }
    else { await api("/clientes",{method:"POST",body:JSON.stringify(dados)}); alert("Cliente cadastrado com sucesso."); }
    limpar(); await carregar();
  } catch(err) { console.error(err);alert("Não foi possível salvar: "+err.message); }
  finally {botao.disabled=false;botao.textContent=original;}
});
function limpar(){form.reset();set("clienteId","");document.getElementById("tituloForm").textContent="Cadastrar Cliente";}
document.getElementById("btnCancelarEdicao")?.addEventListener("click",limpar);
busca.addEventListener("input",render); filtro.addEventListener("change",render);
document.getElementById("btnExportarClientes")?.addEventListener("click",()=>{
  if(!clientes.length)return alert("Não há clientes para exportar.");
  const keys=["nome","documento","logradouro","cidade","cep","contato","email","telefone","ativo","observacoes"];
  const rows=[keys.join(";"),...clientes.map(c=>keys.map(k=>csv(c[k]??(k==="ativo"?true:""))).join(";"))];
  const url=URL.createObjectURL(new Blob(["\uFEFF"+rows.join("\r\n")],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="linche-clientes.csv";a.click();URL.revokeObjectURL(url);
});
document.getElementById("btnImportarClientes")?.addEventListener("click",()=>{if(podeEditar)arquivoCsv?.click();});
arquivoCsv?.addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try {
    const rows=parseCsv(await f.text());if(!rows.length)throw Error("CSV sem registros.");
    for(const r of rows){
      const nome=r.nome||r.razaosocial||r.razao_social||"";
      if(!nome.trim())throw Error("Existe uma linha sem nome.");
      const data={nome:nome.trim(),documento:r.documento||r.cnpj||"",logradouro:r.logradouro||r.endereco||"",
        cidade:r.cidade||"",cep:r.cep||"",contato:r.contato||"",email:r.email||"",telefone:r.telefone||r.fone||"",
        ativo:!["false","inativo","0","nao","não"].includes(String(r.ativo||"true").toLowerCase()),
        observacoes:r.observacoes||r.observacao||""};
      await api("/clientes",{method:"POST",body:JSON.stringify(data)});
    }
    alert(rows.length+" cliente(s) importado(s).");await carregar();
  } catch(err){console.error(err);alert("Importação interrompida: "+err.message);}
  finally{e.target.value="";}
});
function parseCsv(s){
  s=s.replace(/^\uFEFF/,"");const sep=s.split("\n")[0].includes(";")?";":",";
  const out=[];let row=[],field="",quoted=false;
  for(let i=0;i<s.length;i++){const ch=s[i],n=s[i+1];
    if(ch==='"'){if(quoted&&n==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(ch===sep&&!quoted){row.push(field);field="";}
    else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&n==="\n")i++;row.push(field);field="";if(row.some(x=>x.trim()))out.push(row);row=[];}
    else field+=ch;
  }
  if(field||row.length){row.push(field);if(row.some(x=>x.trim()))out.push(row);}
  if(out.length<2)return [];
  const heads=out.shift().map(x=>x.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9_]/g,""));
  return out.map(row=>Object.fromEntries(heads.map((h,i)=>[h,String(row[i]||"").trim()])));
}
function val(id){return document.getElementById(id)?.value?.trim()||"";}
function set(id,v){const el=document.getElementById(id);if(el)el.value=v??"";}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function csv(v){return '"'+String(v).replaceAll('"','""').replaceAll("\r"," ").replaceAll("\n"," ")+'"';}
await carregar();
