// Peças compartilhadas pelas tools de escrita (Fatia 2).
//
// Existe para que as tools de escrita digam a mesma coisa do mesmo
// jeito: o mesmo formato de erro, a mesma moeda, a mesma comparação de
// antes/depois. Formato divergente entre duas tools vira resposta
// divergente do modelo, e aí quem lê não sabe se conferiu tudo.
//
// A resolução de nome ambíguo mora em resolver.js (Fatia 4) — era daqui
// e saiu para não haver duas regras de desempate no projeto.

import { ErroNegocio } from '../config/erros.js';

// Executa a operação e traduz falha em RETORNO, não em exceção: o modelo
// precisa do texto para explicar em português. Erro inesperado vira
// mensagem genérica — detalhe de SQL não vaza para o modelo (nem para a
// tela, por tabela).
export async function protegido(fn, mensagemGenerica) {
  try {
    return await fn();
  } catch (erro) {
    if (erro instanceof ErroNegocio) return { ok: false, erro: erro.message };
    console.error(`[tools] ${mensagemGenerica}:`, erro.message);
    return { ok: false, erro: mensagemGenerica };
  }
}

// R$ 1.234,56 — o mesmo formato que o resto do produto usa.
export function moeda(valor) {
  if (valor === null || valor === undefined) return null;
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Monta a lista de alterações comparando o registro antes e depois.
// Compara o que o BANCO gravou, não o que o modelo pediu: NUMERIC volta
// como string ("45.00"), e comparar string com número marcaria alteração
// onde não houve.
export function diferencas(antes, depois, campos) {
  const lista = [];
  for (const { campo, rotulo, formatar } of campos) {
    const de = antes[campo];
    const para = depois[campo];
    if (mesmoValor(de, para)) continue;
    lista.push({
      campo,
      de: formatar ? formatar(de) : de,
      para: formatar ? formatar(para) : para,
      rotulo,
    });
  }
  return lista;
}

function mesmoValor(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  // NUMERIC do pg chega como string; "45.00" e 45 são o mesmo preço.
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return String(a) === String(b);
}
