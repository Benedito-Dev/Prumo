// Limite de tentativas na porta de entrada.
//
// Senha de balcão de depósito é senha fraca — o nome da loja, uma data,
// seis dígitos. Contra isso, tentativa ilimitada quebra qualquer conta em
// minutos, e a conta que interessa ao atacante é a do dono, que administra
// usuários e vê todos os números.
//
// O número é folgado de propósito: quem erra a senha 10 vezes em 15 minutos
// não é o vendedor abrindo o caixa de manhã. O limite atrapalha o script,
// não a pessoa.
import rateLimit from 'express-rate-limit';

export const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,

  // skipSuccessfulRequests: só tentativa MALSUCEDIDA conta. Sem isso, um
  // balcão movimentado com vários vendedores no mesmo IP (a loja tem uma
  // internet só) esgotaria a cota fazendo login de verdade.
  skipSuccessfulRequests: true,

  // Cabeçalhos padrão (RateLimit-*); os X-RateLimit-* antigos ficam de fora.
  standardHeaders: 'draft-7',
  legacyHeaders: false,

  // Mensagem no mesmo formato de erro do resto da API ({ erro }) e escrita
  // para quem não é técnico — quem esbarra aqui costuma ser alguém que
  // esqueceu a senha, não um invasor.
  message: {
    erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.',
  },
});
