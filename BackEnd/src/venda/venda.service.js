// Regras de negócio de venda (RF10–RF14) — o núcleo do sistema.
//
// Sem HTTP: recebe dados, devolve dados, lança ErroNegocio. Antes tudo
// isto vivia dentro do controller, com `return res.status(...)` no meio
// da transação — o que tornava impossível reusar a partir das tools do
// Zé.
//
// O service recebe apenas IDs já resolvidos. Traduzir "cimento" em um
// produto é trabalho de quem chama (a tool, com o resolver.js); aqui
// dentro um nome nunca entra.
import { pool, query } from '../config/db.js';
import { ErroNegocio, naoEncontrado, conflito } from '../config/erros.js';

export const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'cartao', 'fiado'];

// Cabeçalho da venda com os nomes para exibição.
const SELECT_VENDA = `
  SELECT v.*,
         c.nome AS cliente_nome,
         u.nome AS usuario_nome
    FROM venda v
    LEFT JOIN cliente c ON c.id = v.cliente_id
    JOIN usuario u ON u.id = v.usuario_id
`;

// Centavo: o dinheiro nunca sai daqui com resto de ponto flutuante.
const emReais = (n) => Number(Number(n).toFixed(2));

export async function listarVendas({ de, ate, status, cliente_id } = {}) {
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
  if (cliente_id) {
    params.push(cliente_id);
    condicoes.push(`v.cliente_id = $${params.length}`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const { rows } = await query(`${SELECT_VENDA} ${where} ORDER BY v.vendida_em DESC`, params);
  return rows;
}

// Venda com os itens. null quando não existe.
export async function buscarVenda(id) {
  const venda = await query(`${SELECT_VENDA} WHERE v.id = $1`, [id]);
  if (venda.rowCount === 0) return null;

  const itens = await query(
    'SELECT * FROM item_venda WHERE venda_id = $1 ORDER BY produto_nome',
    [id]
  );
  return { ...venda.rows[0], itens: itens.rows };
}

export async function exigirVenda(id) {
  const venda = await buscarVenda(id);
  if (!venda) throw naoEncontrado('Venda não encontrada');
  return venda;
}

// Valida o pedido ANTES de abrir a transação. Separado de criarVenda
// porque a tool do Zé precisa validar para montar a nota de conferência
// sem gravar nada.
export function validarPedidoDeVenda({ forma_pagamento, itens, desconto }) {
  if (Number(desconto) < 0) {
    throw new ErroNegocio('desconto não pode ser negativo');
  }
  if (!forma_pagamento || !FORMAS_PAGAMENTO.includes(forma_pagamento)) {
    throw new ErroNegocio(`forma_pagamento inválida. Use: ${FORMAS_PAGAMENTO.join(', ')}`);
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new ErroNegocio('A venda precisa de ao menos um item');
  }
  for (const item of itens) {
    if (!item.produto_id) {
      throw new ErroNegocio('Cada item precisa de produto_id');
    }
    if (item.quantidade === undefined || Number(item.quantidade) <= 0) {
      throw new ErroNegocio('Cada item precisa de quantidade maior que zero');
    }
  }
}

// Monta a nota SEM gravar: resolve preço de cada item, soma e aplica
// desconto. É o que a tool do Zé mostra para conferência antes de
// confirmar, e é a mesma conta que criarVenda faz depois — se
// divergissem, a nota mentiria.
export async function simularVenda({ itens, desconto = 0 }) {
  const descontoNum = emReais(Number(desconto) || 0);
  const linhas = [];
  let soma = 0;

  for (const item of itens) {
    const { rows } = await query(
      'SELECT id, nome, unidade, preco_venda FROM produto WHERE id = $1 AND ativo = TRUE',
      [item.produto_id]
    );
    if (rows.length === 0) {
      throw new ErroNegocio(`Produto ${item.produto_id} não existe ou está inativo`);
    }
    const produto = rows[0];

    // Preço negociado no balcão tem prioridade sobre o de tabela (RF12).
    const preco =
      item.preco_unitario !== undefined
        ? Number(item.preco_unitario)
        : Number(produto.preco_venda);
    if (preco < 0) throw new ErroNegocio('preco_unitario não pode ser negativo');

    const quantidade = Number(item.quantidade);
    const subtotal = emReais(quantidade * preco);
    soma += subtotal;

    linhas.push({
      produto_id: produto.id,
      produto_nome: produto.nome,
      unidade: produto.unidade,
      quantidade,
      preco_unitario: emReais(preco),
      subtotal,
    });
  }

  const somaItens = emReais(soma);
  if (descontoNum > somaItens) {
    throw new ErroNegocio('Desconto maior que o total dos itens');
  }

  return {
    itens: linhas,
    soma_itens: somaItens,
    desconto: descontoNum,
    valor_total: emReais(somaItens - descontoNum),
  };
}

// Grava venda + itens numa transação: ou tudo, ou nada.
export async function criarVenda({ cliente_id, usuario_id, forma_pagamento, itens, desconto }) {
  const descontoNum = Number(desconto) || 0;
  validarPedidoDeVenda({ forma_pagamento, itens, desconto: descontoNum });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const usr = await client.query('SELECT id FROM usuario WHERE id = $1', [usuario_id]);
    if (usr.rowCount === 0) {
      throw new ErroNegocio('Vendedor (usuario_id) não existe');
    }

    // Cabeçalho primeiro; o total entra depois, com a soma dos itens.
    const vendaResult = await client.query(
      `INSERT INTO venda (cliente_id, usuario_id, forma_pagamento, desconto, valor_total)
       VALUES ($1, $2, $3, $4, 0)
       RETURNING id`,
      [cliente_id ?? null, usuario_id, forma_pagamento, descontoNum]
    );
    const vendaId = vendaResult.rows[0].id;

    let soma = 0;
    for (const item of itens) {
      const prod = await client.query(
        'SELECT nome, preco_venda FROM produto WHERE id = $1 AND ativo = TRUE',
        [item.produto_id]
      );
      if (prod.rowCount === 0) {
        throw new ErroNegocio(`Produto ${item.produto_id} não existe ou está inativo`);
      }

      const preco =
        item.preco_unitario !== undefined
          ? Number(item.preco_unitario)
          : Number(prod.rows[0].preco_venda);
      if (preco < 0) throw new ErroNegocio('preco_unitario não pode ser negativo');

      const quantidade = Number(item.quantidade);
      const subtotal = emReais(quantidade * preco);
      soma += subtotal;

      // produto_nome é CÓPIA: renomear o produto depois não reescreve
      // o histórico desta venda (princípio P3).
      await client.query(
        `INSERT INTO item_venda (venda_id, produto_id, produto_nome, quantidade, preco_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [vendaId, item.produto_id, prod.rows[0].nome, quantidade, preco, subtotal]
      );
    }

    const somaItens = emReais(soma);
    if (descontoNum > somaItens) {
      throw new ErroNegocio('Desconto maior que o total dos itens');
    }
    await client.query('UPDATE venda SET valor_total = $1 WHERE id = $2', [
      emReais(somaItens - descontoNum),
      vendaId,
    ]);

    await client.query('COMMIT');
    return buscarVenda(vendaId);
  } catch (erro) {
    // ROLLBACK protegido: se ele falhar, o erro original é o que
    // interessa — antes, um rollback quebrado mascarava a causa real.
    try {
      await client.query('ROLLBACK');
    } catch (falhaRollback) {
      console.error('[venda] ROLLBACK falhou:', falhaRollback.message);
    }
    if (erro.code === '23503') {
      throw new ErroNegocio('Cliente informado não existe');
    }
    throw erro;
  } finally {
    client.release();
  }
}

// Soft delete (RF14): a venda não some, muda de status. Cancelar duas
// vezes é barrado — o que torna a operação idempotente do ponto de
// vista de quem confirma.
export async function cancelarVenda(id) {
  const { rows, rowCount } = await query(
    `UPDATE venda
        SET status = 'cancelada', cancelada_em = NOW()
      WHERE id = $1 AND status = 'concluida'
    RETURNING id, status, cancelada_em`,
    [id]
  );

  if (rowCount === 0) {
    const existe = await query('SELECT status FROM venda WHERE id = $1', [id]);
    if (existe.rowCount === 0) throw naoEncontrado('Venda não encontrada');
    throw conflito('Venda já está cancelada');
  }
  return rows[0];
}

// Vendas recentes de um cliente — como o Zé acha "a venda do Marcos de
// ontem" sem que a pessoa saiba o id.
export async function vendasRecentesDoCliente(cliente_id, { dias = 7, limite = 10 } = {}) {
  const { rows } = await query(
    `${SELECT_VENDA}
      WHERE v.cliente_id = $1
        AND v.status = 'concluida'
        AND v.vendida_em >= NOW() - ($2 || ' days')::interval
      ORDER BY v.vendida_em DESC
      LIMIT $3`,
    [cliente_id, String(dias), limite]
  );
  return rows;
}
