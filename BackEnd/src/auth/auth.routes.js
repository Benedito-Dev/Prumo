// Rotas de autenticação.
import { Router } from 'express';
import { login, refresh, logout, me } from './auth.controller.js';
import { requireAuth } from './requireAuth.js';
import { limitarLogin } from './limitarTentativas.js';

const router = Router();

router.post('/login', limitarLogin, login); // login + senha -> access (json) + refresh (cookie)
router.post('/refresh', refresh);   // rotaciona o refresh e emite novo access
router.post('/logout', logout);     // revoga o refresh
router.get('/me', requireAuth, me); // usuário do token atual (protegida)

export default router;
