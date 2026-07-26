// Cliente HTTP central com autenticação.
// - Injeta o access token (Bearer) em cada requisição.
// - Se receber 401, tenta renovar via /auth/refresh (cookie httpOnly) UMA
//   vez e repete a requisição. Se o refresh falhar, dispara logout.
// O access token vive só em memória (não em localStorage) — mais seguro.

const BASE = '/api';

let accessToken = null;
let aoDeslogar = null; // callback registrado pelo AuthContext

export function definirAccessToken(token) {
  accessToken = token;
}
export function registrarLogout(cb) {
  aoDeslogar = cb;
}

// Controle para não disparar vários refresh em paralelo
let refreshPromise = null;

async function tentarRefresh() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // envia o cookie do refresh
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('refresh falhou');
        const dados = await r.json();
        accessToken = dados.accessToken;
        return dados.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(caminho, opcoes = {}, jaRenovou = false) {
  const headers = {
    'Content-Type': 'application/json',
    ...opcoes.headers,
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const resposta = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers,
    credentials: 'include',
  });

  // Access expirado: tenta renovar uma vez e repete
  if (resposta.status === 401 && !jaRenovou && !caminho.startsWith('/auth/')) {
    try {
      await tentarRefresh();
      return request(caminho, opcoes, true);
    } catch {
      accessToken = null;
      if (aoDeslogar) aoDeslogar();
      throw new Error('Sessão expirada');
    }
  }

  if (resposta.status === 204) return null;

  const dados = await resposta.json().catch(() => ({}));
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
