import "dotenv/config";
import express from "express";
import cors from "cors";
import integrationsRouter from "./routes/integrations.js";
import chamadosRouter from "./routes/chamados.js";
import { firebaseAdmin, firebaseAdminConfigurado } from "./firebase-admin.js";

const VERSION = "3.5.0";
const app = express();
const PORT = Number(process.env.PORT || 3000);
const allowed = [
  process.env.FRONTEND_ORIGIN,
  "https://rat-online-linche.firebaseapp.com",
  "https://rat-online-linche.web.app",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
].filter(Boolean);

app.use(cors({ origin(origin, callback) {
  if (!origin || allowed.includes(origin)) return callback(null, true);
  return callback(new Error("Origem não autorizada pelo CORS."));
} }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({
  ok: true,
  service: "Linche Field API",
  version: VERSION,
  firebase: firebaseAdminConfigurado(),
  whatsapp: { enabled: false, message: "Canal WhatsApp fora do escopo desta versão." },
  timestamp: new Date().toISOString()
}));

// Teste somente de leitura: confirma que a credencial consegue acessar o Firestore.
app.get("/api/health/firestore", async (req, res) => {
  try {
    if (!firebaseAdminConfigurado()) {
      return res.status(503).json({ ok: false, firestore: "not_configured" });
    }
    const { db } = firebaseAdmin();
    const snapshot = await db.doc("_healthchecks/connection").get();
    return res.json({
      ok: true,
      firestore: "connected",
      readTest: "passed",
      healthDocumentExists: snapshot.exists,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[firestore-health] falha na leitura:", error.code || error.name || "unknown");
    return res.status(503).json({
      ok: false,
      firestore: "error",
      code: error.code || "FIRESTORE_CONNECTION_FAILED",
      message: "Não foi possível acessar o Firestore. Verifique a credencial, o projeto e as permissões."
    });
  }
});

app.use("/api/integrations", integrationsRouter);
app.use("/api/chamados", chamadosRouter);
app.use((error, req, res, next) => {
  console.error("[api] erro não tratado:", error);
  res.status(error.message?.includes("CORS") ? 403 : 500).json({ ok: false, message: error.message || "Erro interno." });
});

app.listen(PORT, "0.0.0.0", () => console.log(`Linche Field API ${VERSION} online na porta ${PORT}`));
