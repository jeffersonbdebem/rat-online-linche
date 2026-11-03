import { exigirAcesso } from "./auth-service.js";
const sessao = await exigirAcesso(["admin","gestor","analista","consulta"]);

import { db, auth } from "./firebase-config.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const parametros = new URLSearchParams(window.location.search);
const ratId = parametros.get("id");
const abrirPdfAutomaticamente = parametros.get("pdf") === "1";

let ratAtual = null;

const btnPdf = document.getElementById("btnPdf");
const btnVoltar = document.getElementById("btnVoltar");
const carregamento = document.getElementById("estadoCarregamento");
const conteudo = document.getElementById("conteudoRat");

btnVoltar.addEventListener("click", () => {
  window.location.href = "historico.html";
});

btnPdf.addEventListener("click", () => {
  if (ratAtual) {
    gerarPdfDaRat(ratAtual);
  }
});

onAuthStateChanged(auth, async usuario => {
  if (!usuario) {
    window.location.href = "login.html";
    return;
  }

  if (!ratId) {
    mostrarErro("O identificador da RAT não foi informado.");
    return;
  }

  await carregarRat();
});

async function carregarRat() {
  try {
    const referencia = doc(db, "rats", ratId);
    const snapshot = await getDoc(referencia);

    if (!snapshot.exists()) {
      mostrarErro("A RAT solicitada não foi encontrada.");
      return;
    }

    ratAtual = {
      id: snapshot.id,
      ...snapshot.data()
    };

    preencherTela(ratAtual);

    carregamento.classList.add("hidden");
    conteudo.classList.remove("hidden");
    btnPdf.disabled = false;

    if (abrirPdfAutomaticamente) {
      setTimeout(() => gerarPdfDaRat(ratAtual), 250);
    }
  } catch (erro) {
    console.error("Erro ao abrir RAT:", erro);
    mostrarErro("Não foi possível abrir os dados desta RAT.");
  }
}

function preencherTela(rat) {
  document.getElementById("tituloRat").textContent = rat.numero || "RAT sem número";

  const campos = {
    cliente: rat.cliente,
    documento: rat.documento,
    solicitante: rat.solicitante,
    endereco: rat.endereco,
    cidade: rat.cidade,
    cep: rat.cep,
    email: rat.email,
    fone: rat.fone,
    abertura: formatarData(rat.abertura),
    final: formatarData(rat.final),
    tag: rat.tag,
    valor: rat.valor,
    atendimento: rat.atendimento,
    status: rat.status,
    pecas: [rat.pecas, rat.outros].filter(Boolean).join(" "),
    problema: rat.problema,
    solucao: rat.solucao,
    obs: rat.obs,
    tecnicos: rat.tecnicoNome || rat.tecnico || rat.tecnicos,
    rg: rat.rg,
    entreguePor: rat.entreguePor,
    finalizado: rat.finalizado ? "Sim" : "Não",
    criadoEm: formatarDataFirestore(rat.criadoEm)
  };

  Object.entries(campos).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.textContent = valor || "-";
    }
  });

  const assinaturaBox = document.getElementById("assinaturaBox");

  if (rat.assinaturaImagem) {
    assinaturaBox.innerHTML = `
      <img
        src="${rat.assinaturaImagem}"
        alt="Assinatura registrada na RAT"
      >
    `;
  }
}

function mostrarErro(mensagem) {
  carregamento.textContent = mensagem;
  carregamento.classList.add("error-card");
  btnPdf.disabled = true;
}

async function gerarPdfDaRat(rat) {
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const logo = await carregarImagem("assets/logo-linche.png");

    const numero = rat.numero || "RAT";
    const tecnicos = rat.tecnicoNome || rat.tecnico || rat.tecnicos || "";

    pdf.addImage(logo, "PNG", 12, 10, 70, 24);

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 100, 55);
    pdf.setFontSize(10);
    pdf.text("LINCHE TECNOLOGIA E CONSULTORIA LTDA", 92, 12);

    pdf.setTextColor(20, 20, 20);
    pdf.setFont("helvetica", "normal");
    pdf.text("CNPJ: 07.138.235/0001-93", 92, 17);
    pdf.text("Rua Jacareí, 28 - Parque Prado, Campinas - SP", 92, 22);
    pdf.text("CEP: 13043-090", 92, 27);
    pdf.text("Tel: (19) 3241-3200", 92, 32);
    pdf.text("suporte@lincheti.com.br | www.lincheti.com.br", 92, 37);

    // Identificação da RAT: quadro compacto no canto superior direito.
    pdf.rect(173, 10, 27, 22);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("RAT Nº", 186.5, 16, { align: "center" });
    pdf.setFontSize(7);
    pdf.text("VERSÃO 1", 186.5, 20, { align: "center" });
    pdf.setTextColor(0, 100, 55);
    pdf.setFontSize(8);
    pdf.text(numero, 186.5, 26, { maxWidth: 24, align: "center" });
    pdf.setTextColor(20, 20, 20);

    titulo(pdf, "RELATÓRIO DE ATENDIMENTO TÉCNICO", 42);
    secao(pdf, "IDENTIFICAÇÃO DO CLIENTE", 52);

    linha(pdf, 12, 57, 186, 10, [
      ["NOME / RAZÃO SOCIAL:", rat.cliente],
      ["CPF / CNPJ:", rat.documento]
    ]);

    linha(pdf, 12, 67, 186, 10, [
      ["ENDEREÇO/BAIRRO:", rat.endereco],
      ["CIDADE:", rat.cidade],
      ["CEP:", rat.cep]
    ]);

    linha(pdf, 12, 77, 186, 10, [
      ["SOLICITANTE:", rat.solicitante],
      ["E-MAIL:", rat.email],
      ["FONE:", rat.fone]
    ]);

    secao(pdf, "INFORMAÇÕES DO ATENDIMENTO", 94);

    linha(pdf, 12, 99, 186, 10, [
      ["DATA/HORA DE ABERTURA:", formatarData(rat.abertura)],
      ["TAG:", rat.tag],
      ["VALOR:", rat.valor]
    ]);

    campoTexto(pdf, 12, 109, 186, 10, "PEÇAS E PERIFÉRICOS:", [rat.pecas, rat.outros].filter(Boolean).join(" "));
    campoTexto(pdf, 12, 119, 186, 18, "PROBLEMA:", rat.problema);
    campoTexto(pdf, 12, 137, 186, 22, "SOLUÇÃO:", rat.solucao);
    campoTexto(pdf, 12, 159, 186, 16, "OBS:", rat.obs);
    campoTexto(pdf, 12, 175, 186, 9, "ATENDIMENTO:", rat.atendimento);
    campoTexto(pdf, 12, 184, 186, 9, "STATUS:", rat.status);

    linha(pdf, 12, 198, 186, 22, [
      ["DATA/HORÁRIO FINAL:", formatarData(rat.final)],
      ["ASSINATURA CLIENTE:", ""],
      ["RG / CARIMBO:", rat.rg],
      ["TÉCNICOS RESPONSÁVEIS:", tecnicos]
    ]);

    if (rat.assinaturaImagem) {
      pdf.addImage(rat.assinaturaImagem, "PNG", 72, 204, 42, 12);
    }

    secao(pdf, "CONTROLE INTERNO", 231);

    linha(pdf, 60, 236, 90, 12, [
      ["FINALIZADO CARD:", rat.finalizado ? "SIM" : "NÃO"],
      ["ENTREGUE POR:", rat.entreguePor]
    ]);

    pdf.setFontSize(9);
    pdf.setTextColor(0, 100, 55);
    pdf.setFontSize(8);
    pdf.text("LINCHE FIELD • Desenvolvido por Jefferson Bruno de Bem", 67, 285);

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);

    window.open(url, "_blank", "noopener");

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (erro) {
    console.error("Erro ao gerar PDF da RAT:", erro);
    alert("Não foi possível gerar o PDF desta RAT.");
  }
}

function titulo(pdf, texto, y) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(0, 100, 55);
  pdf.text(texto, 105, y, { align: "center" });
  pdf.line(45, y + 3, 165, y + 3);
  pdf.setTextColor(20, 20, 20);
}

function secao(pdf, texto, y) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(texto, 105, y, { align: "center" });
}

function linha(pdf, x, y, largura, altura, itens) {
  const coluna = largura / itens.length;

  pdf.rect(x, y, largura, altura);

  itens.forEach((item, indice) => {
    if (indice > 0) {
      pdf.line(
        x + coluna * indice,
        y,
        x + coluna * indice,
        y + altura
      );
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text(
      item[0],
      x + coluna * indice + 2,
      y + 4
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(
      String(item[1] || ""),
      x + coluna * indice + 2,
      y + 8,
      {
        maxWidth: coluna - 4
      }
    );
  });
}

function campoTexto(pdf, x, y, largura, altura, rotulo, texto) {
  pdf.rect(x, y, largura, altura);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text(rotulo, x + 2, y + 4);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(
    String(texto || ""),
    x + 35,
    y + 4,
    {
      maxWidth: largura - 40
    }
  );
}

function carregarImagem(origem) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();

    imagem.onload = () => resolve(imagem);
    imagem.onerror = reject;
    imagem.src = origem;
  });
}

function formatarData(valor) {
  if (!valor) return "";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return String(valor);
  }

  return data.toLocaleString("pt-BR");
}

function formatarDataFirestore(valor) {
  if (!valor) return "-";

  const data = valor.toDate
    ? valor.toDate()
    : new Date(valor);

  return data.toLocaleString("pt-BR");
}
