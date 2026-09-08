const REPORT_URL = process.env.MSPDESK_REPORT_URL || "";
const API_KEY = process.env.MSPDESK_API_KEY || "";

function configurado() {
  return Boolean(REPORT_URL && API_KEY);
}

function normalizarLista(payload) {
  if (Array.isArray(payload)) return payload;
  for (const chave of ["data", "items", "results", "tickets", "content", "rows"]) {
    if (Array.isArray(payload?.[chave])) return payload[chave];
  }
  return [];
}

function mascararUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "Configurada";
  }
}

export async function mspDeskStatus() {
  return {
    integration: "mspdesk",
    configured: configurado(),
    connected: false,
    message: configurado()
      ? "Credenciais configuradas."
      : "Configure MSPDESK_REPORT_URL e MSPDESK_API_KEY no backend/.env.",
    endpoint: mascararUrl(REPORT_URL),
    lastSync: null
  };
}

async function consultarRelatorio(page = 0, size = 20) {
  if (!configurado()) {
    const error = new Error("Configure MSPDESK_REPORT_URL e MSPDESK_API_KEY no backend/.env.");
    error.code = "MSPDESK_NOT_CONFIGURED";
    throw error;
  }

  const url = new URL(REPORT_URL);
  url.searchParams.set("page", String(Math.max(0, Number(page) || 0)));
  url.searchParams.set("size", String(Math.min(100, Math.max(1, Number(size) || 20))));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": API_KEY,
      "Accept": "application/json"
    },
    signal: AbortSignal.timeout(20000)
  });

  const texto = await response.text();
  let payload = null;
  try { payload = texto ? JSON.parse(texto) : null; } catch { payload = { raw: texto }; }

  if (!response.ok) {
    const error = new Error(`MSP Desk respondeu HTTP ${response.status}.`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return { payload, items: normalizarLista(payload) };
}

function mapearTicket(ticket = {}) {
  return {
    idTicket: ticket.id ?? ticket.idTicket ?? ticket.ticketId ?? ticket.ID ?? null,
    numeroTicket: ticket.numero ?? ticket.numeroTicket ?? ticket.ticketNumber ?? ticket["Nº Ticket"] ?? ticket["N° Ticket"] ?? null,
    assunto: ticket.assunto ?? ticket.subject ?? ticket.titulo ?? ticket["Assunto"] ?? "",
    status: ticket.status ?? ticket["Status"] ?? "",
    prioridade: ticket.prioridade ?? ticket.priority ?? ticket["Prioridade"] ?? "",
    cliente: ticket.cliente ?? ticket.client ?? ticket["Cliente"] ?? "",
    contato: ticket.contato ?? ticket.contact ?? ticket["Contato"] ?? "",
    dataCriacao: ticket.dataCriacao ?? ticket.createdAt ?? ticket["Data de Criação"] ?? null,
    agente: ticket.agente ?? ticket.agent ?? ticket.tecnico ?? ticket["Agente"] ?? ""
  };
}

export async function testarMspDesk() {
  if (!configurado()) {
    return {
      integration: "mspdesk",
      configured: false,
      connected: false,
      message: "Configure MSPDESK_REPORT_URL e MSPDESK_API_KEY no backend/.env."
    };
  }

  try {
    const { items } = await consultarRelatorio(0, 1);
    return {
      integration: "mspdesk",
      configured: true,
      connected: true,
      message: "MSP Desk respondeu com sucesso.",
      sampleCount: items.length,
      lastSync: new Date().toISOString()
    };
  } catch (error) {
    return {
      integration: "mspdesk",
      configured: true,
      connected: false,
      message: error.message || "Falha ao consultar o MSP Desk.",
      status: error.status || null
    };
  }
}

export async function listarTickets(page = 0, size = 20) {
  const { payload, items } = await consultarRelatorio(page, size);
  return {
    page: Number(page) || 0,
    size: Number(size) || 20,
    totalNaPagina: items.length,
    tickets: items.map(mapearTicket),
    rawMeta: {
      hasPayload: Boolean(payload),
      payloadKeys: payload && !Array.isArray(payload) && typeof payload === "object"
        ? Object.keys(payload).slice(0, 30)
        : []
    }
  };
}
