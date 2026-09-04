import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export const DOMINIO_PERMITIDO = "@lincheti.com.br";
export const ADMIN_EMAIL = "jefferson.bem@lincheti.com.br";

const PERFIS_VALIDOS = [
  "admin",
  "gestor",
  "analista",
  "consulta"
];

let promessaSessao = null;
let sessaoAtual = null;

export function emailCorporativo(email = "") {
  return String(email)
    .trim()
    .toLowerCase()
    .endsWith(DOMINIO_PERMITIDO);
}

export function normalizarPerfil(perfil = "") {
  const normalizado =
    String(perfil)
      .trim()
      .toLowerCase();

  return PERFIS_VALIDOS.includes(normalizado)
    ? normalizado
    : "analista";
}

function nomePorEmail(email = "") {
  const parte =
    String(email)
      .split("@")[0] || "Usuário";

  return parte
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, letra => letra.toUpperCase());
}

async function garantirAdmin(user) {
  const email =
    String(user.email || "")
      .trim()
      .toLowerCase();

  if (email !== ADMIN_EMAIL) {
    return null;
  }

  const ref =
    doc(
      db,
      "usuarios",
      user.uid
    );

  const snap =
    await getDoc(ref);

  if (snap.exists()) {
    const atual =
      snap.data();

    /*
     * Mesmo se o campo tiver sido alterado manualmente,
     * o e-mail administrativo fixo continua sendo admin.
     */
    if (
      normalizarPerfil(
        atual.perfil
      ) !== "admin" ||
      atual.ativo === false
    ) {
      await setDoc(
        ref,
        {
          ...atual,
          nome:
            atual.nome ||
            user.displayName ||
            nomePorEmail(email),
          email,
          cargo:
            atual.cargo ||
            "Administrador",
          perfil:
            "admin",
          ativo:
            true,
          atualizadoEm:
            serverTimestamp()
        },
        {
          merge: true
        }
      );
    }

    return {
      uid: user.uid,
      ...atual,
      nome:
        atual.nome ||
        user.displayName ||
        nomePorEmail(email),
      email,
      cargo:
        atual.cargo ||
        "Administrador",
      perfil:
        "admin",
      ativo:
        true
    };
  }

  const perfilAdmin = {
    nome:
      user.displayName ||
      "Jefferson Bem",
    email,
    cargo:
      "Administrador",
    perfil:
      "admin",
    ativo:
      true,
    criadoEm:
      serverTimestamp(),
    atualizadoEm:
      serverTimestamp()
  };

  await setDoc(
    ref,
    perfilAdmin
  );

  return {
    uid:
      user.uid,
    ...perfilAdmin
  };
}

export async function carregarPerfilAprovado(user) {
  if (!user) {
    return null;
  }

  if (
    !emailCorporativo(
      user.email || ""
    )
  ) {
    throw new Error(
      "DOMINIO_NAO_AUTORIZADO"
    );
  }

  const admin =
    await garantirAdmin(user);

  if (admin) {
    return admin;
  }

  const usuarioRef =
    doc(
      db,
      "usuarios",
      user.uid
    );

  const usuarioSnap =
    await getDoc(
      usuarioRef
    );

  if (
    usuarioSnap.exists()
  ) {
    const dados =
      usuarioSnap.data();

    return {
      uid:
        user.uid,
      ...dados,
      perfil:
        normalizarPerfil(
          dados.perfil
        )
    };
  }

  const solicitacaoRef =
    doc(
      db,
      "solicitacoesAcesso",
      user.uid
    );

  const solicitacaoSnap =
    await getDoc(
      solicitacaoRef
    );

  if (
    solicitacaoSnap.exists()
  ) {
    const solicitacao =
      solicitacaoSnap.data();

    if (
      solicitacao.status ===
      "pendente"
    ) {
      throw new Error(
        "ACESSO_PENDENTE"
      );
    }

    if (
      solicitacao.status ===
      "recusado"
    ) {
      throw new Error(
        "ACESSO_RECUSADO"
      );
    }
  }

  throw new Error(
    "SEM_SOLICITACAO"
  );
}

export async function obterSessao() {
  if (sessaoAtual) {
    return sessaoAtual;
  }

  if (promessaSessao) {
    return promessaSessao;
  }

  promessaSessao =
    new Promise(
      (resolve, reject) => {

        let unsubscribe =
          null;

        unsubscribe =
          onAuthStateChanged(
            auth,
            async user => {

              try {

                if (!user) {
                  sessaoAtual =
                    null;

                  resolve(null);
                  return;
                }

                if (
                  !emailCorporativo(
                    user.email || ""
                  )
                ) {
                  await signOut(auth);

                  resolve(null);
                  return;
                }

                const perfil =
                  await carregarPerfilAprovado(
                    user
                  );

                if (
                  perfil?.ativo ===
                  false
                ) {
                  throw new Error(
                    "USUARIO_INATIVO"
                  );
                }

                sessaoAtual = {
                  user,
                  perfil: {
                    ...perfil,
                    perfil:
                      normalizarPerfil(
                        perfil.perfil
                      )
                  }
                };

                window.LincheAuth =
                  sessaoAtual;

                window.dispatchEvent(
                  new CustomEvent(
                    "linche-auth-ready",
                    {
                      detail:
                        sessaoAtual
                    }
                  )
                );

                resolve(
                  sessaoAtual
                );

              } catch (erro) {
                reject(erro);
              } finally {
                try {
                  unsubscribe?.();
                } catch {}
              }

            },
            reject
          );

      }
    );

  return promessaSessao;
}

export async function exigirAcesso(
  perfisPermitidos = []
) {

  try {

    const sessao =
      await obterSessao();

    if (!sessao) {
      redirecionarLogin(
        "login"
      );
      return new Promise(() => {});
    }

    if (
      perfisPermitidos.length &&
      !perfisPermitidos.includes(
        sessao.perfil.perfil
      )
    ) {
      window.location.replace(
        "dashboard.html?acesso=negado"
      );

      return new Promise(() => {});
    }

    return sessao;

  } catch (erro) {

    const motivo = {
      ACESSO_PENDENTE:
        "pendente",
      ACESSO_RECUSADO:
        "recusado",
      USUARIO_INATIVO:
        "inativo",
      DOMINIO_NAO_AUTORIZADO:
        "dominio",
      SEM_SOLICITACAO:
        "sem-solicitacao"
    }[erro?.message] || "erro";

    try {
      await signOut(auth);
    } catch {}

    redirecionarLogin(
      motivo
    );

    return new Promise(() => {});

  }

}

function redirecionarLogin(
  motivo
) {

  const paginaAtual =
    window.location.pathname
      .split("/")
      .pop() ||
    "dashboard.html";

  const retorno =
    encodeURIComponent(
      paginaAtual +
      window.location.search
    );

  window.location.replace(
    `login.html?motivo=${encodeURIComponent(motivo)}&returnTo=${retorno}`
  );
}

export async function sairDoSistema() {
  sessaoAtual =
    null;

  promessaSessao =
    null;

  await signOut(auth);

  window.location.replace(
    "login.html"
  );
}

export function temPerfil(
  sessao,
  perfis = []
) {
  return perfis.includes(
    normalizarPerfil(
      sessao?.perfil?.perfil
    )
  );
}
