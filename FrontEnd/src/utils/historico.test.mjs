#!/usr/bin/env node
// Banco de provas da tradução do log de auditoria.
//
// O log guarda nome de coluna e valor cru; a tela precisa de português.
// Se isto quebrar, o histórico vira um dump de banco na cara do dono.
//
// Uso:
//   node FrontEnd/src/utils/historico.test.mjs
import {
  rotuloCampo,
  formatarValor,
  descreverAlteracao,
  descreverAcao,
  corDaAcao,
  quando,
} from './historico.js';

let passou = 0, falhou = 0;
const ok = (c, t, d = '') => {
  if (c) { passou++; console.log(`  ✅ ${t}`); }
  else { falhou++; console.log(`  ❌ ${t}${d ? ` — ${d}` : ''}`); }
};
// `moeda()` usa espaço NÃO-QUEBRÁVEL (U+00A0) depois do "R$". Escrito
// pelo código do caractere, não literal: um U+00A0 no meio do fonte é
// invisível e some no primeiro editor que normalizar o arquivo.
const semNbsp = (s) => String(s).replace(new RegExp(String.fromCharCode(160), "g"), " ");

// ---------------------------------------------------------------
console.log('\n🏷️ RÓTULOS — nome de coluna não vai para a tela');

ok(rotuloCampo('preco_venda') === 'Preço de venda', 'preco_venda vira "Preço de venda"');
ok(rotuloCampo('observacao') === 'Observação', 'observacao ganha acento');
ok(rotuloCampo('ativo') === 'Situação', 'ativo vira "Situação"');
ok(rotuloCampo('campo_novo') === 'campo_novo',
  'campo desconhecido não quebra (devolve como veio)');

// ---------------------------------------------------------------
console.log('\n💰 VALORES');

ok(semNbsp(formatarValor('preco_venda', '42.00')) === 'R$ 42,00',
  'preço em string vira moeda', formatarValor('preco_venda', '42.00'));
ok(semNbsp(formatarValor('preco_custo', 30)) === 'R$ 30,00', 'preço em número também',
  formatarValor('preco_custo', 30));
ok(formatarValor('nome', 'Cimento') === 'Cimento', 'texto passa direto');
ok(formatarValor('tipo', 'consumidor_final') === 'consumidor final',
  'tipo troca underscore por espaço');

// Campo esvaziado é o que mais importa enxergar.
ok(formatarValor('telefone', null) === 'vazio', 'null vira "vazio", não some');
ok(formatarValor('observacao', '') === 'vazio', 'string vazia também');
ok(formatarValor('preco_custo', undefined) === 'vazio', 'undefined também');

ok(formatarValor('ativo', true) === 'ativo', 'ativo true vira "ativo"');
ok(formatarValor('ativo', false) === 'inativo', 'ativo false vira "inativo"');
ok(formatarValor('ativo', 'false') === 'inativo',
  'ativo como string "false" também (o banco devolve assim)');

// O log não guarda o nome da categoria — não fingir que sabe.
ok(formatarValor('categoria_id', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') === 'outra categoria',
  'UUID de categoria não vaza para a tela');
ok(formatarValor('categoria_id', null) === 'sem categoria', 'categoria vazia é explícita');

// ---------------------------------------------------------------
console.log('\n📝 ALTERAÇÃO COMPLETA');

const alt = { campo: 'preco_venda', de: '42.00', para: '45.00' };
ok(semNbsp(descreverAlteracao(alt)) === 'Preço de venda: R$ 42,00 → R$ 45,00',
  'a frase do reajuste de preço', descreverAlteracao(alt));

ok(descreverAlteracao({ campo: 'telefone', de: null, para: '11999998888' })
   === 'Telefone: vazio → 11999998888',
  'campo preenchido pela primeira vez');
ok(descreverAlteracao({ campo: 'observacao', de: 'paga sempre em dia', para: null })
   === 'Observação: paga sempre em dia → vazio',
  'campo apagado aparece como tal');

// ---------------------------------------------------------------
console.log('\n🗣️ FRASE DA AÇÃO');

const linha = (o = {}) => ({
  usuario_nome: 'Benedito', acao: 'editar', entidade: 'produto',
  entidade_nome: 'Cimento CP-II', ...o,
});

ok(descreverAcao(linha()) === 'Benedito alterou o produto Cimento CP-II',
  'edição de produto', descreverAcao(linha()));
ok(descreverAcao(linha({ acao: 'criar' })) === 'Benedito cadastrou o produto Cimento CP-II',
  'criação usa "cadastrou"');
ok(descreverAcao(linha({ acao: 'desativar' })) === 'Benedito desativou o produto Cimento CP-II',
  'desativação usa "desativou"');
ok(descreverAcao(linha({ acao: 'remover' })) === 'Benedito apagou o produto Cimento CP-II',
  'remoção usa "apagou"');
ok(descreverAcao(linha({ entidade: 'cliente', entidade_nome: 'Marcos' }))
   === 'Benedito alterou o cliente Marcos',
  'cliente usa o artigo certo');
ok(descreverAcao(linha({ entidade_nome: null })).includes('sem nome'),
  'registro sem nome não vira "null" na tela');
ok(descreverAcao(null) === '', 'linha nula devolve texto vazio');
ok(descreverAcao(linha({ acao: 'acao_futura' })).includes('acao_futura'),
  'ação desconhecida não quebra a tela');

// ---------------------------------------------------------------
console.log('\n🎨 COR E DATA');

ok(corDaAcao('remover') === 'prumo', 'remover é vermelho');
ok(corDaAcao('desativar') === 'prumo', 'desativar também');
ok(corDaAcao('criar') === 'nivel', 'criar é verde');
ok(corDaAcao('inventada') === 'grafite', 'ação desconhecida cai no neutro');

ok(quando('2026-08-16T14:30:00').includes('16/08/2026'), 'data em pt-BR');
ok(quando('data-invalida') === '', 'data inválida devolve vazio, não "Invalid Date"');

console.log(`\n${passou} passaram, ${falhou} falharam\n`);
process.exit(falhou > 0 ? 1 : 0);
