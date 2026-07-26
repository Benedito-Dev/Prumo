// Serviço de tokens JWT.
// Dois tipos: access (curto, autoriza requisições) e refresh (longo,
// renova o access). Segredos diferentes para cada um, por segurança.
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
export const REFRESH_TTL_DIAS = Number(process.env.REFRESH_TOKEN_TTL_DIAS || 7);

// --- Access token ---
// Carrega o mínimo: id, papel e nome do usuário.
export function gerarAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, papel: usuario.papel, nome: usuario.nome },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

export function verificarAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET); // lança se inválido/expirado
}

// --- Refresh token ---
// Inclui um jti (id único) para casar com o registro no banco e permitir
// revogação/rotação. O token só é aceito se o jti ainda existir na tabela.
export function gerarRefreshToken(usuario) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: usuario.id, jti }, REFRESH_SECRET, {
    expiresIn: `${REFRESH_TTL_DIAS}d`,
  });
  return { token, jti };
}

export function verificarRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET); // { sub, jti, iat, exp }
}

// Data de expiração do refresh (para gravar no banco e no cookie).
export function expiracaoRefresh() {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TTL_DIAS);
  return d;
}
