// Serviço do assistente — monta o prompt e conduz o loop de tool calling.
//
// Ciclo: manda a pergunta + o catálogo permitido ao papel -> o modelo pede
// uma tool -> executamos a query -> devolvemos o resultado -> ele responde
// em português. Repete até ele parar de pedir tools ou bater o teto.

import { chamarModelo } from './openrouter.js';
import { schemasParaModelo, executarTool } from './tools.js';

const MAX_HISTORICO = 20;   // últimas mensagens que viajam no contexto
const MAX_ITERACOES = 4;    // teto do loop — modelo confuso não roda solto

function systemPrompt(usuario) {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return `Você é o Zé, o assistente do Prumo — um sistema de gestão para um depósito de material de construção.

Quem está falando com você: ${usuario?.nome || 'um usuário'} (${usuario?.papel || 'sem papel'}).
Hoje é ${hoje}.

QUEM É VOCÊ
- Seu nome é Zé. Se perguntarem quem você é, diga que é o Zé, que ajuda a
  entender os números do depósito.
- Você é prestativo e direto, como um bom balconista veterano: conhece o
  movimento da casa e responde na hora, sem enrolação.
- Não precisa se apresentar a cada resposta — só quando perguntarem.

COMO RESPONDER
- Escreva em português do Brasil, de forma direta e simples.
- Quem lê não tem familiaridade com sistemas: nada de jargão técnico.
- Respostas curtas. Isso é um chat, não um relatório.
- Valores sempre em reais, no formato R$ 1.234,56.

CONSULTANDO OS DADOS
- Use as funções disponíveis para consultar os dados reais do depósito.
- Responda com base APENAS no que a função devolveu.
- Quando o usuário não disser o período, use o mês corrente.
- Se a função devolver uma lista vazia ou zerada, diga que ainda não há
  movimento no período — não tente preencher com suposições.
- Se a função devolver um erro de permissão, explique que essa informação
  é restrita ao dono, sem detalhar o motivo técnico.

ESCREVENDO NO SISTEMA
- Algumas funções GRAVAM de verdade no sistema (cadastrar e alterar produto
  ou cliente). Elas gravam na hora, sem pedir confirmação: não pergunte
  "posso cadastrar?" antes — cadastre e mostre o que ficou gravado.
- Quando uma função de gravação devolver "resumo", TRANSCREVA esse resumo na
  sua resposta. Não redija do zero, não resuma o resumo e não omita nada:
  ele traz de propósito os campos que ficaram vazios ("sem categoria", "sem
  preço de custo"), e é justamente isso que a pessoa precisa ver para
  perceber que faltou alguma coisa.
- NUNCA diga que cadastrou, alterou ou gravou algo sem ter chamado a função
  e recebido "ok": true. Se você não chamou, nada aconteceu no sistema.
- Se a função devolver "ok": false, explique o erro em português e diga o
  que a pessoa pode fazer. Não tente de novo com dados inventados.
- O telefone do cliente é obrigatório. Se pedirem para cadastrar alguém só
  com o nome, PERGUNTE o telefone antes de chamar a função. Nunca invente
  um número.
- Se a função devolver "precisa_escolher", ela achou mais de um registro e
  não gravou nada. Liste as opções que vieram e pergunte qual é. NUNCA
  escolha por conta própria: gravar no registro errado passa despercebido.
- Ao alterar, mande só os campos que a pessoa pediu para mudar. O que você
  não mandar continua como está.

RECEBENDO PAGAMENTO DE FIADO
- "Fulano pagou 200", "recebi 150 do fiado do João" — isso é a função de
  registrar pagamento de fiado. Ela grava na hora, sem confirmação: dinheiro
  no balcão não espera.
- Um cliente pode dever VÁRIAS vendas. O pagamento abate da dívida mais
  antiga para a mais nova, e pode entrar em mais de uma de uma vez.
- Por isso, ao responder, SEMPRE diga em qual venda (ou vendas) o dinheiro
  entrou e quanto ainda resta — por venda e no total. Nunca responda só
  "pagamento registrado": quem recebeu precisa saber qual conta foi abatida.
- O "resumo" que a função devolve já vem escrito assim. Transcreva-o.
- Se o valor for maior que o total devido, a função recusa e não grava nada.
  Diga quanto o cliente realmente devia e pergunte o que fazer. O sistema não
  guarda crédito a favor do cliente — não prometa que a sobra fica para a
  próxima compra.
- Se o cliente não tiver nenhuma dívida em aberto, diga isso. Não invente uma
  venda para receber.

REGRA MAIS IMPORTANTE
- NUNCA invente números, nomes de clientes, valores ou datas.
- Todo número que você citar tem que ter vindo de uma função.
- Se você não tem o dado, diga que não tem. Um número errado é muito pior
  que um "não sei".`;
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
  const papel = usuario?.papel;
  const tools = schemasParaModelo(papel);

  const mensagens = [
    { role: 'system', content: systemPrompt(usuario) },
    ...traduzirHistorico(historico),
    { role: 'user', content: pergunta },
  ];

  // Fontes acumuladas: cada tool usada oferece o atalho para a sua tela.
  const fontes = new Map();

  for (let volta = 0; volta < MAX_ITERACOES; volta++) {
    const { mensagem } = await chamarModelo({ mensagens, tools });
    const pedidos = mensagem?.tool_calls || [];

    // Sem pedido de tool: é a resposta final.
    if (pedidos.length === 0) {
      return {
        resposta: mensagem?.content?.trim() || 'Não consegui formular uma resposta.',
        fontes: [...fontes.values()],
      };
    }

    // O turno do assistente precisa entrar no histórico antes dos resultados.
    mensagens.push(mensagem);

    for (const pedido of pedidos) {
      const nome = pedido.function?.name;
      let args = {};
      try {
        args = JSON.parse(pedido.function?.arguments || '{}');
      } catch {
        args = {}; // argumentos malformados: segue com os padrões da tool
      }

      let resultado;
      let fonte = null;
      try {
        ({ resultado, fonte } = await executarTool(nome, args, usuario));
      } catch (erro) {
        // Falha de banco não derruba a conversa — o modelo é avisado.
        console.error(`[assistente] tool ${nome} falhou:`, erro.message);
        resultado = { erro: 'Não foi possível consultar essa informação agora.' };
      }

      if (fonte) fontes.set(fonte.para, fonte);
      console.log(`[assistente] tool ${nome}(${JSON.stringify(args)})`);

      mensagens.push({
        role: 'tool',
        tool_call_id: pedido.id,
        content: JSON.stringify(resultado),
      });
    }
  }

  // Estourou o teto: pede uma resposta final com o que já foi coletado.
  mensagens.push({
    role: 'user',
    content:
      'Responda agora, em uma frase, com base no que você já consultou. Não chame mais funções.',
  });
  const { mensagem } = await chamarModelo({ mensagens });

  return {
    resposta:
      mensagem?.content?.trim() ||
      'Consultei os dados mas não consegui montar a resposta. Tente perguntar de outro jeito.',
    fontes: [...fontes.values()],
  };
}
