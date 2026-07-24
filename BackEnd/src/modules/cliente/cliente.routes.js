// Rotas de clientes (RF01–RF05).
import { Router } from 'express';
import {
  listarClientes,
  buscarCliente,
  criarCliente,
  atualizarCliente,
  removerCliente,
} from './cliente.controller.js';

const router = Router();

router.get('/', listarClientes);       // ?busca= filtra por nome/telefone
router.get('/:id', buscarCliente);
router.post('/', criarCliente);
router.put('/:id', atualizarCliente);
router.delete('/:id', removerCliente);

export default router;
