// Migrações de schema.
//
// Existe porque o `docs/schema.sql` só roda na PRIMEIRA inicialização do
// volume do Postgres. Até aqui, mudar uma tabela exigia
// `docker compose down -v` — que apaga o banco inteiro. Aceitável com
// dado de teste; impossível no dia em que houver venda real, e é o que
// travava features: o vencimento do fiado virou variável de ambiente em
// vez de coluna justamente por isso.
//
// Sem dependência nova (o projeto não tem ferramenta de migração e não é
// hora de adicionar uma): são arquivos `.sql` numerados em
// `BackEnd/migracoes/`, aplicados em ordem, uma única vez cada.
//
// As regras que sustentam isso:
//
// 1. **Cada migração roda dentro de uma transação.** Falhou no meio? Nada
//    do arquivo foi aplicado, e o banco fica no estado anterior — não num
//    meio-termo que ninguém sabe consertar.
//
// 2. **Registrar e aplicar acontecem na MESMA transação.** Se fossem
//    separados, uma queda entre os dois deixaria a migração aplicada e não
//    registrada; a próxima execução tentaria de novo e quebraria.
//
// 3. **Arquivo já aplicado nunca roda de novo, e nunca deve ser editado.**
//    Corrigir uma migração antiga muda o schema de quem ainda não a
//    aplicou e não muda o de quem já aplicou — os dois bancos divergem em
//    silêncio. Para consertar, crie uma migração nova.
//
// 4. **Um lock impede duas execuções simultâneas.** Duas instâncias da API
//    subindo ao mesmo tempo tentariam migrar juntas.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA_MIGRACOES = path.join(AQUI, '..', '..', 'migracoes');

// Número arbitrário, mas fixo: identifica ESTE lock entre os advisory
// locks do Postgres. Mudá-lo permitiria duas migrações simultâneas.
const LOCK_ID = 918273645;

async function garantirTabelaDeControle(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migracao (
      arquivo     VARCHAR(200) PRIMARY KEY,
      aplicada_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

// Lista os .sql da pasta em ordem alfabética — daí o prefixo numérico
// (001-, 002-): é ele que garante a ordem de aplicação.
async function listarArquivos() {
  try {
    const nomes = await fs.readdir(PASTA_MIGRACOES);
    return nomes.filter((n) => n.endsWith('.sql')).sort();
  } catch (erro) {
    // Pasta ausente é estado válido: projeto sem migração nenhuma.
    if (erro.code === 'ENOENT') return [];
    throw erro;
  }
}

// Aplica o que ainda não foi aplicado. Devolve os nomes aplicados agora.
export async function rodarMigracoes({ silencioso = false } = {}) {
  const arquivos = await listarArquivos();
  if (arquivos.length === 0) return [];

  const client = await pool.connect();
  const aplicadas = [];

  try {
    // Fora da transação: o lock precisa valer para a sessão inteira,
    // inclusive entre uma migração e outra.
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await garantirTabelaDeControle(client);

    const { rows } = await client.query('SELECT arquivo FROM migracao');
    const jaAplicadas = new Set(rows.map((r) => r.arquivo));

    for (const arquivo of arquivos) {
      if (jaAplicadas.has(arquivo)) continue;

      const sql = await fs.readFile(path.join(PASTA_MIGRACOES, arquivo), 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        // Mesma transação do DDL: ou as duas coisas acontecem, ou nenhuma.
        await client.query('INSERT INTO migracao (arquivo) VALUES ($1)', [arquivo]);
        await client.query('COMMIT');
      } catch (erro) {
        // ROLLBACK protegido: se ele falhar, o erro original é o que
        // interessa (mesmo padrão de venda.service.js).
        try {
          await client.query('ROLLBACK');
        } catch (falhaRollback) {
          console.error('[migracao] ROLLBACK falhou:', falhaRollback.message);
        }
        // A mensagem diz QUAL arquivo quebrou: sem isso, quem lê o log de
        // boot não sabe onde procurar.
        throw new Error(`Migração "${arquivo}" falhou: ${erro.message}`);
      }

      aplicadas.push(arquivo);
      if (!silencioso) console.log(`   ✔ ${arquivo}`);
    }

    return aplicadas;
  } finally {
    // Solta o lock mesmo se algo explodiu — senão a próxima subida da API
    // ficaria esperando para sempre.
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
    } catch {
      // A sessão está sendo devolvida ao pool de qualquer forma.
    }
    client.release();
  }
}

// Quais migrações existem e quais já foram aplicadas — para o script de
// status e para diagnóstico.
export async function estadoMigracoes() {
  const arquivos = await listarArquivos();
  const client = await pool.connect();
  try {
    await garantirTabelaDeControle(client);
    const { rows } = await client.query(
      'SELECT arquivo, aplicada_em FROM migracao ORDER BY arquivo'
    );
    const aplicadas = new Map(rows.map((r) => [r.arquivo, r.aplicada_em]));

    return arquivos.map((arquivo) => ({
      arquivo,
      aplicada: aplicadas.has(arquivo),
      aplicada_em: aplicadas.get(arquivo) ?? null,
    }));
  } finally {
    client.release();
  }
}
