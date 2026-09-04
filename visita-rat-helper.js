import {
  collection, doc, getDoc, getDocs, limit, query, updateDoc, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export function obterContextoVisitaDaUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    visitaId: params.get("visitaId") || "",
    destino: params.get("destino") || "finalizacao"
  };
}

export async function abrirRatDaVisita(db, visitaId, destino = "finalizacao") {
  if (!visitaId) return;

  await updateDoc(doc(db, "visitas", visitaId), {
    status: "finalizacao",
    atualizadoEm: serverTimestamp()
  });

  const url = new URL("index.html", window.location.href);
  url.searchParams.set("visitaId", visitaId);
  url.searchParams.set("destino", destino);
  window.location.href = url.toString();
}

export async function carregarVisitaNaRat(db) {
  const contexto = obterContextoVisitaDaUrl();

  if (!contexto.visitaId) {
    return { ...contexto, visita: null, clienteCadastro: null };
  }

  const visitaSnap = await getDoc(doc(db, "visitas", contexto.visitaId));
  if (!visitaSnap.exists()) throw new Error("Visita não encontrada.");

  const visita = { id: visitaSnap.id, ...visitaSnap.data() };
  let clienteCadastro = null;

  if (visita.cliente) {
    const q = query(
      collection(db, "clientes"),
      where("razaoSocial", "==", visita.cliente),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) clienteCadastro = { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  preencher("cliente", visita.cliente);
  preencher("endereco", clienteCadastro?.endereco || visita.endereco);
  preencher("cidade", clienteCadastro?.cidade);
  preencher("cep", clienteCadastro?.cep);
  preencher("solicitante", clienteCadastro?.contato || visita.contato);
  preencher("email", clienteCadastro?.email);
  preencher("fone", clienteCadastro?.fone || visita.telefone);
  preencher("documento", clienteCadastro?.cnpj);
  preencher("problema", visita.problema);
  preencher("tecnicos", visita.tecnico);

  if (visita.data) {
    preencher("abertura", `${visita.data}T${visita.horario || "08:00"}`);
  }

  mostrarAviso(visita, contexto.destino);

  return { ...contexto, visita, clienteCadastro };
}

export async function vincularRatNaVisita(db, contexto, ratDocId, ratNumero, assinaturaColetada) {
  if (!contexto?.visitaId) return;

  const statusFinal = contexto.destino === "concluida" ? "concluida" : "finalizacao";

  const dados = {
    ratId: ratDocId,
    ratNumero,
    ratFinalizada: true,
    assinaturaColetada: Boolean(assinaturaColetada),
    pdfGerado: true,
    status: statusFinal,
    atualizadoEm: serverTimestamp()
  };

  if (statusFinal === "concluida") {
    dados.finalizadaEm = serverTimestamp();
  }

  await updateDoc(doc(db, "visitas", contexto.visitaId), dados);
}

function preencher(id, valor) {
  const el = document.getElementById(id);
  if (el && valor !== undefined && valor !== null && valor !== "") el.value = valor;
}

function mostrarAviso(visita, destino) {
  const form = document.getElementById("ratForm");
  if (!form) return;

  const div = document.createElement("div");
  div.className = "visita-rat-banner";
  div.innerHTML = `
    <strong>RAT vinculada à visita</strong>
    <span>${esc(visita.cliente || "Cliente")} • ${esc(visita.tecnico || "Técnico")} • ${destino === "concluida" ? "Conclusão" : "Finalização"}</span>
  `;
  form.prepend(div);
}

function esc(texto="") {
  const d = document.createElement("div");
  d.textContent = texto;
  return d.innerHTML;
}
