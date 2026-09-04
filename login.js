import {
  auth
} from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  carregarPerfilAprovado,
  emailCorporativo,
  ADMIN_EMAIL
} from "./auth-service.js";

const email =
  document.getElementById(
    "emailLogin"
  );

const senha =
  document.getElementById(
    "senhaLogin"
  );

const erro =
  document.getElementById(
    "loginErro"
  );

const btn =
  document.getElementById(
    "btnLogin"
  );

const parametros =
  new URLSearchParams(
    window.location.search
  );

const returnTo =
  parametros.get("returnTo") ||
  "dashboard.html";

const motivo =
  parametros.get("motivo");

const mensagens = {

  inativo:
    "Seu usuário está inativo. Procure o administrador do Linche Field.",

  dominio:
    "Acesso permitido somente para contas corporativas @lincheti.com.br.",

  pendente:
    "Sua solicitação ainda está aguardando aprovação do administrador.",

  recusado:
    "Sua solicitação de acesso não foi aprovada. Procure o administrador.",

  "sem-solicitacao":
    "Esta conta ainda não possui uma solicitação de acesso.",

  solicitado:
    "Solicitação criada. Confirme seu e-mail corporativo e aguarde a aprovação."

};

if (
  motivo &&
  mensagens[motivo]
) {

  erro.textContent =
    mensagens[motivo];

}

function ehAdministrador(
  user
) {

  return String(
    user?.email || ""
  )
    .trim()
    .toLowerCase() ===
    ADMIN_EMAIL;

}

/*
 * Se já existir sessão:
 * - Jefferson pode entrar normalmente;
 * - demais usuários precisam ter e-mail verificado;
 * - todos precisam estar aprovados.
 */
onAuthStateChanged(
  auth,
  async user => {

    if (!user) {
      return;
    }

    try {

      if (
        !ehAdministrador(user) &&
        !user.emailVerified
      ) {

        await signOut(auth);

        erro.textContent =
          "Confirme seu e-mail corporativo antes de acessar.";

        return;
      }

      const perfil =
        await carregarPerfilAprovado(
          user
        );

      if (
        perfil?.ativo === false
      ) {

        await signOut(auth);

        erro.textContent =
          "Seu usuário está inativo.";

        return;
      }

      window.location.replace(
        returnTo
      );

    } catch (e) {

      /*
       * Não redireciona automaticamente em caso
       * de solicitação pendente/recusada.
       * A mensagem será apresentada ao efetuar login.
       */
      console.log(
        "[Linche Field] Sessão aguardando validação:",
        e?.message
      );

    }

  }
);

async function entrar() {

  erro.textContent =
    "";

  const emailInformado =
    email.value
      .trim()
      .toLowerCase();

  if (
    !emailInformado ||
    !senha.value
  ) {

    erro.textContent =
      "Informe e-mail e senha.";

    return;

  }

  if (
    !emailCorporativo(
      emailInformado
    )
  ) {

    erro.textContent =
      "Use seu e-mail corporativo @lincheti.com.br.";

    return;

  }

  btn.disabled =
    true;

  btn.textContent =
    "Entrando...";

  try {

    const credencial =
      await signInWithEmailAndPassword(
        auth,
        emailInformado,
        senha.value
      );

    /*
     * IMPORTANTE:
     * Jefferson é a conta administrativa já existente
     * e NÃO fica bloqueado por emailVerified.
     *
     * Novos usuários continuam obrigados a confirmar o e-mail.
     */
    if (
      !ehAdministrador(
        credencial.user
      ) &&
      !credencial.user.emailVerified
    ) {

      await signOut(auth);

      erro.textContent =
        "Confirme seu e-mail corporativo antes de acessar.";

      return;

    }

    const perfil =
      await carregarPerfilAprovado(
        credencial.user
      );

    if (
      perfil?.ativo === false
    ) {

      await signOut(auth);

      erro.textContent =
        "Seu usuário está inativo.";

      return;

    }

    window.location.replace(
      returnTo
    );

  } catch (e) {

    console.error(
      "[Linche Field] Falha no login:",
      e
    );

    const mensagem = {

      ACESSO_PENDENTE:
        "Sua solicitação está aguardando aprovação do administrador.",

      ACESSO_RECUSADO:
        "Sua solicitação de acesso não foi aprovada.",

      SEM_SOLICITACAO:
        "Esta conta ainda não possui uma solicitação de acesso.",

      DOMINIO_NAO_AUTORIZADO:
        "Use seu e-mail corporativo @lincheti.com.br."

    }[e?.message];

    erro.textContent =
      mensagem ||
      "E-mail ou senha inválidos.";

    try {
      await signOut(auth);
    } catch {}

  } finally {

    btn.disabled =
      false;

    btn.textContent =
      "Entrar";

  }

}

btn?.addEventListener(
  "click",
  entrar
);

senha?.addEventListener(
  "keydown",
  evento => {

    if (
      evento.key ===
      "Enter"
    ) {

      entrar();

    }

  }
);
