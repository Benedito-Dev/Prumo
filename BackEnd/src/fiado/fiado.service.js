// Regras de negócio de fiado (contas a receber).
//
// Funções puras de HTTP: recebem dados, devolvem dados, lançam ErroNegocio
// quando a regra barra. Servem tanto ao controller REST quanto às tools do
// Zé, sem que nenhum dos dois duplique SQL.
//
// Fiado é POR VENDA: saldo = valor_total − SUM(pagamentos), quita em 0.
// Mas quem paga é o CLIENTE, e um cliente pode ter várias vendas em aberto
// — daí a cascata em `registrarPagamentoEmCascata`.
import { pool, query } from '../config/db.js';
import { ErroNegocio, naoEncontrado } from '../config/erros.js';

// Centavo de ponto flutuante: NUMERIC(12,2) do banco vs. float do JS.
// Tudo que vira dinheiro passa por aqui antes de ser gravado ou devolvido.
const emReais = (n) => Number(Number(n).toFixed(2));

// Uma dívida "quitada" pode sobrar com resíduo de arredondamento. Meio
// centavo é a folga que separa saldo real de poeira de NUMERIC.
const TOLERANCIA = 0.009;

// Saldo em aberto por venda fiado concluída. Reaproveitado pelas listagens;
// o WHERE extra entra por concatenação porque é sempre literal daqui.
const SELECT_ABERTOS = `
  SELECT
    v.id,
    v.cliente_id,
    COALESCE(c.nome, 'Consumidor') AS cliente_nome,
    c.telefone                     AS cliente_telefone,
    v.valor_total,
    v.vendida_em,
    COALESCE(SUM(pf.valor), 0)                  AS pago,
    v.valor_total - COALESCE(SUM(pf.valor), 0)  AS saldo,
    EXTRACT(DAY FROM NOW() - v.vendida_em)::int AS dias
  FROM venda v
  LEFT JOIN cliente c ON c.id = v.cliente_id
  LEFT JOIN pagamento_fiado pf ON pf.venda_id = v.id
  WHERE v.status = 'concluida' AND v.forma_pagamento = 'fiado'
`;

// O SELECT devolve NUMERIC como string (driver pg). Converter na borda
// evita que "315" + "425" vire "315425" lá na frente.
const numerizarDivida = (row) => ({
  ...row,
  valor_total: Number(row.valor_total),
  pago: Number(row.pago),
  saldo: Number(row.saldo),
});

// Todas as dívidas em aberto, mais antigas primeiro (é a ordem em que o
// dono cobra, e a mesma da cascata).
export async function listarAbertos() {
  const { rows } = await query(
    `${SELECT_ABERTOS}
     GROUP BY v.id, c.nome, c.telefone
     HAVING v.valor_total - COALESCE(SUM(pf.valor), 0) > ${TOLERANCIA}
     ORDER BY v.vendida_em ASC`
  );
  return rows.map(numerizarDivida);
}

export async function resumoAbertos() {
  const { rows } = await query(
    `SELECT
       COALESCE(SUM(saldo), 0) AS total_receber,
       COUNT(*)                AS qtd
     FROM (
       SELECT v.id, v.valor_total - COALESCE(SUM(pf.valor), 0) AS saldo
       FROM venda v
       LEFT JOIN pagamento_fiado pf ON pf.venda_id = v.id
       WHERE v.status = 'concluida' AND v.forma_pagamento = 'fiado'
       GROUP BY v.id
       HAVING v.valor_total - COALESCE(SUM(pf.valor), 0) > ${TOLERANCIA}
     ) sub`
  );
  return {
    total_receber: Number(rows[0].total_receber),
    qtd: Number(rows[0].qtd),
  };
}

export async function pagamentosDaVenda(vendaId) {
  const { rows } = await query(
    `SELECT pf.*, u.nome AS usuario_nome
       FROM pagamento_fiado pf
       LEFT JOIN usuario u ON u.id = pf.usuario_id
      WHERE pf.venda_id = $1
      ORDER BY pf.pago_em`,
    [vendaId]
  );
  return rows.map((p) => ({ ...p, valor: Number(p.valor) }));
}

// Dívidas em aberto de UM cliente, da mais antiga para a mais nova.
// É a fila que a cascata percorre — a ordem aqui é regra de negócio,
// não conveniência de exibição.
export async function fiadosDoCliente(clienteId) {
  const { rows } = await query(
    `${SELECT_ABERTOS}
       AND v.cliente_id = $1
     GROUP BY v.id, c.nome, c.telefone
     HAVING v.valor_total - COALESCE(SUM(pf.valor), 0) > ${TOLERANCIA}
     ORDER BY v.vendida_em ASC`,
    [clienteId]
  );
  return rows.map(numerizarDivida);
}

// Quanto o cliente deve ao todo. Atalho para quem só quer o número.
export async function totalDevidoPeloCliente(clienteId) {
  const dividas = await fiadosDoCliente(clienteId);
  return emReais(dividas.reduce((soma, d) => soma + d.saldo, 0));
}

// Valida o valor antes de qualquer ida ao banco: número, positivo, finito.
function exigirValorValido(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ErroNegocio('Valor do pagamento deve ser maior que zero');
  }
  return emReais(n);
}

// Lê o saldo da venda com a linha travada. Só faz sentido dentro de uma
// transação: sem o FOR UPDATE, dois caixas recebendo ao mesmo tempo
// poderiam gravar pagamentos que somados estouram o valor da venda.
async function saldoTravado(client, vendaId) {
  const v = await client.query(
    `SELECT valor_total, forma_pagamento, status FROM venda WHERE id = $1 FOR UPDATE`,
    [vendaId]
  );
  if (v.rowCount === 0) throw naoEncontrado('Venda não encontrada');

  const venda = v.rows[0];
  if (venda.forma_pagamento !== 'fiado' || venda.status !== 'concluida') {
    throw new ErroNegocio('Esta venda não é um fiado em aberto');
  }

  const pg = await client.query(
    `SELECT COALESCE(SUM(valor), 0) AS pago FROM pagamento_fiado WHERE venda_id = $1`,
    [vendaId]
  );
  return emReais(Number(venda.valor_total) - Number(pg.rows[0].pago));
}

// Pagamento em UMA venda específica. É o que a tela do balcão faz hoje:
// a pessoa já está olhando a dívida e sabe qual é.
export async function registrarPagamento({ venda_id, valor, usuario_id = null }) {
  const pago = exigirValorValido(valor);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saldo = await saldoTravado(client, venda_id);
    if (pago > saldo + TOLERANCIA) {
      throw new ErroNegocio(`Valor excede o saldo em aberto (${saldo.toFixed(2)})`);
    }

    await client.query(
      `INSERT INTO pagamento_fiado (venda_id, valor, usuario_id) VALUES ($1, $2, $3)`,
      [venda_id, pago, usuario_id]
    );

    await client.query('COMMIT');
    const novoSaldo = emReais(saldo - pago);
    return { pago, saldo: novoSaldo, quitado: novoSaldo <= TOLERANCIA };
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- cascata

// O coração da Fatia 5. "O Marcos pagou 200" — em qual das dívidas dele?
//
// Regra de produto: abate da MAIS ANTIGA para a mais nova. É como o dono
// cobra e como o cliente entende a própria conta ("estou pagando aquela
// de julho"). Qualquer outra ordem faria a dívida velha envelhecer para
// sempre enquanto as novas se quitam.
//
// Duas garantias que não podem cair:
//  1. Valor maior que o total devido é ErroNegocio ANTES do primeiro
//     INSERT. Não existe tabela de crédito: sobra viraria dinheiro
//     desaparecido no sistema.
//  2. Tudo numa transação. Um pagamento de R$ 200 que quita a venda A e
//     falha na B deixaria o cliente com um recibo que não bate com o
//     sistema — pior que não ter registrado nada.
export async function registrarPagamentoEmCascata({ cliente_id, valor, usuario_id = null }) {
  const recebido = exigirValorValido(valor);
  if (!cliente_id) throw new ErroNegocio('Informe de qual cliente é o pagamento');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Trava todas as vendas fiado do cliente antes de somar. Se outra
    // transação estiver recebendo em paralelo, esperamos por ela em vez
    // de calcular em cima de um total que já mudou.
    const { rows } = await client.query(
      `SELECT v.id, v.valor_total, v.vendida_em
         FROM venda v
        WHERE v.cliente_id = $1
          AND v.status = 'concluida'
          AND v.forma_pagamento = 'fiado'
        ORDER BY v.vendida_em ASC
          FOR UPDATE`,
      [cliente_id]
    );

    // Saldo de cada uma, já com os pagamentos anteriores descontados.
    const fila = [];
    for (const venda of rows) {
      const pg = await client.query(
        `SELECT COALESCE(SUM(valor), 0) AS pago FROM pagamento_fiado WHERE venda_id = $1`,
        [venda.id]
      );
      const saldo = emReais(Number(venda.valor_total) - Number(pg.rows[0].pago));
      if (saldo > TOLERANCIA) {
        fila.push({ id: venda.id, vendida_em: venda.vendida_em, saldo });
      }
    }

    if (fila.length === 0) {
      throw new ErroNegocio('Este cliente não tem fiado em aberto');
    }

    const totalDevido = emReais(fila.reduce((soma, d) => soma + d.saldo, 0));
    if (recebido > totalDevido + TOLERANCIA) {
      // Antes de gravar qualquer coisa — nunca gera crédito.
      throw new ErroNegocio(
        `Valor recebido (R$ ${recebido.toFixed(2)}) é maior que o total devido pelo cliente (R$ ${totalDevido.toFixed(2)})`
      );
    }

    // A cascata em si: abate o que couber em cada dívida, na ordem.
    const abatimentos = [];
    let restante = recebido;
    for (const divida of fila) {
      if (restante <= TOLERANCIA) break;

      const abatido = emReais(Math.min(restante, divida.saldo));
      await client.query(
        `INSERT INTO pagamento_fiado (venda_id, valor, usuario_id) VALUES ($1, $2, $3)`,
        [divida.id, abatido, usuario_id]
      );

      const saldoDepois = emReais(divida.saldo - abatido);
      abatimentos.push({
        venda_id: divida.id,
        vendida_em: divida.vendida_em,
        saldo_antes: divida.saldo,
        abatido,
        saldo_depois: saldoDepois,
        quitada: saldoDepois <= TOLERANCIA,
      });
      restante = emReais(restante - abatido);
    }

    await client.query('COMMIT');

    return {
      cliente_id,
      recebido,
      total_devido_antes: totalDevido,
      total_devido_depois: emReais(totalDevido - recebido),
      abatimentos,
      dividas_quitadas: abatimentos.filter((a) => a.quitada).length,
      quitou_tudo: emReais(totalDevido - recebido) <= TOLERANCIA,
    };
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}
