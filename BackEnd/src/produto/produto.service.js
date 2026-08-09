// Regras de negócio de produto (RF06–RF09).
//
// Funções puras de HTTP: recebem dados, devolvem dados, lançam
// ErroNegocio quando a regra barra. Servem tanto ao controller REST
// quanto às tools do Zé, sem que nenhum dos dois duplique SQL.
import { query } from '../config/db.js';
import { ErroNegocio, naoEncontrado, conflito } from '../config/erros.js';

export const UNIDADES_VALIDAS = [
  'saco', 'milheiro', 'm3', 'peca', 'barra', 'kg', 'metro', 'carrada',
];

// Traz o nome da categoria junto (LEFT JOIN: categoria é opcional).
const SELECT_PRODUTO = `
  SELECT p.*, c.nome AS categoria_nome
    FROM produto p
    LEFT JOIN categoria c ON c.id = p.categoria_id
`;

// Valida os campos obrigatórios. Lança em vez de retornar string:
// quem chama não pode esquecer de checar o retorno.
function validarProduto({ nome, unidade, preco_venda }) {
  if (!nome) throw new ErroNegocio('Nome é obrigatório');
  if (!unidade) throw new ErroNegocio('Unidade é obrigatória');
  if (!UNIDADES_VALIDAS.includes(unidade)) {
    throw new ErroNegocio(`Unidade inválida. Use: ${UNIDADES_VALIDAS.join(', ')}`);
  }
  if (preco_venda === undefined || preco_venda === null) {
    throw new ErroNegocio('Preço de venda é obrigatório');
  }
  if (Number(preco_venda) < 0) {
    throw new ErroNegocio('Preço de venda não pode ser negativo');
  }
}

// A FK de categoria_id é a mesma nos dois caminhos de escrita.
function traduzirErroDeBanco(erro) {
  if (erro.code === '23503') {
    return new ErroNegocio('Categoria informada não existe');
  }
  return erro;
}

export async function listarProdutos({ categoria_id, ativos } = {}) {
  const condicoes = [];
  const params = [];

  if (categoria_id) {
    params.push(categoria_id);
    condicoes.push(`p.categoria_id = $${params.length}`);
  }
  if (ativos === 'true' || ativos === true) {
    condicoes.push('p.ativo = TRUE');
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const { rows } = await query(`${SELECT_PRODUTO} ${where} ORDER BY p.nome`, params);
  return rows;
}

// Devolve null quando não existe — quem chama decide se isso é erro.
export async function buscarProduto(id) {
  const { rows } = await query(`${SELECT_PRODUTO} WHERE p.id = $1`, [id]);
  return rows[0] ?? null;
}

// Igual a buscarProduto, mas lança 404. Evita repetir o if em todo chamador.
export async function exigirProduto(id) {
  const produto = await buscarProduto(id);
  if (!produto) throw naoEncontrado('Produto não encontrado');
  return produto;
}

export async function criarProduto(dados) {
  const { nome, unidade, preco_venda, preco_custo, categoria_id, imagem_url } = dados;
  validarProduto(dados);

  try {
    const { rows } = await query(
      `INSERT INTO produto (nome, unidade, preco_venda, preco_custo, categoria_id, imagem_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nome, unidade, preco_venda, preco_custo ?? null, categoria_id ?? null, imagem_url ?? null]
    );
    return rows[0];
  } catch (erro) {
    throw traduzirErroDeBanco(erro);
  }
}

// Substituição TOTAL: campo ausente vira NULL. É o que o formulário da
// tela faz, porque ele sempre manda a ficha inteira.
// Para alterar só alguns campos, use atualizarProdutoParcial.
export async function atualizarProduto(id, dados) {
  const { nome, unidade, preco_venda, preco_custo, categoria_id, ativo, imagem_url } = dados;
  validarProduto(dados);

  let rows, rowCount;
  try {
    ({ rows, rowCount } = await query(
      `UPDATE produto
          SET nome = $1, unidade = $2, preco_venda = $3,
              preco_custo = $4, categoria_id = $5, ativo = $6, imagem_url = $7
        WHERE id = $8
      RETURNING *`,
      [nome, unidade, preco_venda, preco_custo ?? null, categoria_id ?? null, ativo ?? true, imagem_url ?? null, id]
    ));
  } catch (erro) {
    throw traduzirErroDeBanco(erro);
  }

  // Fora do try: o 404 não é erro de banco.
  if (rowCount === 0) throw naoEncontrado('Produto não encontrado');
  return rows[0];
}

// Substituição PARCIAL: lê o que existe, sobrepõe só os campos citados
// e grava. É o que a IA precisa — "muda o preço do cimento para 45" não
// pode zerar categoria, custo e imagem.
// Ainda não é usada por nenhuma rota; entra em uso na Fatia 2.
export async function atualizarProdutoParcial(id, alteracoes = {}) {
  const atual = await exigirProduto(id);

  // Só as chaves realmente enviadas sobrescrevem. `undefined` é
  // "não mencionou"; `null` é "apague este campo", e passa.
  const CAMPOS = ['nome', 'unidade', 'preco_venda', 'preco_custo', 'categoria_id', 'ativo', 'imagem_url'];
  const merged = { ...atual };
  for (const campo of CAMPOS) {
    if (alteracoes[campo] !== undefined) merged[campo] = alteracoes[campo];
  }

  return atualizarProduto(id, merged);
}

// Desativa sem apagar — preserva o histórico de vendas (princípio P6).
export async function definirAtivoProduto(id, ativo) {
  const { rows, rowCount } = await query(
    `UPDATE produto SET ativo = $1 WHERE id = $2 RETURNING *`,
    [ativo, id]
  );
  if (rowCount === 0) throw naoEncontrado('Produto não encontrado');
  return rows[0];
}

// DELETE de verdade. Só passa em produto sem venda: a FK de item_venda
// barra o resto, e é isso que preserva o histórico.
export async function removerProduto(id) {
  let rowCount;
  try {
    ({ rowCount } = await query('DELETE FROM produto WHERE id = $1 RETURNING id', [id]));
  } catch (erro) {
    if (erro.code === '23503') {
      throw conflito(
        'Produto possui vendas e não pode ser removido. Desative-o (ativo=false) em vez de excluir.'
      );
    }
    throw erro;
  }
  // Fora do try: o 404 não é erro de banco e não deve passar pelo catch.
  if (rowCount === 0) throw naoEncontrado('Produto não encontrado');
}
