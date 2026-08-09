// Token de confirmação das ações destrutivas do Zé.
//
// O PROBLEMA: se a ação pendente for um JSON que vai ao front e volta,
// então o front decide o que o servidor executa. Qualquer um com um
// access token válido — ou o DevTools aberto — manda
// { confirmacao: { tool: 'cancelar_venda', args: { id: <qualquer> } } }
// e o backend obedece, sem a IA ter proposto nada.
//
// A SOLUÇÃO: o servidor assina a proposta. O token viaja opaco pelo
// front e só é aceito de volta se a assinatura bater. Sem estado no
// servidor — o sistema não guarda sessão em lugar nenhum
// (assistente.service.js reconstrói tudo do histórico do cliente), e
// criar a primeira tabela de estado efêmero só para isso seria
// desproporcional.
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { ErroNegocio } from '../config/erros.js';

// 5 minutos: tempo de balcão, não de sessão. O operador confirma na
// hora; token velho não deve valer quando o contexto já mudou.
const VALIDADE_MS = 5 * 60 * 1000;

// Reusa o segredo que já assina os JWT — zero configuração nova.
// Lido a cada uso (não no import) para o processo não subir com um
// valor velho se o ambiente mudar.
function segredo() {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) {
    throw new Error('JWT_ACCESS_SECRET ausente — sem ele não há confirmação segura.');
  }
  return s;
}

const assinar = (dados) =>
  createHmac('sha256', segredo()).update(dados).digest('base64url');

// Compara em tempo constante. Uma comparação com === vaza, pelo tempo,
// quantos bytes iniciais bateram — o que permite forjar byte a byte.
function assinaturaConfere(esperada, recebida) {
  const a = Buffer.from(esperada);
  const b = Buffer.from(recebida);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Assina uma ação proposta pelo Zé. O retorno é opaco para o front.
export function assinarAcao({ tool, args, usuarioId }) {
  const corpo = {
    jti: randomUUID(), // identifica esta proposta específica
    tool,
    args,
    usuario_id: usuarioId, // AMARRA ao usuário que pediu
    expira_em: Date.now() + VALIDADE_MS,
  };
  const dados = Buffer.from(JSON.stringify(corpo)).toString('base64url');
  return `${dados}.${assinar(dados)}`;
}

// Verifica e devolve { tool, args }. Lança ErroNegocio em qualquer
// desvio — as mensagens são para o usuário ler, não para depurar.
export function verificarAcao(token, usuarioId) {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw new ErroNegocio('Confirmação inválida. Peça de novo ao Zé.', {
      codigo: 'confirmacao_invalida',
    });
  }

  const [dados, assinatura] = token.split('.');
  if (!dados || !assinatura || !assinaturaConfere(assinar(dados), assinatura)) {
    throw new ErroNegocio('Confirmação inválida. Peça de novo ao Zé.', {
      codigo: 'confirmacao_invalida',
    });
  }

  let corpo;
  try {
    corpo = JSON.parse(Buffer.from(dados, 'base64url').toString());
  } catch {
    // Assinatura válida mas corpo ilegível não deveria acontecer;
    // se acontecer, trata como inválido em vez de estourar 500.
    throw new ErroNegocio('Confirmação inválida. Peça de novo ao Zé.', {
      codigo: 'confirmacao_invalida',
    });
  }

  // Ordem importa: "não é sua" antes de "expirou" seria vazar que o
  // token de outra pessoa existe. Expiração primeiro é mais discreto.
  if (Date.now() > corpo.expira_em) {
    throw new ErroNegocio('Essa confirmação expirou. Peça de novo.', {
      codigo: 'confirmacao_expirada',
    });
  }
  if (corpo.usuario_id !== usuarioId) {
    throw new ErroNegocio('Essa confirmação não é sua.', {
      status: 403,
      codigo: 'confirmacao_de_outro',
    });
  }

  return { tool: corpo.tool, args: corpo.args };
}
