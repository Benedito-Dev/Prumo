// Controller de produtos (RF06–RF09).
// Casca HTTP: traduz requisição -> service -> resposta. A regra de
// negócio mora em produto.service.js, para que as tools do Zé possam
// reusá-la sem duplicar SQL.
import { responderErro } from '../config/erros.js';
import * as produtos from './produto.service.js';

// GET /api/produtos?categoria_id=...&ativos=true
export async function listarProdutos(req, res) {
  try {
    res.json(await produtos.listarProdutos(req.query));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao listar produtos');
  }
}

// GET /api/produtos/:id
export async function buscarProduto(req, res) {
  try {
    res.json(await produtos.exigirProduto(req.params.id));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao buscar produto');
  }
}

// POST /api/produtos
export async function criarProduto(req, res) {
  try {
    res.status(201).json(await produtos.criarProduto(req.body));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao criar produto');
  }
}

// PUT /api/produtos/:id
// Substituição total: campo omitido vira NULL (a tela manda a ficha inteira).
export async function atualizarProduto(req, res) {
  try {
    res.json(await produtos.atualizarProduto(req.params.id, req.body));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao atualizar produto');
  }
}

// DELETE /api/produtos/:id
// Se o produto já tem vendas, não apaga — a FK barra e vira 409.
export async function removerProduto(req, res) {
  try {
    await produtos.removerProduto(req.params.id);
    res.status(204).send();
  } catch (erro) {
    responderErro(res, erro, 'Falha ao remover produto');
  }
}
