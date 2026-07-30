// Controller de clientes (RF01–RF05).
import { query } from '../config/db.js';

const TIPOS_VALIDOS = ['consumidor_final', 'pedreiro', 'construtora', 'revenda'];

// GET /api/clientes?busca=termo
// Lista clientes; se vier ?busca, filtra por nome parcial OU telefone (RF05).
export async function listarClientes(req, res) {
  try {
    const { busca } = req.query;

    if (busca) {
      const resultado = await query(
        `SELECT * FROM cliente
          WHERE nome ILIKE $1 OR telefone ILIKE $1
          ORDER BY nome`,
        [`%${busca}%`]
      );
      return res.json(resultado.rows);
    }

    const resultado = await query('SELECT * FROM cliente ORDER BY nome');
    res.json(resultado.rows);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao listar clientes', detalhe: erro.message });
  }
}

// GET /api/clientes/estatisticas
// Clientes com estatísticas de compra: total gasto, nº de compras e
// última compra (LEFT JOIN — clientes sem compra também aparecem).
// dias_sem_comprar ajuda a identificar "cliente sumido" (RF24).
export async function estatisticasClientes(req, res) {
  try {
    const sql = `
      SELECT
        c.*,
        COALESCE(SUM(v.valor_total), 0)                    AS total_gasto,
        COUNT(v.id)                                        AS qtd_compras,
        MAX(v.vendida_em)                                  AS ultima_compra,
        CASE WHEN MAX(v.vendida_em) IS NOT NULL
             THEN EXTRACT(DAY FROM NOW() - MAX(v.vendida_em))::int
             ELSE NULL END                                 AS dias_sem_comprar
      FROM cliente c
      LEFT JOIN venda v ON v.cliente_id = c.id AND v.status = 'concluida'
      GROUP BY c.id
      ORDER BY total_gasto DESC, c.nome
    `;
    const r = await query(sql);
    res.json(
      r.rows.map((row) => ({
        ...row,
        total_gasto: Number(row.total_gasto),
        qtd_compras: Number(row.qtd_compras),
        dias_sem_comprar: row.dias_sem_comprar,
      }))
    );
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao carregar estatísticas', detalhe: erro.message });
  }
}

// GET /api/clientes/:id
export async function buscarCliente(req, res) {
  try {
    const { id } = req.params;
    const resultado = await query('SELECT * FROM cliente WHERE id = $1', [id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao buscar cliente', detalhe: erro.message });
  }
}

// POST /api/clientes
// Mínimo obrigatório: nome e telefone (RF02). tipo e observacao são opcionais.
export async function criarCliente(req, res) {
  try {
    const { nome, telefone, tipo, observacao } = req.body;

    if (!nome || !telefone) {
      return res.status(400).json({ erro: 'Nome e telefone são obrigatórios' });
    }
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}` });
    }

    const resultado = await query(
      `INSERT INTO cliente (nome, telefone, tipo, observacao)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nome, telefone, tipo ?? null, observacao ?? null]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao criar cliente', detalhe: erro.message });
  }
}

// PUT /api/clientes/:id
export async function atualizarCliente(req, res) {
  try {
    const { id } = req.params;
    const { nome, telefone, tipo, observacao } = req.body;

    if (!nome || !telefone) {
      return res.status(400).json({ erro: 'Nome e telefone são obrigatórios' });
    }
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}` });
    }

    const resultado = await query(
      `UPDATE cliente
          SET nome = $1, telefone = $2, tipo = $3, observacao = $4
        WHERE id = $5
      RETURNING *`,
      [nome, telefone, tipo ?? null, observacao ?? null, id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao atualizar cliente', detalhe: erro.message });
  }
}

// DELETE /api/clientes/:id
export async function removerCliente(req, res) {
  try {
    const { id } = req.params;
    const resultado = await query('DELETE FROM cliente WHERE id = $1 RETURNING id', [id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }
    res.status(204).send();
  } catch (erro) {
    // Cliente com vendas vinculadas não pode ser apagado (FK) — orientar o uso
    if (erro.code === '23503') {
      return res.status(409).json({
        erro: 'Cliente possui vendas e não pode ser removido',
      });
    }
    res.status(500).json({ erro: 'Falha ao remover cliente', detalhe: erro.message });
  }
}
