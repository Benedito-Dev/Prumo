// Rotas de categorias (RF09).
import { Router } from 'express';
import {
  listarCategorias,
  buscarCategoria,
  criarCategoria,
  atualizarCategoria,
  removerCategoria,
} from './categoria.controller.js';

const router = Router();

router.get('/', listarCategorias);
router.get('/:id', buscarCategoria);
router.post('/', criarCategoria);
router.put('/:id', atualizarCategoria);
router.delete('/:id', removerCategoria);

export default router;
