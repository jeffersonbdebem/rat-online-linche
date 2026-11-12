import {
  db
} from "./firebase-config.js";

import {
  exigirAcesso,
  ADMIN_EMAIL
} from "./auth-service.js";

import {
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const sessao =
  await exigirAcesso(
    [
      "admin",
      "gestor",
      "analista",
      "consulta"
    ]
  );

const perfil =
  String(
    sessao.perfil.perfil ||
    "analista"
  ).toLowerCase();

const emailAtual =
  String(
    sessao.user.email || ""
  ).toLowerCase();

const ehAdmin =
  emailAtual ===
  ADMIN_EMAIL;

const ehGestao =
  [
    "admin",
    "gestor"
  ].includes(
    perfil
  );

const API_CHAMADOS = "https://rat-online-linche.onrender.com/api";

let visitas =
  [];

let rats =
  [];

inicializar();

function inicializar() {

  configurarSaudacao();

  filtrarAtalhos();

  observarVisitas();

  observarRats();

  carregarChamadosDashboard();

  if (ehGestao) {
    carregarGestao();
  }

}

function configurarSaudacao() {

  const nomeCompleto =
    sessao.perfil.nome ||
    sessao.user.email ||
    "Usuário";

  const primeiroNome =
    String(
      nomeCompleto
    )
      .trim()
      .split(/\s+/)[0];

  const hora =
    new Date()
      .getHours();

  const periodo =
    hora < 12
      ? "Bom dia"
      : hora < 18
        ? "Boa tarde"
        : "Boa noite";

  document
    .getElementById(
      "dashboardSaudacao"
    )
    .textContent =
      `${periodo}, ${primeiroNome}`;

}

function filtrarAtalhos() {

  document
    .querySelectorAll(
      "#dashboardAtalhos [data-perfis]"
    )
    .forEach(
      item => {

        const perfis =
          item.dataset.perfis
            .split(",")
            .map(
              valor =>
                valor.trim()
            );

        item.classList.toggle(
          "hidden",
          !perfis.includes(
            perfil
          )
        );

      }
    );

}

function observarVisitas() {

  onSnapshot(
    collection(
      db,
      "visitas"
    ),
    snapshot => {

      visitas =
        snapshot.docs
          .map(
            documento => ({
              id:
                documento.id,

              ...documento.data()
            })
          );

      atualizarDashboardVisitas();

      marcarAtualizacao();

    },
    erro => {

      console.error(
        "[Dashboard] Erro ao acompanhar visitas:",
        erro
      );

      document
        .getElementById(
          "agendaHoje"
        )
        .innerHTML =
          `
            <div class="dashboard-empty error">
              Não foi possível carregar as visitas.
            </div>
          `;

    }
  );

}

function observarRats() {

  /*
   * Primeiro tentamos ordenar diretamente pelo Firestore.
   * Caso existam RATs antigas sem criadoEm ou algum índice
   * ainda não esteja disponível, fazemos fallback.
   */

  try {

    const consulta =
      query(
        collection(
          db,
          "rats"
        ),
        orderBy(
          "criadoEm",
          "desc"
        ),
        limit(8)
      );

    onSnapshot(
      consulta,
      snapshot => {

        rats =
          snapshot.docs
            .map(
              documento => ({
                id:
                  documento.id,

                ...documento.data()
              })
            );

        renderizarRats();

        marcarAtualizacao();

      },
      async erro => {

        console.warn(
          "[Dashboard] Consulta ordenada de RAT falhou. Utilizando fallback.",
          erro
        );

        await carregarRatsFallback();

      }
    );

  } catch (erro) {

    console.warn(
      erro
    );

    carregarRatsFallback();

  }

}

async function carregarRatsFallback() {

  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "rats"
        )
      );

    rats =
      snapshot.docs
        .map(
          documento => ({
            id:
              documento.id,

            ...documento.data()
          })
        )
        .sort(
          (a, b) =>
            timestampMs(
              b.criadoEm
            ) -
            timestampMs(
              a.criadoEm
            )
        )
        .slice(
          0,
          8
        );

    renderizarRats();

    marcarAtualizacao();

  } catch (erro) {

    console.error(
      "[Dashboard] Erro ao carregar RATs:",
      erro
    );

    document
      .getElementById(
        "ultimasRats"
      )
      .innerHTML =
        `
          <div class="dashboard-empty error">
            Não foi possível carregar as RATs.
          </div>
        `;

  }

}

function atualizarDashboardVisitas() {

  const hoje =
    dataISOHoje();

  const visitasHoje =
    visitas
      .filter(
        visita =>
          String(
            visita.data || ""
          ) === hoje
      )
      .sort(
        (a, b) =>
          String(
            a.horario || ""
          )
            .localeCompare(
              String(
                b.horario || ""
              )
            )
      );

  const contagens = {
    agendada:
      0,

    em_rota:
      0,

    em_atendimento:
      0,

    finalizacao:
      0,

    concluida:
      0
  };

  visitasHoje
    .forEach(
      visita => {

        const status =
          normalizarStatus(
            visita.status
          );

        if (
          Object.prototype
            .hasOwnProperty
            .call(
              contagens,
              status
            )
        ) {
          contagens[
            status
          ]++;
        }

      }
    );

  const atrasadas =
    visitasHoje
      .filter(
        estaAtrasada
      )
      .length;

  definirTexto(
    "metricHoje",
    visitasHoje.length
  );

  definirTexto(
    "metricEmRota",
    contagens.em_rota
  );

  definirTexto(
    "metricAtendimento",
    contagens.em_atendimento
  );

  definirTexto(
    "metricFinalizacao",
    contagens.finalizacao
  );

  definirTexto(
    "metricConcluidas",
    contagens.concluida
  );

  definirTexto(
    "metricAtrasadas",
    atrasadas
  );

  definirTexto(
    "summaryAgendadas",
    contagens.agendada
  );

  definirTexto(
    "summaryRota",
    contagens.em_rota
  );

  definirTexto(
    "summaryAtendimento",
    contagens.em_atendimento
  );

  definirTexto(
    "summaryFinalizacao",
    contagens.finalizacao
  );

  definirTexto(
    "summaryConcluidas",
    contagens.concluida
  );

  renderizarAgenda(
    visitasHoje
  );

}

function renderizarAgenda(
  itens
) {

  const container =
    document.getElementById(
      "agendaHoje"
    );

  if (!itens.length) {

    container.innerHTML =
      `
        <div class="dashboard-empty">
          Nenhuma visita agendada para hoje.
        </div>
      `;

    return;
  }

  container.innerHTML =
    itens
      .map(
        visita => {

          const status =
            normalizarStatus(
              visita.status
            );

          const atrasada =
            estaAtrasada(
              visita
            );

          return `
            <a
              class="agenda-row"
              href="kanban.html"
            >

              <div class="agenda-time">
                ${esc(
                  visita.horario ||
                  "--:--"
                )}
              </div>

              <div class="agenda-main">

                <strong>
                  ${esc(
                    visita.cliente ||
                    "Cliente não informado"
                  )}
                </strong>

                <small>
                  ${esc(
                    visita.tecnico ||
                    "Técnico não definido"
                  )}
                </small>

              </div>

              <span
                class="dashboard-status ${status}${atrasada ? " atrasada" : ""}"
              >
                ${
                  atrasada
                    ? "Atrasada"
                    : labelStatus(
                        status
                      )
                }
              </span>

            </a>
          `;

        }
      )
      .join("");

}

function renderizarRats() {

  const container =
    document.getElementById(
      "ultimasRats"
    );

  if (!rats.length) {

    container.innerHTML =
      `
        <div class="dashboard-empty">
          Nenhuma RAT registrada.
        </div>
      `;

    return;
  }

  container.innerHTML =
    rats
      .slice(
        0,
        6
      )
      .map(
        rat => {

          const tecnico =
            rat.tecnicos ||
            rat.criadoPorNome ||
            "—";

          return `
            <a
              class="rat-row"
              href="rat-detalhe.html?id=${encodeURIComponent(rat.id)}"
            >

              <div class="rat-row-main">

                <strong>
                  ${esc(
                    rat.numero ||
                    "RAT"
                  )}
                </strong>

                <small>
                  ${esc(
                    rat.cliente ||
                    "Cliente não informado"
                  )}
                </small>

              </div>

              <div class="rat-row-meta">

                <span>
                  ${esc(
                    tecnico
                  )}
                </span>

                <small>
                  ${formatarTimestamp(
                    rat.criadoEm
                  )}
                </small>

              </div>

            </a>
          `;

        }
      )
      .join("");

}


async function carregarChamadosDashboard() {
  const painel = document.getElementById("painelChamadosDashboard");
  if (!painel) return;
  const perfilAtual = String(sessao.perfil.perfil || "").toLowerCase();
  if (!["admin", "gestor", "analista"].includes(perfilAtual)) {
    painel.classList.add("hidden");
    return;
  }

  const lista = document.getElementById("ultimosChamadosDashboard");
  try {
    const token = await sessao.user.getIdToken();
    const resposta = await fetch(`${API_CHAMADOS}/chamados?limite=500`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.message || `Falha HTTP ${resposta.status}`);

    const chamados = Array.isArray(dados.chamados) ? dados.chamados : [];
    const abertos = chamados.filter(c => c.status !== "encerrado");
    definirTexto("dashChamadosAbertos", abertos.length);
    definirTexto("dashChamadosNovos", chamados.filter(c => c.status === "novo").length);
    definirTexto("dashChamadosAtendimento", chamados.filter(c => c.status === "em_atendimento").length);
    definirTexto("dashChamadosAguardando", chamados.filter(c => c.status === "aguardando_cliente").length);
    definirTexto("dashChamadosUrgentes", abertos.filter(c => c.prioridade === "urgente").length);

    const recentes = chamados.slice(0, 5);
    if (!recentes.length) {
      lista.innerHTML = '<div class="dashboard-empty">Nenhum chamado cadastrado.</div>';
      return;
    }
    const statusLabel = {
      novo: "Novo",
      em_atendimento: "Em atendimento",
      aguardando_cliente: "Aguardando cliente",
      encerrado: "Encerrado"
    };
    lista.innerHTML = recentes.map(chamado => `
      <a class="rat-row" href="chamados.html">
        <div class="rat-row-main">
          <strong>${esc(chamado.protocolo || "Chamado")}</strong>
          <small>${esc(chamado.clienteNome || "Cliente não informado")} · ${esc(chamado.assunto || "")}</small>
        </div>
        <div class="rat-row-meta">
          <span>${esc(statusLabel[chamado.status] || chamado.status || "—")}</span>
          <small>${esc(chamado.prioridade || "normal").toUpperCase()} · ${esc(formatarTimestamp(chamado.atualizadoEm || chamado.criadoEm))}</small>
        </div>
      </a>
    `).join("");
  } catch (erro) {
    console.error("[Dashboard] Erro ao carregar chamados independentes:", erro);
    lista.innerHTML = '<div class="dashboard-empty error">Não foi possível carregar os chamados. Verifique sua permissão ou tente novamente.</div>';
    ["dashChamadosAbertos", "dashChamadosNovos", "dashChamadosAtendimento", "dashChamadosAguardando", "dashChamadosUrgentes"].forEach(id => definirTexto(id, "—"));
  }
}

async function carregarGestao() {

  const painel =
    document.getElementById(
      "gestaoDashboard"
    );

  painel.classList.remove(
    "hidden"
  );

  /*
   * Gestor pode consultar usuários conforme as regras atuais.
   * Solicitações ficam exclusivas ao administrador fixo.
   */

  try {

    const usuariosSnap =
      await getDocs(
        collection(
          db,
          "usuarios"
        )
      );

    const ativos =
      usuariosSnap.docs
        .map(
          documento =>
            documento.data()
        )
        .filter(
          usuario =>
            usuario.ativo !==
            false
        )
        .length;

    definirTexto(
      "metricUsuariosAtivosDashboard",
      ativos
    );

  } catch (erro) {

    console.warn(
      "[Dashboard] Usuários indisponíveis para este perfil:",
      erro
    );

    definirTexto(
      "metricUsuariosAtivosDashboard",
      "—"
    );

  }

  if (!ehAdmin) {

    document
      .getElementById(
        "linkUsuariosDashboard"
      )
      ?.setAttribute(
        "href",
        "#"
      );

    return;
  }

  const linkAcessos =
    document.getElementById(
      "linkAcessosDashboard"
    );

  linkAcessos.classList.remove(
    "hidden"
  );

  try {

    const solicitacoesSnap =
      await getDocs(
        collection(
          db,
          "solicitacoesAcesso"
        )
      );

    const pendentes =
      solicitacoesSnap.docs
        .map(
          documento =>
            documento.data()
        )
        .filter(
          item =>
            item.status ===
            "pendente"
        )
        .length;

    definirTexto(
      "metricAcessosPendentes",
      pendentes
    );

  } catch (erro) {

    console.warn(
      "[Dashboard] Solicitações indisponíveis:",
      erro
    );

    definirTexto(
      "metricAcessosPendentes",
      "—"
    );

  }

}

function estaAtrasada(
  visita
) {

  const status =
    normalizarStatus(
      visita.status
    );

  if (
    !["agendada", "em_rota"].includes(status)
  ) {
    return false;
  }

  if (
    !visita.data ||
    !visita.horario
  ) {
    return false;
  }

  const dataHora =
    new Date(
      `${visita.data}T${visita.horario}:00`
    );

  return (
    !Number.isNaN(
      dataHora.getTime()
    ) &&
    dataHora.getTime() <
      Date.now()
  );

}

function normalizarStatus(
  status = ""
) {

  const valor =
    String(status)
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        "_"
      )
      .replace(
        /-/g,
        "_"
      );

  const mapa = {
    agendada:
      "agendada",

    agendado:
      "agendada",

    em_rota:
      "em_rota",

    rota:
      "em_rota",

    em_atendimento:
      "em_atendimento",

    atendimento:
      "em_atendimento",

    finalizacao:
      "finalizacao",

    finalização:
      "finalizacao",

    concluida:
      "concluida",

    concluída:
      "concluida",

    concluido:
      "concluida",

    concluído:
      "concluida"
  };

  return (
    mapa[valor] ||
    valor ||
    "agendada"
  );

}

function labelStatus(
  status
) {

  return {
    agendada:
      "Agendada",

    em_rota:
      "Em rota",

    em_atendimento:
      "Em atendimento",

    finalizacao:
      "Finalização",

    concluida:
      "Concluída"
  }[status] ||
  status;

}

function dataISOHoje() {

  const agora =
    new Date();

  const ano =
    agora.getFullYear();

  const mes =
    String(
      agora.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const dia =
    String(
      agora.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${ano}-${mes}-${dia}`;

}

function timestampMs(
  valor
) {

  if (!valor) {
    return 0;
  }

  if (
    typeof valor.toMillis ===
    "function"
  ) {
    return valor.toMillis();
  }

  if (
    typeof valor.toDate ===
    "function"
  ) {
    return valor
      .toDate()
      .getTime();
  }

  const data =
    new Date(valor);

  return Number.isNaN(
    data.getTime()
  )
    ? 0
    : data.getTime();

}

function formatarTimestamp(
  valor
) {

  if (!valor) {
    return "—";
  }

  let data;

  if (
    typeof valor.toDate ===
    "function"
  ) {
    data =
      valor.toDate();
  } else {
    data =
      new Date(valor);
  }

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return "—";
  }

  return data
    .toLocaleString(
      "pt-BR",
      {
        day:
          "2-digit",

        month:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    );

}

function marcarAtualizacao() {

  const agora =
    new Date();

  document
    .getElementById(
      "dashboardAtualizado"
    )
    .textContent =
      `Atualizado às ${agora.toLocaleTimeString(
        "pt-BR",
        {
          hour:
            "2-digit",

          minute:
            "2-digit",

          second:
            "2-digit"
        }
      )}`;

}

function definirTexto(
  id,
  valor
) {

  const elemento =
    document.getElementById(
      id
    );

  if (elemento) {
    elemento.textContent =
      String(valor);
  }

}

function esc(
  texto = ""
) {

  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    String(texto);

  return div.innerHTML;

}
