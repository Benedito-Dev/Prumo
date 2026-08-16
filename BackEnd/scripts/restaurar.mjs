#!/usr/bin/env node
// Restaura o banco a partir de um backup.
//
// O par obrigatório do backup.mjs: backup que nunca foi restaurado é
// esperança, não cópia de segurança. Teste isto ANTES de precisar.
//
// Uso:
//   node scripts/restaurar.mjs                          # lista os backups
//   node scripts/restaurar.mjs backups/prumo-....sql    # restaura
//   docker compose exec api node scripts/restaurar.mjs <arquivo>
//
// ATENÇÃO: isto SUBSTITUI o conteúdo atual do banco. Os dumps são gerados
// com --clean --if-exists, ou seja, o arquivo apaga as tabelas antes de
// recriá-las. É o comportamento certo para restaurar, e o motivo de o
// script exigir confirmação explícita.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';

async function listar(pasta) {
  try {
    const nomes = (await fs.readdir(pasta))
      .filter((n) => n.startsWith('prumo-') && n.endsWith('.sql'))
      .sort()
      .reverse();
    if (nomes.length === 0) {
      console.log(`Nenhum backup em ${pasta}.`);
      return;
    }
    console.log(`Backups em ${pasta} (mais recente primeiro):\n`);
    for (const nome of nomes) {
      const { size, mtime } = await fs.stat(path.join(pasta, nome));
      console.log(
        `  ${nome}  ${(size / 1024).toFixed(1)} KB  ${mtime.toLocaleString('pt-BR')}`
      );
    }
    console.log('\nPara restaurar:');
    console.log(`  node scripts/restaurar.mjs ${path.join(pasta, nomes[0])} --sim`);
  } catch (erro) {
    if (erro.code === 'ENOENT') console.log(`Pasta ${pasta} não existe ainda.`);
    else throw erro;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL não definida.');
    process.exit(1);
  }

  const arquivo = process.argv[2];

  // Sem argumento: mostra o que existe em vez de fazer nada.
  if (!arquivo || arquivo.startsWith('--')) {
    await listar(path.resolve('backups'));
    return;
  }

  const caminho = path.resolve(arquivo);
  try {
    await fs.access(caminho);
  } catch {
    console.error(`❌ Arquivo não encontrado: ${caminho}`);
    process.exit(1);
  }

  // Confirmação explícita, não interativa: o script roda dentro de
  // container e em cron, onde não há ninguém para responder um prompt.
  if (!process.argv.includes('--sim')) {
    console.log('⚠️  Isto APAGA o conteúdo atual do banco e põe o do backup no lugar.');
    console.log(`   Banco:   ${url.replace(/:[^:@]*@/, ':***@')}`);
    console.log(`   Arquivo: ${caminho}`);
    console.log('\n   Se é isso mesmo, repita o comando com --sim no fim.');
    process.exit(1);
  }

  console.log(`♻️  Restaurando de ${path.basename(caminho)}…`);

  const conteudo = await fs.readFile(caminho, 'utf8');

  // ON_ERROR_STOP: sem isso o psql segue depois de um erro e o banco fica
  // meio restaurado, que é o pior desfecho possível aqui.
  const psql = spawn('psql', ['-v', 'ON_ERROR_STOP=1', '-q'], {
    env: { ...process.env, PGDATABASE: url },
  });

  let stderr = '';
  psql.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  psql.on('error', (erro) => {
    console.error('❌ Não consegui executar o psql:', erro.message);
    console.error('   Dentro do container: docker compose exec api node scripts/restaurar.mjs …');
    process.exit(1);
  });

  psql.on('close', (codigo) => {
    if (codigo !== 0) {
      console.error(`❌ Restauração falhou (${codigo}):`);
      console.error(stderr.trim());
      process.exit(1);
    }
    console.log('✅ Banco restaurado.');
    console.log('   Reinicie a API para ela reconectar: docker compose restart api');
  });

  psql.stdin.write(conteudo);
  psql.stdin.end();
}

main();
