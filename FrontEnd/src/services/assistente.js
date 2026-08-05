// Assistente de IA — perguntas em linguagem natural sobre o negócio.
// O back ainda não existe: enquanto /assistente/perguntar não responder,
// a página cai no aviso de indisponível (ver Assistente.jsx).
import { api } from './api';

export const assistenteService = {
  // Envia a pergunta + o histórico recente (contexto da conversa).
  // Espera { resposta: string, fontes?: [{ rotulo, para }] }
  perguntar: (pergunta, historico = []) =>
    api.post('/assistente/perguntar', { pergunta, historico }),
};

// Sugestões iniciais — as perguntas do README que motivaram o produto.
export const SUGESTOES = [
  'Quem são meus melhores clientes?',
  'Como foi o faturamento deste mês?',
  'Quanto tenho a receber de fiado?',
  'Quais produtos mais vendem?',
];
