#!/usr/bin/env node
// Aplica as migrações pendentes, ou mostra o estado delas.
//
// A API já migra sozinha no boot; este script existe para rodar a migração
// sem subir a API (num deploy, por exemplo) e para responder "o que já foi
// aplicado neste banco?" sem abrir o psql.
//
// Uso:
//   node scripts/migrar.mjs           # aplica o que falta
//   node scripts/migrar.mjs --status  # só lista, não aplica
import 'dotenv/config';
import { rodarMigracoes, estadoMigracoes } from '../src/config/migracoes.js';
import { pool } from '../src/config/db.js';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não definida.');
    process.exit(1);
  }

  if (process.argv.includes('--status')) {
    const estado = await estadoMigracoes();
    if (estado.length === 0) {
      console.log('Nenhuma migração em BackEnd/migracoes/.');
    } else {
      console.log('Migrações:\n');
      for (const m of estado) {
        const marca = m.aplicada ? '✔' : '·';
        const quando = m.aplicada
          ? new Date(m.aplicada_em).toLocaleString('pt-BR')
          : 'pendente';
        console.log(`  ${marca} ${m.arquivo}  ${quando}`);
      }
      const pendentes = estado.filter((m) => !m.aplicada).length;
      console.log(
        pendentes === 0
          ? '\nTudo aplicado.'
          : `\n${pendentes} pendente(s). Rode: npm run migrar`
      );
    }
    await pool.end();
    return;
  }

  console.log('🗄️  Aplicando migrações…');
  try {
    const aplicadas = await rodarMigracoes();
    console.log(
      aplicadas.length === 0
        ? '   Nada pendente.'
        : `✅ ${aplicadas.length} aplicada(s).`
    );
  } catch (erro) {
    console.error(`❌ ${erro.message}`);
    await pool.end();
    process.exit(1);
  }
  await pool.end();
}

main();
