// Conexão com o PostgreSQL.
// Um único pool é compartilhado por toda a aplicação.
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper para consultas simples: query('SELECT ...', [params])
export const query = (text, params) => pool.query(text, params);
