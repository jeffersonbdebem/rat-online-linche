import { Router } from "express";
import { exigirAcessoChamados } from "../middleware/chamados-auth.js";
import {
  listarClientes, obterCliente, criarCliente, atualizarCliente,
  listarEquipamentos, obterEquipamento, criarEquipamento, atualizarEquipamento,
  listarChamadosEquipamento, removerCliente
} from "../services/clientes-equipamentos.js";

const router = Router();
router.use(exigirAcessoChamados);
const falha = (res, erro, padrao) => res.status(erro.status || 500).json({ ok:false, message:erro.message || padrao });

router.get("/clientes", async (req,res) => {
  try { res.json({ ok:true, clientes:await listarClientes({ busca:req.query.busca, limite:req.query.limite }) }); }
  catch(e) { falha(res,e,"Não foi possível listar os clientes."); }
});
router.post("/clientes", async (req,res) => {
  try { res.status(201).json(await criarCliente(req.body,req.usuario)); }
  catch(e) { falha(res,e,"Não foi possível cadastrar o cliente."); }
});
router.delete("/clientes/:id", async (req,res) => {
  try { res.json(await removerCliente(req.params.id,req.usuario)); }
  catch(e) { falha(res,e,"Não foi possível retirar o cliente."); }
});
router.get("/clientes/:id", async (req,res) => {
  try { res.json({ ok:true, cliente:await obterCliente(req.params.id) }); }
  catch(e) { falha(res,e,"Não foi possível consultar o cliente."); }
});
router.patch("/clientes/:id", async (req,res) => {
  try { res.json(await atualizarCliente(req.params.id,req.body,req.usuario)); }
  catch(e) { falha(res,e,"Não foi possível atualizar o cliente."); }
});
router.get("/equipamentos", async (req,res) => {
  try { res.json({ ok:true, equipamentos:await listarEquipamentos({ clienteId:req.query.clienteId, busca:req.query.busca, limite:req.query.limite }) }); }
  catch(e) { falha(res,e,"Não foi possível listar os equipamentos."); }
});
router.post("/equipamentos", async (req,res) => {
  try { res.status(201).json(await criarEquipamento(req.body,req.usuario)); }
  catch(e) { falha(res,e,"Não foi possível cadastrar o equipamento."); }
});
router.get("/equipamentos/:id/chamados", async (req,res) => {
  try { res.json({ ok:true, ...(await listarChamadosEquipamento(req.params.id)) }); }
  catch(e) { falha(res,e,"Não foi possível consultar o histórico do equipamento."); }
});
router.get("/equipamentos/:id", async (req,res) => {
  try { res.json({ ok:true, equipamento:await obterEquipamento(req.params.id) }); }
  catch(e) { falha(res,e,"Não foi possível consultar o equipamento."); }
});
router.patch("/equipamentos/:id", async (req,res) => {
  try { res.json(await atualizarEquipamento(req.params.id,req.body,req.usuario)); }
  catch(e) { falha(res,e,"Não foi possível atualizar o equipamento."); }
});
export default router;
