// Serviço de usuários e gestão de senha.
import { api } from './api';

export const PAPEIS = [
  { id: 'dono', rotulo: 'Dono' },
  { id: 'vendedor', rotulo: 'Vendedor' },
];

export const usuariosService = {
  listar: () => api.get('/usuarios'),
  buscar: (id) => api.get(`/usuarios/${id}`),
  criar: (dados) => api.post('/usuarios', dados),
  alternarAtivo: (id, ativo) => api.patch(`/usuarios/${id}/ativo`, { ativo }),
  resetarSenha: (id, senha_nova) => api.patch(`/usuarios/${id}/senha`, { senha_nova }),
  // troca da própria senha (qualquer usuário logado)
  trocarMinhaSenha: (senha_atual, senha_nova) =>
    api.patch('/usuarios/me/senha', { senha_atual, senha_nova }),
  // desempenho de vendas (usa o endpoint do painel, filtra pelo id)
  desempenho: () => api.get('/painel/vendas-por-vendedor?periodo=ano'),
};

export function rotuloPapel(id) {
  return PAPEIS.find((p) => p.id === id)?.rotulo || id;
}
