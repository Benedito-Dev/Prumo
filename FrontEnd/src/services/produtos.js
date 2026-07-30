// Serviço de produtos e categorias.
import { api } from './api';

export const UNIDADES = [
  { id: 'saco', rotulo: 'Saco' },
  { id: 'milheiro', rotulo: 'Milheiro' },
  { id: 'm3', rotulo: 'm³' },
  { id: 'peca', rotulo: 'Peça' },
  { id: 'barra', rotulo: 'Barra' },
  { id: 'kg', rotulo: 'Kg' },
  { id: 'metro', rotulo: 'Metro' },
  { id: 'carrada', rotulo: 'Carrada' },
];

export const produtosService = {
  listar: () => api.get('/produtos'),
  criar: (dados) => api.post('/produtos', dados),
  atualizar: (id, dados) => api.put(`/produtos/${id}`, dados),
  remover: (id) => api.delete(`/produtos/${id}`),

  listarCategorias: () => api.get('/categorias'),
  criarCategoria: (nome) => api.post('/categorias', { nome }),
};

// rótulo amigável da unidade
export function rotuloUnidade(id) {
  return UNIDADES.find((u) => u.id === id)?.rotulo || id;
}
