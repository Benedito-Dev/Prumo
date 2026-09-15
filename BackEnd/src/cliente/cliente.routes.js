// Rotas de clientes (RF01–RF05).
import { Router } from 'express';
import {
  listarClientes,
  estatisticasClientes,
  buscarCliente,
  criarCliente,
  atualizarCliente,
  removerCliente,
} from './cliente.controller.js';
import { requireDono } from '../auth/requireDono.js';

const router = Router();

// Aberto ao balcão: buscar e cadastrar cliente é parte de lançar a venda.
// `listarClientes` já devolve ao vendedor só o resultado de uma busca, e o
// dono recebe a lista completa (ver o controller).
router.get('/', listarClientes);              // ?busca= filtra por nome/telefone

// Quanto cada cliente gastou, quantas compras fez, quem sumiu (RF24). É
// relatório de dono, não ferramenta de balcão — nada aqui ajuda a vender.
router.get('/estatisticas', requireDono, estatisticasClientes); // antes de /:id!

router.get('/:id', buscarCliente);
router.post('/', criarCliente);

// Editar e apagar cadastro é administração: o vendedor cria cliente novo no
// balcão, mas não mexe nem remove o que já existe.
router.put('/:id', requireDono, atualizarCliente);
router.delete('/:id', requireDono, removerCliente);

export default router;
