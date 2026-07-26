// Middleware de proteção: exige um access token válido no header
// Authorization: Bearer <token>. Popula req.usuario com o payload.
import { verificarAccessToken } from './token.service.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token de acesso ausente' });
  }

  try {
    const payload = verificarAccessToken(token);
    req.usuario = { id: payload.sub, papel: payload.papel, nome: payload.nome };
    next();
  } catch {
    // 401 sinaliza ao front que ele deve tentar o refresh
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}
