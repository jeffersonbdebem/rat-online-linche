import { exigirAcesso } from "./auth-service.js";
const sessao = await exigirAcesso(["admin","gestor","analista"]);

import { db } from "./firebase-config.js";

import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const STATUS = [
    "agendada",
    "em_rota",
    "em_atendimento",
    "finalizacao",
    "concluida"
];

const STATUS_LABEL = {
    agendada: "Agendada",
    em_rota: "Em rota",
    em_atendimento: "Em atendimento",
    finalizacao: "Finalização",
    concluida: "Concluída"
};

const visitasRef = collection(db, "visitas");

let visitas = [];

const $ = id =>
    document.getElementById(id);

const modal =
    $("modalVisita");

const form =
    $("formVisita");

function hojeISO() {

    const data = new Date();

    return [
        data.getFullYear(),
        String(data.getMonth() + 1).padStart(2, "0"),
        String(data.getDate()).padStart(2, "0")
    ].join("-");

}

function escapar(texto = "") {

    const elemento =
        document.createElement("div");

    elemento.textContent = texto;

    return elemento.innerHTML;

}

function iniciais(nome = "") {

    return nome
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(parte =>
            parte[0]?.toUpperCase()
        )
        .join("") || "TI";

}

function formatarData(data) {

    if (!data) {
        return "Sem data";
    }

    const [
        ano,
        mes,
        dia
    ] = data.split("-");

    return `${dia}/${mes}/${ano}`;

}

function estaAtrasada(visita) {

    /*
     * Atraso é operacionalmente relevante apenas enquanto a visita
     * ainda não iniciou. A partir de Em atendimento, o horário agendado
     * deixa de representar atraso de chegada.
     */
    if (
        !["agendada", "em_rota"].includes(visita.status) ||
        !visita.data
    ) {
        return false;
    }

    const limite = new Date(
        `${visita.data}T${visita.horario || "23:59"}:00`
    );

    return limite.getTime() <
        Date.now();

}

function mostrarToast(
    mensagem,
    erro = false
) {

    const toast =
        $("toast");

    toast.textContent =
        mensagem;

    toast.className =
        `toast show${erro ? " error" : ""}`;

    clearTimeout(
        mostrarToast.timer
    );

    mostrarToast.timer =
        setTimeout(() => {

            toast.className =
                "toast";

        }, 2600);

}

function abrirModal(
    visita = null
) {

    form.reset();

    $("visitaId").value =
        visita?.id || "";

    $("tituloModal").textContent =
        visita
            ? "Editar visita"
            : "Nova visita";

    $("btnExcluir").classList.toggle(
        "hidden",
        !visita ||
        !["admin", "gestor"].includes(
            sessao.perfil.perfil
        )
    );

    if (visita) {

        const campos = [
            "cliente",
            "data",
            "horario",
            "tecnico",
            "prioridade",
            "contato",
            "telefone",
            "endereco",
            "problema",
            "observacoes"
        ];

        campos.forEach(campo => {

            $(campo).value =
                visita[campo] || "";

        });

    } else {

        $("data").value =
            hojeISO();

        $("prioridade").value =
            "media";

        if (
            sessao?.perfil?.nome &&
            $("tecnico")
        ) {
            $("tecnico").value =
                sessao.perfil.nome;
        }

    }

    modal.classList.remove(
        "hidden"
    );

}

function fecharModal() {

    modal.classList.add(
        "hidden"
    );

    form.reset();

}

function passaFiltro(visita) {

    const busca =
        $("filtroBusca")
            .value
            .trim()
            .toLowerCase();

    const tecnico =
        $("filtroTecnico").value;

    const prioridade =
        $("filtroPrioridade").value;

    const filtroData =
        $("filtroData").value;

    const texto = [
        visita.cliente,
        visita.endereco,
        visita.tecnico,
        visita.problema
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    if (
        busca &&
        !texto.includes(busca)
    ) {
        return false;
    }

    if (
        tecnico !== "todos" &&
        visita.tecnico !== tecnico
    ) {
        return false;
    }

    if (
        prioridade !== "todas" &&
        visita.prioridade !== prioridade
    ) {
        return false;
    }

    if (
        filtroData === "hoje" &&
        visita.data !== hojeISO()
    ) {
        return false;
    }

    if (
        filtroData === "semana"
    ) {

        const agora =
            new Date();

        const inicio =
            new Date(agora);

        inicio.setHours(
            0,
            0,
            0,
            0
        );

        inicio.setDate(
            agora.getDate() -
            agora.getDay()
        );

        const fim =
            new Date(inicio);

        fim.setDate(
            inicio.getDate() + 6
        );

        fim.setHours(
            23,
            59,
            59,
            999
        );

        const dataVisita =
            new Date(
                `${visita.data}T12:00:00`
            );

        if (
            dataVisita < inicio ||
            dataVisita > fim
        ) {
            return false;
        }

    }

    return true;

}

function criarCard(visita) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "visit-card";

    card.draggable =
        true;

    card.dataset.id =
        visita.id;

    card.innerHTML = `

        <div class="card-top">

            <div class="card-client">
                ${escapar(
                    visita.cliente ||
                    "Cliente não informado"
                )}
            </div>

            <span class="priority ${escapar(
                visita.prioridade ||
                "media"
            )}">
                ${escapar(
                    visita.prioridade ||
                    "Média"
                )}
            </span>

        </div>

        <p class="card-problem">
            ${escapar(
                visita.problema ||
                "Sem descrição"
            )}
        </p>

        <div class="card-meta">

            <div>
                ◷
                ${formatarData(
                    visita.data
                )}
                às
                ${escapar(
                    visita.horario ||
                    "--:--"
                )}
            </div>

            <div>
                ⌖
                ${escapar(
                    visita.endereco ||
                    "Endereço não informado"
                )}
            </div>

        </div>

        <div class="card-footer">

            <div class="technician">

                <span class="avatar">
                    ${iniciais(
                        visita.tecnico
                    )}
                </span>

                ${escapar(
                    visita.tecnico ||
                    "Sem técnico"
                )}

            </div>

            <div class="card-footer-actions">

                <div class="status-quick-wrap">
                    <button
                        type="button"
                        class="status-quick-button"
                        data-status-toggle="${visita.id}"
                        aria-label="Alterar etapa da visita"
                    >
                        ${escapar(STATUS_LABEL[visita.status] || visita.status || "Etapa")} ▾
                    </button>
                    <div class="status-quick-menu" data-status-menu="${visita.id}">
                        ${STATUS.map(status => `
                            <button
                                type="button"
                                class="status-quick-option ${visita.status === status ? "active" : ""}"
                                data-set-status="${status}"
                                data-visita-id="${visita.id}"
                            >
                                ${escapar(STATUS_LABEL[status])}
                            </button>
                        `).join("")}
                    </div>
                </div>

                ${
                    estaAtrasada(visita)
                        ? `
                            <span class="late-label">
                                ATRASADA
                            </span>
                        `
                        : ""
                }

                ${
                    visita.status === "finalizacao" && !visita.ratFinalizada
                        ? `
                            <button
                                type="button"
                                class="card-rat-button"
                                data-abrir-rat="${visita.id}"
                            >
                                Abrir RAT
                            </button>
                        `
                        : ""
                }

                ${
                    visita.ratFinalizada
                        ? `
                            <span class="rat-linked">
                                RAT ${escapar(visita.ratNumero || "vinculada")}
                            </span>
                        `
                        : ""
                }

            </div>

        </div>

    `;

    const botaoRat =
        card.querySelector(
            "[data-abrir-rat]"
        );

    if (botaoRat) {

        botaoRat.addEventListener(
            "click",
            evento => {

                evento.stopPropagation();

                abrirRatVinculada(
                    visita,
                    visita.destinoAposRat || "finalizacao"
                );

            }
        );

    }

    const botaoStatus = card.querySelector("[data-status-toggle]");
    const menuStatus = card.querySelector("[data-status-menu]");

    if (botaoStatus && menuStatus) {
        botaoStatus.addEventListener("click", evento => {
            evento.stopPropagation();
            document.querySelectorAll(".status-quick-menu.open").forEach(menu => {
                if (menu !== menuStatus) menu.classList.remove("open");
            });
            menuStatus.classList.toggle("open");
        });

        menuStatus.querySelectorAll("[data-set-status]").forEach(opcao => {
            opcao.addEventListener("click", async evento => {
                evento.stopPropagation();
                menuStatus.classList.remove("open");
                const novoStatus = opcao.dataset.setStatus;
                if (!novoStatus || novoStatus === visita.status) return;
                await moverVisita(visita.id, novoStatus);
            });
        });
    }

    card.addEventListener(
        "click",
        () => abrirModal(visita)
    );

    card.addEventListener(
        "dragstart",
        evento => {

            card.classList.add(
                "dragging"
            );

            evento
                .dataTransfer
                .setData(
                    "text/plain",
                    visita.id
                );

        }
    );

    card.addEventListener(
        "dragend",
        () => {

            card.classList.remove(
                "dragging"
            );

        }
    );

    return card;

}

function atualizarTecnicos() {

    const tecnicoAtual =
        $("filtroTecnico").value;

    const tecnicos = [
        ...new Set(
            visitas
                .map(visita =>
                    visita.tecnico
                )
                .filter(Boolean)
        )
    ].sort(
        (a, b) =>
            a.localeCompare(b)
    );

    $("filtroTecnico").innerHTML = `

        <option value="todos">
            Todos os técnicos
        </option>

        ${tecnicos
            .map(tecnico => `

                <option value="${escapar(tecnico)}">
                    ${escapar(tecnico)}
                </option>

            `)
            .join("")}

    `;

    if (
        tecnicos.includes(
            tecnicoAtual
        )
    ) {

        $("filtroTecnico").value =
            tecnicoAtual;

    }

}

function renderizar() {

    const visitasFiltradas =
        visitas.filter(
            passaFiltro
        );

    STATUS.forEach(status => {

        const coluna =
            document.querySelector(
                `[data-status="${status}"]`
            );

        const lista =
            coluna.querySelector(
                ".card-list"
            );

        const itens =
            visitasFiltradas.filter(
                visita =>
                    visita.status === status
            );

        coluna
            .querySelector(
                ".column-count"
            )
            .textContent =
                itens.length;

        lista.innerHTML =
            "";

        if (!itens.length) {

            lista.innerHTML = `

                <div class="empty-state">
                    Arraste uma visita para esta etapa
                </div>

            `;

        }

        itens.forEach(visita => {

            lista.appendChild(
                criarCard(visita)
            );

        });

    });

    $("totalVisitas").textContent =
        visitasFiltradas.length;

    $("totalCampo").textContent =
        visitasFiltradas.filter(
            visita =>
                [
                    "em_rota",
                    "em_atendimento",
                    "finalizacao"
                ].includes(
                    visita.status
                )
        ).length;

    $("totalAtrasadas").textContent =
        visitasFiltradas.filter(
            estaAtrasada
        ).length;

    $("totalConcluidas").textContent =
        visitasFiltradas.filter(
            visita =>
                visita.status ===
                "concluida"
        ).length;

}

async function salvarVisita(
    evento
) {

    evento.preventDefault();

    const id =
        $("visitaId").value;

    const dados = {

        cliente:
            $("cliente").value.trim(),

        data:
            $("data").value,

        horario:
            $("horario").value,

        tecnico:
            $("tecnico").value.trim(),

        prioridade:
            $("prioridade").value,

        contato:
            $("contato").value.trim(),

        telefone:
            $("telefone").value.trim(),

        endereco:
            $("endereco").value.trim(),

        problema:
            $("problema").value.trim(),

        observacoes:
            $("observacoes").value.trim(),

        atualizadoPorUid:
            sessao.user.uid,

        atualizadoPorNome:
            sessao.perfil.nome,

        atualizadoPorEmail:
            sessao.user.email || "",

        atualizadoEm:
            serverTimestamp()

    };

    try {

        $("btnSalvar").disabled =
            true;

        $("btnSalvar").textContent =
            "Salvando...";

        if (id) {

            await updateDoc(
                doc(
                    db,
                    "visitas",
                    id
                ),
                dados
            );

            mostrarToast(
                "Visita atualizada."
            );

        } else {

            await addDoc(
                visitasRef,
                {
                    ...dados,

                    status:
                        "agendada",

                    criadoPorUid:
                        sessao.user.uid,

                    criadoPorNome:
                        sessao.perfil.nome,

                    criadoPorEmail:
                        sessao.user.email || "",

                    criadoEm:
                        serverTimestamp()
                }
            );

            mostrarToast(
                "Visita criada."
            );

        }

        fecharModal();

    } catch (erro) {

        console.error(erro);

        mostrarToast(
            "Erro ao salvar visita.",
            true
        );

    } finally {

        $("btnSalvar").disabled =
            false;

        $("btnSalvar").textContent =
            "Salvar visita";

    }

}

async function excluirVisita() {

    const id =
        $("visitaId").value;

    if (
        !id ||
        !confirm(
            "Deseja excluir esta visita?"
        )
    ) {
        return;
    }

    try {

        await deleteDoc(
            doc(
                db,
                "visitas",
                id
            )
        );

        fecharModal();

        mostrarToast(
            "Visita excluída."
        );

    } catch (erro) {

        console.error(erro);

        mostrarToast(
            "Erro ao excluir visita.",
            true
        );

    }

}


function abrirRatVinculada(visita, destino = "finalizacao") {
    if (!visita?.id) {
        mostrarToast("Não foi possível identificar a visita.", true);
        return;
    }

    const url =
        `index.html?visitaId=${encodeURIComponent(visita.id)}&destino=${encodeURIComponent(destino)}`;

    console.log("[Linche Field] Abrindo RAT vinculada:", url);

    window.location.assign(url);
}

async function moverVisita(
    id,
    novoStatus
) {

    if (!id) {
        return;
    }

    const visita = visitas.find(
        item => item.id === id
    );

    if (!visita) {
        mostrarToast(
            "Visita não encontrada.",
            true
        );
        return;
    }

    /*
     * FINALIZAÇÃO / CONCLUSÃO:
     * Se ainda não existe RAT finalizada, abre a RAT obrigatoriamente.
     */
    if (
        (
            novoStatus === "finalizacao" ||
            novoStatus === "concluida"
        ) &&
        !visita.ratFinalizada
    ) {

        const destinoRat =
            novoStatus;

        /*
         * Primeiro mudamos visualmente para Finalização.
         * Mesmo que o Firestore apresente falha momentânea,
         * a RAT ainda será aberta para o técnico não ficar travado.
         */
        try {

            await updateDoc(
                doc(
                    db,
                    "visitas",
                    id
                ),
                {
                    status:
                        "finalizacao",

                    destinoAposRat:
                        destinoRat,

                    atualizadoEm:
                        serverTimestamp(),

                    "horariosStatus.finalizacao":
                        serverTimestamp()
                }
            );

        } catch (erroAtualizacao) {

            console.warn(
                "[Linche Field] Não foi possível atualizar a visita antes de abrir a RAT:",
                erroAtualizacao
            );

        }

        abrirRatVinculada(
            visita,
            destinoRat
        );

        return;
    }

    try {

        await updateDoc(
            doc(
                db,
                "visitas",
                id
            ),
            {
                status:
                    novoStatus,

                atualizadoEm:
                    serverTimestamp(),

                [`horariosStatus.${novoStatus}`]:
                    serverTimestamp()
            }
        );

        mostrarToast(
            "Etapa atualizada."
        );

    } catch (erro) {

        console.error(
            "Erro ao mover visita:",
            erro
        );

        mostrarToast(
            "Erro ao mover visita.",
            true
        );

    }

}

document
    .querySelectorAll(
        "[data-dropzone]"
    )
    .forEach(zona => {

        zona.addEventListener(
            "dragover",
            evento => {

                evento.preventDefault();

                zona.classList.add(
                    "drag-over"
                );

            }
        );

        zona.addEventListener(
            "dragleave",
            () => {

                zona.classList.remove(
                    "drag-over"
                );

            }
        );

        zona.addEventListener(
            "drop",
            evento => {

                evento.preventDefault();

                zona.classList.remove(
                    "drag-over"
                );

                const visitaId =
                    evento
                        .dataTransfer
                        .getData(
                            "text/plain"
                        );

                moverVisita(
                    visitaId,
                    zona.dataset.dropzone
                );

            }
        );

    });

$("btnNovaVisita")
    .addEventListener(
        "click",
        () => abrirModal()
    );

$("btnAtualizar")
    .addEventListener(
        "click",
        renderizar
    );

$("btnExcluir")
    .addEventListener(
        "click",
        excluirVisita
    );

form.addEventListener(
    "submit",
    salvarVisita
);

document
    .querySelectorAll(
        "[data-close-modal]"
    )
    .forEach(elemento => {

        elemento.addEventListener(
            "click",
            fecharModal
        );

    });

[
    "filtroBusca",
    "filtroData",
    "filtroTecnico",
    "filtroPrioridade"
].forEach(id => {

    $(id).addEventListener(
        "input",
        renderizar
    );

});

document.addEventListener(
    "keydown",
    evento => {

        if (
            evento.key === "Escape"
        ) {

            fecharModal();

        }

    }
);

const consulta =
    query(
        visitasRef,
        orderBy(
            "criadoEm",
            "desc"
        )
    );

onSnapshot(
    consulta,

    resultado => {

        visitas =
            resultado.docs.map(
                documento => ({
                    id: documento.id,
                    ...documento.data()
                })
            );

        atualizarTecnicos();

        renderizar();

    },

    erro => {

        console.error(erro);

        mostrarToast(
            "Erro ao carregar visitas. Verifique o Firebase.",
            true
        );

    }
);