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
