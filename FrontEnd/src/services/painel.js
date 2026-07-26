// Serviço do painel — agrupa as chamadas de indicadores (RF16–RF22).
import { api } from './api';

export const painelService = {
  faturamento: () => api.get('/painel/faturamento'),
  resumo: (periodo = 'mes') => api.get(`/painel/resumo?periodo=${periodo}`),
  rankingClientes: (periodo = 'mes', limite = 5) =>
    api.get(`/painel/ranking-clientes?periodo=${periodo}&limite=${limite}`),
  produtosMaisVendidos: (periodo = 'mes', limite = 5) =>
    api.get(`/painel/produtos-mais-vendidos?periodo=${periodo}&limite=${limite}`),
  evolucaoFaturamento: (periodo = 'mes') =>
    api.get(`/painel/evolucao-faturamento?periodo=${periodo}`),
};
