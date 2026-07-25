// Controller do painel de indicadores (RF16–RF22).
// Somente leitura. Todas as consultas ignoram vendas canceladas.
import { query } from '../config/db.js';
import { resolverPeriodo, mesCorrenteEAnterior } from './periodo.js';

// GET /api/painel/faturamento
// Faturamento do mês corrente com comparação ao anterior (RF16).
export async function faturamento(req, res) {
  try {
    const { inicioMes, inicioMesAnterior } = mesCorrenteEAnterior();

    const sql = `
      SELECT
        COALESCE(SUM(valor_total) FILTER (WHERE vendida_em >= $1), 0)               AS mes_atual,
        COALESCE(SUM(valor_total) FILTER (WHERE vendida_em >= $2 AND vendida_em < $1), 0) AS mes_anterior,
        COUNT(*) FILTER (WHERE vendida_em >= $1)                                    AS vendas_mes_atual
      FROM venda
      WHERE status = 'concluida' AND vendida_em >= $2
    `;
    const r = await query(sql, [inicioMes, inicioMesAnterior]);
    const { mes_atual, mes_anterior, vendas_mes_atual } = r.rows[0];

    const atual = Number(mes_atual);
    const anterior = Number(mes_anterior);
    // variação percentual; null quando não há base de comparação
    const variacao_pct = anterior > 0
      ? Number((((atual - anterior) / anterior) * 100).toFixed(1))
      : null;

    res.json({
      mes_atual: atual,
      mes_anterior: anterior,
      variacao_pct,
      vendas_mes_atual: Number(vendas_mes_atual),
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao calcular faturamento', detalhe: erro.message });
  }
}

// GET /api/painel/resumo?periodo=mes
// Números-chave do período: total faturado, nº de vendas e ticket médio (RF18).
export async function resumo(req, res) {
  try {
    const { de, ate } = resolverPeriodo(req.query);
    const sql = `
      SELECT
        COALESCE(SUM(valor_total), 0) AS total,
        COUNT(*)                      AS qtd_vendas,
        COALESCE(AVG(valor_total), 0) AS ticket_medio
      FROM venda
      WHERE status = 'concluida' AND vendida_em >= $1 AND vendida_em < $2
    `;
    const r = await query(sql, [de, ate]);
    res.json({
      periodo: { de, ate },
      total: Number(r.rows[0].total),
      qtd_vendas: Number(r.rows[0].qtd_vendas),
      ticket_medio: Number(Number(r.rows[0].ticket_medio).toFixed(2)),
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao calcular resumo', detalhe: erro.message });
  }
}

// GET /api/painel/ranking-clientes?periodo=mes&limite=10
// Clientes que mais compraram, por valor e por volume (RF17).
export async function rankingClientes(req, res) {
  try {
    const { de, ate } = resolverPeriodo(req.query);
    const limite = Math.min(Number(req.query.limite) || 10, 50);

    const sql = `
      SELECT
        v.cliente_id,
        COALESCE(c.nome, 'Consumidor') AS cliente_nome,
        SUM(v.valor_total) AS total_gasto,
        COUNT(*)           AS qtd_compras
      FROM venda v
      LEFT JOIN cliente c ON c.id = v.cliente_id
      WHERE v.status = 'concluida' AND v.vendida_em >= $1 AND v.vendida_em < $2
      GROUP BY v.cliente_id, c.nome
      ORDER BY total_gasto DESC
      LIMIT $3
    `;
    const r = await query(sql, [de, ate, limite]);
    res.json(r.rows.map((row) => ({
      cliente_id: row.cliente_id,
      cliente_nome: row.cliente_nome,
      total_gasto: Number(row.total_gasto),
      qtd_compras: Number(row.qtd_compras),
    })));
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao montar ranking de clientes', detalhe: erro.message });
  }
}

// GET /api/painel/produtos-mais-vendidos?periodo=mes&limite=10
// Produtos mais vendidos no período, por quantidade e por valor (RF19).
export async function produtosMaisVendidos(req, res) {
  try {
    const { de, ate } = resolverPeriodo(req.query);
    const limite = Math.min(Number(req.query.limite) || 10, 50);

    const sql = `
      SELECT
        i.produto_id,
        i.produto_nome,
        SUM(i.quantidade) AS quantidade_total,
        SUM(i.subtotal)   AS valor_total
      FROM item_venda i
      JOIN venda v ON v.id = i.venda_id
      WHERE v.status = 'concluida' AND v.vendida_em >= $1 AND v.vendida_em < $2
      GROUP BY i.produto_id, i.produto_nome
      ORDER BY quantidade_total DESC
      LIMIT $3
    `;
    const r = await query(sql, [de, ate, limite]);
    res.json(r.rows.map((row) => ({
      produto_id: row.produto_id,
      produto_nome: row.produto_nome,
      quantidade_total: Number(row.quantidade_total),
      valor_total: Number(row.valor_total),
    })));
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao listar produtos mais vendidos', detalhe: erro.message });
  }
}

// GET /api/painel/vendas-por-vendedor?periodo=mes
// Faturamento e nº de vendas por vendedor (RF20).
export async function vendasPorVendedor(req, res) {
  try {
    const { de, ate } = resolverPeriodo(req.query);
    const sql = `
      SELECT
        v.usuario_id,
        u.nome AS usuario_nome,
        SUM(v.valor_total) AS total_vendido,
        COUNT(*)           AS qtd_vendas
      FROM venda v
      JOIN usuario u ON u.id = v.usuario_id
      WHERE v.status = 'concluida' AND v.vendida_em >= $1 AND v.vendida_em < $2
      GROUP BY v.usuario_id, u.nome
      ORDER BY total_vendido DESC
    `;
    const r = await query(sql, [de, ate]);
    res.json(r.rows.map((row) => ({
      usuario_id: row.usuario_id,
      usuario_nome: row.usuario_nome,
      total_vendido: Number(row.total_vendido),
      qtd_vendas: Number(row.qtd_vendas),
    })));
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao listar vendas por vendedor', detalhe: erro.message });
  }
}

// GET /api/painel/evolucao-faturamento?periodo=mes
// Faturamento agrupado por dia, para o gráfico de evolução (RF22).
export async function evolucaoFaturamento(req, res) {
  try {
    const { de, ate } = resolverPeriodo(req.query);
    const sql = `
      SELECT
        DATE(vendida_em) AS dia,
        SUM(valor_total) AS total
      FROM venda
      WHERE status = 'concluida' AND vendida_em >= $1 AND vendida_em < $2
      GROUP BY DATE(vendida_em)
      ORDER BY dia
    `;
    const r = await query(sql, [de, ate]);
    res.json(r.rows.map((row) => ({
      dia: row.dia,
      total: Number(row.total),
    })));
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao montar evolução do faturamento', detalhe: erro.message });
  }
}
