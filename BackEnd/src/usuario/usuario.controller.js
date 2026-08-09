// Controller de usuários (RF13, RNF05).
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { conferirSenha, gerarHash } from '../auth/senha.service.js';

const PAPEIS_VALIDOS = ['dono', 'vendedor'];
const SENHA_MINIMA = 4;

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
      // Sem papel informado, cria o de MENOR privilégio. Antes o default
      // era 'dono' — quem esquecesse o campo ganhava um administrador.
      [nome, email.trim().toLowerCase(), senha_hash, papel ?? 'vendedor']
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

// PATCH /api/usuarios/me/senha  { senha_atual, senha_nova }
// O usuário logado troca a própria senha (confere a atual).
export async function trocarMinhaSenha(req, res) {
  try {
    const { senha_atual, senha_nova } = req.body;
    if (!senha_atual || !senha_nova) {
      return res.status(400).json({ erro: 'Informe a senha atual e a nova' });
    }
    if (senha_nova.length < SENHA_MINIMA) {
      return res.status(400).json({ erro: `A nova senha deve ter ao menos ${SENHA_MINIMA} caracteres` });
    }

    const r = await query('SELECT senha_hash FROM usuario WHERE id = $1', [req.usuario.id]);
    if (r.rowCount === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });

    if (!(await conferirSenha(senha_atual, r.rows[0].senha_hash))) {
      return res.status(400).json({ erro: 'Senha atual incorreta' });
    }

    const hash = await gerarHash(senha_nova);
    await query('UPDATE usuario SET senha_hash = $1 WHERE id = $2', [hash, req.usuario.id]);
    res.json({ ok: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao trocar senha', detalhe: erro.message });
  }
}

// PATCH /api/usuarios/:id/senha  { senha_nova }  (só dono)
// O dono reseta a senha de qualquer usuário (sem pedir a atual).
export async function resetarSenha(req, res) {
  try {
    const { id } = req.params;
    const { senha_nova } = req.body;
    if (!senha_nova || senha_nova.length < SENHA_MINIMA) {
      return res.status(400).json({ erro: `A nova senha deve ter ao menos ${SENHA_MINIMA} caracteres` });
    }

    const hash = await gerarHash(senha_nova);
    const r = await query(
      `UPDATE usuario SET senha_hash = $1 WHERE id = $2 RETURNING ${COLUNAS_PUBLICAS}`,
      [hash, id]
    );
    if (r.rowCount === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json({ ok: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao resetar senha', detalhe: erro.message });
  }
}
