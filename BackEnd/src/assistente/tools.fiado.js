// Tools de fiado do Zé (Fatia 5).
//
// Uma só: registrar_pagamento_fiado. Ela NÃO pede confirmação — receber no
// balcão é a operação mais frequente e mais urgente do módulo, e é
// reversível na conversa. O que substitui a confirmação é o registro
// detalhado do retorno: o modelo tem que dizer em qual venda o dinheiro
// entrou e quanto ainda resta.
import * as fiados from '../fiado/fiado.service.js';
import { buscarClientesPorNome } from '../cliente/cliente.service.js';
import { ErroNegocio } from '../config/erros.js';

const reais = (n) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`;

const dataCurta = (d) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

// Erro vai para o modelo como DADO, não como exceção: ele precisa
// explicar em português. SQL cru nunca vaza para o modelo.
function comoErro(erro) {
  if (erro instanceof ErroNegocio) return { ok: false, erro: erro.message };
  return { ok: false, erro: 'Não consegui registrar o pagamento agora.' };
}

// Seção 4 do contrato: 1 resultado segue, 0 ou 2+ devolvem erro.
// Ambiguidade é pergunta, não chute — errar aqui credita dinheiro na
// conta do cliente errado, em silêncio.
async function resolverCliente(nome) {
  const termo = String(nome ?? '').trim();
  if (!termo) return { erro: { ok: false, erro: 'Informe de qual cliente é o pagamento.' } };

  const achados = await buscarClientesPorNome(termo);

  if (achados.length === 0) {
    return { erro: { ok: false, erro: `Não achei nenhum cliente com "${termo}".` } };
  }
  if (achados.length > 1) {
    return {
      erro: {
        ok: false,
        erro: `Achei ${achados.length} clientes com "${termo}". Qual deles?`,
        precisa_escolher: achados.map((c) => ({
          id: c.id,
          rotulo: c.telefone ? `${c.nome} (${c.telefone})` : c.nome,
        })),
      },
    };
  }
  return { cliente: achados[0] };
}

// Frase pronta para o modelo transcrever. Discriminar venda por venda é
// requisito de produto, não enfeite: sem isso o dono não sabe qual conta
// foi abatida.
function resumirCascata(nomeCliente, resultado) {
  const partes = resultado.abatimentos.map((a) =>
    a.quitada
      ? `${reais(a.abatido)} quitaram a venda de ${dataCurta(a.vendida_em)}`
      : `${reais(a.abatido)} entraram na venda de ${dataCurta(a.vendida_em)}, que ainda deve ${reais(a.saldo_depois)}`
  );

  const fecho = resultado.quitou_tudo
    ? `${nomeCliente} não deve mais nada.`
    : `${nomeCliente} ainda deve ${reais(resultado.total_devido_depois)} no total.`;

  return `Recebi ${reais(resultado.recebido)} de ${nomeCliente}: ${partes.join('; ')}. ${fecho}`;
}

export const TOOLS_FIADO = {
  registrar_pagamento_fiado: {
    escreve: true,
    papeis: '*',
    fonte: { rotulo: 'Fiados', para: '/fiados' },
    schema: {
      name: 'registrar_pagamento_fiado',
      description:
        'Registra o recebimento de um pagamento de fiado de um cliente. Use para "o Marcos pagou 200", "recebi 150 do João do fiado" ou "o Zé quitou a conta". Se o cliente tem várias dívidas em aberto, o pagamento abate da mais antiga para a mais nova automaticamente. Depois de executar, diga SEMPRE em qual venda o dinheiro entrou e quanto ainda resta.',
      parameters: {
        type: 'object',
        properties: {
          cliente: {
            type: 'string',
            description: 'Nome (ou parte do nome) do cliente que está pagando.',
          },
          valor: {
            type: 'number',
            description: 'Valor recebido, em reais.',
          },
          venda_id: {
            type: 'string',
            description:
              'Opcional. Só quando a pessoa disser explicitamente qual dívida está pagando. Sem isso, o pagamento entra em cascata da dívida mais antiga para a mais nova.',
          },
        },
        required: ['cliente', 'valor'],
      },
    },

    async executar({ cliente, valor, venda_id }, usuario) {
      try {
        const { cliente: encontrado, erro } = await resolverCliente(cliente);
        if (erro) return erro;

        // Caminho por venda: só quando a pessoa apontou a dívida. Ainda
        // assim confere que a venda é do cliente citado — o modelo pode
        // ter pescado um id de uma resposta anterior sobre outra pessoa.
        if (venda_id) {
          const dividas = await fiados.fiadosDoCliente(encontrado.id);
          const alvo = dividas.find((d) => d.id === venda_id);
          if (!alvo) {
            return {
              ok: false,
              erro: `Essa venda não é uma dívida em aberto de ${encontrado.nome}.`,
            };
          }

          const pago = await fiados.registrarPagamento({
            venda_id,
            valor,
            usuario_id: usuario?.id ?? null,
          });
          const restante = await fiados.totalDevidoPeloCliente(encontrado.id);

          return {
            ok: true,
            acao: 'pagamento_registrado',
            entidade: 'pagamento_fiado',
            cliente: encontrado.nome,
            registro: {
              venda_id,
              vendida_em: alvo.vendida_em,
              abatido: pago.pago,
              saldo_da_venda: pago.saldo,
              quitada: pago.quitado,
            },
            total_devido_depois: restante,
            resumo:
              `Recebi ${reais(pago.pago)} de ${encontrado.nome} na venda de ${dataCurta(alvo.vendida_em)}` +
              (pago.quitado ? ', que ficou quitada' : `, que ainda deve ${reais(pago.saldo)}`) +
              `. No total ${encontrado.nome} ainda deve ${reais(restante)}.`,
          };
        }

        const resultado = await fiados.registrarPagamentoEmCascata({
          cliente_id: encontrado.id,
          valor,
          usuario_id: usuario?.id ?? null,
        });

        return {
          ok: true,
          acao: 'pagamento_registrado',
          entidade: 'pagamento_fiado',
          cliente: encontrado.nome,
          registro: resultado.abatimentos.map((a) => ({
            venda_id: a.venda_id,
            vendida_em: a.vendida_em,
            abatido: a.abatido,
            saldo_da_venda: a.saldo_depois,
            quitada: a.quitada,
          })),
          recebido: resultado.recebido,
          total_devido_depois: resultado.total_devido_depois,
          resumo: resumirCascata(encontrado.nome, resultado),
        };
      } catch (erro) {
        return comoErro(erro);
      }
    },
  },
};
