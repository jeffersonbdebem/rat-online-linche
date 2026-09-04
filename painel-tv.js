import { db } from "./firebase-config.js";

import {
  exigirAcesso
} from "./auth-service.js";

import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

await exigirAcesso(
  [
    "admin",
    "gestor",
    "analista",
    "consulta"
  ]
);

const STATUS = [
  "agendada",
  "em_rota",
  "em_atendimento",
  "finalizacao",
  "concluida"
];

let visitas = [];

function hojeISO() {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function esc(t = "") {
  const d =
    document.createElement("div");

  d.textContent =
    String(t);

  return d.innerHTML;
}

function iniciais(n = "") {
  return String(n)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(x =>
      x[0]?.toUpperCase()
    )
    .join("") || "TI";
}

function prioridade(v = "media") {
  return {
    alta: "Alta",
    media: "Média",
    baixa: "Baixa"
  }[v] || v;
}

function statusTecnico(status) {
  return {
    agendada: "Agendada",
    em_rota: "Em rota",
    em_atendimento: "Atendendo",
    finalizacao: "Finalizando",
    concluida: "Concluída"
  }[status] || status;
}

function atrasada(v) {
  if (
    !["agendada", "em_rota"].includes(v.status) ||
    !v.data ||
    !v.horario
  ) {
    return false;
  }

  const limite =
    new Date(
      `${v.data}T${v.horario}:00`
    );

  return (
    !Number.isNaN(
      limite.getTime()
    ) &&
    limite.getTime() <
      Date.now()
  );
}

function minutosAtraso(v) {
  if (!atrasada(v)) {
    return 0;
  }

  const limite =
    new Date(
      `${v.data}T${v.horario}:00`
    );

  return Math.max(
    1,
    Math.floor(
      (
        Date.now() -
        limite.getTime()
      ) /
      60000
    )
  );
}

function atrasoTexto(v) {
  const minutos =
    minutosAtraso(v);

  if (minutos < 60) {
    return `Atraso ${minutos} min`;
  }

  const horas =
    Math.floor(
      minutos / 60
    );

  const resto =
    minutos % 60;

  return resto
    ? `Atraso ${horas}h ${resto}min`
    : `Atraso ${horas}h`;
}

function card(v) {
  const late =
    atrasada(v);

  const emCampo =
    [
      "em_rota",
      "em_atendimento",
      "finalizacao"
    ].includes(
      v.status
    );

  return `
    <article
      class="tv-card ${late ? "late" : ""} ${emCampo ? "field-card" : ""}"
    >

      <div class="tv-card-top">

        <span class="time">
          ${esc(v.horario || "--:--")}
        </span>

        <div class="card-badges">

          ${
            emCampo
              ? `
                <span class="field-badge ${esc(v.status)}">
                  ${esc(statusTecnico(v.status))}
                </span>
              `
              : ""
          }

          <span class="priority ${esc(v.prioridade || "media")}">
            ${esc(prioridade(v.prioridade))}
          </span>

        </div>

      </div>

      <strong class="client">
        ${esc(v.cliente || "Cliente não informado")}
      </strong>

      <p>
        ${esc(v.problema || "Sem descrição")}
      </p>

      <div class="tech">

        <span>
          ${iniciais(v.tecnico)}
        </span>

        <div class="tech-copy">

          <b>
            ${esc(v.tecnico || "Sem técnico")}
          </b>

          ${
            emCampo
              ? `
                <small>
                  ${esc(statusTecnico(v.status))}
                </small>
              `
              : ""
          }

        </div>

      </div>

      ${
        late
          ? `
            <div class="late-label">
              <span>!</span>
              ${esc(atrasoTexto(v))}
            </div>
          `
          : ""
      }

    </article>
  `;
}

function itensHoje() {
  const hoje =
    hojeISO();

  return visitas
    .filter(
      v =>
        String(
          v.data || ""
        ) === hoje
    )
    .sort(
      (a, b) =>
        String(
          a.horario || ""
        ).localeCompare(
          String(
            b.horario || ""
          )
        )
    );
}

function render() {
  const itens =
    itensHoje();

  STATUS.forEach(
    status => {

      const coluna =
        document.querySelector(
          `[data-status="${status}"]`
        );

      const lista =
        itens.filter(
          v =>
            v.status === status
        );

      coluna
        .querySelector(
          ".count"
        )
        .textContent =
          lista.length;

      coluna
        .querySelector(
          ".tv-list"
        )
        .innerHTML =
          lista.length
            ? lista
                .map(card)
                .join("")
            : `
                <div class="empty">
                  Sem visitas
                </div>
              `;

    }
  );

  const emCampo =
    itens.filter(
      v =>
        [
          "em_rota",
          "em_atendimento",
          "finalizacao"
        ].includes(
          v.status
        )
    );

  const atrasadas =
    itens.filter(
      atrasada
    );

  const concluidas =
    itens.filter(
      v =>
        v.status ===
        "concluida"
    );

  document
    .getElementById(
      "totalHoje"
    )
    .textContent =
      itens.length;

  document
    .getElementById(
      "totalCampo"
    )
    .textContent =
      emCampo.length;

  document
    .getElementById(
      "totalAtrasadas"
    )
    .textContent =
      atrasadas.length;

  document
    .getElementById(
      "totalConcluidas"
    )
    .textContent =
      concluidas.length;

  atualizarFaixa(
    itens,
    emCampo,
    atrasadas,
    concluidas
  );

  atualizarProximaVisita(
    itens
  );

  document
    .getElementById(
      "ultimaAtualizacao"
    )
    .textContent =
      `Atualizado ${new Date().toLocaleTimeString(
        "pt-BR",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }
      )}`;
}

function atualizarFaixa(
  itens,
  emCampo,
  atrasadas,
  concluidas
) {
  const texto =
    `${itens.length} visitas hoje • ` +
    `${emCampo.length} em campo • ` +
    `${concluidas.length} concluídas` +
    (
      atrasadas.length
        ? ` • ${atrasadas.length} atrasada${atrasadas.length > 1 ? "s" : ""}`
        : ""
    );

  document
    .getElementById(
      "faixaOperacao"
    )
    .textContent =
      texto;
}

function atualizarProximaVisita(
  itens
) {
  const agora =
    Date.now();

  const futura =
    itens.find(
      v => {

        if (
          v.status !== "agendada" ||
          !v.data ||
          !v.horario
        ) {
          return false;
        }

        const dataHora =
          new Date(
            `${v.data}T${v.horario}:00`
          );

        return (
          !Number.isNaN(
            dataHora.getTime()
          ) &&
          dataHora.getTime() >=
            agora
        );
      }
    );

  const container =
    document.getElementById(
      "proximaVisita"
    );

  if (!futura) {
    container.innerHTML = `
      <strong>--:--</strong>
      <span>Nenhuma visita futura</span>
    `;

    return;
  }

  container.innerHTML = `
    <strong>
      ${esc(futura.horario || "--:--")}
    </strong>

    <span>
      ${esc(futura.cliente || "Cliente")}
      ${
        futura.tecnico
          ? ` • ${esc(futura.tecnico)}`
          : ""
      }
    </span>
  `;
}

const consulta =
  query(
    collection(
      db,
      "visitas"
    ),
    orderBy(
      "criadoEm",
      "desc"
    )
  );

onSnapshot(
  consulta,
  snapshot => {

    visitas =
      snapshot.docs
        .map(
          d => ({
            id:
              d.id,
            ...d.data()
          })
        );

    render();

  },
  e => {

    console.error(e);

    document
      .getElementById(
        "ultimaAtualizacao"
      )
      .textContent =
        "Falha na conexão";

  }
);

function clock() {
  const d =
    new Date();

  document
    .getElementById(
      "relogio"
    )
    .textContent =
      d.toLocaleTimeString(
        "pt-BR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );

  document
    .getElementById(
      "dataAtual"
    )
    .textContent =
      d.toLocaleDateString(
        "pt-BR",
        {
          weekday: "long",
          day: "2-digit",
          month: "long"
        }
      );
}

clock();

setInterval(
  clock,
  1000
);

setInterval(
  render,
  30000
);

document
  .getElementById(
    "btnFullscreen"
  )
  .addEventListener(
    "click",
    async () => {

      try {

        if (
          !document.fullscreenElement
        ) {
          await document
            .documentElement
            .requestFullscreen();
        } else {
          await document
            .exitFullscreen();
        }

      } catch (e) {
        console.warn(e);
      }

    }
  );
