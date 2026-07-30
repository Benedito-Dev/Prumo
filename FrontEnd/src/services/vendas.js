// Serviço da tela de vendas — clientes, produtos e criação de venda.
import { api } from './api';

export const vendasService = {
  // busca produtos ativos (para adicionar na venda)
  buscarProdutos: (busca = '') => {
    const q = busca ? `?ativos=true` : '?ativos=true';
    return api.get(`/produtos${q}`).then((lista) =>
      busca
        ? lista.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()))
        : lista
    );
  },

  // busca clientes por nome ou telefone (RF05)
  buscarClientes: (busca) => api.get(`/clientes${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),

  // cadastro rápido de cliente (nome + telefone)
  criarCliente: (dados) => api.post('/clientes', dados),

  // lança a venda (transação no back-end)
  criarVenda: (dados) => api.post('/vendas', dados),

  // histórico de vendas (com filtros de período/status)
  listar: ({ de, ate, status } = {}) => {
    const p = new URLSearchParams();
    if (de) p.set('de', de);
    if (ate) p.set('ate', ate);
    if (status) p.set('status', status);
    const qs = p.toString();
    return api.get(`/vendas${qs ? `?${qs}` : ''}`);
  },
  detalhar: (id) => api.get(`/vendas/${id}`),
  cancelar: (id) => api.patch(`/vendas/${id}/cancelar`),
};
