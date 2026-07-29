// Controller de usuários — versão mínima (RF13, RNF05).
// Objetivo agora: ter vendedores no banco para vincular às vendas.
// Login/autenticação completa vem numa fase posterior.
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

const PAPEIS_VALIDOS = ['dono', 'vendedor', 'caixa', 'estoque'];

// Colunas seguras para retornar — NUNCA inclui senha_hash.
const COLUNAS_PUBLICAS = 'id, nome, email, papel, ativo, criado_em';

// Validação simples de formato de e-mail.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/usuarios
export async function listarUsuarios(req, res) {
  try {
    const resultado = await query(
      `SELECT ${COLUNAS_PUBLICAS} FROM usuario ORDER BY nome`
    );
    res.json(resultado.rows);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao listar usuários', detalhe: erro.message });
  }
}

// GET /api/usuarios/:id
export async function buscarUsuario(req, res) {
  try {
    const { id } = req.params;
    const resultado = await query(
      `SELECT ${COLUNAS_PUBLICAS} FROM usuario WHERE id = $1`,
      [id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao buscar usuário', detalhe: erro.message });
  }
}

// POST /api/usuarios
export async function criarUsuario(req, res) {
  try {
    const { nome, email, senha, papel } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ erro: 'E-mail inválido' });
    }
    if (papel && !PAPEIS_VALIDOS.includes(papel)) {
      return res.status(400).json({ erro: `Papel inválido. Use: ${PAPEIS_VALIDOS.join(', ')}` });
    }

    // Senha nunca é salva em texto puro.
    const senha_hash = await bcrypt.hash(senha, 10);

    const resultado = await query(
      `INSERT INTO usuario (nome, email, senha_hash, papel)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUNAS_PUBLICAS}`,
      [nome, email.trim().toLowerCase(), senha_hash, papel ?? 'dono']
    );
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    // email é UNIQUE no schema
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail' });
    }
    res.status(500).json({ erro: 'Falha ao criar usuário', detalhe: erro.message });
  }
}

// PATCH /api/usuarios/:id/ativo  — ativa/desativa sem apagar (preserva histórico de vendas).
export async function alternarAtivo(req, res) {
  try {
    const { id } = req.params;
    const { ativo } = req.body;

    if (typeof ativo !== 'boolean') {
      return res.status(400).json({ erro: 'Campo "ativo" (true/false) é obrigatório' });
    }

    const resultado = await query(
      `UPDATE usuario SET ativo = $1 WHERE id = $2 RETURNING ${COLUNAS_PUBLICAS}`,
      [ativo, id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao atualizar usuário', detalhe: erro.message });
  }
}
