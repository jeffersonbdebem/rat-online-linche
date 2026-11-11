import {
  exigirAcesso,
  sairDoSistema,
  ADMIN_EMAIL
} from "./auth-service.js";

const sessao =
  await exigirAcesso();

if (sessao) {

  const sidebar =
    document.querySelector(
      ".sidebar"
    );

  if (!sidebar) {

    console.error(
      "[Linche Field] Sidebar não encontrada."
    );

  } else {

    const paginaAtual =
      window.location.pathname
        .split("/")
        .pop() ||
      "dashboard.html";

    const perfil =
      String(
        sessao.perfil.perfil ||
        "analista"
      ).toLowerCase();

    const emailAtual =
      String(
        sessao.user.email || ""
      ).toLowerCase();

    const ehAdminFixo =
      emailAtual ===
      ADMIN_EMAIL;

    const itensMenu = [
      {
        nome: "Dashboard",
        arquivo: "dashboard.html",
        icone: "⌂",
        perfis: ["admin","gestor","analista","consulta"]
      },
      {
        nome: "Visitas",
        arquivo: "kanban.html",
        icone: "▦",
        perfis: ["admin","gestor","analista"]
      },
      {
        nome: "Painel TV",
        arquivo: "painel-tv.html",
        icone: "▣",
        perfis: ["admin","gestor","analista","consulta"]
      },
      {
        nome: "Nova RAT",
        arquivo: "index.html",
        icone: "+",
        perfis: ["admin","gestor","analista"]
      },
      {
        nome: "Histórico",
        arquivo: "historico.html",
        icone: "◷",
        perfis: ["admin","gestor","analista","consulta"]
      },
      {
        nome: "Clientes",
        arquivo: "clientes.html",
        icone: "◇",
        perfis: ["admin","gestor","analista","consulta"]
      },
      {
        nome: "Equipamentos",
        arquivo: "equipamentos.html",
        icone: "▣",
        perfis: ["admin","gestor","analista","consulta"]
      },
      {
        nome: "Relatórios",
        arquivo: "relatorios.html",
        icone: "▥",
        perfis: ["admin","gestor","consulta"]
      }
    ];

    itensMenu.push({
      nome: "Sobre",
      arquivo: "sobre.html",
      icone: "ⓘ",
      perfis: ["admin","gestor","analista","consulta"]
    });

    if (ehAdminFixo) {
      itensMenu.push({
        nome: "Acessos",
        arquivo: "admin-acessos.html",
        icone: "⚙",
        perfis: ["admin"]
      });

      itensMenu.push({
        nome: "Usuários",
        arquivo: "usuarios.html",
        icone: "♙",
        perfis: ["admin"]
      });

      itensMenu.push({
        nome: "Integrações",
        arquivo: "integracoes.html",
        icone: "⇄",
        perfis: ["admin"]
      });
    }

    const menuHtml =
      itensMenu
        .filter(
          item =>
            item.perfis.includes(
              perfil
            )
        )
        .map(
          item => {

            const ativo =
              paginaAtual ===
              item.arquivo
                ? "active"
                : "";

            return `
              <a
                href="${item.arquivo}"
                class="${ativo}"
              >
                <span class="nav-icon">
                  ${item.icone}
                </span>

                <span class="nav-label">
                  ${item.nome}
                </span>
              </a>
            `;

          }
        )
        .join("");

    const nome =
      sessao.perfil.nome ||
      sessao.user.email ||
      "Usuário";

    const perfilLabel = {
      admin:
        "Administrador",

      gestor:
        "Gestor",

      analista:
        "Analista",

      consulta:
        "Consulta"
    }[perfil] || "Analista";

    sidebar.innerHTML = `
      <a
        href="dashboard.html"
        class="brand"
      >
        <img
          src="assets/logo-linche-icone.jpeg"
          class="brand-logo"
          alt="Linche Tecnologia"
        >

        <div class="brand-text">
          <strong>Linche</strong>
          <small>FIELD</small>
        </div>
      </a>

      <nav class="nav-menu">
        ${menuHtml}
      </nav>

      <div class="sidebar-user">

        <div class="sidebar-user-avatar">
          ${iniciais(nome)}
        </div>

        <div class="sidebar-user-info">
          <strong>
            ${escapar(nome)}
          </strong>

          <small>
            ${escapar(perfilLabel)}
          </small>
        </div>

        <button
          type="button"
          class="sidebar-logout"
          id="lincheLogout"
          title="Sair"
          aria-label="Sair"
        >
          ↪
        </button>

      </div>

      <div class="sidebar-footer-logo">
        <img
          src="assets/logo-linche-horizontal.png"
          alt="Linche Tecnologia"
        >
        <small class="sidebar-developer-credit">Desenvolvido por<br><strong>Jefferson Bruno de Bem</strong></small>
      </div>
    `;

    document
      .getElementById(
        "lincheLogout"
      )
      ?.addEventListener(
        "click",
        async () => {
          await sairDoSistema();
        }
      );

  }

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

function escapar(texto = "") {
  const div =
    document.createElement("div");

  div.textContent =
    texto;

  return div.innerHTML;
}
