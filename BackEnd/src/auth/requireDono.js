// Middleware de autorização: exige que o usuário seja 'dono'.
// Usar SEMPRE após requireAuth (que popula req.usuario).
export function requireDono(req, res, next) {
  if (req.usuario?.papel !== 'dono') {
    return res.status(403).json({ erro: 'Acesso restrito ao dono' });
  }
  next();
}
