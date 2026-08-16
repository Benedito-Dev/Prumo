// Controller de autenticação.
// Fluxo: login -> access (resposta JSON) + refresh (cookie httpOnly).
// O refresh é persistido e rotacionado a cada renovação.
import { query } from '../config/db.js';
import { responderErro } from '../config/erros.js';
import { conferirSenha } from './senha.service.js';
import {
  gerarAccessToken,
  gerarRefreshToken,
  verificarRefreshToken,
  expiracaoRefresh,
  REFRESH_TTL_DIAS,
} from './token.service.js';
import * as refreshRepo from './refresh.repo.js';

const COOKIE_REFRESH = 'prumo_refresh';

// Opções do cookie do refresh token.
function opcoesCookie() {
  return {
    httpOnly: true, // JavaScript não acessa — protege de XSS
    secure: process.env.NODE_ENV === 'production', // só HTTPS em produção
    sameSite: 'lax',
    path: '/api/auth', // enviado só nas rotas de auth
    maxAge: REFRESH_TTL_DIAS * 24 * 60 * 60 * 1000,
  };
}

// Emite o par de tokens e grava o refresh no banco + cookie.
async function emitirSessao(res, usuario) {
  const accessToken = gerarAccessToken(usuario);
  const { token: refreshToken, jti } = gerarRefreshToken(usuario);

  await refreshRepo.salvar(jti, usuario.id, expiracaoRefresh());
  res.cookie(COOKIE_REFRESH, refreshToken, opcoesCookie());

  return accessToken;
}

// Dados públicos do usuário (nunca a senha).
function usuarioPublico(u) {
  return { id: u.id, nome: u.nome, email: u.email, papel: u.papel, ativo: u.ativo };
}

// POST /api/auth/login  { email, senha }
export async function login(req, res) {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ erro: 'E-mail e senha são obrigatórios' });
    }

    const r = await query('SELECT * FROM usuario WHERE email = $1', [
      email.trim().toLowerCase(),
    ]);
    const usuario = r.rows[0];

    // Mesma resposta para usuário inexistente ou senha errada (não vaza qual falhou)
    if (!usuario || !(await conferirSenha(senha, usuario.senha_hash))) {
      return res.status(401).json({ erro: 'Login ou senha inválidos' });
    }
    if (!usuario.ativo) {
      return res.status(403).json({ erro: 'Usuário inativo' });
    }

    const accessToken = await emitirSessao(res, usuario);
    res.json({ accessToken, usuario: usuarioPublico(usuario) });
  } catch (erro) {
    responderErro(res, erro, 'Falha no login');
  }
}

// POST /api/auth/refresh  (refresh vem no cookie)
// Rotação: valida o refresh atual, revoga-o e emite um novo par.
export async function refresh(req, res) {
  try {
    const token = req.cookies?.[COOKIE_REFRESH];
    if (!token) return res.status(401).json({ erro: 'Sem refresh token' });

    let payload;
    try {
      payload = verificarRefreshToken(token);
    } catch {
      return res.status(401).json({ erro: 'Refresh token inválido ou expirado' });
    }

    // O jti precisa estar ativo no banco (não revogado/expirado)
    if (!(await refreshRepo.estaAtivo(payload.jti))) {
      return res.status(401).json({ erro: 'Sessão encerrada. Faça login novamente.' });
    }

    // Rotação: o refresh usado morre
    await refreshRepo.revogar(payload.jti);

    const r = await query('SELECT * FROM usuario WHERE id = $1', [payload.sub]);
    const usuario = r.rows[0];
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Usuário indisponível' });
    }

    const accessToken = await emitirSessao(res, usuario);
    res.json({ accessToken, usuario: usuarioPublico(usuario) });
  } catch (erro) {
    responderErro(res, erro, 'Falha ao renovar sessão');
  }
}

// POST /api/auth/logout — revoga o refresh e limpa o cookie.
export async function logout(req, res) {
  try {
    const token = req.cookies?.[COOKIE_REFRESH];
    if (token) {
      try {
        const payload = verificarRefreshToken(token);
        await refreshRepo.revogar(payload.jti);
      } catch {
        // token já inválido — segue limpando o cookie
      }
    }
    res.clearCookie(COOKIE_REFRESH, { path: '/api/auth' });
    res.json({ ok: true });
  } catch (erro) {
    responderErro(res, erro, 'Falha no logout');
  }
}

// GET /api/auth/me — usuário do access token atual (rota protegida).
export async function me(req, res) {
  try {
    const r = await query('SELECT * FROM usuario WHERE id = $1', [req.usuario.id]);
    if (r.rowCount === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(usuarioPublico(r.rows[0]));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao carregar usuário');
  }
}
