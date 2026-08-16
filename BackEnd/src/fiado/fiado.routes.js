// Rotas de fiados (contas a receber).
import { Router } from 'express';
import {
  listarAbertos,
  resumo,
  pagamentosDaVenda,
  pagar,
  dividaDoCliente,
  pagarCliente,
} from './fiado.controller.js';
import { requireDono } from '../auth/requireDono.js';

const router = Router();

// --- Aberto ao balcão: a dívida de UM cliente ---
// Alimentam o aviso no meio da venda ("este cliente tem R$ X em aberto").
// Vêm antes das rotas com :vendaId para o Express não tomar "cliente"
// como um id de venda.
router.get('/cliente/:clienteId', dividaDoCliente);
router.post('/cliente/:clienteId/pagar', pagarCliente);

// --- Restrito ao dono: o mapa de quem deve ---
// A lista de todos os devedores e o total a receber são a saúde financeira
// da loja. O vendedor recebe pagamento pelo aviso da venda, sem precisar
// ver quem mais está endividado.
router.get('/', requireDono, listarAbertos);   // vendas fiado em aberto (com saldo)
router.get('/resumo', requireDono, resumo);    // total a receber + nº de dívidas

// Histórico e pagamento de UMA venda: a tela de Fiados (do dono) usa as duas.
router.get('/:vendaId/pagamentos', requireDono, pagamentosDaVenda);
router.post('/:vendaId/pagar', requireDono, pagar);

export default router;
