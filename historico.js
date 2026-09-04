import { exigirAcesso } from "./auth-service.js";
const sessao = await exigirAcesso(["admin","gestor","analista","consulta"]);

import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

let todasRats = [];

const tbody = document.getElementById("listaRats");
const busca = document.getElementById("busca");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("usuarioLogado").textContent = user.email;
  await carregarHistorico();
});

document.getElementById("btnSair")?.addEventListener("click", () => signOut(auth));
document.getElementById("btnAtualizar").addEventListener("click", carregarHistorico);
busca.addEventListener("input", renderizarTabela);

async function carregarHistorico() {
  tbody.innerHTML = `<tr><td colspan="6">Carregando...</td></tr>`;

  try {
    const consulta = query(
      collection(db, "rats"),
      orderBy("criadoEm", "desc"),
      limit(100)
    );

    const snapshot = await getDocs(consulta);

    todasRats = snapshot.docs.map(documento => ({
      id: documento.id,
      ...documento.data()
    }));

    renderizarTabela();
  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro);
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          Não foi possível carregar o histórico.
        </td>
      </tr>
    `;
  }
}

function renderizarTabela() {
  const termo = busca.value.toLowerCase().trim();

  const filtradas = todasRats.filter(rat => {
    const texto = [
      rat.numero,
      rat.cliente,
      rat.tecnicoNome,
      rat.tecnico,
      rat.tecnicos,
      rat.status
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return texto.includes(termo);
  });

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="6">Nenhuma RAT encontrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtradas.map(rat => {
    const urlDetalhe = `rat-detalhe.html?id=${encodeURIComponent(rat.id)}`;
    const urlPdf = `${urlDetalhe}&pdf=1`;

    return `
      <tr>
        <td><strong>${escapar(rat.numero || "-")}</strong></td>
        <td>${escapar(rat.cliente || "-")}</td>
        <td>${escapar(rat.tecnicoNome || rat.tecnico || rat.tecnicos || "-")}</td>
        <td>${escapar(rat.status || "-")}</td>
        <td>${formatarDataFirestore(rat.criadoEm)}</td>
        <td>
          <div class="table-actions">
            <a class="table-action view" href="${urlDetalhe}">
              Ver RAT
            </a>

            <a class="table-action pdf" href="${urlPdf}" target="_blank" rel="noopener">
              Abrir PDF
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function formatarDataFirestore(valor) {
  if (!valor) return "-";

  const data = valor.toDate
    ? valor.toDate()
    : new Date(valor);

  return data.toLocaleString("pt-BR");
}

function escapar(valor = "") {
  const elemento = document.createElement("div");
  elemento.textContent = String(valor);
  return elemento.innerHTML;
}
