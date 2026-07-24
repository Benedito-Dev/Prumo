// Rotas de produtos (RF06–RF09).
import { Router } from 'express';
import {
  listarProdutos,
  buscarProduto,
  criarProduto,
  atualizarProduto,
  removerProduto,
} from './produto.controller.js';

const router = Router();

router.get('/', listarProdutos);       // ?categoria_id= e ?ativos=true filtram
router.get('/:id', buscarProduto);
router.post('/', criarProduto);
router.put('/:id', atualizarProduto);
router.delete('/:id', removerProduto);

export default router;
