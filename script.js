import { exigirAcesso } from "./auth-service.js";
const sessao = await exigirAcesso(["admin","gestor","analista"]);

import { db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

console.log("SCRIPT RAT CARREGADO COM FIREBASE");

// =========================================================
// CONTEXTO DA VISITA
// =========================================================

const parametrosUrl = new URLSearchParams(window.location.search);

let contextoVisita = {
  visitaId: parametrosUrl.get("visitaId") || "",
  destino: parametrosUrl.get("destino") || "finalizacao",
  visita: null
};

// =========================================================
// ASSINATURA
// =========================================================

const canvas = document.getElementById("signaturePad");

const signaturePad = new SignaturePad(canvas, {
  backgroundColor: "rgb(255,255,255)"
});

function resizeCanvas() {

  const assinaturaAtual =
    !signaturePad.isEmpty()
      ? signaturePad.toData()
      : null;

  const ratio =
    Math.max(
      window.devicePixelRatio || 1,
      1
    );

  const larguraCss =
    canvas.offsetWidth;

  const alturaCss =
    canvas.offsetHeight;

  canvas.width =
    Math.round(
      larguraCss * ratio
    );

  canvas.height =
    Math.round(
      alturaCss * ratio
    );

  const contexto =
    canvas.getContext("2d");

  contexto.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );

  signaturePad.clear();

  if (assinaturaAtual) {
    signaturePad.fromData(
      assinaturaAtual
    );
  }
}

window.addEventListener(
  "resize",
  resizeCanvas
);

resizeCanvas();

// =========================================================
// HELPERS
// =========================================================

function val(id) {
  return document.getElementById(id)?.value || "";
}

function radio(name) {
  return document.querySelector(
    `input[name="${name}"]:checked`
  )?.value || "";
}

function checks(name) {
  return [
    ...document.querySelectorAll(
      `input[name="${name}"]:checked`
    )
  ]
    .map(item => item.value)
    .join(", ");
}

function preencher(id, valor) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return;
  }

  const elemento =
    document.getElementById(id);

  if (elemento) {
    elemento.value =
      valor;
  }
}

function limparAssinatura() {
  signaturePad.clear();
}

function limparFormulario() {
  document
    .getElementById("ratForm")
    .reset();

  signaturePad.clear();
}

// =========================================================
// CARREGAR VISITA NA RAT
// =========================================================

async function carregarVisitaVinculada() {

  if (!contextoVisita.visitaId) {
    return;
  }

  try {

    const referenciaVisita =
      doc(
        db,
        "visitas",
        contextoVisita.visitaId
      );

    const snapshotVisita =
      await getDoc(
        referenciaVisita
      );

    if (!snapshotVisita.exists()) {
      alert(
        "A visita vinculada não foi encontrada."
      );
      return;
    }

    const visita = {
      id: snapshotVisita.id,
      ...snapshotVisita.data()
    };

    contextoVisita.visita =
      visita;

    let clienteCadastro =
      null;

    if (visita.cliente) {

      try {

        const consultaCliente =
          query(
            collection(
              db,
              "clientes"
            ),
            where(
              "razaoSocial",
              "==",
              visita.cliente
            ),
            limit(1)
          );

        const resultadoCliente =
          await getDocs(
            consultaCliente
          );

        if (!resultadoCliente.empty) {

          clienteCadastro = {
            id:
              resultadoCliente
                .docs[0]
                .id,

            ...resultadoCliente
              .docs[0]
              .data()
          };

        }

      } catch (erroCliente) {

        // Se o cadastro não for localizado, a RAT continua com os dados da visita.
        console.warn(
          "Não foi possível localizar o cadastro completo do cliente:",
          erroCliente
        );

      }

    }

    preencher(
      "cliente",
      visita.cliente
    );

    preencher(
      "documento",
      clienteCadastro?.cnpj
    );

    preencher(
      "endereco",
      clienteCadastro?.endereco ||
      visita.endereco
    );

    preencher(
      "cidade",
      clienteCadastro?.cidade
    );

    preencher(
      "cep",
      clienteCadastro?.cep
    );

    preencher(
      "solicitante",
      clienteCadastro?.contato ||
      visita.contato
    );

    preencher(
      "email",
      clienteCadastro?.email
    );

    preencher(
      "fone",
      clienteCadastro?.fone ||
      visita.telefone
    );

    preencher(
      "problema",
      visita.problema
    );

    preencher(
      "tecnicos",
      visita.tecnico
    );

    if (visita.data) {

      preencher(
        "abertura",
        `${visita.data}T${visita.horario || "08:00"}`
      );

    }

    // Em visita de campo, deixa o atendimento marcado como Visita Técnica.
    const visitaTecnica =
      document.querySelector(
        'input[name="atendimento"][value="Visita Técnica"]'
      );

    if (visitaTecnica) {
      visitaTecnica.checked =
        true;
    }

    exibirBannerDaVisita(
      visita
    );

  } catch (erro) {

    console.error(
      "Erro ao carregar visita vinculada:",
      erro
    );

    alert(
      "Não foi possível carregar os dados da visita."
    );

  }
}

function exibirBannerDaVisita(
  visita
) {

  const formulario =
    document.getElementById(
      "ratForm"
    );

  if (!formulario) {
    return;
  }

  if (
    document.getElementById(
      "bannerVisitaRat"
    )
  ) {
    return;
  }

  const banner =
    document.createElement(
      "div"
    );

  banner.id =
    "bannerVisitaRat";

  banner.className =
    "visita-rat-banner";

  const destinoTexto =
    contextoVisita.destino ===
    "concluida"
      ? "Conclusão"
      : "Finalização";

  banner.innerHTML = `
    <strong>
      RAT vinculada a uma visita técnica
    </strong>

    <span>
      ${visita.cliente || "Cliente"} •
      ${visita.tecnico || "Técnico"} •
      Após gerar a RAT: ${destinoTexto}
    </span>

    <a href="kanban.html">
      ← Voltar ao Kanban
    </a>
  `;

  formulario.prepend(
    banner
  );
}

// =========================================================
// SALVAR RAT
// =========================================================

async function salvarRatNoFirestore() {

  const rat =
    document
      .getElementById(
        "ratNumero"
      )
      ?.innerText || "";

  const sequencial =
    Number(
      rat.split("-")[2] || 0
    );

  const dadosRat = {

    numero:
      rat,

    sequencial,

    visitaId:
      contextoVisita.visitaId || null,

    origem:
      contextoVisita.visitaId
        ? "visita"
        : "manual",

    cliente:
      val("cliente"),

    documento:
      val("documento"),

    endereco:
      val("endereco"),

    cidade:
      val("cidade"),

    cep:
      val("cep"),

    solicitante:
      val("solicitante"),

    email:
      val("email"),

    fone:
      val("fone"),

    abertura:
      val("abertura"),

    tag:
      val("tag"),

    valor:
      val("valor"),

    pecas:
      checks("pecas"),

    outros:
      val("outros"),

    problema:
      val("problema"),

    solucao:
      val("solucao"),

    obs:
      val("obs"),

    atendimento:
      radio("atendimento"),

    status:
      radio("status"),

    finalizado:
      document
        .getElementById(
          "finalizado"
        )
        ?.checked || false,

    entreguePor:
      val("entreguePor"),

    tecnicos:
      val("tecnicos"),

    final:
      val("final"),

    rg:
      val("rg"),

    assinaturaData:
      val("assinaturaData"),

    assinaturaImagem:
      signaturePad.isEmpty()
        ? ""
        : signaturePad.toDataURL(
            "image/png"
          ),

    criadoPorUid:
      sessao.user.uid,

    criadoPorNome:
      sessao.perfil.nome,

    criadoPorEmail:
      sessao.user.email || "",

    criadoEm:
      serverTimestamp()

  };

  const referencia =
    await addDoc(
      collection(
        db,
        "rats"
      ),
      dadosRat
    );

  console.log(
    "RAT salva no Firestore:",
    referencia.id,
    dadosRat
  );

  return {
    referencia,
    dadosRat
  };
}

// =========================================================
// VINCULAR RAT À VISITA
// =========================================================

async function finalizarVinculoComVisita(
  ratId,
  numeroRat
) {

  if (
    !contextoVisita.visitaId
  ) {
    return;
  }

  const destino =
    contextoVisita.destino ===
    "concluida"
      ? "concluida"
      : "finalizacao";

  const dadosVisita = {

    ratId:
      ratId,

    ratNumero:
      numeroRat,

    ratFinalizada:
      true,

    assinaturaColetada:
      !signaturePad.isEmpty(),

    pdfGerado:
      true,

    status:
      destino,

    destinoAposRat:
      null,

    atualizadoEm:
      serverTimestamp(),

    [`horariosStatus.${destino}`]:
      serverTimestamp()

  };

  if (
    destino ===
    "concluida"
  ) {

    dadosVisita.finalizadaEm =
      serverTimestamp();

  }

  await updateDoc(
    doc(
      db,
      "visitas",
      contextoVisita.visitaId
    ),
    dadosVisita
  );

}

// =========================================================
// GERAR PDF
// =========================================================

let gerandoPdf =
  false;

async function gerarPDF() {

  if (gerandoPdf) {
    return;
  }

  gerandoPdf =
    true;

  let salvamento;

  try {

    salvamento =
      await salvarRatNoFirestore();

  } catch (erro) {

    console.error(
      "Erro ao salvar no Firestore:",
      erro
    );

    alert(
      "Erro ao salvar a RAT. Verifique a conexão e tente novamente."
    );

    gerandoPdf =
      false;

    return;
  }

  try {

    const { jsPDF } =
      window.jspdf;

    const pdf =
      new jsPDF(
        "p",
        "mm",
        "a4"
      );

    const logo =
      await carregarImagem(
        "assets/logo-linche.png"
      );

    const rat =
      salvamento.dadosRat.numero;

    pdf.addImage(
      logo,
      "PNG",
      12,
      10,
      70,
      24
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setTextColor(
      0,
      100,
      55
    );

    pdf.setFontSize(10);

    pdf.text(
      "LINCHE INFORMATICA LTDA ME",
      92,
      12
    );

    pdf.setTextColor(
      20,
      20,
      20
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.text(
      "CNPJ: 07.138.235/0001-93",
      92,
      17
    );

    pdf.text(
      "R. Dr. Joaquim de Souza Campos Júnior, 74",
      92,
      22
    );

    pdf.text(
      "CEP: 13070-718 Bonfim - Campinas/SP",
      92,
      27
    );

    pdf.text(
      "Tel: (19) 3241-3200 | financeiro@lincheti.com.br",
      92,
      32
    );

    pdf.rect(
      165,
      10,
      32,
      22
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.text(
      "RAT Nº",
      174,
      17
    );

    pdf.setTextColor(
      0,
      100,
      55
    );

    pdf.setFontSize(8);

    pdf.text(
      rat,
      166.5,
      25,
      {
        maxWidth: 29
      }
    );

    pdf.setTextColor(
      20,
      20,
      20
    );

    titulo(
      pdf,
      "RELATÓRIO DE ATENDIMENTO TÉCNICO",
      42
    );

    secao(
      pdf,
      "IDENTIFICAÇÃO DO CLIENTE",
      52
    );

    linha(
      pdf,
      12,
      57,
      186,
      10,
      [
        [
          "NOME / RAZÃO SOCIAL:",
          val("cliente")
        ],
        [
          "CPF / CNPJ:",
          val("documento")
        ]
      ]
    );

    linha(
      pdf,
      12,
      67,
      186,
      10,
      [
        [
          "ENDEREÇO/BAIRRO:",
          val("endereco")
        ],
        [
          "CIDADE:",
          val("cidade")
        ],
        [
          "CEP:",
          val("cep")
        ]
      ]
    );

    linha(
      pdf,
      12,
      77,
      186,
      10,
      [
        [
          "SOLICITANTE:",
          val("solicitante")
        ],
        [
          "E-MAIL:",
          val("email")
        ],
        [
          "FONE:",
          val("fone")
        ]
      ]
    );

    secao(
      pdf,
      "INFORMAÇÕES DO ATENDIMENTO",
      94
    );

    linha(
      pdf,
      12,
      99,
      186,
      10,
      [
        [
          "DATA/HORA DE ABERTURA:",
          formatarData(
            val("abertura")
          )
        ],
        [
          "TAG:",
          val("tag")
        ],
        [
          "VALOR:",
          val("valor")
        ]
      ]
    );

    campoTexto(
      pdf,
      12,
      109,
      186,
      10,
      "PEÇAS E PERIFÉRICOS:",
      `${checks("pecas")} ${val("outros")}`
    );

    campoTexto(
      pdf,
      12,
      119,
      186,
      18,
      "PROBLEMA:",
      val("problema")
    );

    campoTexto(
      pdf,
      12,
      137,
      186,
      22,
      "SOLUÇÃO:",
      val("solucao")
    );

    campoTexto(
      pdf,
      12,
      159,
      186,
      16,
      "OBS:",
      val("obs")
    );

    campoTexto(
      pdf,
      12,
      175,
      186,
      9,
      "ATENDIMENTO:",
      radio("atendimento")
    );

    campoTexto(
      pdf,
      12,
      184,
      186,
      9,
      "STATUS:",
      radio("status")
    );

    linha(
      pdf,
      12,
      198,
      186,
      22,
      [
        [
          "DATA/HORÁRIO FINAL:",
          formatarData(
            val("final")
          )
        ],
        [
          "ASSINATURA CLIENTE:",
          ""
        ],
        [
          "RG / CARIMBO:",
          val("rg")
        ],
        [
          "TÉCNICOS RESPONSÁVEIS:",
          val("tecnicos")
        ]
      ]
    );

    if (
      !signaturePad.isEmpty()
    ) {

      const assinaturaPdf =
        await obterAssinaturaParaPdf();

      if (assinaturaPdf) {

        const tamanho =
          calcularTamanhoAssinaturaPdf(
            assinaturaPdf.proporcao
          );

        /*
         * Centraliza a assinatura na área reservada,
         * mantendo a proporção original sem esticar.
         */
        const areaX =
          61.5;

        const areaY =
          201.5;

        const areaW =
          46.5;

        const areaH =
          16;

        const assinaturaX =
          areaX +
          (
            areaW -
            tamanho.largura
          ) / 2;

        const assinaturaY =
          areaY +
          (
            areaH -
            tamanho.altura
          ) / 2;

        pdf.addImage(
          assinaturaPdf.dataUrl,
          "PNG",
          assinaturaX,
          assinaturaY,
          tamanho.largura,
          tamanho.altura
        );

      }

    }

    secao(
      pdf,
      "CONTROLE INTERNO",
      231
    );

    linha(
      pdf,
      60,
      236,
      90,
      12,
      [
        [
          "FINALIZADO CARD:",
          document
            .getElementById(
              "finalizado"
            )
            .checked
              ? "SIM"
              : "NÃO"
        ],
        [
          "ENTREGUE POR:",
          val("entreguePor")
        ]
      ]
    );

    pdf.setFontSize(9);

    pdf.setTextColor(
      0,
      100,
      55
    );

    pdf.text(
      "linche.ti     lincheti     linchetecnologia",
      73,
      285
    );

    pdf.save(
      `${rat}.pdf`
    );

    // Só marca a visita como vinculada depois do PDF ser gerado.
    await finalizarVinculoComVisita(
      salvamento.referencia.id,
      rat
    );

    await gerarProximoNumeroRat();

    if (
      contextoVisita.visitaId
    ) {

      alert(
        contextoVisita.destino === "concluida"
          ? "RAT gerada e visita concluída com sucesso!"
          : "RAT gerada e vinculada à visita com sucesso!"
      );

      window.location.href =
        "kanban.html";

      return;
    }

    alert(
      "RAT salva no Firestore e PDF gerado com sucesso!"
    );

  } catch (erro) {

    console.error(
      "Erro durante geração do PDF:",
      erro
    );

    alert(
      "A RAT foi salva, mas ocorreu um erro durante a geração/vinculação do PDF."
    );

  } finally {

    gerandoPdf =
      false;

  }

}


async function obterAssinaturaParaPdf() {

  if (signaturePad.isEmpty()) {
    return null;
  }

  const origem =
    canvas;

  const ctx =
    origem.getContext("2d");

  const imagem =
    ctx.getImageData(
      0,
      0,
      origem.width,
      origem.height
    );

  const dados =
    imagem.data;

  let minX =
    origem.width;

  let minY =
    origem.height;

  let maxX =
    0;

  let maxY =
    0;

  let encontrou =
    false;

  /*
   * Como o fundo é branco, procuramos pixels
   * que sejam visivelmente diferentes de branco.
   */
  for (
    let y = 0;
    y < origem.height;
    y++
  ) {

    for (
      let x = 0;
      x < origem.width;
      x++
    ) {

      const i =
        (y * origem.width + x) * 4;

      const r =
        dados[i];

      const g =
        dados[i + 1];

      const b =
        dados[i + 2];

      const a =
        dados[i + 3];

      if (
        a > 10 &&
        (
          r < 245 ||
          g < 245 ||
          b < 245
        )
      ) {

        encontrou =
          true;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;

      }

    }

  }

  if (!encontrou) {
    return null;
  }

  const margem =
    Math.max(
      8,
      Math.round(
        Math.min(
          origem.width,
          origem.height
        ) * 0.03
      )
    );

  minX =
    Math.max(
      0,
      minX - margem
    );

  minY =
    Math.max(
      0,
      minY - margem
    );

  maxX =
    Math.min(
      origem.width - 1,
      maxX + margem
    );

  maxY =
    Math.min(
      origem.height - 1,
      maxY + margem
    );

  const largura =
    maxX - minX + 1;

  const altura =
    maxY - minY + 1;

  const recorte =
    document.createElement(
      "canvas"
    );

  recorte.width =
    largura;

  recorte.height =
    altura;

  const recorteCtx =
    recorte.getContext(
      "2d"
    );

  recorteCtx.fillStyle =
    "#ffffff";

  recorteCtx.fillRect(
    0,
    0,
    largura,
    altura
  );

  recorteCtx.drawImage(
    origem,
    minX,
    minY,
    largura,
    altura,
    0,
    0,
    largura,
    altura
  );

  return {
    dataUrl:
      recorte.toDataURL(
        "image/png"
      ),

    proporcao:
      largura / altura
  };
}

function calcularTamanhoAssinaturaPdf(
  proporcao
) {

  const maxLargura =
    38;

  const maxAltura =
    11;

  let largura =
    maxLargura;

  let altura =
    largura / proporcao;

  if (
    altura >
    maxAltura
  ) {

    altura =
      maxAltura;

    largura =
      altura * proporcao;

  }

  return {
    largura,
    altura
  };
}


// =========================================================
// PDF HELPERS
// =========================================================

function titulo(
  pdf,
  texto,
  y
) {

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(14);

  pdf.setTextColor(
    0,
    100,
    55
  );

  pdf.text(
    texto,
    105,
    y,
    {
      align:
        "center"
    }
  );

  pdf.line(
    45,
    y + 3,
    165,
    y + 3
  );

  pdf.setTextColor(
    20,
    20,
    20
  );

}

function secao(
  pdf,
  texto,
  y
) {

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(9);

  pdf.text(
    texto,
    105,
    y,
    {
      align:
        "center"
    }
  );

}

function linha(
  pdf,
  x,
  y,
  w,
  h,
  items
) {

  const col =
    w / items.length;

  pdf.rect(
    x,
    y,
    w,
    h
  );

  items.forEach(
    (item, i) => {

      if (i > 0) {

        pdf.line(
          x + col * i,
          y,
          x + col * i,
          y + h
        );

      }

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(7);

      pdf.text(
        item[0],
        x + col * i + 2,
        y + 4
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(8);

      pdf.text(
        String(
          item[1] || ""
        ),
        x + col * i + 2,
        y + 8,
        {
          maxWidth:
            col - 4
        }
      );

    }
  );

}

function campoTexto(
  pdf,
  x,
  y,
  w,
  h,
  label,
  texto
) {

  pdf.rect(
    x,
    y,
    w,
    h
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(7);

  pdf.text(
    label,
    x + 2,
    y + 4
  );

  pdf.setFont(
    "helvetica",
    "normal"
  );

  pdf.setFontSize(8);

  pdf.text(
    String(
      texto || ""
    ),
    x + 35,
    y + 4,
    {
      maxWidth:
        w - 40
    }
  );

}

function carregarImagem(src) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const img =
        new Image();

      img.onload =
        () =>
          resolve(img);

      img.onerror =
        reject;

      img.src =
        src;

    }
  );

}

function formatarData(valor) {

  if (!valor) {
    return "";
  }

  const data =
    new Date(valor);

  return data
    .toLocaleString(
      "pt-BR"
    );

}

// =========================================================
// NUMERAÇÃO AUTOMÁTICA
// =========================================================

async function gerarProximoNumeroRat() {

  const ano =
    new Date()
      .getFullYear();

  const consulta =
    query(
      collection(
        db,
        "rats"
      ),
      orderBy(
        "sequencial",
        "desc"
      ),
      limit(1)
    );

  const resultado =
    await getDocs(
      consulta
    );

  let proximo =
    1;

  if (
    !resultado.empty
  ) {

    proximo =
      Number(
        resultado
          .docs[0]
          .data()
          .sequencial || 0
      ) + 1;

  }

  const numero =
    String(proximo)
      .padStart(
        6,
        "0"
      );

  document
    .getElementById(
      "ratNumero"
    )
    .innerText =
      `RAT-${ano}-${numero}`;

  return proximo;
}

// Inicialização da tela.
gerarProximoNumeroRat();

if (
  !contextoVisita.visitaId &&
  sessao?.perfil?.nome &&
  !val("tecnicos")
) {
  preencher(
    "tecnicos",
    sessao.perfil.nome
  );
}

carregarVisitaVinculada();

window.limparAssinatura =
  limparAssinatura;

window.limparFormulario =
  limparFormulario;

window.gerarPDF =
  gerarPDF;
