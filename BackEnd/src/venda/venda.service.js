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
import {
  numeroValido,
  uuidValido,
  listaValida,
  opcaoValida,
  MAX_ITENS_VENDA,
} from '../config/validar.js';

export const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'cartao', 'fiado'];

// Cabeçalho da venda com os nomes para exibição.
// O telefone do cliente vem junto porque o recibo é mandado no WhatsApp a
// partir da tela de vendas — sem ele, o vendedor teria de procurar o
// contato na lista do celular a cada segunda via.
const SELECT_VENDA = `
  SELECT v.*,
         c.nome     AS cliente_nome,
         c.telefone AS cliente_telefone,
         u.nome     AS usuario_nome
    FROM venda v
    LEFT JOIN cliente c ON c.id = v.cliente_id
    JOIN usuario u ON u.id = v.usuario_id
`;

// Centavo: o dinheiro nunca sai daqui com resto de ponto flutuante.
const emReais = (n) => Number(Number(n).toFixed(2));

// `usuario_id` restringe a lista a um vendedor. Quem decide passá-lo é o
// controller, a partir do papel no token — nunca o cliente da requisição,
// senão bastaria omitir o parâmetro para ver as vendas de todo mundo.
export async function listarVendas({ de, ate, status, cliente_id, usuario_id } = {}) {
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
  if (usuario_id) {
    params.push(usuario_id);
    condicoes.push(`v.usuario_id = $${params.length}`);
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
//
// A checagem antiga era `Number(item.quantidade) <= 0`, que NÃO pega
// lixo: `Number('abc')` é NaN, e NaN não é menor nem maior que zero, então
// a comparação dá false e o item passava. O NUMERIC do Postgres aceita
// NaN como valor válido — a venda gravava com valor_total = NaN e
// contaminava a soma do faturamento inteiro. Daí `numeroValido`, que
// rejeita NaN e Infinity explicitamente.
export function validarPedidoDeVenda({ forma_pagamento, itens, desconto }) {
  if (desconto !== undefined && desconto !== null && desconto !== '') {
    numeroValido(desconto, 'desconto', { permitirZero: true });
  }
  // "forma de pagamento", não "forma_pagamento": nome de coluna não é
  // texto de tela.
  opcaoValida(forma_pagamento, 'forma de pagamento', FORMAS_PAGAMENTO, { feminino: true });
  listaValida(itens, 'itens', { max: MAX_ITENS_VENDA });

  itens.forEach((item, i) => {
    // O número da linha entra na mensagem: numa venda de 8 itens, "o item
    // 3 está com a quantidade errada" é acionável; "um item está errado"
    // manda a pessoa conferir tudo de novo.
    const onde = itens.length > 1 ? ` (item ${i + 1})` : '';
    if (!item || typeof item !== 'object') {
      throw new ErroNegocio(`Item inválido${onde}`);
    }
    uuidValido(item.produto_id, `produto do item${onde}`);
    numeroValido(item.quantidade, `quantidade${onde}`);
    // Preço zero é legítimo — brinde, bonificação, cortesia no balcão.
    if (item.preco_unitario !== undefined && item.preco_unitario !== null) {
      numeroValido(item.preco_unitario, `preço${onde}`, { permitirZero: true });
    }
  });
}

// Monta a nota SEM gravar: resolve preço de cada item, soma e aplica
// desconto. É o que a tool do Zé mostra para conferência antes de
// confirmar, e é a mesma conta que criarVenda faz depois — se
// divergissem, a nota mentiria.
export async function simularVenda({ itens, desconto = 0 }) {
  // A nota do Zé é conferida por gente antes de virar venda; ela não pode
  // exibir NaN nem números impossíveis.
  listaValida(itens, 'itens', { max: MAX_ITENS_VENDA });
  const descontoNum = emReais(
    desconto ? numeroValido(desconto, 'desconto', { permitirZero: true }) : 0
  );
  const linhas = [];
  let soma = 0;

  for (const item of itens) {
    uuidValido(item.produto_id, 'produto');
    numeroValido(item.quantidade, 'quantidade');
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
      item.preco_unitario !== undefined && item.preco_unitario !== null
        ? numeroValido(item.preco_unitario, 'preço', { permitirZero: true })
        : Number(produto.preco_venda);

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
  // Valida ANTES de converter. `Number('abc') || 0` daria 0 e engoliria a
  // entrada inválida em silêncio — o pedido seria gravado com desconto
  // zero, e quem digitou nunca saberia que o valor não entrou.
  validarPedidoDeVenda({ forma_pagamento, itens, desconto });

  const descontoNum = desconto ? Number(desconto) : 0;

  // UUID malformado chegaria ao SQL e estouraria com 22P02, que o
  // usuário lê como "Falha inesperada".
  uuidValido(cliente_id, 'cliente', { obrigatorio: false });

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
//
// Venda fiado com pagamento já recebido NÃO pode ser cancelada. As
// consultas de fiado só enxergam vendas 'concluida', então a dívida
// sumiria da lista enquanto os registros em pagamento_fiado continuariam
// apontando para ela: o dinheiro que o cliente entregou viraria um
// pagamento órfão, sem dívida correspondente, e ninguém perceberia.
// Quem precisa desfazer isso primeiro devolve o dinheiro.
export async function cancelarVenda(id) {
  const recebido = await query(
    `SELECT COALESCE(SUM(valor), 0) AS pago
       FROM pagamento_fiado
      WHERE venda_id = $1`,
    [id]
  );
  if (Number(recebido.rows[0].pago) > 0) {
    throw conflito(
      'Esta venda já teve pagamento recebido. Devolva o valor ao cliente antes de cancelar.'
    );
  }

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

// Quem pode corrigir uma venda, e até quando.
//
// O dono corrige qualquer uma. O vendedor corrige só as dele e só no
// mesmo dia: 99% dos erros aparecem na hora, com o cliente ainda no
// balcão. Venda de ontem em diante já entrou em faturamento que o dono
// pode ter conferido — refazê-la sem ele saber mudaria número fechado.
//
// Devolve a venda quando pode; lança ErroNegocio explicando quando não.
export async function exigirVendaCorrigivel(id, usuario) {
  const venda = await exigirVenda(id);

  if (venda.status !== 'concluida') {
    throw conflito('Esta venda já foi cancelada.');
  }

  const pago = await query(
    'SELECT COALESCE(SUM(valor), 0) AS pago FROM pagamento_fiado WHERE venda_id = $1',
    [id]
  );
  if (Number(pago.rows[0].pago) > 0) {
    throw conflito(
      'Esta venda já teve pagamento recebido. Devolva o valor ao cliente antes de corrigir.'
    );
  }

  if (usuario.papel === 'dono') return venda;

  if (venda.usuario_id !== usuario.id) {
    // 404 e não 403: dizer "existe, mas não é sua" já confirmaria a venda
    // a quem não deveria saber dela — mesma regra de buscarVenda.
    throw naoEncontrado('Venda não encontrada');
  }

  // "Mesmo dia" é o dia do calendário, não 24 horas: uma venda das 18h de
  // ontem não deve ser corrigível às 8h de hoje só porque cabe na janela.
  const hoje = new Date();
  const dataVenda = new Date(venda.vendida_em);
  const mesmoDia =
    hoje.getFullYear() === dataVenda.getFullYear() &&
    hoje.getMonth() === dataVenda.getMonth() &&
    hoje.getDate() === dataVenda.getDate();

  if (!mesmoDia) {
    throw conflito('Só o dono corrige venda de outro dia. Peça para ele.');
  }

  return venda;
}

// Cancela a venda e devolve os dados para reabri-la preenchida.
//
// Não edita nada: `item_venda` continua congelado (RF12) e a venda
// original permanece no histórico como cancelada. Quem grava a versão
// corrigida é o fluxo normal de criarVenda, o que mantém uma única porta
// de entrada para venda no sistema.
export async function prepararCorrecao(id, usuario) {
  const venda = await exigirVendaCorrigivel(id, usuario);
  await cancelarVenda(id);

  return {
    cancelada: venda.id,
    // O molde carrega produto_id (não o nome): a tela remonta os itens a
    // partir do catálogo atual, e um produto desativado desde a venda
    // aparece como ausente em vez de ser revendido silenciosamente.
    molde: {
      cliente_id: venda.cliente_id,
      cliente_nome: venda.cliente_nome,
      cliente_telefone: venda.cliente_telefone,
      forma_pagamento: venda.forma_pagamento,
      desconto: Number(venda.desconto),
      itens: (venda.itens || []).map((i) => ({
        produto_id: i.produto_id,
        produto_nome: i.produto_nome,
        quantidade: Number(i.quantidade),
        preco_unitario: Number(i.preco_unitario),
      })),
    },
  };
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
