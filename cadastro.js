import {
  auth,
  db
} from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
  emailCorporativo,
  ADMIN_EMAIL
} from "./auth-service.js";

const form =
  document.getElementById(
    "cadastroForm"
  );

const nome =
  document.getElementById(
    "nomeCadastro"
  );

const cargo =
  document.getElementById(
    "cargoCadastro"
  );

const email =
  document.getElementById(
    "emailCadastro"
  );

const senha =
  document.getElementById(
    "senhaCadastro"
  );

const confirmarSenha =
  document.getElementById(
    "confirmarSenhaCadastro"
  );

const erro =
  document.getElementById(
    "cadastroErro"
  );

const sucesso =
  document.getElementById(
    "cadastroSucesso"
  );

const botao =
  document.getElementById(
    "btnSolicitarAcesso"
  );

const PERFIL_POR_CARGO = {
  "Analista de Suporte":
    "analista",

  "Técnico de Campo":
    "analista",

  "Coordenador Técnico":
    "gestor",

  "Gestor":
    "gestor",

  "Administrativo":
    "consulta",

  "Financeiro":
    "consulta",

  "Comercial":
    "consulta"
};

form.addEventListener(
  "submit",
  solicitarAcesso
);

async function solicitarAcesso(
  evento
) {

  evento.preventDefault();

  erro.textContent =
    "";

  sucesso.textContent =
    "";

  const nomeInformado =
    nome.value.trim();

  const cargoInformado =
    cargo.value;

  const emailInformado =
    email.value
      .trim()
      .toLowerCase();

  if (
    !nomeInformado ||
    !cargoInformado ||
    !emailInformado ||
    !senha.value ||
    !confirmarSenha.value
  ) {
    erro.textContent =
      "Preencha todos os campos.";
    return;
  }

  if (
    !emailCorporativo(
      emailInformado
    )
  ) {
    erro.textContent =
      "Use somente um e-mail corporativo @lincheti.com.br.";
    return;
  }

  if (
    emailInformado ===
    ADMIN_EMAIL
  ) {
    erro.textContent =
      "A conta administrativa não pode ser criada por esta tela.";
    return;
  }

  if (
    senha.value.length < 8
  ) {
    erro.textContent =
      "A senha deve possuir pelo menos 8 caracteres.";
    return;
  }

  if (
    senha.value !==
    confirmarSenha.value
  ) {
    erro.textContent =
      "As senhas não conferem.";
    return;
  }

  const perfilSolicitado =
    PERFIL_POR_CARGO[
      cargoInformado
    ];

  if (!perfilSolicitado) {
    erro.textContent =
      "Cargo inválido.";
    return;
  }

  botao.disabled =
    true;

  botao.textContent =
    "Criando solicitação...";

  try {

    const credencial =
      await createUserWithEmailAndPassword(
        auth,
        emailInformado,
        senha.value
      );

    await updateProfile(
      credencial.user,
      {
        displayName:
          nomeInformado
      }
    );

    await setDoc(
      doc(
        db,
        "solicitacoesAcesso",
        credencial.user.uid
      ),
      {
        uid:
          credencial.user.uid,

        nome:
          nomeInformado,

        cargo:
          cargoInformado,

        email:
          emailInformado,

        perfilSolicitado:
          perfilSolicitado,

        status:
          "pendente",

        emailVerificado:
          false,

        criadoEm:
          serverTimestamp(),

        atualizadoEm:
          serverTimestamp()
      }
    );

    try {

      await sendEmailVerification(
        credencial.user
      );

    } catch (
      erroVerificacao
    ) {

      console.warn(
        "[Linche Field] Não foi possível enviar o e-mail de verificação:",
        erroVerificacao
      );

    }

    await signOut(auth);

    form.reset();

    sucesso.innerHTML = `
      Solicitação criada com sucesso.<br>
      Verifique seu e-mail corporativo e aguarde a aprovação do administrador.
    `;

    setTimeout(
      () => {
        window.location.href =
          "login.html?motivo=solicitado";
      },
      3500
    );

  } catch (e) {

    console.error(
      "[Linche Field] Erro no cadastro:",
      e
    );

    if (
      e?.code ===
      "auth/email-already-in-use"
    ) {
      erro.textContent =
        "Já existe uma conta com este e-mail.";
    } else if (
      e?.code ===
      "auth/weak-password"
    ) {
      erro.textContent =
        "A senha informada é muito fraca.";
    } else {
      erro.textContent =
        "Não foi possível criar a solicitação. Tente novamente.";
    }

  } finally {

    botao.disabled =
      false;

    botao.textContent =
      "Solicitar acesso";

  }

}
