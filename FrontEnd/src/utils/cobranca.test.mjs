#!/usr/bin/env node
// Banco de provas da cobrança de fiado.
//
// O tom é requisito, não estilo: quem deve no depósito é cliente que vai
// voltar. Vários testes aqui verificam o que a mensagem NÃO diz — é o tipo
// de regressão que passa despercebida numa revisão de código.
//
// Uso:
//   node FrontEnd/src/utils/cobranca.test.mjs
import { textoCobranca, linkCobranca } from './cobranca.js';

let passou = 0;
let falhou = 0;
const ok = (c, t, d = '') => {
  if (c) { passou++; console.log(`  ✅ ${t}`); }
  else { falhou++; console.log(`  ❌ ${t}${d ? ` — ${d}` : ''}`); }
};

// `moeda()` usa espaço NÃO-QUEBRÁVEL depois do "R$". Diferente do recibo,
// aqui ele é mantido: WhatsApp o exibe normalmente, e é o espaço correto
// tipograficamente. Os testes normalizam antes de comparar.
const semNbsp = (s) => String(s).replace(/ /g, ' ');

const LOJA = { nome: 'Deposito Sao Jose', telefone: '(11) 3456-7890' };
const CLIENTE = { nome: 'Marcos Andrade', telefone: '11987654321' };

const divida = (over = {}) => ({
  id: 'v1',
  saldo: 340,
  vendida_em: '2026-07-01T10:00:00',
  dias: 46,
  dias_atraso: 16,
  vencida: true,
  ...over,
});

// ---------------------------------------------------------------
console.log('\n💬 TOM — cobrar sem perder o cliente');

const texto = textoCobranca(CLIENTE, [divida()], LOJA);
const baixo = texto.toLowerCase();

const PROIBIDAS = [
  'dívida', 'divida', 'devedor', 'inadimplente', 'pendência', 'pendencia',
  'juros', 'multa', 'nome sujo', 'protesto', 'cobrança judicial',
  'imediatamente', 'urgente',
];
const encontradas = PROIBIDAS.filter((p) => baixo.includes(p));
ok(encontradas.length === 0,
  'não usa palavra de cobrança agressiva',
  encontradas.length ? `achou: ${encontradas.join(', ')}` : '');

ok(baixo.includes('lembrar'), 'lembra em vez de exigir');
ok(baixo.includes('é só falar') || baixo.includes('combina'),
  'abre espaço para a pessoa negociar');
ok(texto.startsWith('Oi, Marcos!'), 'chama pelo primeiro nome, como no balcão');

// ---------------------------------------------------------------
console.log('\n💰 CONTEÚDO — o que a pessoa precisa saber');

ok(semNbsp(texto).includes('R$ 340,00'), 'diz o valor em aberto');
ok(texto.includes('01/07/2026'), 'diz a data da compra');
ok(texto.includes('Deposito Sao Jose'), 'assina com o nome da loja');
ok(texto.includes('(11) 3456-7890'), 'inclui o telefone da loja');

// Uma dívida x várias mudam a frase.
const varias = textoCobranca(CLIENTE, [
  divida({ saldo: 340 }),
  divida({ id: 'v2', saldo: 160, vencida: false, dias_atraso: 0 }),
], LOJA);
ok(varias.includes('2 compras'), 'com duas dívidas, fala em compras no plural');
ok(semNbsp(varias).includes('R$ 500,00'), 'e soma os saldos', varias);

const uma = textoCobranca(CLIENTE, [divida()], LOJA);
ok(uma.includes('sua compra de'), 'com uma dívida, fala no singular');
ok(!uma.includes('compras em aberto'), 'e não usa o plural');

// ---------------------------------------------------------------
console.log('\n⏰ ATRASO — só avisa quando existe');

ok(texto.includes('16 dias'), 'diz há quantos dias venceu');

const umDia = textoCobranca(CLIENTE, [divida({ dias_atraso: 1 })], LOJA);
ok(umDia.includes('ontem') && !umDia.includes('1 dias'),
  'atraso de 1 dia vira "ontem", não "1 dias"');

const emDia = textoCobranca(
  CLIENTE,
  [divida({ vencida: false, dias_atraso: 0, dias: 5 })],
  LOJA
);
ok(!emDia.toLowerCase().includes('venceu'),
  'dívida dentro do prazo NÃO leva aviso de vencimento');
ok(semNbsp(emDia).includes('R$ 340,00'), 'mas ainda diz o valor');

// Com várias, o atraso citado é o da mais atrasada.
const mistas = textoCobranca(CLIENTE, [
  divida({ dias_atraso: 5 }),
  divida({ id: 'v2', dias_atraso: 40 }),
], LOJA);
ok(mistas.includes('40 dias'), 'cita o maior atraso entre as dívidas');

// ---------------------------------------------------------------
console.log('\n🛡️ ENTRADA ESTRANHA');

ok(textoCobranca(CLIENTE, [], LOJA) === '', 'sem dívida, não gera texto');
ok(textoCobranca(CLIENTE, [divida({ saldo: 0 })], LOJA) === '',
  'dívida de saldo zero não gera cobrança');
ok(textoCobranca(null, [divida()], LOJA).startsWith('Oi!'),
  'cliente sem nome ainda gera saudação');
ok(textoCobranca(CLIENTE, [divida()], {}).length > 0,
  'sem dados da loja, o texto continua válido');
ok(!textoCobranca(CLIENTE, [divida()], {}).includes('undefined'),
  'e não vaza "undefined" na mensagem');
ok(textoCobranca({ nome: 'Marcos' }, [divida({ vendida_em: 'invalida' })], LOJA).length > 0,
  'data inválida não quebra a mensagem');

// ---------------------------------------------------------------
console.log('\n🔗 LINK');

const link = linkCobranca(CLIENTE, [divida()], LOJA);
ok(link.startsWith('https://wa.me/5511987654321?text='), 'número ganha DDI 55');
ok(
  linkCobranca({ ...CLIENTE, telefone: '5511987654321' }, [divida()], LOJA)
    .startsWith('https://wa.me/5511987654321'),
  'número com DDI não ganha outro'
);
ok(
  linkCobranca({ nome: 'Marcos' }, [divida()], LOJA).startsWith('https://wa.me/?text='),
  'sem telefone, abre o seletor de contato'
);
ok(
  semNbsp(decodeURIComponent(link.split('?text=')[1])).includes('R$ 340,00'),
  'o link carrega o texto da cobrança'
);

console.log(`\n${passou} passaram, ${falhou} falharam\n`);
process.exit(falhou > 0 ? 1 : 0);
