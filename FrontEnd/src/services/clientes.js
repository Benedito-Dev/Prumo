// Serviço de clientes.
import { api } from './api';

export const TIPOS = [
  { id: 'consumidor_final', rotulo: 'Consumidor' },
  { id: 'pedreiro', rotulo: 'Pedreiro' },
  { id: 'construtora', rotulo: 'Construtora' },
  { id: 'revenda', rotulo: 'Revenda' },
];

export const clientesService = {
  // lista simples, sem agregação de vendas — para quem só precisa dos nomes
  listar: () => api.get('/clientes'),
  // clientes com estatísticas de compra (total, nº compras, última compra)
  estatisticas: () => api.get('/clientes/estatisticas'),
  buscar: (id) => api.get(`/clientes/${id}`),
  criar: (dados) => api.post('/clientes', dados),
  atualizar: (id, dados) => api.put(`/clientes/${id}`, dados),
  remover: (id) => api.delete(`/clientes/${id}`),
  // histórico de vendas do cliente (mais recentes primeiro)
  historico: (id) => api.get(`/vendas?cliente_id=${id}`),
};

export function rotuloTipo(id) {
  return TIPOS.find((t) => t.id === id)?.rotulo || 'Sem tipo';
}

// Limite de dias para considerar um cliente "sumido" (RF24).
export const DIAS_SUMIDO = 15;
