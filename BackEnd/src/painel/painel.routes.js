// Rotas do painel de indicadores (RF16–RF22). Somente leitura.
import { Router } from 'express';
import { requireDono } from '../auth/requireDono.js';
import {
  faturamento,
  resumo,
  rankingClientes,
  produtosMaisVendidos,
  vendasPorVendedor,
  evolucaoFaturamento,
  meuResumo,
  minhaEvolucao,
} from './painel.controller.js';

const router = Router();

// --- Aberto a qualquer autenticado: o próprio desempenho ---
// Filtram por req.usuario.id, então um vendedor só alcança os próprios
// números. Precisam vir ANTES do requireDono abaixo.
router.get('/meu-resumo', meuResumo);
router.get('/minha-evolucao', minhaEvolucao);

// --- Daqui para baixo, só o dono ---
// Estes indicadores são números da loja: faturamento, ranking de clientes
// e quanto cada vendedor vendeu. As tools equivalentes do Zé já eram
// ['dono'] — a rota REST estava aberta, e a mesma informação respondia
// diferente conforme o caminho. Esta linha é o que fecha essa assimetria.
router.use(requireDono);

router.get('/faturamento', faturamento);                       // RF16 (mês x mês anterior)
router.get('/resumo', resumo);                                 // RF18 (total, nº, ticket médio)
router.get('/ranking-clientes', rankingClientes);              // RF17
router.get('/produtos-mais-vendidos', produtosMaisVendidos);   // RF19
router.get('/vendas-por-vendedor', vendasPorVendedor);         // RF20
router.get('/evolucao-faturamento', evolucaoFaturamento);      // RF22

export default router;
