import { Router } from "express";
import multer from "multer";
import { exigirAcessoChamados } from "../middleware/chamados-auth.js";
import { abrirChamadoManual, listarChamados, atualizarChamadoManual, adicionarNotaManual, listarMensagensChamado } from "../services/chamados-manual.js";
import { listarTarefasChamado, criarTarefaChamado, atualizarTarefaChamado } from "../services/tarefas-chamados.js";
import { listarItensChamado, criarItemChamado, atualizarItemChamado } from "../services/itens-chamados.js";
import { listarAnexosChamado, registrarAnexoChamado, obterUrlAnexoChamado } from "../services/anexos-chamados.js";

const router = Router();
const MAX_ANEXO = 15 * 1024 * 1024;
const TIPOS_ANEXO = new Set(["image/jpeg","image/png","image/webp","image/heic","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/plain"]);
const uploadAnexo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ANEXO, files: 1 },
  fileFilter: (_req, file, cb) => cb(TIPOS_ANEXO.has(file.mimetype) ? null : Object.assign(new Error("Tipo de arquivo não permitido."), { status: 400 }), TIPOS_ANEXO.has(file.mimetype))
});
function receberAnexo(req, res, next) {
  uploadAnexo.single("arquivo")(req, res, erro => {
    if (!erro) return next();
    const status = erro.code === "LIMIT_FILE_SIZE" ? 413 : erro.status || 400;
    return res.status(status).json({ ok: false, message: erro.code === "LIMIT_FILE_SIZE" ? "O arquivo deve ter até 15 MB." : erro.message || "Não foi possível receber o arquivo." });
  });
}
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
router.get("/:id/tarefas", exigirAcessoChamados, async (req, res) => {
  try { res.json({ ok: true, tarefas: await listarTarefasChamado(req.params.id) }); }
  catch (e) { falha(res, e, "Não foi possível listar as tarefas."); }
});
router.post("/:id/tarefas", exigirAcessoChamados, async (req, res) => {
  try { res.status(201).json(await criarTarefaChamado(req.params.id, req.body, req.usuario)); }
  catch (e) { falha(res, e, "Não foi possível criar a tarefa."); }
});
router.patch("/:id/tarefas/:tarefaId", exigirAcessoChamados, async (req, res) => {
  try { res.json(await atualizarTarefaChamado(req.params.id, req.params.tarefaId, req.body, req.usuario)); }
  catch (e) { falha(res, e, "Não foi possível atualizar a tarefa."); }
});
router.get("/:id/itens", exigirAcessoChamados, async (req, res) => {
  try { res.json({ ok: true, itens: await listarItensChamado(req.params.id) }); }
  catch (e) { falha(res, e, "Não foi possível listar os itens."); }
});
router.post("/:id/itens", exigirAcessoChamados, async (req, res) => {
  try { res.status(201).json(await criarItemChamado(req.params.id, req.body, req.usuario)); }
  catch (e) { falha(res, e, "Não foi possível adicionar o item."); }
});
router.patch("/:id/itens/:itemId", exigirAcessoChamados, async (req, res) => {
  try { res.json(await atualizarItemChamado(req.params.id, req.params.itemId, req.body, req.usuario)); }
  catch (e) { falha(res, e, "Não foi possível atualizar o item."); }
});
router.get("/:id/anexos", exigirAcessoChamados, async (req, res) => {
  try { res.json({ ok: true, anexos: await listarAnexosChamado(req.params.id) }); }
  catch (e) { falha(res, e, "Não foi possível listar os anexos."); }
});
router.post("/:id/anexos", exigirAcessoChamados, receberAnexo, async (req, res) => {
  try { res.status(201).json(await registrarAnexoChamado(req.params.id, req.file, req.body?.categoria, req.usuario)); }
  catch (e) { falha(res, e, "Não foi possível registrar o anexo."); }
});
router.get("/:id/anexos/:anexoId/url", exigirAcessoChamados, async (req, res) => {
  try { res.json(await obterUrlAnexoChamado(req.params.id, req.params.anexoId)); }
  catch (e) { falha(res, e, "Não foi possível abrir o anexo."); }
});
router.get("/:id/mensagens", exigirAcessoChamados, async (req, res) => {\n  try { res.json({ ok: true, mensagens: await listarMensagensChamado(req.params.id) }); }\n  catch (e) { falha(res, e, "Não foi possível consultar a linha do tempo."); }\n});\nrouter.post("/:id/notas", exigirAcessoChamados, async (req, res) => {
  try { res.status(201).json(await adicionarNotaManual(req.params.id, req.body?.texto, req.usuario)); }
  catch (e) { falha(res, e, "Não foi possível salvar a nota."); }
});
export default router;