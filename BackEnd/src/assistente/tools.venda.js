// Tools de venda do Zé (Fatia 6) — as que mexem em dinheiro.
//
// As duas CONFIRMAM. É a exceção à regra das outras escritas, e o
// motivo é o custo do erro:
//
// - Cancelamento é soft delete: uma venda lançada errada não some, ela
//   fica no histórico marcada como cancelada. É cicatriz, não desfazer.
// - É a única escrita multi-entidade: N produtos + 1 cliente, e cada
//   um é uma chance de acertar o registro errado em silêncio.
// - Se for fiado, a venda errada vira cobrança fantasma para um cliente
//   de verdade na tela de Fiados.
//
// A confirmação não é um "tem certeza?": é a NOTA da venda montada, que
// a pessoa lê como leria um papel no balcão. A mesma conferência que as
// outras tools fazem depois de gravar — só que aqui vem antes, porque
// aqui gravar é caro.
import * as vendas from '../venda/venda.service.js';
import { resolverCliente, resolverProduto } from './resolver.js';
import { ErroNegocio } from '../config/erros.js';

const FONTE = { rotulo: 'Vendas', para: '/vendas' };

const reais = (n) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`;
const dataCurta = (d) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

function comoErro(erro, generica) {
  if (erro instanceof ErroNegocio) return { ok: false, erro: erro.message };
  console.error(`[tools.venda] ${generica}:`, erro.message);
  return { ok: false, erro: generica };
}

// Resolve TUDO antes de qualquer INSERT — cliente e os N produtos.
// Uma venda parcialmente executada é inaceitável, e perguntar item por
// item seria uma conversa insuportável: se houver ambiguidade em mais de
// um lugar, devolve todas as pendências de uma vez para o Zé perguntar
// numa frase só.
async function resolverTudo({ cliente, cliente_id, itens }) {
  const pendencias = {};
  let clienteResolvido = null;

  // Sem cliente = venda "Consumidor" (RF03) — não é erro.
  if (cliente || cliente_id) {
    const r = await resolverCliente({ id: cliente_id, busca: cliente });
    if (r.falha) {
      pendencias.cliente = r.falha.precisa_escolher ?? [];
      pendencias._erros = [...(pendencias._erros ?? []), r.falha.erro];
    } else {
      clienteResolvido = r.item;
    }
  }

  const linhas = [];
  for (const [i, item] of itens.entries()) {
    const termo = item.produto ?? item.produto_id;
    const r = await resolverProduto({ id: item.produto_id, busca: item.produto });
    if (r.falha) {
      pendencias[`item ${i + 1} (${termo})`] = r.falha.precisa_escolher ?? [];
      pendencias._erros = [...(pendencias._erros ?? []), r.falha.erro];
      continue;
    }
    linhas.push({
      produto_id: r.item.id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    });
  }

  const erros = pendencias._erros ?? [];
  delete pendencias._erros;

  if (erros.length > 0) {
    return {
      falha: {
        ok: false,
        erro: erros.join(' '),
        precisa_escolher: pendencias,
      },
    };
  }
  return { cliente: clienteResolvido, itens: linhas };
}

// A nota que a pessoa lê antes de confirmar. Formato de papel de
// balcão: quantidade, produto, preço unitário, subtotal.
function montarNota({ nota, cliente, forma_pagamento }) {
  const linhas = nota.itens.map(
    (i) =>
      `${i.quantidade} ${i.unidade} ${i.produto_nome} — ${reais(i.preco_unitario)} = ${reais(i.subtotal)}`
  );
  const partes = [
    `Cliente: ${cliente ? cliente.nome : 'Consumidor'}`,
    `Pagamento: ${forma_pagamento}`,
  ];
  if (nota.desconto > 0) {
    partes.push(`Desconto: ${reais(nota.desconto)} (de ${reais(nota.soma_itens)})`);
  }
  return `${linhas.join('; ')}. ${partes.join(' · ')} · TOTAL ${reais(nota.valor_total)}`;
}

export const TOOLS_VENDA = {
  criar_venda: {
    escreve: true,
    confirma: true,
    papeis: '*',
    fonte: FONTE,
    schema: {
      name: 'criar_venda',
      description:
        'Lança uma venda no sistema. Use para "vende 10 sacos de cimento pro João no fiado" ' +
        'ou "lança 2 vergalhões à vista". Mostra a nota e PEDE CONFIRMAÇÃO antes de gravar — ' +
        'não diga que vendeu antes de a pessoa confirmar. Sem cliente, a venda é para Consumidor.',
      parameters: {
        type: 'object',
        properties: {
          itens: {
            type: 'array',
            description: 'Os produtos vendidos.',
            items: {
              type: 'object',
              properties: {
                produto: {
                  type: 'string',
                  description: 'Nome (ou parte) do produto, como o usuário falou.',
                },
                produto_id: {
                  type: 'string',
                  description: 'Id do produto, quando já foi escolhido numa pergunta anterior.',
                },
                quantidade: { type: 'number', description: 'Quantas unidades.' },
                preco_unitario: {
                  type: 'number',
                  description:
                    'Preço negociado, em reais. Só mande se o usuário citou um preço diferente do de tabela.',
                },
              },
              required: ['quantidade'],
            },
          },
          cliente: {
            type: 'string',
            description: 'Nome do cliente. Sem isso, a venda é "Consumidor".',
          },
          cliente_id: {
            type: 'string',
            description: 'Id do cliente, quando já foi escolhido numa pergunta anterior.',
          },
          forma_pagamento: {
            type: 'string',
            enum: vendas.FORMAS_PAGAMENTO,
            description: 'Como o cliente pagou.',
          },
          desconto: { type: 'number', description: 'Desconto em reais sobre o total. Opcional.' },
        },
        required: ['itens', 'forma_pagamento'],
      },
    },

    // PASSO 1: resolve, simula e mostra a nota. NADA é gravado.
    async preparar(args) {
      try {
        const itens = Array.isArray(args.itens) ? args.itens : [];
        if (itens.length === 0) {
          return { ok: false, erro: 'A venda precisa de ao menos um item.' };
        }

        const resolvido = await resolverTudo({
          cliente: args.cliente,
          cliente_id: args.cliente_id,
          itens,
        });
        if (resolvido.falha) return resolvido.falha;

        // Valida com os IDs já resolvidos: pega quantidade zerada e
        // forma de pagamento inválida antes de simular.
        vendas.validarPedidoDeVenda({
          forma_pagamento: args.forma_pagamento,
          itens: resolvido.itens,
          desconto: args.desconto ?? 0,
        });

        const nota = await vendas.simularVenda({
          itens: resolvido.itens,
          desconto: args.desconto ?? 0,
        });

        return {
          ok: true,
          precisa_confirmar: true,
          // Só IDs viajam para o passo 2 — o nome já foi resolvido e
          // não pode ser resolvido de novo, sob risco de dar em outro.
          args: {
            cliente_id: resolvido.cliente?.id ?? null,
            forma_pagamento: args.forma_pagamento,
            desconto: args.desconto ?? 0,
            itens: resolvido.itens,
          },
          rotulo: 'Lançar venda',
          resumo: montarNota({
            nota,
            cliente: resolvido.cliente,
            forma_pagamento: args.forma_pagamento,
          }),
        };
      } catch (erro) {
        return comoErro(erro, 'Não consegui montar a venda agora.');
      }
    },

    // PASSO 2: grava, com os IDs que foram assinados no token.
    async executar(args, usuario) {
      try {
        const venda = await vendas.criarVenda({
          cliente_id: args.cliente_id,
          usuario_id: usuario?.id,
          forma_pagamento: args.forma_pagamento,
          itens: args.itens,
          desconto: args.desconto,
        });

        const ehFiado = venda.forma_pagamento === 'fiado';
        return {
          ok: true,
          acao: 'venda_lancada',
          entidade: 'venda',
          registro: venda,
          resumo:
            `Venda lançada para ${venda.cliente_nome ?? 'Consumidor'}: ` +
            `${reais(venda.valor_total)} em ${venda.forma_pagamento}.` +
            (ehFiado ? ' Entrou na conta de fiado do cliente.' : ''),
        };
      } catch (erro) {
        return comoErro(erro, 'Não consegui lançar a venda agora.');
      }
    },
  },

  cancelar_venda: {
    escreve: true,
    confirma: true,
    papeis: ['dono'], // some com dinheiro do faturamento — decisão de dono
    fonte: FONTE,
    schema: {
      name: 'cancelar_venda',
      description:
        'Cancela uma venda já lançada. A venda não some: fica marcada como cancelada e sai ' +
        'do faturamento. Pede confirmação. Se não souber o id, informe o cliente para eu ' +
        'listar as vendas recentes dele.',
      parameters: {
        type: 'object',
        properties: {
          venda_id: { type: 'string', description: 'Id da venda a cancelar.' },
          cliente: {
            type: 'string',
            description: 'Nome do cliente, quando não se sabe o id da venda.',
          },
          cliente_id: { type: 'string', description: 'Id do cliente, se já resolvido.' },
        },
        required: [],
      },
    },

    async preparar(args) {
      try {
        let venda = null;

        if (args.venda_id) {
          venda = await vendas.buscarVenda(args.venda_id);
          if (!venda) return { ok: false, erro: 'Não achei essa venda.' };
        } else {
          if (!args.cliente && !args.cliente_id) {
            return { ok: false, erro: 'Diga qual venda cancelar — pelo cliente ou pelo id.' };
          }
          const r = await resolverCliente({ id: args.cliente_id, busca: args.cliente });
          if (r.falha) return r.falha;

          const recentes = await vendas.vendasRecentesDoCliente(r.item.id);
          if (recentes.length === 0) {
            return { ok: false, erro: `${r.item.nome} não tem venda recente para cancelar.` };
          }
          if (recentes.length > 1) {
            // Mesma regra do resolvedor: não escolhe, pergunta.
            return {
              ok: false,
              erro: `${r.item.nome} tem ${recentes.length} vendas recentes. Qual delas?`,
              precisa_escolher: recentes.map((v) => ({
                id: v.id,
                rotulo: `${dataCurta(v.vendida_em)} — ${reais(v.valor_total)} (${v.forma_pagamento})`,
              })),
            };
          }
          venda = await vendas.buscarVenda(recentes[0].id);
        }

        if (venda.status === 'cancelada') {
          return { ok: false, erro: 'Essa venda já está cancelada.' };
        }

        const itens = venda.itens
          .map((i) => `${i.quantidade} ${i.produto_nome}`)
          .join('; ');

        return {
          ok: true,
          precisa_confirmar: true,
          args: { venda_id: venda.id },
          rotulo: 'Cancelar venda',
          resumo:
            `Cancelar a venda de ${dataCurta(venda.vendida_em)} para ` +
            `${venda.cliente_nome ?? 'Consumidor'} — ${reais(venda.valor_total)} (${itens}). ` +
            'Ela sai do faturamento, mas continua no histórico marcada como cancelada.',
        };
      } catch (erro) {
        return comoErro(erro, 'Não consegui preparar o cancelamento agora.');
      }
    },

    async executar(args) {
      try {
        const cancelada = await vendas.cancelarVenda(args.venda_id);
        return {
          ok: true,
          acao: 'venda_cancelada',
          entidade: 'venda',
          registro: cancelada,
          resumo: 'Venda cancelada. Ela saiu do faturamento e continua no histórico.',
        };
      } catch (erro) {
        return comoErro(erro, 'Não consegui cancelar a venda agora.');
      }
    },
  },
};
