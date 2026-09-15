#!/usr/bin/env node
// Backup do banco.
//
// Gera um arquivo .sql com TUDO (schema + dados) usando pg_dump, e apaga
// os backups antigos além do limite. Roda contra qualquer Postgres que a
// DATABASE_URL alcance — o do Docker aqui, ou o Neon lá.
//
// Uso:
//   node scripts/backup.mjs                    # para ./backups
//   node scripts/backup.mjs D:/backups-prumo   # para outra pasta
//   docker compose exec api node scripts/backup.mjs
//
// Por que .sql e não o formato binário do Postgres: um .sql pode ser lido,
// versionado e restaurado por qualquer ferramenta, inclusive à mão numa
// emergência. O dump binário é menor e mais rápido, mas exige exatamente o
// pg_restore da versão certa — que é o que ninguém tem na hora do aperto.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import 'dotenv/config';

// Quantos backups manter. Sete dias de cópia diária cobre o caso real:
// alguém percebe que apagou algo errado no dia seguinte, não em três
// meses. Guardar tudo para sempre enche o disco em silêncio.
const MANTER = Number(process.env.BACKUP_MANTER || 7);

const PREFIXO = 'prumo-';

function agoraParaNome() {
  // AAAA-MM-DD_HH-MM-SS: ordena alfabeticamente na mesma ordem
  // cronológica, o que faz a limpeza dos antigos ser um sort simples.
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}

async function limparAntigos(pasta) {
  const nomes = (await fs.readdir(pasta))
    .filter((n) => n.startsWith(PREFIXO) && n.endsWith('.sql'))
    .sort()
    .reverse(); // mais recentes primeiro

  const excedentes = nomes.slice(MANTER);
  for (const nome of excedentes) {
    await fs.unlink(path.join(pasta, nome));
    console.log(`   removido (antigo): ${nome}`);
  }
  return excedentes.length;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL não definida. Sem ela não há o que copiar.');
    process.exit(1);
  }

  const pasta = path.resolve(process.argv[2] || 'backups');
  await fs.mkdir(pasta, { recursive: true });

  const nome = `${PREFIXO}${agoraParaNome()}.sql`;
  const destino = path.join(pasta, nome);

  console.log(`💾 Copiando o banco para ${destino}`);

  // A URL vai por variável de ambiente, não como argumento: argumento de
  // processo aparece na lista de processos da máquina, e a URL carrega a
  // senha do banco.
  const dump = spawn(
    'pg_dump',
    ['--no-owner', '--no-privileges', '--clean', '--if-exists'],
    { env: { ...process.env, PGDATABASE: url } }
  );

  const arquivo = createWriteStream(destino);
  dump.stdout.pipe(arquivo);

  let erroStderr = '';
  dump.stderr.on('data', (d) => {
    erroStderr += d.toString();
  });

  dump.on('error', (erro) => {
    console.error('❌ Não consegui executar o pg_dump:', erro.message);
    console.error('');
    console.error('   O pg_dump vem com o PostgreSQL e NÃO existe no container da');
    console.error('   API (node:alpine). Use o container do banco, que já o tem:');
    console.error('');
    console.error('     npm run backup:docker');
    console.error('');
    console.error('   Contra o Neon (ou outro banco remoto), rode da sua máquina');
    console.error('   com o PostgreSQL client instalado e a DATABASE_URL apontando');
    console.error('   para lá.');
    process.exit(1);
  });

  dump.on('close', async (codigo) => {
    if (codigo !== 0) {
      console.error(`❌ pg_dump terminou com erro (${codigo}):`);
      console.error(erroStderr.trim());
      // Arquivo pela metade é pior que arquivo nenhum: alguém confiaria
      // nele na hora de restaurar.
      await fs.unlink(destino).catch(() => {});
      process.exit(1);
    }

    const { size } = await fs.stat(destino);
    console.log(`✅ Backup pronto: ${(size / 1024).toFixed(1)} KB`);

    const removidos = await limparAntigos(pasta);
    if (removidos > 0) {
      console.log(`   (mantendo os ${MANTER} mais recentes)`);
    }
  });
}

main();
