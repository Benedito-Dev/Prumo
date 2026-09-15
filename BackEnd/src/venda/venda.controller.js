// Controller de vendas — o núcleo do sistema (RF10–RF14).
// Casca HTTP: a regra de negócio mora em venda.service.js, para que as
// tools do Zé possam reusá-la sem duplicar a transação.
import { responderErro } from '../config/erros.js';
import * as vendas from './venda.service.js';

// GET /api/vendas?de=YYYY-MM-DD&ate=YYYY-MM-DD&status=concluida&cliente_id=UUID
//
// O dono vê a loja inteira; o vendedor vê só o que ele mesmo lançou. O
// recorte vem do token e SOBRESCREVE o que veio na query — sem isso,
// bastaria mandar ?usuario_id=<id do colega> para ler as vendas dele.
export async function listarVendas(req, res) {
  try {
    const filtros = { ...req.query };
    if (req.usuario.papel !== 'dono') {
      filtros.usuario_id = req.usuario.id;
    }
    res.json(await vendas.listarVendas(filtros));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao listar vendas');
  }
}

// GET /api/vendas/:id — cabeçalho + itens
//
// Filtrar só a listagem não bastaria: o id da venda vai na URL, e sem esta
// checagem o vendedor leria a venda de um colega trocando o endereço.
// Responde 404, não 403 — dizer "existe, mas não é sua" já confirmaria a
// venda a quem não deveria saber dela.
export async function buscarVenda(req, res) {
  try {
    const venda = await vendas.exigirVenda(req.params.id);
    if (req.usuario.papel !== 'dono' && venda.usuario_id !== req.usuario.id) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }
    res.json(venda);
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

// POST /api/vendas/:id/corrigir
//
// Cancela a venda e devolve o molde para a tela reabri-la preenchida.
// Não é edição: a venda original fica no histórico como cancelada e a
// versão corrigida entra como venda nova, pelo mesmo caminho de sempre.
// É o que mantém `item_venda` congelado (RF12) e ainda assim evita que o
// vendedor redigite tudo por causa de uma quantidade errada.
export async function corrigirVenda(req, res) {
  try {
    res.json(await vendas.prepararCorrecao(req.params.id, req.usuario));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao preparar a correção');
  }
}

// PATCH /api/vendas/:id/cancelar — soft delete (RF14), preserva o histórico.
//
// Cancelar tira dinheiro do faturamento e é cicatriz, não desfazer: a
// tool equivalente do Zé sempre foi ['dono'], mas esta rota estava aberta
// a qualquer vendedor — a mesma ação respondia diferente conforme o
// caminho. O vendedor conserta erro do dia por /corrigir, que cancela e
// reabre preenchido; cancelar sem substituir continua sendo do dono.
export async function cancelarVenda(req, res) {
  try {
    if (req.usuario.papel !== 'dono') {
      return res.status(403).json({
        erro: 'Só o dono cancela venda. Use "Corrigir venda" para acertar um erro.',
      });
    }
    res.json(await vendas.cancelarVenda(req.params.id));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao cancelar venda');
  }
}
