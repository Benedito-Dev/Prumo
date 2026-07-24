// Rotas de health-check.
import { Router } from 'express';
import { healthCheck } from './health.controller.js';

const router = Router();

// GET /health — a API está viva e o banco responde?
router.get('/', healthCheck);

export default router;
