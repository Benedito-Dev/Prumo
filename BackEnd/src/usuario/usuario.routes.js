// Rotas de usuários (RF13, RNF05).
import { Router } from 'express';
import {
  listarUsuarios,
  buscarUsuario,
  criarUsuario,
  alternarAtivo,
  trocarMinhaSenha,
  resetarSenha,
} from './usuario.controller.js';
import { requireDono } from '../auth/requireDono.js';

const router = Router();

// Qualquer usuário logado troca a PRÓPRIA senha (antes de /:id!).
router.patch('/me/senha', trocarMinhaSenha);

// Gestão de usuários — restrita ao dono.
router.get('/', requireDono, listarUsuarios);
router.get('/:id', requireDono, buscarUsuario);
router.post('/', requireDono, criarUsuario);
router.patch('/:id/ativo', requireDono, alternarAtivo);
router.patch('/:id/senha', requireDono, resetarSenha);

export default router;
