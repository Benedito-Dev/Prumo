// Rotas do painel de indicadores (RF16–RF22). Somente leitura.
import { Router } from 'express';
import {
  faturamento,
  resumo,
  rankingClientes,
  produtosMaisVendidos,
  vendasPorVendedor,
  evolucaoFaturamento,
} from './painel.controller.js';

const router = Router();

router.get('/faturamento', faturamento);                       // RF16 (mês x mês anterior)
router.get('/resumo', resumo);                                 // RF18 (total, nº, ticket médio)
router.get('/ranking-clientes', rankingClientes);              // RF17
router.get('/produtos-mais-vendidos', produtosMaisVendidos);   // RF19
router.get('/vendas-por-vendedor', vendasPorVendedor);         // RF20
router.get('/evolucao-faturamento', evolucaoFaturamento);      // RF22

export default router;
