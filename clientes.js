import { exigirAcesso } from "./auth-service.js";
const sessao = await exigirAcesso(["admin","gestor","analista","consulta"]);
const podeEditarClientes = ["admin","gestor"].includes(sessao.perfil.perfil);

import { db, auth } from "./firebase-config.js";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const form = document.getElementById("clienteForm");
const tabela = document.getElementById("clientesTabela");
const totalClientes = document.getElementById("totalClientes");
const buscaCliente = document.getElementById("buscaCliente");
const filtroStatus = document.getElementById("filtroStatus");
const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");
const btnSair = document.getElementById("btnSair");

let clientes = [];

if (!podeEditarClientes) {
  document
    .querySelectorAll(
      "#clienteForm input, #clienteForm select, #clienteForm textarea, #clienteForm button"
    )
    .forEach(elemento => {
      elemento.disabled = true;
    });

  const titulo =
    document.getElementById("tituloForm");

  if (titulo) {
    titulo.textContent =
      "Cadastro de Cliente — somente consulta";
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  carregarClientes();
});

btnSair?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!podeEditarClientes) {
    alert("Seu perfil possui acesso somente para consulta de clientes.");
    return;
  }

  const id = valor("clienteId");

  const dadosCliente = {
    razaoSocial: valor("razaoSocial"),
    cnpj: valor("cnpj"),
    endereco: valor("endereco"),
    cidade: valor("cidade"),
    cep: valor("cep"),
    contato: valor("contato"),
    email: valor("email"),
    fone: valor("fone"),
    ativo: valor("ativo") === "true",
    observacao: valor("observacao"),
    atualizadoEm: serverTimestamp()
  };

  if (!dadosCliente.razaoSocial) {
    alert("Informe o nome ou razão social do cliente.");
    return;
  }

  try {
    if (id) {
      await updateDoc(doc(db, "clientes", id), dadosCliente);
      alert("Cliente atualizado com sucesso.");
    } else {
      await addDoc(collection(db, "clientes"), {
        ...dadosCliente,
        criadoEm: serverTimestamp()
      });
      alert("Cliente cadastrado com sucesso.");
    }

    limparFormulario();
    await carregarClientes();

  } catch (erro) {
    console.error("Erro ao salvar cliente:", erro);
    alert("Erro ao salvar cliente. Verifique o console.");
  }
});

btnCancelarEdicao.addEventListener("click", limparFormulario);
buscaCliente.addEventListener("input", renderizarClientes);
filtroStatus.addEventListener("change", renderizarClientes);

async function carregarClientes() {
  try {
    const consulta = query(collection(db, "clientes"), orderBy("razaoSocial"));
    const snapshot = await getDocs(consulta);

    clientes = snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data()
    }));

    totalClientes.innerText = String(clientes.length);
    renderizarClientes();

  } catch (erro) {
    console.error("Erro ao carregar clientes:", erro);

    tabela.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar clientes. Verifique as regras do Firestore.</td>
      </tr>
    `;
  }
}

function renderizarClientes() {
  const termo = buscaCliente.value.toLowerCase().trim();
  const status = filtroStatus.value;

  let lista = clientes.filter((cliente) => {
    const texto = [
      cliente.razaoSocial,
      cliente.cnpj,
      cliente.cidade,
      cliente.contato,
      cliente.email,
      cliente.fone
    ].join(" ").toLowerCase();

    const bateBusca = texto.includes(termo);
    const bateStatus =
      status === "todos" ||
      (status === "ativos" && cliente.ativo !== false) ||
      (status === "inativos" && cliente.ativo === false);

    return bateBusca && bateStatus;
  });

  if (lista.length === 0) {
    tabela.innerHTML = `
      <tr>
        <td colspan="7">Nenhum cliente encontrado.</td>
      </tr>
    `;
    return;
  }

  tabela.innerHTML = lista.map((cliente) => `
    <tr>
      <td><strong>${escapar(cliente.razaoSocial || "")}</strong></td>
      <td>${escapar(cliente.cnpj || "")}</td>
      <td>${escapar(cliente.cidade || "")}</td>
      <td>${escapar(cliente.contato || "")}</td>
      <td>${escapar(cliente.fone || "")}</td>
      <td>${cliente.ativo === false ? "Inativo" : "Ativo"}</td>
      <td>
        ${podeEditarClientes
          ? `<button class="secondary small" onclick="editarCliente('${cliente.id}')">Editar</button>`
          : `<span class="read-only-badge">Consulta</span>`
        }
      </td>
    </tr>
  `).join("");
}

window.editarCliente = function editarCliente(id) {
  const cliente = clientes.find((item) => item.id === id);

  if (!cliente) return;

  document.getElementById("tituloForm").innerText = "Editar Cliente";
  preencher("clienteId", cliente.id);
  preencher("razaoSocial", cliente.razaoSocial);
  preencher("cnpj", cliente.cnpj);
  preencher("endereco", cliente.endereco);
  preencher("cidade", cliente.cidade);
  preencher("cep", cliente.cep);
  preencher("contato", cliente.contato);
  preencher("email", cliente.email);
  preencher("fone", cliente.fone);
  preencher("ativo", cliente.ativo === false ? "false" : "true");
  preencher("observacao", cliente.observacao);

  window.scrollTo({ top: 0, behavior: "smooth" });
};

function limparFormulario() {
  form.reset();
  preencher("clienteId", "");
  document.getElementById("tituloForm").innerText = "Cadastrar Cliente";
}

function valor(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function preencher(id, valorCampo) {
  document.getElementById(id).value = valorCampo || "";
}

function escapar(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
