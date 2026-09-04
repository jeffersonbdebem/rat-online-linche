import {
  db
} from "./firebase-config.js";

import {
  exigirAcesso,
  ADMIN_EMAIL
} from "./auth-service.js";

import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const sessao =
  await exigirAcesso(
    ["admin"]
  );

if (
  String(
    sessao.user.email || ""
  ).toLowerCase() !==
  ADMIN_EMAIL
) {
  window.location.replace(
    "dashboard.html?acesso=negado"
  );
}

let solicitacoes =
  [];

const lista =
  document.getElementById(
    "listaSolicitacoes"
  );

const busca =
  document.getElementById(
    "buscaAcesso"
  );

const filtro =
  document.getElementById(
    "filtroStatusAcesso"
  );

document
  .getElementById(
    "btnAtualizarAcessos"
  )
  .addEventListener(
    "click",
    carregarSolicitacoes
  );

busca.addEventListener(
  "input",
  renderizar
);

filtro.addEventListener(
  "input",
  renderizar
);

await carregarSolicitacoes();

async function carregarSolicitacoes() {

  lista.innerHTML =
    `
      <div class="empty-state">
        Carregando solicitações...
      </div>
    `;

  try {

    const resultado =
      await getDocs(
        query(
          collection(
            db,
            "solicitacoesAcesso"
          ),
          orderBy(
            "criadoEm",
            "desc"
          )
        )
      );

    solicitacoes =
      resultado.docs.map(
        item => ({
          id:
            item.id,
          ...item.data()
        })
      );

    atualizarMetricas();
    renderizar();

  } catch (e) {

    console.error(e);

    lista.innerHTML =
      `
        <div class="empty-state">
          Não foi possível carregar as solicitações.
        </div>
      `;

  }

}

function atualizarMetricas() {

  document
    .getElementById(
      "metricPendentes"
    )
    .textContent =
      solicitacoes.filter(
        item =>
          item.status ===
          "pendente"
      ).length;

  document
    .getElementById(
      "metricAprovadas"
    )
    .textContent =
      solicitacoes.filter(
        item =>
          item.status ===
          "aprovado"
      ).length;

  document
    .getElementById(
      "metricRecusadas"
    )
    .textContent =
      solicitacoes.filter(
        item =>
          item.status ===
          "recusado"
      ).length;

}

function renderizar() {

  const termo =
    busca.value
      .trim()
      .toLowerCase();

  const status =
    filtro.value;

  const itens =
    solicitacoes.filter(
      item => {

        if (
          status !== "todos" &&
          item.status !== status
        ) {
          return false;
        }

        if (!termo) {
          return true;
        }

        const texto = [
          item.nome,
          item.cargo,
          item.email,
          item.perfilSolicitado
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return texto.includes(
          termo
        );

      }
    );

  if (!itens.length) {

    lista.innerHTML =
      `
        <div class="empty-state">
          Nenhuma solicitação encontrada.
        </div>
      `;

    return;
  }

  lista.innerHTML =
    itens
      .map(
        item =>
          cardSolicitacao(
            item
          )
      )
      .join("");

  lista
    .querySelectorAll(
      "[data-aprovar]"
    )
    .forEach(
      botao => {

        botao.addEventListener(
          "click",
          () =>
            aprovar(
              botao.dataset.aprovar
            )
        );

      }
    );

  lista
    .querySelectorAll(
      "[data-recusar]"
    )
    .forEach(
      botao => {

        botao.addEventListener(
          "click",
          () =>
            recusar(
              botao.dataset.recusar
            )
        );

      }
    );

}

function cardSolicitacao(
  item
) {

  const perfil =
    normalizarPerfilSolicitado(
      item.perfilSolicitado
    );

  const statusLabel = {
    pendente:
      "Pendente",
    aprovado:
      "Aprovado",
    recusado:
      "Recusado"
  }[item.status] || item.status;

  return `
    <article class="access-request-card">

      <div class="access-request-main">

        <div class="access-avatar">
          ${iniciais(item.nome)}
        </div>

        <div class="access-request-data">

          <div class="access-request-title">
            <strong>
              ${esc(item.nome || "Sem nome")}
            </strong>

            <span class="access-status ${esc(item.status || "pendente")}">
              ${esc(statusLabel)}
            </span>
          </div>

          <p>
            ${esc(item.cargo || "Cargo não informado")}
          </p>

          <small>
            ${esc(item.email || "")}
          </small>

        </div>

      </div>

      <div class="access-profile-select">

        <label>
          Perfil de acesso

          <select
            id="perfil-${item.id}"
            ${item.status !== "pendente" ? "disabled" : ""}
          >
            <option
              value="analista"
              ${perfil === "analista" ? "selected" : ""}
            >
              Analista
            </option>

            <option
              value="gestor"
              ${perfil === "gestor" ? "selected" : ""}
            >
              Gestor
            </option>

            <option
              value="consulta"
              ${perfil === "consulta" ? "selected" : ""}
            >
              Consulta
            </option>
          </select>

        </label>

      </div>

      <div class="access-request-actions">

        ${
          item.status === "pendente"
            ? `
                <button
                  type="button"
                  class="primary"
                  data-aprovar="${item.id}"
                >
                  Aprovar
                </button>

                <button
                  type="button"
                  class="danger"
                  data-recusar="${item.id}"
                >
                  Recusar
                </button>
              `
            : `
                <span class="access-finished">
                  ${esc(statusLabel)}
                </span>
              `
        }

      </div>

    </article>
  `;

}

async function aprovar(
  id
) {

  const solicitacao =
    solicitacoes.find(
      item =>
        item.id === id
    );

  if (!solicitacao) {
    return;
  }

  const select =
    document.getElementById(
      `perfil-${id}`
    );

  const perfil =
    normalizarPerfilSolicitado(
      select?.value ||
      solicitacao.perfilSolicitado
    );

  try {

    await setDoc(
      doc(
        db,
        "usuarios",
        id
      ),
      {
        nome:
          solicitacao.nome,

        cargo:
          solicitacao.cargo,

        email:
          String(
            solicitacao.email || ""
          ).toLowerCase(),

        perfil:
          perfil,

        ativo:
          true,

        aprovadoPorUid:
          sessao.user.uid,

        aprovadoPorEmail:
          sessao.user.email,

        criadoEm:
          serverTimestamp(),

        atualizadoEm:
          serverTimestamp()
      }
    );

    await updateDoc(
      doc(
        db,
        "solicitacoesAcesso",
        id
      ),
      {
        status:
          "aprovado",

        perfilAprovado:
          perfil,

        aprovadoPorUid:
          sessao.user.uid,

        aprovadoPorEmail:
          sessao.user.email,

        aprovadoEm:
          serverTimestamp(),

        atualizadoEm:
          serverTimestamp()
      }
    );

    toast(
      "Acesso aprovado com sucesso."
    );

    await carregarSolicitacoes();

  } catch (e) {

    console.error(e);

    toast(
      "Não foi possível aprovar o acesso.",
      true
    );

  }

}

async function recusar(
  id
) {

  const solicitacao =
    solicitacoes.find(
      item =>
        item.id === id
    );

  if (!solicitacao) {
    return;
  }

  const confirmar =
    window.confirm(
      `Recusar o acesso de ${solicitacao.nome || solicitacao.email}?`
    );

  if (!confirmar) {
    return;
  }

  try {

    await updateDoc(
      doc(
        db,
        "solicitacoesAcesso",
        id
      ),
      {
        status:
          "recusado",

        recusadoPorUid:
          sessao.user.uid,

        recusadoPorEmail:
          sessao.user.email,

        recusadoEm:
          serverTimestamp(),

        atualizadoEm:
          serverTimestamp()
      }
    );

    toast(
      "Solicitação recusada."
    );

    await carregarSolicitacoes();

  } catch (e) {

    console.error(e);

    toast(
      "Não foi possível recusar a solicitação.",
      true
    );

  }

}

function normalizarPerfilSolicitado(
  perfil
) {

  const permitido = [
    "analista",
    "gestor",
    "consulta"
  ];

  const valor =
    String(
      perfil || ""
    )
      .toLowerCase();

  return permitido.includes(
    valor
  )
    ? valor
    : "analista";

}

function iniciais(nome = "") {
  return String(nome)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      parte =>
        parte[0]?.toUpperCase()
    )
    .join("") || "TI";
}

function esc(texto = "") {
  const div =
    document.createElement("div");

  div.textContent =
    texto;

  return div.innerHTML;
}

function toast(
  mensagem,
  erro = false
) {

  const elemento =
    document.getElementById(
      "toastAdmin"
    );

  elemento.textContent =
    mensagem;

  elemento.className =
    `toast show${erro ? " error" : ""}`;

  clearTimeout(
    toast.timer
  );

  toast.timer =
    setTimeout(
      () => {
        elemento.className =
          "toast";
      },
      2600
    );

}
