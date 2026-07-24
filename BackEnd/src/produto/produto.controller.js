// Controller de produtos (RF06–RF09).
import { query } from '../config/db.js';

const UNIDADES_VALIDAS = ['saco', 'milheiro', 'm3', 'peca', 'barra', 'kg', 'metro', 'carrada'];

// Monta o SELECT trazendo o nome da categoria junto (LEFT JOIN: categoria é opcional).
const SELECT_PRODUTO = `
  SELECT p.*, c.nome AS categoria_nome
    FROM produto p
    LEFT JOIN categoria c ON c.id = p.categoria_id
`;

// Valida o corpo de criação/atualização. Retorna string de erro ou null.
function validarProduto({ nome, unidade, preco_venda }) {
  if (!nome) return 'Nome é obrigatório';
  if (!unidade) return 'Unidade é obrigatória';
  if (!UNIDADES_VALIDAS.includes(unidade)) {
    return `Unidade inválida. Use: ${UNIDADES_VALIDAS.join(', ')}`;
  }
  if (preco_venda === undefined || preco_venda === null) return 'Preço de venda é obrigatório';
  if (Number(preco_venda) < 0) return 'Preço de venda não pode ser negativo';
  return null;
}

// GET /api/produtos?categoria_id=...&ativos=true
export async function listarProdutos(req, res) {
  try {
    const { categoria_id, ativos } = req.query;
    const condicoes = [];
    const params = [];

    if (categoria_id) {
      params.push(categoria_id);
      condicoes.push(`p.categoria_id = $${params.length}`);
    }
    if (ativos === 'true') {
      condicoes.push('p.ativo = TRUE');
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const resultado = await query(`${SELECT_PRODUTO} ${where} ORDER BY p.nome`, params);
    res.json(resultado.rows);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao listar produtos', detalhe: erro.message });
  }
}

// GET /api/produtos/:id
export async function buscarProduto(req, res) {
  try {
    const { id } = req.params;
    const resultado = await query(`${SELECT_PRODUTO} WHERE p.id = $1`, [id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao buscar produto', detalhe: erro.message });
  }
}

// POST /api/produtos
export async function criarProduto(req, res) {
  try {
    const { nome, unidade, preco_venda, preco_custo, categoria_id } = req.body;

    const erroValidacao = validarProduto(req.body);
    if (erroValidacao) {
      return res.status(400).json({ erro: erroValidacao });
    }

    const resultado = await query(
      `INSERT INTO produto (nome, unidade, preco_venda, preco_custo, categoria_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nome, unidade, preco_venda, preco_custo ?? null, categoria_id ?? null]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    // categoria_id inexistente
    if (erro.code === '23503') {
      return res.status(400).json({ erro: 'Categoria informada não existe' });
    }
    res.status(500).json({ erro: 'Falha ao criar produto', detalhe: erro.message });
  }
}

// PUT /api/produtos/:id
export async function atualizarProduto(req, res) {
  try {
    const { id } = req.params;
    const { nome, unidade, preco_venda, preco_custo, categoria_id, ativo } = req.body;

    const erroValidacao = validarProduto(req.body);
    if (erroValidacao) {
      return res.status(400).json({ erro: erroValidacao });
    }

    const resultado = await query(
      `UPDATE produto
          SET nome = $1, unidade = $2, preco_venda = $3,
              preco_custo = $4, categoria_id = $5, ativo = $6
        WHERE id = $7
      RETURNING *`,
      [nome, unidade, preco_venda, preco_custo ?? null, categoria_id ?? null, ativo ?? true, id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    if (erro.code === '23503') {
      return res.status(400).json({ erro: 'Categoria informada não existe' });
    }
    res.status(500).json({ erro: 'Falha ao atualizar produto', detalhe: erro.message });
  }
}

// DELETE /api/produtos/:id
// Se o produto já tem vendas, não apaga — apenas desativa (preserva o histórico).
export async function removerProduto(req, res) {
  try {
    const { id } = req.params;
    const resultado = await query('DELETE FROM produto WHERE id = $1 RETURNING id', [id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.status(204).send();
  } catch (erro) {
    // Produto referenciado em item_venda: não pode apagar (preservar histórico).
    if (erro.code === '23503') {
      return res.status(409).json({
        erro: 'Produto possui vendas e não pode ser removido. Desative-o (ativo=false) em vez de excluir.',
      });
    }
    res.status(500).json({ erro: 'Falha ao remover produto', detalhe: erro.message });
  }
}
