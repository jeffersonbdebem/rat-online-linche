import { Router } from "express";
import { mspDeskStatus, testarMspDesk, listarTickets } from "../integrations/mspdesk/service.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

// Todas as rotas da integração exigem token Firebase válido e cadastro admin ativo.
router.use("/mspdesk", requireAdmin);

router.get("/mspdesk/status", async (req, res) => {
  res.json(await mspDeskStatus());
});

router.post("/mspdesk/test", async (req, res) => {
  const resultado = await testarMspDesk();
  res.status(resultado.connected ? 200 : 503).json(resultado);
});

router.get("/mspdesk/tickets", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 0);
    const size = Number(req.query.size ?? 20);
    const resultado = await listarTickets(page, size);
    res.json(resultado);
  } catch (error) {
    const status = error.code === "MSPDESK_NOT_CONFIGURED" ? 503 : (error.status && error.status >= 400 ? 502 : 500);
    res.status(status).json({
      connected: false,
      message: error.message || "Falha ao consultar chamados do MSP Desk."
    });
  }
});

export default router;
