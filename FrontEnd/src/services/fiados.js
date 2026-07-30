// Serviço de fiados (contas a receber).
import { api } from './api';

export const fiadosService = {
  listar: () => api.get('/fiados'), // dívidas em aberto (com saldo)
  resumo: () => api.get('/fiados/resumo'),
  pagamentos: (vendaId) => api.get(`/fiados/${vendaId}/pagamentos`),
  pagar: (vendaId, valor) => api.post(`/fiados/${vendaId}/pagar`, { valor }),
};
