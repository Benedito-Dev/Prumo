// Controller do assistente de IA.
import { responder } from './assistente.service.js';
import { assistenteConfigurado, ErroOpenRouter } from './openrouter.js';

const MAX_PERGUNTA = 1000; // caracteres — evita abuso de contexto

// POST /api/assistente/perguntar  { pergunta, historico }
export async function perguntar(req, res) {
  const { pergunta, historico } = req.body;

  if (!pergunta || typeof pergunta !== 'string' || !pergunta.trim()) {
    return res.status(400).json({ erro: 'Informe a pergunta' });
  }
  if (pergunta.length > MAX_PERGUNTA) {
    return res
      .status(400)
      .json({ erro: `A pergunta deve ter no máximo ${MAX_PERGUNTA} caracteres` });
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
    });
    res.json(r);
  } catch (erro) {
    if (erro instanceof ErroOpenRouter) {
      // 4xx do provedor não é culpa do cliente daqui — vira 502.
      const status = erro.status === 503 || erro.status === 504 ? erro.status : 502;
      return res.status(status).json({ erro: erro.message });
    }
    res.status(500).json({ erro: 'Falha ao consultar o assistente', detalhe: erro.message });
  }
}
