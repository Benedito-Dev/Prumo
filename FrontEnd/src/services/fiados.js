// Serviço de fiados (contas a receber).
import { api } from './api';

export const fiadosService = {
  // --- Tela de Fiados (só o dono alcança estas) ---
  listar: () => api.get('/fiados'), // dívidas em aberto (com saldo)
  resumo: () => api.get('/fiados/resumo'),
  pagamentos: (vendaId) => api.get(`/fiados/${vendaId}/pagamentos`),
  pagar: (vendaId, valor) => api.post(`/fiados/${vendaId}/pagar`, { valor }),

  // --- Aviso no meio da venda (abertas ao balcão) ---
  // Só a dívida do cliente que está sendo atendido, nunca a lista de todos.
  dividaDoCliente: (clienteId) => api.get(`/fiados/cliente/${clienteId}`),
  // Abate da dívida mais antiga para a mais nova, numa transação só.
  pagarCliente: (clienteId, valor) =>
    api.post(`/fiados/cliente/${clienteId}/pagar`, { valor }),
};
