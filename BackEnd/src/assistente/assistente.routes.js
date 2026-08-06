// Rotas do assistente de IA.
import { Router } from 'express';
import { perguntar } from './assistente.controller.js';

const router = Router();

router.post('/perguntar', perguntar); // pergunta em linguagem natural

export default router;
