// Rotas de vendas — o núcleo do sistema (RF10–RF14).
import { Router } from 'express';
import {
  listarVendas,
  buscarVenda,
  criarVenda,
  cancelarVenda,
  corrigirVenda,
} from './venda.controller.js';

const router = Router();

router.get('/', listarVendas);            // ?de= &ate= &status= filtram
router.get('/:id', buscarVenda);          // cabeçalho + itens
router.post('/', criarVenda);             // lança a venda (transação)
router.post('/:id/corrigir', corrigirVenda);   // cancela e devolve o molde
router.patch('/:id/cancelar', cancelarVenda);  // soft delete (só dono)

export default router;
