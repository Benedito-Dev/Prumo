// Regras de negócio de cliente (RF01–RF05).
// Mesma ideia do produto.service: sem HTTP, lança ErroNegocio.
import { query } from '../config/db.js';
import { ErroNegocio, naoEncontrado, conflito } from '../config/erros.js';
import { textoValido, opcaoValida, uuidValido } from '../config/validar.js';
import { registrar, calcularAlteracoes, ACOES } from '../auditoria/auditoria.service.js';

export const TIPOS_VALIDOS = ['consumidor_final', 'pedreiro', 'construtora', 'revenda'];

// Valida E devolve os campos já limpos. Devolver importa: antes a
// checagem só dizia "está ok" e o valor CRU seguia para o SQL — nome com
// 5000 caracteres estourava o VARCHAR(120) e virava 500, e `nome: 12345`
// era aceito e gravado como a string "12345".
function validarCliente({ nome, telefone, tipo, observacao }) {
  return {
    nome: textoValido(nome, 'nome'),
    telefone: textoValido(telefone, 'telefone'),
    tipo: opcaoValida(tipo, 'tipo', TIPOS_VALIDOS, { obrigatorio: false }),
    observacao: textoValido(observacao, 'observacao', { obrigatorio: false }),
  };
}

// Sem busca: lista tudo. Com busca: nome parcial OU telefone (RF05).
export async function listarClientes({ busca } = {}) {
  if (busca) {
    const { rows } = await query(
      `SELECT * FROM cliente
        WHERE nome ILIKE $1 OR telefone ILIKE $1
        ORDER BY nome`,
      [`%${busca}%`]
    );
    return rows;
  }

  const { rows } = await query('SELECT * FROM cliente ORDER BY nome');
  return rows;
}

// Clientes + estatísticas de compra. LEFT JOIN para que quem nunca
// comprou também apareça. dias_sem_comprar alimenta o "sumido" (RF24).
export async function estatisticasClientes() {
  const { rows } = await query(`
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
  `);

  // SUM e COUNT voltam como string no pg — converte para número aqui,
  // senão o front soma texto.
  return rows.map((row) => ({
    ...row,
    total_gasto: Number(row.total_gasto),
    qtd_compras: Number(row.qtd_compras),
    dias_sem_comprar: row.dias_sem_comprar,
  }));
}

export async function buscarCliente(id) {
  const { rows } = await query('SELECT * FROM cliente WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function exigirCliente(id) {
  const cliente = await buscarCliente(id);
  if (!cliente) throw naoEncontrado('Cliente não encontrado');
  return cliente;
}

// Mínimo obrigatório: nome e telefone (RF02) — não travar o balcão.
// `usuario` (do token) alimenta o log de auditoria; ver produto.service.
export async function criarCliente(dados, usuario = null) {
  const { nome, telefone, tipo, observacao } = validarCliente(dados);

  const { rows } = await query(
    `INSERT INTO cliente (nome, telefone, tipo, observacao)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nome, telefone, tipo, observacao]
  );

  await registrar({
    usuario,
    acao: ACOES.CRIAR,
    entidade: 'cliente',
    entidade_id: rows[0].id,
    entidade_nome: rows[0].nome,
  });
  return rows[0];
}

// Substituição TOTAL — ver a nota em produto.service.atualizarProduto.
export async function atualizarCliente(id, dados, usuario = null) {
  uuidValido(id, 'cliente');
  const { nome, telefone, tipo, observacao } = validarCliente(dados);

  // Estado ANTES, para o log dizer o que mudou.
  const antes = await buscarCliente(id);
  if (!antes) throw naoEncontrado('Cliente não encontrado');

  const { rows, rowCount } = await query(
    `UPDATE cliente
        SET nome = $1, telefone = $2, tipo = $3, observacao = $4
      WHERE id = $5
    RETURNING *`,
    [nome, telefone, tipo, observacao, id]
  );

  if (rowCount === 0) throw naoEncontrado('Cliente não encontrado');

  const alteracoes = calcularAlteracoes(antes, rows[0]);
  // Salvar o formulário sem mudar nada não vira linha no log.
  if (alteracoes) {
    await registrar({
      usuario,
      acao: ACOES.EDITAR,
      entidade: 'cliente',
      entidade_id: rows[0].id,
      entidade_nome: rows[0].nome,
      alteracoes,
    });
  }
  return rows[0];
}

// Substituição PARCIAL — o que a IA usa. Entra em uso na Fatia 2.
export async function atualizarClienteParcial(id, alteracoes = {}, usuario = null) {
  const atual = await exigirCliente(id);

  const CAMPOS = ['nome', 'telefone', 'tipo', 'observacao'];
  const merged = { ...atual };
  for (const campo of CAMPOS) {
    if (alteracoes[campo] !== undefined) merged[campo] = alteracoes[campo];
  }

  // Repassa o usuário: sem isso a escrita do Zé ficaria anônima no log.
  return atualizarCliente(id, merged, usuario);
}

// Busca por nome parcial, para o Zé traduzir "o Marcos" em um registro.
// Diferente de listarClientes({ busca }), não procura por telefone: quem
// fala com o assistente diz o nome. Teto de 10 para não despejar a
// agenda inteira no modelo.
export async function buscarClientesPorNome(termo) {
  const busca = String(termo ?? '').trim();
  if (!busca) return [];

  const { rows } = await query(
    'SELECT * FROM cliente WHERE nome ILIKE $1 ORDER BY nome LIMIT 10',
    [`%${busca}%`]
  );
  return rows;
}

export async function removerCliente(id, usuario = null) {
  // Lê antes de apagar: o log precisa dizer QUAL cliente sumiu.
  const antes = await buscarCliente(id);

  let rowCount;
  try {
    ({ rowCount } = await query('DELETE FROM cliente WHERE id = $1 RETURNING id', [id]));
  } catch (erro) {
    // Cliente com vendas vinculadas não pode ser apagado (FK).
    if (erro.code === '23503') {
      throw conflito('Cliente possui vendas e não pode ser removido');
    }
    throw erro;
  }
  if (rowCount === 0) throw naoEncontrado('Cliente não encontrado');

  await registrar({
    usuario,
    acao: ACOES.REMOVER,
    entidade: 'cliente',
    entidade_id: id,
    entidade_nome: antes?.nome ?? null,
  });
}
