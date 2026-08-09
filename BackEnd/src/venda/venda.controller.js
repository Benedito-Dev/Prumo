// Controller de vendas — o núcleo do sistema (RF10–RF14).
// Casca HTTP: a regra de negócio mora em venda.service.js, para que as
// tools do Zé possam reusá-la sem duplicar a transação.
import { responderErro } from '../config/erros.js';
import * as vendas from './venda.service.js';

// GET /api/vendas?de=YYYY-MM-DD&ate=YYYY-MM-DD&status=concluida&cliente_id=UUID
export async function listarVendas(req, res) {
  try {
    res.json(await vendas.listarVendas(req.query));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao listar vendas');
  }
}

// GET /api/vendas/:id — cabeçalho + itens
export async function buscarVenda(req, res) {
  try {
    res.json(await vendas.exigirVenda(req.params.id));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao buscar venda');
  }
}

// POST /api/vendas
// Corpo: { cliente_id?, forma_pagamento, itens: [{ produto_id, quantidade, preco_unitario? }] }
// cliente_id ausente/null = venda "Consumidor" (RF03).
// preco_unitario por item é opcional: se não vier, usa o preço atual do produto;
// se vier, respeita a negociação do balcão (RF12).
//
// Quem vendeu sai do TOKEN, nunca do corpo: antes vinha em usuario_id, o que
// permitia lançar venda no nome de outro vendedor e fazer o RF20
// (vendas-por-vendedor) mentir. O campo no corpo é ignorado.
export async function criarVenda(req, res) {
  try {
    const { cliente_id, forma_pagamento, itens, desconto } = req.body;
    const venda = await vendas.criarVenda({
      cliente_id,
      usuario_id: req.usuario.id,
      forma_pagamento,
      itens,
      desconto,
    });
    res.status(201).json(venda);
  } catch (erro) {
    responderErro(res, erro, 'Falha ao registrar venda');
  }
}

// PATCH /api/vendas/:id/cancelar — soft delete (RF14), preserva o histórico.
export async function cancelarVenda(req, res) {
  try {
    res.json(await vendas.cancelarVenda(req.params.id));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao cancelar venda');
  }
}
