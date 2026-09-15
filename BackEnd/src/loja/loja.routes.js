// Rotas de identificação da loja.
// Entram depois do requireAuth (ver routes.js): o endereço e o telefone do
// depósito não precisam ficar abertos a quem não é da casa.
import { Router } from 'express';
import { dadosDaLoja } from '../config/loja.js';

const router = Router();

// GET /api/loja — cabeçalho do recibo (nome, telefone, endereço).
router.get('/', (req, res) => res.json(dadosDaLoja()));

export default router;
