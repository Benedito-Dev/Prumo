// Controller do painel de indicadores (RF16–RF22).
// Somente leitura. Todas as consultas ignoram vendas canceladas.
import { query } from '../config/db.js';
import { responderErro } from '../config/erros.js';
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
    responderErro(res, erro, 'Falha ao calcular faturamento');
  }
}

// GET /api/painel/resumo?periodo=mes
// Números-chave do período: total faturado, nº de vendas e ticket médio (RF18).
export async function resumo(req, res) {
  try {
    const { de, ate } = resolverPeriodo(req.query);

    // Período anterior de mesma duração (para comparar tendência).
    const dur = new Date(ate) - new Date(de);
    const antDe = new Date(new Date(de) - dur).toISOString();
    const antAte = de;

    const sql = `
      SELECT
        COALESCE(SUM(valor_total), 0) AS total,
        COUNT(*)                      AS qtd_vendas,
        COALESCE(AVG(valor_total), 0) AS ticket_medio,
        COUNT(DISTINCT cliente_id)    AS clientes
      FROM venda
      WHERE status = 'concluida' AND vendida_em >= $1 AND vendida_em < $2
    `;
    const [atual, anterior] = await Promise.all([
      query(sql, [de, ate]),
      query(sql, [antDe, antAte]),
    ]);

    const a = atual.rows[0];
    const b = anterior.rows[0];

    // variação percentual; null quando não há base de comparação (>0)
    const varPct = (novo, velho) =>
      Number(velho) > 0 ? Number((((novo - velho) / velho) * 100).toFixed(1)) : null;

    res.json({
      periodo: { de, ate },
      total: Number(a.total),
      qtd_vendas: Number(a.qtd_vendas),
      ticket_medio: Number(Number(a.ticket_medio).toFixed(2)),
      clientes: Number(a.clientes),
      // variações vs. período anterior
      variacao: {
        total: varPct(Number(a.total), Number(b.total)),
        qtd_vendas: varPct(Number(a.qtd_vendas), Number(b.qtd_vendas)),
        ticket_medio: varPct(Number(a.ticket_medio), Number(b.ticket_medio)),
        clientes: varPct(Number(a.clientes), Number(b.clientes)),
      },
    });
  } catch (erro) {
    responderErro(res, erro, 'Falha ao calcular resumo');
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
    responderErro(res, erro, 'Falha ao montar ranking de clientes');
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
    responderErro(res, erro, 'Falha ao listar produtos mais vendidos');
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
    responderErro(res, erro, 'Falha ao listar vendas por vendedor');
  }
}

// GET /api/painel/meu-resumo?periodo=mes
// O desempenho do PRÓPRIO usuário logado — a única rota do painel aberta
// ao vendedor. Todas as outras expõem números da loja (faturamento, ranking
// de clientes, quanto cada colega vendeu) e são restritas ao dono.
//
// O filtro vem de req.usuario.id, nunca da query string: aceitar um
// usuario_id do cliente devolveria a um vendedor o desempenho de outro,
// que é exatamente o que esta rota existe para não fazer.
export async function meuResumo(req, res) {
  try {
    const { de, ate } = resolverPeriodo(req.query);

    const sql = `
      SELECT
        COALESCE(SUM(valor_total), 0) AS total,
        COUNT(*)                      AS qtd_vendas,
        COALESCE(AVG(valor_total), 0) AS ticket_medio
      FROM venda
      WHERE status = 'concluida'
        AND usuario_id = $1
        AND vendida_em >= $2 AND vendida_em < $3
    `;
    const r = await query(sql, [req.usuario.id, de, ate]);
    const a = r.rows[0];

    res.json({
      periodo: { de, ate },
      total: Number(a.total),
      qtd_vendas: Number(a.qtd_vendas),
      ticket_medio: Number(Number(a.ticket_medio).toFixed(2)),
    });
  } catch (erro) {
    responderErro(res, erro, 'Falha ao calcular seu resumo');
  }
}

// GET /api/painel/minha-evolucao?periodo=mes
// Faturamento diário do próprio vendedor, para o gráfico da tela dele.
export async function minhaEvolucao(req, res) {
  try {
    const { de, ate } = resolverPeriodo(req.query);
    const sql = `
      SELECT
        DATE(vendida_em) AS dia,
        SUM(valor_total) AS total
      FROM venda
      WHERE status = 'concluida'
        AND usuario_id = $1
        AND vendida_em >= $2 AND vendida_em < $3
      GROUP BY DATE(vendida_em)
      ORDER BY dia
    `;
    const r = await query(sql, [req.usuario.id, de, ate]);
    res.json(r.rows.map((row) => ({
      dia: row.dia,
      total: Number(row.total),
    })));
  } catch (erro) {
    responderErro(res, erro, 'Falha ao montar sua evolução');
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
    responderErro(res, erro, 'Falha ao montar evolução do faturamento');
  }
}
