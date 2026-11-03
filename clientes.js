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
  orderBy,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const form = document.getElementById("clienteForm");
const tabela = document.getElementById("clientesTabela");
const totalClientes = document.getElementById("totalClientes");
const buscaCliente = document.getElementById("buscaCliente");
const filtroStatus = document.getElementById("filtroStatus");
const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");
const btnSair = document.getElementById("btnSair");
const btnImportarClientes = document.getElementById("btnImportarClientes");
const btnExportarClientes = document.getElementById("btnExportarClientes");
const arquivoClientesCsv = document.getElementById("arquivoClientesCsv");
const importacaoClientes = document.getElementById("importacaoClientes");
const btnFecharImportacao = document.getElementById("btnFecharImportacao");
const btnConfirmarImportacao = document.getElementById("btnConfirmarImportacao");
const resumoImportacao = document.getElementById("resumoImportacao");
const previewImportacao = document.getElementById("previewImportacao");

let clientes = [];
let importacaoPendente = [];

if (!podeEditarClientes) {
  document.querySelectorAll("#clienteForm input, #clienteForm select, #clienteForm textarea, #clienteForm button")
    .forEach(elemento => { elemento.disabled = true; });

  const titulo = document.getElementById("tituloForm");
  if (titulo) titulo.textContent = "Cadastro de Cliente — somente consulta";
  if (btnImportarClientes) btnImportarClientes.disabled = true;
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
  const dadosCliente = lerDadosFormulario();

  if (!dadosCliente.razaoSocial) {
    alert("Informe o nome ou razão social do cliente.");
    return;
  }

  try {
    if (id) {
      await updateDoc(doc(db, "clientes", id), {
        ...dadosCliente,
        atualizadoEm: serverTimestamp()
      });
      alert("Cliente atualizado com sucesso.");
    } else {
      await addDoc(collection(db, "clientes"), {
        ...dadosCliente,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
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

btnImportarClientes?.addEventListener("click", () => {
  if (!podeEditarClientes) return;
  arquivoClientesCsv?.click();
});

btnExportarClientes?.addEventListener("click", exportarClientesCsv);
btnFecharImportacao?.addEventListener("click", fecharImportacao);
btnConfirmarImportacao?.addEventListener("click", confirmarImportacao);
arquivoClientesCsv?.addEventListener("change", tratarArquivoCsv);

async function carregarClientes() {
  try {
    const consulta = query(collection(db, "clientes"), orderBy("razaoSocial"));
    const snapshot = await getDocs(consulta);
    clientes = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
    totalClientes.innerText = String(clientes.length);
    renderizarClientes();
  } catch (erro) {
    console.error("Erro ao carregar clientes:", erro);
    tabela.innerHTML = `<tr><td colspan="7">Erro ao carregar clientes. Verifique as regras do Firestore.</td></tr>`;
  }
}

function renderizarClientes() {
  const termo = buscaCliente.value.toLowerCase().trim();
  const status = filtroStatus.value;

  const lista = clientes.filter((cliente) => {
    const texto = [cliente.razaoSocial, cliente.cnpj, cliente.cidade, cliente.contato, cliente.email, cliente.fone]
      .join(" ").toLowerCase();
    const bateBusca = texto.includes(termo);
    const bateStatus = status === "todos" ||
      (status === "ativos" && cliente.ativo !== false) ||
      (status === "inativos" && cliente.ativo === false);
    return bateBusca && bateStatus;
  });

  if (lista.length === 0) {
    tabela.innerHTML = `<tr><td colspan="7">Nenhum cliente encontrado.</td></tr>`;
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
      <td>${podeEditarClientes
        ? `<button class="secondary small" onclick="editarCliente('${cliente.id}')">Editar</button>`
        : `<span class="read-only-badge">Consulta</span>`}</td>
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

function lerDadosFormulario() {
  return {
    razaoSocial: valor("razaoSocial"),
    cnpj: valor("cnpj"),
    endereco: valor("endereco"),
    cidade: valor("cidade"),
    cep: valor("cep"),
    contato: valor("contato"),
    email: valor("email"),
    fone: valor("fone"),
    ativo: valor("ativo") !== "false",
    observacao: valor("observacao")
  };
}

function exportarClientesCsv() {
  if (!clientes.length) {
    alert("Não há clientes para exportar.");
    return;
  }

  const campos = ["razaoSocial", "cnpj", "endereco", "cidade", "cep", "contato", "email", "fone", "ativo", "observacao"];
  const cabecalho = campos.join(";");
  const linhas = clientes.map((cliente) => campos.map((campo) => {
    let valorCampo = cliente[campo];
    if (campo === "ativo") valorCampo = cliente.ativo === false ? "false" : "true";
    return csvEscapar(valorCampo ?? "");
  }).join(";"));

  const csv = "\uFEFF" + [cabecalho, ...linhas].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `field-system-clientes-${dataArquivo()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function tratarArquivoCsv(event) {
  const arquivo = event.target.files?.[0];
  if (!arquivo) return;
  if (!podeEditarClientes) return;

  try {
    const texto = await arquivo.text();
    const registros = parseCsv(texto);
    importacaoPendente = prepararImportacao(registros);
    renderizarPreviewImportacao(importacaoPendente, arquivo.name);
    importacaoClientes.hidden = false;
    importacaoClientes.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (erro) {
    console.error("Erro ao ler CSV:", erro);
    alert(`Não foi possível ler o CSV: ${erro.message}`);
  } finally {
    event.target.value = "";
  }
}

function prepararImportacao(registros) {
  const existentesPorCnpj = new Map();
  const existentesPorNome = new Map();
  clientes.forEach((cliente) => {
    const cnpj = normalizarChave(cliente.cnpj);
    const nome = normalizarTexto(cliente.razaoSocial);
    if (cnpj) existentesPorCnpj.set(cnpj, cliente);
    if (nome) existentesPorNome.set(nome, cliente);
  });

  return registros.map((registro, indice) => {
    const cliente = normalizarRegistroCliente(registro);
    const existente = (cliente.cnpj && existentesPorCnpj.get(normalizarChave(cliente.cnpj))) ||
      existentesPorNome.get(normalizarTexto(cliente.razaoSocial));

    const erros = [];
    if (!cliente.razaoSocial) erros.push("Razão social obrigatória");
    if (cliente.email && !/^\\S+@\\S+\\.\\S+$/.test(cliente.email)) erros.push("E-mail inválido");

    return {
      linha: indice + 2,
      cliente,
      existente: existente || null,
      erros,
      acao: erros.length ? "Erro" : existente ? "Atualizar" : "Novo"
    };
  });
}

function renderizarPreviewImportacao(itens, nomeArquivo) {
  const erros = itens.filter(item => item.erros.length).length;
  const novos = itens.filter(item => item.acao === "Novo").length;
  const atualizacoes = itens.filter(item => item.acao === "Atualizar").length;

  resumoImportacao.innerHTML = `\n    <strong>${escapar(nomeArquivo)}</strong> · ${itens.length} registro(s) · ${novos} novo(s) · ${atualizacoes} atualização(ões) · ${erros} erro(s)\n  `;

  previewImportacao.innerHTML = itens.length ? itens.map(item => `
    <tr>
      <td>${item.linha}</td>
      <td>${escapar(item.cliente.razaoSocial || "—")}</td>
      <td>${escapar(item.cliente.cnpj || "—")}</td>
      <td>${item.erros.length ? `<span class="import-error">${escapar(item.erros.join(", "))}</span>` : `<span class="import-ok">${item.acao}</span>`}</td>
    </tr>
  `).join("") : `<tr><td colspan="4">Nenhum registro encontrado no CSV.</td></tr>`;

  btnConfirmarImportacao.disabled = !itens.length || erros > 0;
}

async function confirmarImportacao() {
  if (!podeEditarClientes || !importacaoPendente.length) return;
  if (importacaoPendente.some(item => item.erros.length)) {
    alert("Corrija os registros com erro antes de importar.");
    return;
  }

  btnConfirmarImportacao.disabled = true;
  btnConfirmarImportacao.textContent = "Importando...";

  try {
    for (let inicio = 0; inicio < importacaoPendente.length; inicio += 450) {
      const lote = writeBatch(db);
      const itens = importacaoPendente.slice(inicio, inicio + 450);

      itens.forEach((item) => {
        if (item.existente) {
          lote.update(doc(db, "clientes", item.existente.id), {
            ...item.cliente,
            atualizadoEm: serverTimestamp()
          });
        } else {
          const ref = doc(collection(db, "clientes"));
          lote.set(ref, {
            ...item.cliente,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp()
          });
        }
      });
      await lote.commit();
    }

    alert(`${importacaoPendente.length} cliente(s) processado(s) com sucesso.`);
    fecharImportacao();
    await carregarClientes();
  } catch (erro) {
    console.error("Erro ao importar clientes:", erro);
    alert("Erro ao importar clientes. Verifique o console e as regras do Firestore.");
  } finally {
    btnConfirmarImportacao.disabled = false;
    btnConfirmarImportacao.textContent = "Importar clientes";
  }
}

function fecharImportacao() {
  importacaoPendente = [];
  importacaoClientes.hidden = true;
  resumoImportacao.innerHTML = "";
  previewImportacao.innerHTML = `<tr><td colspan="4">Selecione um arquivo CSV.</td></tr>`;
  if (btnConfirmarImportacao) btnConfirmarImportacao.disabled = true;
}

function parseCsv(texto) {
  const textoLimpo = String(texto).replace(/^\uFEFF/, "");
  const linhas = [];
  let linha = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < textoLimpo.length; i++) {
    const caractere = textoLimpo[i];
    const proximo = textoLimpo[i + 1];
    if (caractere === '"') {
      if (entreAspas && proximo === '"') {
        campo += '"';
        i++;
      } else {
        entreAspas = !entreAspas;
      }
    } else if ((caractere === ";" || caractere === ",") && !entreAspas) {
      linha.push(campo);
      campo = "";
    } else if ((caractere === "\n" || caractere === "\r") && !entreAspas) {
      if (caractere === "\r" && proximo === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.some(valor => String(valor).trim() !== "")) linhas.push(linha);
      linha = [];
    } else {
      campo += caractere;
    }
  }

  if (campo !== "" || linha.length) {
    linha.push(campo);
    if (linha.some(valor => String(valor).trim() !== "")) linhas.push(linha);
  }

  if (linhas.length < 2) return [];

  const cabecalhos = linhas[0].map(normalizarCabecalho);
  const permitidos = new Set(["razaosocial", "cnpj", "endereco", "cidade", "cep", "contato", "email", "fone", "ativo", "observacao"]);
  const desconhecidos = cabecalhos.filter(campo => campo && !permitidos.has(campo));
  if (desconhecidos.length) {
    throw new Error(`Colunas não reconhecidas: ${desconhecidos.join(", ")}`);
  }

  return linhas.slice(1).map(valores => {
    const registro = {};
    cabecalhos.forEach((cabecalho, index) => {
      if (cabecalho) registro[cabecalho] = String(valores[index] ?? "").trim();
    });
    return registro;
  });
}

function normalizarRegistroCliente(registro) {
  return {
    razaoSocial: registro.razaosocial || "",
    cnpj: registro.cnpj || "",
    endereco: registro.endereco || "",
    cidade: registro.cidade || "",
    cep: registro.cep || "",
    contato: registro.contato || "",
    email: registro.email || "",
    fone: registro.fone || "",
    ativo: interpretarAtivo(registro.ativo),
    observacao: registro.observacao || ""
  };
}

function interpretarAtivo(valorCampo) {
  const valorNormalizado = normalizarTexto(valorCampo);
  if (["false", "inativo", "nao", "não", "0"].includes(valorNormalizado)) return false;
  return true;
}

function normalizarCabecalho(valorCampo) {
  return normalizarChave(valorCampo).replace(/^cpf/, "cnpj");
}

function normalizarChave(valorCampo) {
  return String(valorCampo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizarTexto(valorCampo) {
  return String(valorCampo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function csvEscapar(valorCampo) {
  return `"${String(valorCampo).replaceAll('"', '""').replaceAll("\r", " ").replaceAll("\n", " ")}"`;
}

function dataArquivo() {
  const agora = new Date();
  const pad = (valor) => String(valor).padStart(2, "0");
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

function limparFormulario() {
  form.reset();
  preencher("clienteId", "");
  document.getElementById("tituloForm").innerText = "Cadastrar Cliente";
}

function valor(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function preencher(id, valorCampo) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.value = valorCampo ?? "";
}

function escapar(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
