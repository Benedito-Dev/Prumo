#!/usr/bin/env node
// Banco de provas da validação de entrada.
//
// Roda em Node puro, sem banco: o módulo é livre de HTTP e de SQL.
//
// O caso que deu origem a tudo isto: `quantidade: "abc"` passava pelo
// `Number()` do service, virava NaN, e o Postgres ACEITAVA — NUMERIC tem
// NaN como valor válido. A venda gravava com valor_total = NaN e
// contaminava a soma do faturamento inteiro.
//
// Uso:
//   node BackEnd/scripts/testar-validar.mjs
import {
  numeroValido,
  textoValido,
  uuidValido,
  listaValida,
  opcaoValida,
  MAX_ITENS_VENDA,
} from '../src/config/validar.js';
import { ErroNegocio } from '../src/config/erros.js';

let passou = 0;
let falhou = 0;

function ok(condicao, titulo, detalhe = '') {
  if (condicao) { passou++; console.log(`  ✅ ${titulo}`); }
  else { falhou++; console.log(`  ❌ ${titulo}${detalhe ? ` — ${detalhe}` : ''}`); }
}

// Espera que a função lance ErroNegocio (não TypeError, não silêncio).
function barra(fn, titulo) {
  try {
    const r = fn();
    ok(false, titulo, `aceitou e devolveu ${JSON.stringify(r)}`);
  } catch (erro) {
    ok(erro instanceof ErroNegocio, titulo,
      erro instanceof ErroNegocio ? '' : `lançou ${erro.constructor.name}: ${erro.message}`);
  }
}

function aceita(fn, esperado, titulo) {
  try {
    const r = fn();
    ok(r === esperado, titulo, r === esperado ? '' : `devolveu ${JSON.stringify(r)}`);
  } catch (erro) {
    ok(false, titulo, `barrou: ${erro.message}`);
  }
}

// ---------------------------------------------------------------
console.log('\n🔢 NÚMERO — o bug que originou tudo');

barra(() => numeroValido('abc', 'quantidade'), '"abc" é barrado (virava NaN no banco)');
barra(() => numeroValido(NaN, 'quantidade'), 'NaN literal é barrado');
barra(() => numeroValido('1e400', 'quantidade'), '"1e400" (vira Infinity) é barrado');
barra(() => numeroValido(Infinity, 'quantidade'), 'Infinity é barrado');
barra(() => numeroValido(-Infinity, 'quantidade'), '-Infinity é barrado');
barra(() => numeroValido(1e12, 'quantidade'), 'número absurdo é barrado (estoura NUMERIC)');

// Estes viram número no Number() mas não são alguém informando um número.
barra(() => numeroValido(null, 'quantidade'), 'null é barrado (Number(null) daria 0)');
barra(() => numeroValido(undefined, 'quantidade'), 'undefined é barrado');
barra(() => numeroValido('', 'quantidade'), 'string vazia é barrada (Number("") daria 0)');
barra(() => numeroValido([], 'quantidade'), 'array vazio é barrado (Number([]) daria 0)');
barra(() => numeroValido([5], 'quantidade'), 'array com número é barrado');
barra(() => numeroValido({}, 'quantidade'), 'objeto é barrado');
barra(() => numeroValido(true, 'quantidade'), 'true é barrado (Number(true) daria 1)');
barra(() => numeroValido(-5, 'quantidade'), 'negativo é barrado');
barra(() => numeroValido(0, 'quantidade'), 'zero é barrado quando não permitido');

aceita(() => numeroValido(5, 'quantidade'), 5, 'número aceito');
aceita(() => numeroValido('5', 'quantidade'), 5, 'string numérica vira número');
aceita(() => numeroValido('1.5', 'quantidade'), 1.5, 'decimal em string funciona');
aceita(() => numeroValido(0, 'preço', { permitirZero: true }), 0,
  'zero aceito quando permitido (brinde)');
aceita(() => numeroValido('0', 'preço', { permitirZero: true }), 0, 'zero em string também');

// ---------------------------------------------------------------
console.log('\n📝 TEXTO');

barra(() => textoValido(12345, 'nome'), 'número é barrado (virava a string "12345")');
barra(() => textoValido('', 'nome'), 'vazio é barrado');
barra(() => textoValido('   ', 'nome'), 'só espaços é barrado');
barra(() => textoValido(null, 'nome'), 'null é barrado');
barra(() => textoValido('x'.repeat(200), 'nome'), 'nome longo demais é barrado (VARCHAR(120))');
barra(() => textoValido(['a'], 'nome'), 'array é barrado');

aceita(() => textoValido('Marcos', 'nome'), 'Marcos', 'texto normal aceito');
aceita(() => textoValido('  Marcos  ', 'nome'), 'Marcos', 'espaços em volta são removidos');
aceita(() => textoValido(null, 'observacao', { obrigatorio: false }), null,
  'campo opcional aceita null');
aceita(() => textoValido('x'.repeat(120), 'nome'), 'x'.repeat(120), 'exatamente no limite passa');

// ---------------------------------------------------------------
console.log('\n🔑 UUID');

barra(() => uuidValido('xxx', 'cliente'), 'texto solto é barrado (daria 22P02 no SQL)');
barra(() => uuidValido('123', 'cliente'), 'número em string é barrado');
barra(() => uuidValido(123, 'cliente'), 'número é barrado');
barra(() => uuidValido('a1b2c3d4-e5f6-7890-abcd', 'cliente'), 'UUID truncado é barrado');
barra(() => uuidValido(null, 'cliente'), 'null é barrado quando obrigatório');

const UM_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
aceita(() => uuidValido(UM_UUID, 'cliente'), UM_UUID, 'UUID válido aceito');
aceita(() => uuidValido(UM_UUID.toUpperCase(), 'cliente'), UM_UUID.toUpperCase(),
  'UUID em maiúsculas aceito');
aceita(() => uuidValido(null, 'cliente', { obrigatorio: false }), null,
  'null aceito quando opcional (venda Consumidor)');

// ---------------------------------------------------------------
console.log('\n📋 LISTA');

barra(() => listaValida('nao é lista', 'itens'), 'string é barrada');
barra(() => listaValida(null, 'itens'), 'null é barrado');
barra(() => listaValida({}, 'itens'), 'objeto é barrado');
barra(() => listaValida([], 'itens'), 'lista vazia é barrada');
barra(() => listaValida(Array(5000).fill({}), 'itens'), '5000 itens é barrado');
barra(() => listaValida(Array(MAX_ITENS_VENDA + 1).fill({}), 'itens'),
  'um acima do limite é barrado');

const tres = [{}, {}, {}];
ok(listaValida(tres, 'itens') === tres, 'lista normal passa e volta igual');
ok(listaValida(Array(MAX_ITENS_VENDA).fill({}), 'itens').length === MAX_ITENS_VENDA,
  'exatamente no limite passa');

// ---------------------------------------------------------------
console.log('\n🎯 OPÇÃO');

const FORMAS = ['dinheiro', 'pix', 'cartao', 'fiado'];
barra(() => opcaoValida('boleto', 'forma_pagamento', FORMAS), 'valor fora da lista é barrado');
barra(() => opcaoValida('', 'forma_pagamento', FORMAS), 'vazio é barrado');
barra(() => opcaoValida('Dinheiro', 'forma_pagamento', FORMAS),
  'capitalização diferente é barrada (o CHECK do banco é exato)');

aceita(() => opcaoValida('fiado', 'forma_pagamento', FORMAS), 'fiado', 'opção válida aceita');
aceita(() => opcaoValida(null, 'tipo', ['pedreiro'], { obrigatorio: false }), null,
  'opcional aceita null');

// Concordância: "unidade inválido" denuncia texto de máquina.
try { opcaoValida('x', 'unidade', ['saco'], { feminino: true }); } catch (e) {
  ok(e.message.includes('inválida'), 'campo feminino recebe "inválida"', `"${e.message}"`);
}
try { opcaoValida('x', 'tipo', ['pedreiro']); } catch (e) {
  ok(e.message.includes('inválido'), 'campo masculino recebe "inválido"', `"${e.message}"`);
}

// ---------------------------------------------------------------
console.log('\n💬 MENSAGENS — quem lê não é técnico');

try { numeroValido('abc', 'quantidade'); } catch (e) {
  // Insensível a caixa: a mensagem começa a frase, então o campo sobe
  // para maiúscula ("Quantidade precisa ser…").
  ok(/quantidade/i.test(e.message), 'a mensagem diz qual campo falhou', `"${e.message}"`);
  ok(/^[A-ZÀ-Ú]/.test(e.message), 'e começa com maiúscula, como frase', `"${e.message}"`);
  ok(!/NaN|undefined|TypeError|null/.test(e.message),
    'e não vaza jargão de programação', `"${e.message}"`);
}
try { uuidValido('xxx', 'cliente'); } catch (e) {
  ok(!e.message.toLowerCase().includes('uuid'),
    'erro de id não fala em "UUID" (ninguém no balcão sabe o que é)', `"${e.message}"`);
}
try { numeroValido(1e12, 'preço'); } catch (e) {
  ok(/grande/i.test(e.message), 'número absurdo diz que é grande demais', `"${e.message}"`);
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`);
process.exit(falhou > 0 ? 1 : 0);
