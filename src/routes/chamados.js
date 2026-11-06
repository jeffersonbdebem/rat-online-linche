import { Router } from "express";
import { exigirAcessoChamados } from "../middleware/chamados-auth.js";
import { abrirChamadoManual, listarChamados, atualizarChamadoManual, adicionarNotaManual } from "../services/chamados-manual.js";

const router = Router();
const falha = (res, erro, padrao) => res.status(erro.status || 500).json({ ok: false, message: erro.message || padrao });

router.get("/", exigirAcessoChamados, async (req, res) => {
  try { res.json({ ok: true, chamados: await listarChamados({ status: req.query.status, limite: req.query.limite }) }); }
  catch (e) { falha(res, e, "Não foi possível listar os chamados."); }
});
router.post("/", exigirAcessoChamados, async (req, res) => {
  try { res.status(201).json(await abrirChamadoManual(req.body, req.usuario)); }
  catch (e) { falha(res, e, "Não foi possível abrir o chamado."); }
});
router.patch("/:id", exigirAcessoChamados, async (req, res) => {
  try { res.json(await atualizarChamadoManual(req.params.id, req.body, req.usuario)); }
  catch (e) { falha(res, e, "Não foi possível atualizar o chamado."); }
});
router.post("/:id/notas", exigirAcessoChamados, async (req, res) => {
  try { res.status(201).json(await adicionarNotaManual(req.params.id, req.body?.texto, req.usuario)); }
  catch (e) { falha(res, e, "Não foi possível salvar a nota."); }
});
export default router;