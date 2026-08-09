// Controller de clientes (RF01–RF05).
// Casca HTTP — a regra mora em cliente.service.js.
import { responderErro } from '../config/erros.js';
import * as clientes from './cliente.service.js';

// GET /api/clientes?busca=termo
export async function listarClientes(req, res) {
  try {
    res.json(await clientes.listarClientes(req.query));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao listar clientes');
  }
}

// GET /api/clientes/estatisticas
export async function estatisticasClientes(req, res) {
  try {
    res.json(await clientes.estatisticasClientes());
  } catch (erro) {
    responderErro(res, erro, 'Falha ao carregar estatísticas');
  }
}

// GET /api/clientes/:id
export async function buscarCliente(req, res) {
  try {
    res.json(await clientes.exigirCliente(req.params.id));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao buscar cliente');
  }
}

// POST /api/clientes
export async function criarCliente(req, res) {
  try {
    res.status(201).json(await clientes.criarCliente(req.body));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao criar cliente');
  }
}

// PUT /api/clientes/:id
export async function atualizarCliente(req, res) {
  try {
    res.json(await clientes.atualizarCliente(req.params.id, req.body));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao atualizar cliente');
  }
}

// DELETE /api/clientes/:id
export async function removerCliente(req, res) {
  try {
    await clientes.removerCliente(req.params.id);
    res.status(204).send();
  } catch (erro) {
    responderErro(res, erro, 'Falha ao remover cliente');
  }
}
