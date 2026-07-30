// Controller de fiados (contas a receber).
// Fiado é por venda: saldo = valor_total − SUM(pagamentos). Quita em 0.
import { pool, query } from '../config/db.js';

// GET /api/fiados
// Vendas fiado concluídas com saldo em aberto (> 0), mais antigas primeiro.
export async function listarAbertos(req, res) {
  try {
    const sql = `
      SELECT
        v.id,
        v.cliente_id,
        COALESCE(c.nome, 'Consumidor') AS cliente_nome,
        c.telefone                     AS cliente_telefone,
        v.valor_total,
        v.vendida_em,
        COALESCE(SUM(pf.valor), 0)                 AS pago,
        v.valor_total - COALESCE(SUM(pf.valor), 0) AS saldo,
        EXTRACT(DAY FROM NOW() - v.vendida_em)::int AS dias
      FROM venda v
      LEFT JOIN cliente c ON c.id = v.cliente_id
      LEFT JOIN pagamento_fiado pf ON pf.venda_id = v.id
      WHERE v.status = 'concluida' AND v.forma_pagamento = 'fiado'
      GROUP BY v.id, c.nome, c.telefone
      HAVING v.valor_total - COALESCE(SUM(pf.valor), 0) > 0.009
      ORDER BY v.vendida_em ASC
    `;
    const r = await query(sql);
    res.json(
      r.rows.map((row) => ({
        ...row,
        valor_total: Number(row.valor_total),
        pago: Number(row.pago),
        saldo: Number(row.saldo),
      }))
    );
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao listar fiados', detalhe: erro.message });
  }
}

// GET /api/fiados/resumo — total a receber e nº de dívidas em aberto.
export async function resumo(req, res) {
  try {
    const sql = `
      SELECT
        COALESCE(SUM(saldo), 0) AS total_receber,
        COUNT(*)                AS qtd
      FROM (
        SELECT v.id, v.valor_total - COALESCE(SUM(pf.valor), 0) AS saldo
        FROM venda v
        LEFT JOIN pagamento_fiado pf ON pf.venda_id = v.id
        WHERE v.status = 'concluida' AND v.forma_pagamento = 'fiado'
        GROUP BY v.id
        HAVING v.valor_total - COALESCE(SUM(pf.valor), 0) > 0.009
      ) sub
    `;
    const r = await query(sql);
    res.json({
      total_receber: Number(r.rows[0].total_receber),
      qtd: Number(r.rows[0].qtd),
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao calcular resumo', detalhe: erro.message });
  }
}

// GET /api/fiados/:vendaId/pagamentos — histórico de quitações de uma venda.
export async function pagamentosDaVenda(req, res) {
  try {
    const { vendaId } = req.params;
    const r = await query(
      `SELECT pf.*, u.nome AS usuario_nome
         FROM pagamento_fiado pf
         LEFT JOIN usuario u ON u.id = pf.usuario_id
        WHERE pf.venda_id = $1
        ORDER BY pf.pago_em`,
      [vendaId]
    );
    res.json(r.rows.map((p) => ({ ...p, valor: Number(p.valor) })));
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao buscar pagamentos', detalhe: erro.message });
  }
}

// POST /api/fiados/:vendaId/pagar  { valor }
// Registra um pagamento (parcial ou total). Não pode exceder o saldo.
export async function pagar(req, res) {
  const { vendaId } = req.params;
  const valor = Number(req.body.valor);

  if (!valor || valor <= 0) {
    return res.status(400).json({ erro: 'Valor do pagamento deve ser maior que zero' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // trava a venda e confirma que é fiado concluída
    const v = await client.query(
      `SELECT valor_total, forma_pagamento, status FROM venda WHERE id = $1 FOR UPDATE`,
      [vendaId]
    );
    if (v.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }
    const venda = v.rows[0];
    if (venda.forma_pagamento !== 'fiado' || venda.status !== 'concluida') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Esta venda não é um fiado em aberto' });
    }

    // saldo atual
    const pg = await client.query(
      `SELECT COALESCE(SUM(valor), 0) AS pago FROM pagamento_fiado WHERE venda_id = $1`,
      [vendaId]
    );
    const saldo = Number(venda.valor_total) - Number(pg.rows[0].pago);
    if (valor > saldo + 0.009) {
      await client.query('ROLLBACK');
      return res
        .status(400)
        .json({ erro: `Valor excede o saldo em aberto (${saldo.toFixed(2)})` });
    }

    await client.query(
      `INSERT INTO pagamento_fiado (venda_id, valor, usuario_id)
       VALUES ($1, $2, $3)`,
      [vendaId, Number(valor.toFixed(2)), req.usuario?.id ?? null]
    );

    await client.query('COMMIT');
    const novoSaldo = Number((saldo - valor).toFixed(2));
    res.status(201).json({ pago: Number(valor.toFixed(2)), saldo: novoSaldo, quitado: novoSaldo <= 0.009 });
  } catch (erro) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Falha ao registrar pagamento', detalhe: erro.message });
  } finally {
    client.release();
  }
}
