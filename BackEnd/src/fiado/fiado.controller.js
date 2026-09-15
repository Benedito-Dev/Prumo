// Controller de fiados (contas a receber).
// Casca HTTP: traduz requisição -> service -> resposta. A regra de negócio
// mora em fiado.service.js, para que as tools do Zé possam reusá-la sem
// duplicar SQL.
import { responderErro } from '../config/erros.js';
import * as fiados from './fiado.service.js';

// GET /api/fiados
// Vendas fiado concluídas com saldo em aberto (> 0), mais antigas primeiro.
export async function listarAbertos(req, res) {
  try {
    res.json(await fiados.listarAbertos());
  } catch (erro) {
    responderErro(res, erro, 'Falha ao listar fiados');
  }
}

// GET /api/fiados/resumo — total a receber e nº de dívidas em aberto.
export async function resumo(req, res) {
  try {
    res.json(await fiados.resumoAbertos());
  } catch (erro) {
    responderErro(res, erro, 'Falha ao calcular resumo');
  }
}

// GET /api/fiados/cliente/:clienteId — dívida de UM cliente.
//
// Existe para o aviso no meio da venda ("este cliente tem R$ 340,00 em
// aberto, deseja abater?"). É aberta ao vendedor de propósito: ele descobre
// a dívida de quem está atendendo, e só dela — a lista de todos os
// devedores da loja (`GET /fiados`) continua restrita ao dono.
//
// A diferença não é técnica, é de ética: saber que o cliente à sua frente
// deve é atendimento; ter o mapa de quem está endividado é outra coisa.
export async function dividaDoCliente(req, res) {
  try {
    const dividas = await fiados.fiadosDoCliente(req.params.clienteId);
    const total = await fiados.totalDevidoPeloCliente(req.params.clienteId);
    res.json({
      total,
      qtd_dividas: dividas.length,
      // A mais antiga é a que a cobrança abate primeiro; a tela mostra a
      // data dela para dar a dimensão ("desde 12/03").
      mais_antiga: dividas[0]?.vendida_em ?? null,
    });
  } catch (erro) {
    responderErro(res, erro, 'Falha ao consultar dívida do cliente');
  }
}

// POST /api/fiados/cliente/:clienteId/pagar  { valor }
// Abate da dívida mais antiga para a mais nova, numa transação só.
// É o botão "abater" do aviso na venda: o vendedor recebe sem precisar
// saber de qual venda antiga o dinheiro está saindo.
export async function pagarCliente(req, res) {
  try {
    const resultado = await fiados.registrarPagamentoEmCascata({
      cliente_id: req.params.clienteId,
      valor: req.body.valor,
      usuario_id: req.usuario?.id ?? null,
    });
    res.status(201).json(resultado);
  } catch (erro) {
    responderErro(res, erro, 'Falha ao registrar pagamento');
  }
}

// GET /api/fiados/:vendaId/pagamentos — histórico de quitações de uma venda.
export async function pagamentosDaVenda(req, res) {
  try {
    res.json(await fiados.pagamentosDaVenda(req.params.vendaId));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao buscar pagamentos');
  }
}

// POST /api/fiados/:vendaId/pagar  { valor }
// Registra um pagamento (parcial ou total) NAQUELA venda. A tela sempre
// sabe qual é a dívida; a cascata por cliente é exclusiva do Zé.
export async function pagar(req, res) {
  try {
    const resultado = await fiados.registrarPagamento({
      venda_id: req.params.vendaId,
      valor: req.body.valor,
      usuario_id: req.usuario?.id ?? null,
    });
    res.status(201).json(resultado);
  } catch (erro) {
    responderErro(res, erro, 'Falha ao registrar pagamento');
  }
}
