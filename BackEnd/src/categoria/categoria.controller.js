// Controller de categorias (RF09).
import { query } from '../config/db.js';
import { responderErro } from '../config/erros.js';

// GET /api/categorias
export async function listarCategorias(req, res) {
  try {
    const resultado = await query('SELECT * FROM categoria ORDER BY nome');
    res.json(resultado.rows);
  } catch (erro) {
    responderErro(res, erro, 'Falha ao listar categorias');
  }
}

// GET /api/categorias/:id
export async function buscarCategoria(req, res) {
  try {
    const { id } = req.params;
    const resultado = await query('SELECT * FROM categoria WHERE id = $1', [id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    responderErro(res, erro, 'Falha ao buscar categoria');
  }
}

// POST /api/categorias
export async function criarCategoria(req, res) {
  try {
    const { nome } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }

    const resultado = await query(
      'INSERT INTO categoria (nome) VALUES ($1) RETURNING *',
      [nome]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    // nome é UNIQUE no schema
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma categoria com esse nome' });
    }
    responderErro(res, erro, 'Falha ao criar categoria');
  }
}

// PUT /api/categorias/:id
export async function atualizarCategoria(req, res) {
  try {
    const { id } = req.params;
    const { nome } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }

    const resultado = await query(
      'UPDATE categoria SET nome = $1 WHERE id = $2 RETURNING *',
      [nome, id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma categoria com esse nome' });
    }
    responderErro(res, erro, 'Falha ao atualizar categoria');
  }
}

// DELETE /api/categorias/:id
export async function removerCategoria(req, res) {
  try {
    const { id } = req.params;
    const resultado = await query('DELETE FROM categoria WHERE id = $1 RETURNING id', [id]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Categoria não encontrada' });
    }
    res.status(204).send();
  } catch (erro) {
    // produtos vinculados impedem a remoção (FK)
    if (erro.code === '23503') {
      return res.status(409).json({
        erro: 'Categoria possui produtos e não pode ser removida',
      });
    }
    responderErro(res, erro, 'Falha ao remover categoria');
  }
}
