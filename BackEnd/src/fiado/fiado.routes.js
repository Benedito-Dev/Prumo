// Rotas de fiados (contas a receber).
import { Router } from 'express';
import { listarAbertos, resumo, pagamentosDaVenda, pagar } from './fiado.controller.js';

const router = Router();

router.get('/', listarAbertos);                    // vendas fiado em aberto (com saldo)
router.get('/resumo', resumo);                     // total a receber + nº de dívidas
router.get('/:vendaId/pagamentos', pagamentosDaVenda); // histórico de quitações
router.post('/:vendaId/pagar', pagar);             // registra pagamento (parcial/total)

export default router;
