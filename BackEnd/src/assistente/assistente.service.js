// Serviço do assistente — monta o prompt e conversa com o modelo.
//
// PASSO 1 (atual): sem tools. O modelo responde só com o que sabe da
// conversa, e é instruído a dizer que ainda não consulta os dados.
// PASSO 3 acrescenta o catálogo de tools e o loop de execução.

import { chamarModelo } from './openrouter.js';

const MAX_HISTORICO = 20; // últimas mensagens que viajam no contexto

function systemPrompt(usuario) {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return `Você é o assistente do Prumo, um sistema de gestão para um depósito de material de construção.

Quem está falando com você: ${usuario?.nome || 'um usuário'} (${usuario?.papel || 'sem papel'}).
Hoje é ${hoje}.

COMO RESPONDER
- Escreva em português do Brasil, de forma direta e simples.
- Quem lê não tem familiaridade com sistemas: nada de jargão técnico.
- Respostas curtas. Isso é um chat, não um relatório.
- Valores sempre em reais, no formato R$ 1.234,56.

REGRA MAIS IMPORTANTE
- NUNCA invente números, nomes de clientes, valores ou datas.
- Se você não tem o dado, diga que não tem. Um número errado é muito pior
  que um "não sei".

O QUE VOCÊ AINDA NÃO CONSEGUE FAZER
- Você ainda NÃO tem acesso aos dados do depósito (vendas, clientes,
  fiados, produtos). Essa ligação está sendo construída.
- Se perguntarem algo que dependa desses dados, explique com naturalidade
  que ainda não consegue consultar essa informação, e sugira a tela do
  sistema onde ela está disponível (Painel, Vendas, Fiados, Clientes ou
  Produtos).
- Você pode conversar normalmente sobre o que é o Prumo e como usá-lo.`;
}

// Converte o histórico do front ({ papel, texto }) para o formato do modelo.
function traduzirHistorico(historico = []) {
  return historico
    .filter((m) => m && typeof m.texto === 'string' && m.texto.trim())
    .slice(-MAX_HISTORICO)
    .map((m) => ({
      role: m.papel === 'assistente' ? 'assistant' : 'user',
      content: m.texto,
    }));
}

// Responde uma pergunta. Devolve { resposta, fontes }.
export async function responder({ pergunta, historico, usuario }) {
  const mensagens = [
    { role: 'system', content: systemPrompt(usuario) },
    ...traduzirHistorico(historico),
    { role: 'user', content: pergunta },
  ];

  const { mensagem } = await chamarModelo({ mensagens });

  return {
    resposta: mensagem?.content?.trim() || 'Não consegui formular uma resposta.',
    fontes: [], // passo 3: cada tool usada acrescenta a sua
  };
}
