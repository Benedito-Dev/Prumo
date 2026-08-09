// Zé — o assistente de IA do Prumo. Perguntas em linguagem natural sobre
// o negócio. A rota e o campo `papel: 'assistente'` seguem com o nome
// técnico: renomear quebraria links salvos e o contrato com a API.
import { api } from './api';

export const assistenteService = {
  // Envia a pergunta + o histórico recente (contexto da conversa).
  //
  // `confirmacao` é o token que veio em `acao_pendente` de uma resposta
  // anterior, devolvido intacto ao clicar no botão. É ele que autoriza a
  // ação destrutiva — o texto digitado nunca autoriza nada.
  //
  // Espera { resposta, fontes?, acao_pendente?: { token, rotulo, tipo } }
  perguntar: (pergunta, historico = [], confirmacao) =>
    api.post('/assistente/perguntar', {
      pergunta,
      historico,
      ...(confirmacao ? { confirmacao } : {}),
    }),
};

// Sugestões iniciais — as perguntas do README que motivaram o produto.
export const SUGESTOES = [
  'Quem são meus melhores clientes?',
  'Como foi o faturamento deste mês?',
  'Quanto tenho a receber de fiado?',
  'Quais produtos mais vendem?',
];
