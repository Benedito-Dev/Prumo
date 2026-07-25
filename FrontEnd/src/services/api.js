// Cliente HTTP central da aplicação.
// Toda conversa com o back-end passa por aqui — se a base mudar, muda num lugar só.
// Em desenvolvimento, /api é encaminhado para o back-end pelo proxy do Vite.

const BASE = '/api';

async function request(caminho, opcoes = {}) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  });

  // 204 (No Content) não tem corpo
  if (resposta.status === 204) return null;

  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro na requisição');
  }
  return dados;
}

export const api = {
  get: (caminho) => request(caminho),
  post: (caminho, corpo) => request(caminho, { method: 'POST', body: JSON.stringify(corpo) }),
  put: (caminho, corpo) => request(caminho, { method: 'PUT', body: JSON.stringify(corpo) }),
  patch: (caminho, corpo) => request(caminho, { method: 'PATCH', body: JSON.stringify(corpo) }),
  delete: (caminho) => request(caminho, { method: 'DELETE' }),
};
