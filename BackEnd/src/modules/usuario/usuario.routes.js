// Rotas de usuários — versão mínima (RF13).
import { Router } from 'express';
import {
  listarUsuarios,
  buscarUsuario,
  criarUsuario,
  alternarAtivo,
} from './usuario.controller.js';

const router = Router();

router.get('/', listarUsuarios);
router.get('/:id', buscarUsuario);
router.post('/', criarUsuario);
router.patch('/:id/ativo', alternarAtivo);   // desativa sem apagar

export default router;
