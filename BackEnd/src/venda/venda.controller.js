// Controller de vendas — o núcleo do sistema (RF10–RF14).
import { pool, query } from '../config/db.js';

const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'cartao', 'fiado'];

// Monta o cabeçalho da venda com nomes de cliente e vendedor (para exibição).
const SELECT_VENDA = `
  SELECT v.*,
         c.nome AS cliente_nome,
         u.nome AS usuario_nome
    FROM venda v
    LEFT JOIN cliente c ON c.id = v.cliente_id
    JOIN usuario u ON u.id = v.usuario_id
`;

// GET /api/vendas?de=YYYY-MM-DD&ate=YYYY-MM-DD&status=concluida
export async function listarVendas(req, res) {
  try {
    const { de, ate, status } = req.query;
    const condicoes = [];
    const params = [];

    if (de) {
      params.push(de);
      condicoes.push(`v.vendida_em >= $${params.length}`);
    }
    if (ate) {
      params.push(ate);
      // inclui o dia inteiro do "ate"
      condicoes.push(`v.vendida_em < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (status) {
      params.push(status);
      condicoes.push(`v.status = $${params.length}`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const resultado = await query(`${SELECT_VENDA} ${where} ORDER BY v.vendida_em DESC`, params);
    res.json(resultado.rows);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao listar vendas', detalhe: erro.message });
  }
}

// GET /api/vendas/:id — cabeçalho + itens
export async function buscarVenda(req, res) {
  try {
    const { id } = req.params;

    const venda = await query(`${SELECT_VENDA} WHERE v.id = $1`, [id]);
    if (venda.rowCount === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    const itens = await query(
      'SELECT * FROM item_venda WHERE venda_id = $1 ORDER BY produto_nome',
      [id]
    );

    res.json({ ...venda.rows[0], itens: itens.rows });
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao buscar venda', detalhe: erro.message });
  }
}

// POST /api/vendas
// Corpo: { cliente_id?, usuario_id, forma_pagamento, itens: [{ produto_id, quantidade, preco_unitario? }] }
// cliente_id ausente/null = venda "Consumidor" (RF03).
// preco_unitario por item é opcional: se não vier, usa o preço atual do produto;
// se vier, respeita a negociação do balcão (RF12).
export async function criarVenda(req, res) {
  const { cliente_id, usuario_id, forma_pagamento, itens, desconto } = req.body;
  const descontoNum = Number(desconto) || 0;

  // --- Validações (antes de abrir a transação) ---
  if (descontoNum < 0) {
    return res.status(400).json({ erro: 'desconto não pode ser negativo' });
  }
  if (!usuario_id) {
    return res.status(400).json({ erro: 'usuario_id (quem vendeu) é obrigatório' });
  }
  if (!forma_pagamento || !FORMAS_PAGAMENTO.includes(forma_pagamento)) {
    return res.status(400).json({ erro: `forma_pagamento inválida. Use: ${FORMAS_PAGAMENTO.join(', ')}` });
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'A venda precisa de ao menos um item' });
  }
  for (const item of itens) {
    if (!item.produto_id) {
      return res.status(400).json({ erro: 'Cada item precisa de produto_id' });
    }
    if (item.quantidade === undefined || Number(item.quantidade) <= 0) {
      return res.status(400).json({ erro: 'Cada item precisa de quantidade maior que zero' });
    }
  }

  // --- Transação: venda + itens são gravados juntos ou nada ---
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Confirma o vendedor
    const usr = await client.query('SELECT id FROM usuario WHERE id = $1', [usuario_id]);
    if (usr.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Vendedor (usuario_id) não existe' });
    }

    // Cria o cabeçalho da venda (valor_total entra depois com a soma dos itens)
    const vendaResult = await client.query(
      `INSERT INTO venda (cliente_id, usuario_id, forma_pagamento, desconto, valor_total)
       VALUES ($1, $2, $3, $4, 0)
       RETURNING id`,
      [cliente_id ?? null, usuario_id, forma_pagamento, descontoNum]
    );
    const vendaId = vendaResult.rows[0].id;

    // Insere cada item congelando nome e preço no momento da venda
    let valorTotal = 0;
    for (const item of itens) {
      const prod = await client.query(
        'SELECT nome, preco_venda FROM produto WHERE id = $1 AND ativo = TRUE',
        [item.produto_id]
      );
      if (prod.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: `Produto ${item.produto_id} não existe ou está inativo` });
      }

      const nome = prod.rows[0].nome;
      // Preço: usa o negociado, se informado; senão o preço atual do produto
      const precoUnitario = item.preco_unitario !== undefined
        ? Number(item.preco_unitario)
        : Number(prod.rows[0].preco_venda);
      if (precoUnitario < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'preco_unitario não pode ser negativo' });
      }

      const quantidade = Number(item.quantidade);
      const subtotal = Number((quantidade * precoUnitario).toFixed(2));
      valorTotal += subtotal;

      await client.query(
        `INSERT INTO item_venda (venda_id, produto_id, produto_nome, quantidade, preco_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [vendaId, item.produto_id, nome, quantidade, precoUnitario, subtotal]
      );
    }

    // Aplica o desconto: total = soma dos itens − desconto (nunca abaixo de 0)
    const somaItens = Number(valorTotal.toFixed(2));
    if (descontoNum > somaItens) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Desconto maior que o total dos itens' });
    }
    valorTotal = Number((somaItens - descontoNum).toFixed(2));
    await client.query('UPDATE venda SET valor_total = $1 WHERE id = $2', [valorTotal, vendaId]);

    await client.query('COMMIT');

    // Devolve a venda completa
    const completa = await query(`${SELECT_VENDA} WHERE v.id = $1`, [vendaId]);
    const itensSalvos = await query('SELECT * FROM item_venda WHERE venda_id = $1', [vendaId]);
    res.status(201).json({ ...completa.rows[0], itens: itensSalvos.rows });
  } catch (erro) {
    await client.query('ROLLBACK');
    // cliente_id inexistente cai aqui (FK)
    if (erro.code === '23503') {
      return res.status(400).json({ erro: 'Cliente informado não existe' });
    }
    res.status(500).json({ erro: 'Falha ao registrar venda', detalhe: erro.message });
  } finally {
    client.release();
  }
}

// PATCH /api/vendas/:id/cancelar — soft delete (RF14), preserva o histórico.
export async function cancelarVenda(req, res) {
  try {
    const { id } = req.params;

    const resultado = await query(
      `UPDATE venda
          SET status = 'cancelada', cancelada_em = NOW()
        WHERE id = $1 AND status = 'concluida'
      RETURNING id, status, cancelada_em`,
      [id]
    );

    if (resultado.rowCount === 0) {
      // ou não existe, ou já estava cancelada
      const existe = await query('SELECT status FROM venda WHERE id = $1', [id]);
      if (existe.rowCount === 0) {
        return res.status(404).json({ erro: 'Venda não encontrada' });
      }
      return res.status(409).json({ erro: 'Venda já está cancelada' });
    }

    res.json(resultado.rows[0]);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao cancelar venda', detalhe: erro.message });
  }
}
