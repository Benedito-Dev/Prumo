// Cliente do OpenRouter — formato OpenAI-compatível (/chat/completions).
// Usa fetch nativo do Node; nenhuma dependência nova.
//
// O modelo vem do .env (OPENROUTER_MODEL), então trocar de modelo é editar
// uma linha e reiniciar — sem tocar em código.

const URL_API = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_PADRAO = 30000;

// Erro com status HTTP, para o controller escolher a resposta certa.
export class ErroOpenRouter extends Error {
  constructor(mensagem, status = 500) {
    super(mensagem);
    this.name = 'ErroOpenRouter';
    this.status = status;
  }
}

// true quando a chave está configurada — o controller responde 503 se não.
export function assistenteConfigurado() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function modeloAtual() {
  return process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
}

// Chama o modelo. `mensagens` no formato { role, content }.
// `tools` fica pronto para o passo 3 (tool calling); por ora vai vazio.
export async function chamarModelo({ mensagens, tools = [], toolChoice = 'auto' }) {
  if (!assistenteConfigurado()) {
    throw new ErroOpenRouter('Assistente não configurado (falta OPENROUTER_API_KEY)', 503);
  }

  const timeout = Number(process.env.OPENROUTER_TIMEOUT_MS) || TIMEOUT_PADRAO;
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), timeout);

  const corpo = {
    model: modeloAtual(),
    messages: mensagens,
  };
  if (tools.length > 0) {
    corpo.tools = tools;
    corpo.tool_choice = toolChoice;
  }

  let resposta;
  try {
    resposta = await fetch(URL_API, {
      method: 'POST',
      signal: controle.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        // O OpenRouter usa estes dois para atribuição no painel dele.
        'HTTP-Referer': 'https://github.com/Benedito-Dev/Prumo',
        'X-Title': 'Prumo',
      },
      body: JSON.stringify(corpo),
    });
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw new ErroOpenRouter(`O modelo demorou mais de ${timeout / 1000}s para responder`, 504);
    }
    throw new ErroOpenRouter(`Falha de rede ao chamar o modelo: ${erro.message}`, 502);
  } finally {
    clearTimeout(relogio);
  }

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    const detalhe = dados?.error?.message || `HTTP ${resposta.status}`;
    throw new ErroOpenRouter(`OpenRouter recusou a chamada: ${detalhe}`, resposta.status);
  }

  const escolha = dados.choices?.[0];
  if (!escolha) {
    throw new ErroOpenRouter('O modelo respondeu sem nenhuma escolha (choices vazio)', 502);
  }

  // Custo real, não estimativa — a base para decidir se o modelo compensa.
  if (dados.usage) {
    const { prompt_tokens: entrada, completion_tokens: saida } = dados.usage;
    console.log(
      `[assistente] ${modeloAtual()} · entrada ${entrada} · saída ${saida} tokens`
    );
  }

  return {
    mensagem: escolha.message,
    motivoParada: escolha.finish_reason,
    uso: dados.usage ?? null,
  };
}
