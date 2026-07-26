// Repositório dos refresh tokens no banco.
// Guardar permite logout real (revogar) e rotação (invalidar o antigo).
import { query } from '../config/db.js';

// Registra um novo refresh token ativo.
export function salvar(jti, usuarioId, expiraEm) {
  return query(
    'INSERT INTO refresh_token (jti, usuario_id, expira_em) VALUES ($1, $2, $3)',
    [jti, usuarioId, expiraEm]
  );
}

// Um refresh só vale se existe, não está revogado e não expirou.
export async function estaAtivo(jti) {
  const r = await query(
    `SELECT 1 FROM refresh_token
      WHERE jti = $1 AND revogado = FALSE AND expira_em > NOW()`,
    [jti]
  );
  return r.rowCount > 0;
}

// Revoga um token específico (rotação e logout).
export function revogar(jti) {
  return query('UPDATE refresh_token SET revogado = TRUE WHERE jti = $1', [jti]);
}

// Revoga todas as sessões de um usuário (logout de todos os dispositivos).
export function revogarTodosDoUsuario(usuarioId) {
  return query(
    'UPDATE refresh_token SET revogado = TRUE WHERE usuario_id = $1 AND revogado = FALSE',
    [usuarioId]
  );
}
