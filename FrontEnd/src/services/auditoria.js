// Histórico de alterações de cadastro (só o dono alcança).
import { api } from './api';

export const auditoriaService = {
  listar: ({ usuario_id, entidade, de, ate, limite } = {}) => {
    const p = new URLSearchParams();
    if (usuario_id) p.set('usuario_id', usuario_id);
    if (entidade) p.set('entidade', entidade);
    if (de) p.set('de', de);
    if (ate) p.set('ate', ate);
    if (limite) p.set('limite', limite);
    const qs = p.toString();
    return api.get(`/auditoria${qs ? `?${qs}` : ''}`);
  },
  // Histórico de um registro específico (ficha do produto/cliente).
  historicoDe: (entidade, id) => api.get(`/auditoria/${entidade}/${id}`),
};
