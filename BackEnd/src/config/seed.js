// Seed do usuário admin inicial.
// Roda no boot: se NÃO houver nenhum usuário no banco, cria um admin
// com as credenciais das variáveis de ambiente. Idempotente — se já
// existe qualquer usuário, não faz nada (evita duplicar / sobrescrever).
import { query } from './db.js';
import { gerarHash } from '../auth/senha.service.js';

const ADMIN_NOME = process.env.ADMIN_NOME || 'Administrador';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@prumo.com';
const ADMIN_SENHA = process.env.ADMIN_SENHA || 'prumo123';

export async function seedAdmin() {
  try {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM usuario');
    if (rows[0].n > 0) return; // já há usuários — não faz nada

    const senha_hash = await gerarHash(ADMIN_SENHA);
    await query(
      `INSERT INTO usuario (nome, email, senha_hash, papel)
       VALUES ($1, $2, $3, 'dono')`,
      [ADMIN_NOME, ADMIN_EMAIL.toLowerCase(), senha_hash]
    );
    console.log(`👤 Admin inicial criado: ${ADMIN_EMAIL} (senha definida em ADMIN_SENHA)`);
  } catch (erro) {
    // não derruba o boot se o seed falhar; só avisa
    console.error('⚠️  Falha ao criar admin inicial:', erro.message);
  }
}
