// Controller do assistente de IA.
import { responder } from './assistente.service.js';
import { assistenteConfigurado, ErroOpenRouter } from './openrouter.js';
import { ErroNegocio } from '../config/erros.js';
import { verificarAcao } from './confirmacao.js';

const MAX_PERGUNTA = 1000; // caracteres — evita abuso de contexto
const MAX_CONFIRMACAO = 4000; // token HMAC; teto para não virar vetor de abuso

// POST /api/assistente/perguntar  { pergunta, historico, confirmacao? }
export async function perguntar(req, res) {
  const { pergunta, historico, confirmacao } = req.body;

  if (!pergunta || typeof pergunta !== 'string' || !pergunta.trim()) {
    return res.status(400).json({ erro: 'Informe a pergunta' });
  }
  if (pergunta.length > MAX_PERGUNTA) {
    return res
      .status(400)
      .json({ erro: `A pergunta deve ter no máximo ${MAX_PERGUNTA} caracteres` });
  }
  // O token é validado ANTES do 503: entrada inválida é problema do
  // pedido, não da configuração do servidor. Também evita gastar uma
  // chamada ao modelo com um token que já se sabe que não presta.
  if (confirmacao !== undefined) {
    if (typeof confirmacao !== 'string' || confirmacao.length > MAX_CONFIRMACAO) {
      return res.status(400).json({ erro: 'Confirmação inválida. Peça de novo ao Zé.' });
    }
    try {
      verificarAcao(confirmacao, req.usuario?.id);
    } catch (erro) {
      if (erro instanceof ErroNegocio) {
        return res.status(erro.status).json({ erro: erro.message });
      }
      throw erro;
    }
  }
  if (!assistenteConfigurado()) {
    return res.status(503).json({
      erro: 'O assistente ainda não foi configurado neste servidor.',
    });
  }

  try {
    const r = await responder({
      pergunta: pergunta.trim(),
      historico: Array.isArray(historico) ? historico : [],
      usuario: req.usuario,
      confirmacao,
    });
    res.json(r);
  } catch (erro) {
    // Token adulterado, expirado ou de outro usuário — 400/403 com a
    // mensagem que o usuário lê na tela.
    if (erro instanceof ErroNegocio) {
      return res.status(erro.status).json({ erro: erro.message });
    }
    if (erro instanceof ErroOpenRouter) {
      // 4xx do provedor não é culpa do cliente daqui — vira 502.
      const status = erro.status === 503 || erro.status === 504 ? erro.status : 502;
      return res.status(status).json({ erro: erro.message });
    }
    res.status(500).json({ erro: 'Falha ao consultar o assistente', detalhe: erro.message });
  }
}
