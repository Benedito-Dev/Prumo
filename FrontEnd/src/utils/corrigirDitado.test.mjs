#!/usr/bin/env node
// Banco de provas do corretor de ditado (Etapa 1 do plano).
//
// Roda em Node puro, sem framework e sem navegador — é justamente por isso
// que o corretor foi escrito como módulo sem React: se o algoritmo estiver
// errado, o erro aparece aqui, onde o teste custa segundos.
//
// Uso:
//   node FrontEnd/src/utils/corrigirDitado.test.mjs
import {
  normalizar,
  similaridade,
  corrigirPorCatalogo,
  numerosPorExtenso,
  corrigir,
} from './corrigirDitado.js';

// O vocabulário REAL do sistema hoje. Note que o banco guarda sem acento e a
// pessoa fala com acento — metade do trabalho do corretor é essa ponte.
const VOCABULARIO = {
  produtos: [
    'Areia media',
    'Cimento CP-II 50kg',
    'Cimento Mizu 50kg',
    'Vergalhao 10mm',
  ],
  clientes: ['Construtora Vale Verde', 'Jose Ferreira', 'Marcos Andrade'],
};

let passou = 0;
let falhou = 0;

function ok(condicao, titulo, detalhe = '') {
  if (condicao) {
    passou++;
    console.log(`  ✅ ${titulo}`);
  } else {
    falhou++;
    console.log(`  ❌ ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

// Atalho: passa uma frase pelo corretor inteiro com o vocabulário real.
const c = (texto) => corrigir([texto], VOCABULARIO);

// ---------------------------------------------------------------------------
console.log('\n🔤 NORMALIZAR');

ok(normalizar('Vergalhão') === 'vergalhao', 'tira acento');
ok(normalizar('Cimento CP-II 50kg') === 'cimento cp ii 50kg', 'pontuação vira espaço');
ok(normalizar('  Jose   Ferreira  ') === 'jose ferreira', 'colapsa espaços e apara');
ok(normalizar('José Ferreira') === normalizar('Jose Ferreira'),
  'com e sem acento chegam ao mesmo lugar');
ok(normalizar(null) === '' && normalizar(undefined) === '', 'aguenta vazio');

// ---------------------------------------------------------------------------
console.log('\n📏 SIMILARIDADE');

ok(similaridade('vergalhao', 'vergalhao') === 1, 'igual é 1');
ok(similaridade('vergalhao', 'xyz') < 0.3, 'distante é baixo');
ok(similaridade('Vergalhão', 'vergalhao') === 1, 'normaliza antes de comparar');
// Com espaço, "josefa reira" fica em ~0.77 — ABAIXO do corte. Quem salva o
// caso é a comparação sem espaço, dentro do corretor; a fronteira de palavra
// errada é invisível para o Levenshtein comum. Este teste fixa esse limite
// para que ninguém tente resolver o caso baixando o corte.
ok(similaridade('jose ferreira', 'josefa reira') < 0.78,
  'com espaço, a fronteira errada fica ABAIXO do corte (por isso o modo colado)',
  String(similaridade('jose ferreira', 'josefa reira')));
ok(similaridade('joseferreira', 'josefareira') > 0.78,
  'sem espaço, a mesma dupla passa do corte (~0.83)',
  String(similaridade('joseferreira', 'josefareira')));
ok(similaridade('', '') === 1 && similaridade('a', '') === 0, 'aguenta vazio');

// ---------------------------------------------------------------------------
console.log('\n🔢 NÚMEROS POR EXTENSO');

ok(numerosPorExtenso('dez') === '10', '"dez" → 10', numerosPorExtenso('dez'));
ok(numerosPorExtenso('dez reais') === '10', '"dez reais" → 10',
  numerosPorExtenso('dez reais'));
ok(numerosPorExtenso('trinta e nove') === '39', '"trinta e nove" → 39',
  numerosPorExtenso('trinta e nove'));
ok(numerosPorExtenso('trinta e nove e noventa') === '39,90',
  '"trinta e nove e noventa" → 39,90', numerosPorExtenso('trinta e nove e noventa'));
ok(numerosPorExtenso('trinta e nove reais e noventa centavos') === '39,90',
  'a forma longa do preço também cai em 39,90',
  numerosPorExtenso('trinta e nove reais e noventa centavos'));
ok(numerosPorExtenso('cinco e cinquenta') === '5,50', '"cinco e cinquenta" → 5,50',
  numerosPorExtenso('cinco e cinquenta'));
ok(numerosPorExtenso('dois mil e quinhentos') === '2500', 'milhar por extenso',
  numerosPorExtenso('dois mil e quinhentos'));
ok(numerosPorExtenso('vende dez saco de cimento') === 'vende 10 saco de cimento',
  'número no meio da frase, resto preservado',
  numerosPorExtenso('vende dez saco de cimento'));
ok(numerosPorExtenso('bom dia tudo bem') === 'bom dia tudo bem',
  'frase sem número sai intacta');
// O "e" de ligação de frase não pode ser confundido com o "e" de número.
ok(numerosPorExtenso('cimento e areia') === 'cimento e areia',
  '"e" de conjunção não é engolido', numerosPorExtenso('cimento e areia'));

// Achado numa varredura de frases do balcão: "cento" está na tabela das
// centenas, e sem guarda "por cento" virava "por 100" — logo em desconto,
// que é onde trocar número custa dinheiro.
ok(numerosPorExtenso('desconto de dez por cento') === 'desconto de 10 por cento',
  '"por cento" continua porcentagem, não vira 100',
  numerosPorExtenso('desconto de dez por cento'));

// "um"/"uma" são artigo com muito mais frequência que numeral. Convertê-los
// estragaria texto que já estava certo.
ok(numerosPorExtenso('cadastra um cliente novo') === 'cadastra um cliente novo',
  '"um" de artigo não vira 1', numerosPorExtenso('cadastra um cliente novo'));
ok(numerosPorExtenso('vinte e um') === '21', 'mas "vinte e um" fecha o número',
  numerosPorExtenso('vinte e um'));

// ---------------------------------------------------------------------------
console.log('\n📚 CATÁLOGO — os erros reais do reconhecimento');

// O CASO CENTRAL: palavra quebrada em duas. Só casa com janela de 3.
ok(/Vergalhao 10mm/.test(c('ver galhão dez')),
  '"ver galhão dez" → Vergalhao 10mm', c('ver galhão dez'));

// Fronteira de palavra no lugar errado.
ok(/Jose Ferreira/.test(c('josefa reira')),
  '"josefa reira" → Jose Ferreira', c('josefa reira'));

// Acento falado vs. banco sem acento.
ok(/Vergalhao 10mm/.test(c('vergalhão')),
  '"vergalhão" → Vergalhao 10mm', c('vergalhão'));

// Só capitalização — o mais fácil, mas precisa devolver a forma do banco.
ok(c('marcos andrade') === 'Marcos Andrade',
  '"marcos andrade" → Marcos Andrade', c('marcos andrade'));

ok(/Construtora Vale Verde/.test(c('construtora vale verde')),
  'nome de cliente com 3 palavras', c('construtora vale verde'));

ok(/Areia media/.test(c('areia média')),
  '"areia média" → Areia media', c('areia média'));

// Fala abreviada: no balcão ninguém diz o nome de cadastro inteiro. O nome
// curto tem que alcançar o completo — desde que só um candidato case.
ok(c('marcos') === 'Marcos Andrade', 'primeiro nome alcança o cliente completo',
  c('marcos'));
ok(c('areia') === 'Areia media', 'nome curto alcança o produto completo', c('areia'));
ok(/Cimento CP-II 50kg/.test(c('cimento cp dois')),
  'sigla soletrada: "cimento cp dois" → Cimento CP-II 50kg', c('cimento cp dois'));
ok(/Cimento Mizu 50kg/.test(c('cimento mizu')),
  'com a marca dita, o cimento certo é escolhido', c('cimento mizu'));

// ---------------------------------------------------------------------------
console.log('\n🛑 CATÁLOGO — o que NÃO pode ser corrigido');

// Ambiguidade: os dois cimentos empatam. Escolher um seria adivinhar, e o
// erro adivinhado a pessoa não percebe. O resolvedor do Zé pergunta qual.
const cimento = c('cimento');
ok(!/CP|Mizu/i.test(cimento),
  '"cimento" sozinho NÃO vira nenhum dos dois cimentos', cimento);

// Frase corrente, sem nada do catálogo.
ok(c('bom dia tudo bem') === 'bom dia tudo bem',
  'frase sem nada do catálogo sai intacta', c('bom dia tudo bem'));

// Falso positivo: palavra distante de tudo não é trocada à força.
ok(c('martelo') === 'martelo',
  '"martelo" não vira Areia media', c('martelo'));
ok(c('preciso de uma nota fiscal') === 'preciso de uma nota fiscal',
  'frase administrativa sai intacta', c('preciso de uma nota fiscal'));

// Corte conservador: abaixo dele, deixa como está.
const abaixoDoCorte = corrigirPorCatalogo('parafuso sextavado', VOCABULARIO);
ok(abaixoDoCorte.trocas === 0, 'abaixo do corte não troca nada', abaixoDoCorte.texto);

// ---------------------------------------------------------------------------
console.log('\n🧩 JANELAS E NÃO-SOBREPOSIÇÃO');

// Se a janela de 3 casar, os pedaços dela não podem ser reprocessados por
// janelas menores — senão "dez" viraria outra coisa dentro do vergalhão.
const janelaGrande = corrigirPorCatalogo(numerosPorExtenso('ver galhão dez'), VOCABULARIO);
ok(janelaGrande.texto === 'Vergalhao 10mm',
  'janela de 3 consome as três palavras, sem sobra', janelaGrande.texto);
ok(janelaGrande.trocas === 1, 'e conta como uma troca só', String(janelaGrande.trocas));

// Duas entidades na mesma frase, cada uma na sua janela.
const duas = c('vergalhão pro marcos andrade');
ok(/Vergalhao 10mm/.test(duas) && /Marcos Andrade/.test(duas),
  'produto e cliente na mesma frase, sem uma atrapalhar a outra', duas);

// ---------------------------------------------------------------------------
console.log('\n🎧 ALTERNATIVAS DO NAVEGADOR');

// O ganho principal da abordagem: a 1ª hipótese pode não casar e uma
// posterior casar. O navegador não sabe qual das suas hipóteses é a boa.
const escolhida = corrigir(['ver galhao dez', 'vergalhão dez'], VOCABULARIO);
ok(/Vergalhao 10mm/.test(escolhida),
  'usa a alternativa que casa com o catálogo', escolhida);

const sextaBoa = corrigir(
  ['quero falar com zé farreira', 'quero falar com jose ferreira'],
  VOCABULARIO
);
ok(/Jose Ferreira/.test(sextaBoa),
  'alternativa mais tardia ganha quando ela é a que casa', sextaBoa);

// Nenhuma casa: devolve a primeira, sem inventar.
const nenhumaCasa = corrigir(['bom dia', 'bom dia doutor'], VOCABULARIO);
ok(nenhumaCasa === 'bom dia', 'nenhuma casa: fica com a primeira', nenhumaCasa);

ok(corrigir([], VOCABULARIO) === '', 'lista vazia devolve string vazia');
ok(corrigir('vergalhão', VOCABULARIO).includes('Vergalhao'),
  'aceita string solta, não só array');

// Catálogo vazio não pode quebrar nem inventar.
ok(corrigir(['vergalhão dez'], { produtos: [], clientes: [] }) === 'vergalhao 10',
  'sem catálogo, só os números são convertidos',
  corrigir(['vergalhão dez'], { produtos: [], clientes: [] }));

// ---------------------------------------------------------------------------
console.log('\n🗣️ FRASE INTEIRA — o caso do balcão');

const frase = c('vende dez ver galhão dez pro marcos andrade no fiado');
ok(/Vergalhao 10mm/.test(frase), 'frase real: produto corrigido', frase);
ok(/Marcos Andrade/.test(frase), 'frase real: cliente corrigido', frase);
ok(/^vende 10 /.test(frase), 'frase real: a quantidade vira número', frase);

// Regressão achada na revisão da Etapa 1: a janela de 3 palavras casava
// "2 areia media" com "Areia media" (o 2 some na normalização) e ENGOLIA
// a quantidade — "vende 2 areia" virava "vende Areia media". No balcão
// isso é vender 1 quando se pediu 2.
console.log('\n🔢 QUANTIDADE NÃO PODE SUMIR');
const qtd1 = corrigir(['vende 2 areia media'], VOCABULARIO);
ok(qtd1 === 'vende 2 Areia media', 'número antes do produto é preservado', qtd1);
const qtd2 = corrigir(['vende dois areia media'], VOCABULARIO);
ok(qtd2 === 'vende 2 Areia media', 'número por extenso também', qtd2);
const qtd3 = corrigir(['vende 2 vergalhao 10mm'], VOCABULARIO);
ok(qtd3 === 'vende 2 Vergalhao 10mm', 'e o 10mm do nome continua casando', qtd3);
const qtd4 = corrigir(['vende 10 cimento mizu pro jose'], VOCABULARIO);
ok(qtd4 === 'vende 10 Cimento Mizu 50kg pro Jose Ferreira',
  'quantidade + produto + cliente na mesma frase', qtd4);
ok(/fiado$/.test(frase), 'frase real: o resto do texto é preservado', frase);

const preco = c('cadastra cimento mizu a trinta e nove e noventa');
ok(/Cimento Mizu 50kg/.test(preco), 'frase real: o cimento COM marca é corrigido', preco);
ok(/39,90/.test(preco), 'frase real: preço por extenso vira 39,90', preco);

const divida = c('quanto o josefa reira deve');
ok(/Jose Ferreira/.test(divida) && /deve$/.test(divida),
  'frase real: "quanto o josefa reira deve"', divida);

// ---------------------------------------------------------------------------
console.log(`\n${falhou === 0 ? '✅' : '❌'} ${passou} passaram, ${falhou} falharam\n`);
process.exitCode = falhou === 0 ? 0 : 1;
