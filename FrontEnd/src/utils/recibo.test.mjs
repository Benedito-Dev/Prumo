#!/usr/bin/env node
// Banco de provas do recibo.
//
// Roda em Node puro, sem navegador e sem impressora — é por isso que o
// recibo foi escrito como módulo sem React. O papel na mão do cliente é a
// versão que vale numa discussão de balcão: se a conta do recibo divergir
// da venda gravada, o erro aparece aqui.
//
// Uso:
//   node FrontEnd/src/utils/recibo.test.mjs
import {
  COLUNAS,
  reciboTermico,
  reciboWhatsApp,
  linkWhatsApp,
} from './recibo.js';

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

const LOJA = {
  nome: 'Deposito Sao Jose',
  telefone: '(11) 3456-7890',
  endereco: 'Rua das Obras, 120 - Centro',
};

// Venda de referência: dois itens, sem desconto, no dinheiro.
const VENDA = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  cliente_nome: 'Marcos Andrade',
  usuario_nome: 'Benedito',
  forma_pagamento: 'dinheiro',
  desconto: 0,
  valor_total: 315,
  vendida_em: '2026-08-16T14:30:00',
  itens: [
    { produto_nome: 'Cimento CP-II 50kg', quantidade: 5, preco_unitario: 42, subtotal: 210 },
    { produto_nome: 'Areia media', quantidade: 1.5, preco_unitario: 70, subtotal: 105 },
  ],
};

// ---------------------------------------------------------------
console.log('\n📏 LARGURA — a bobina de 80mm não perdoa');

const termico = reciboTermico(VENDA, LOJA);
const linhas = termico.split('\n');
const estourou = linhas.filter((l) => l.length > COLUNAS);
ok(
  estourou.length === 0,
  `nenhuma linha passa de ${COLUNAS} colunas`,
  estourou.length ? `estouraram: ${JSON.stringify(estourou.slice(0, 2))}` : ''
);

// Nome longo é o caso que quebra layout de recibo na vida real.
const vendaNomeLongo = {
  ...VENDA,
  itens: [
    {
      produto_nome: 'Vergalhao de aco CA-50 nervurado 10mm barra 12 metros',
      quantidade: 20,
      preco_unitario: 38.5,
      subtotal: 770,
    },
  ],
  valor_total: 770,
};
const longo = reciboTermico(vendaNomeLongo, LOJA);
ok(
  longo.split('\n').every((l) => l.length <= COLUNAS),
  'nome de produto muito longo é quebrado, não estourado'
);
ok(longo.includes('Vergalhao'), 'o começo do nome longo continua legível');

// Cliente com nome grande também não pode empurrar o valor para fora —
// nem ser truncado: é o recibo dele, o nome tem de sair inteiro.
const vendaClienteLongo = {
  ...VENDA,
  cliente_nome: 'Construtora Vale Verde Empreendimentos Ltda',
};
const clienteLongo = reciboTermico(vendaClienteLongo, LOJA);
ok(
  clienteLongo.split('\n').every((l) => l.length <= COLUNAS),
  'cliente com nome longo não estoura a linha'
);
ok(
  clienteLongo.includes('Empreendimentos') && clienteLongo.includes('Ltda'),
  'o nome longo do cliente sai INTEIRO, quebrado em linhas'
);

// ---------------------------------------------------------------
console.log('\n💰 CONTAS — o papel não pode discordar do sistema');

ok(termico.includes('R$ 315,00'), 'o total sai do valor_total gravado');
ok(termico.includes('R$ 210,00'), 'o subtotal do item 1 aparece');
ok(termico.includes('R$ 105,00'), 'o subtotal do item 2 aparece');
ok(termico.includes('5 x R$ 42,00'), 'quantidade x preço unitário do item 1');
ok(termico.includes('1,5 x R$ 70,00'), 'quantidade decimal sai em pt-BR (1,5)');

// Sem desconto, nada de linha "Subtotal" repetindo o total.
ok(!termico.includes('Subtotal'), 'sem desconto, não imprime linha de subtotal');

const comDesconto = reciboTermico(
  { ...VENDA, desconto: 15, valor_total: 300 },
  LOJA
);
ok(comDesconto.includes('Subtotal'), 'com desconto, o subtotal aparece');
ok(comDesconto.includes('-R$ 15,00'), 'o desconto aparece com sinal negativo');
ok(comDesconto.includes('R$ 300,00'), 'o total já vem abatido do servidor');

// O espaço não-quebrável do toLocaleString não pode vazar para a bobina.
ok(!termico.includes(' '), 'nenhum espaço não-quebrável no texto térmico');

// ---------------------------------------------------------------
console.log('\n🧾 CONTEÚDO — o que o cliente precisa ler');

ok(termico.includes('DEPOSITO SAO JOSE'), 'o nome da loja vai no cabeçalho');
ok(termico.includes('(11) 3456-7890'), 'o telefone da loja vai no cabeçalho');
ok(termico.includes('Marcos Andrade'), 'o cliente aparece');
ok(termico.includes('Benedito'), 'quem vendeu aparece');
ok(termico.includes('A1B2C3D4'), 'o código curto da venda permite achá-la depois');
ok(
  termico.includes('nao e documento fiscal'),
  'o papel avisa que não é nota fiscal'
);
ok(termico.includes('16/08/2026'), 'a data da venda aparece');

// Venda sem cliente é o caso mais comum do balcão.
const semCliente = reciboTermico({ ...VENDA, cliente_nome: null }, LOJA);
ok(semCliente.includes('Consumidor'), 'venda sem cliente sai como "Consumidor"');

// ---------------------------------------------------------------
console.log('\n📕 FIADO — o comprovante não pode parecer quitação');

const fiado = reciboTermico({ ...VENDA, forma_pagamento: 'fiado' }, LOJA);
ok(fiado.includes('FIADO'), 'o recibo de fiado diz FIADO');
ok(fiado.includes('valor em aberto'), 'e avisa que o valor está em aberto');
ok(
  reciboWhatsApp({ ...VENDA, forma_pagamento: 'fiado' }, LOJA).includes('em aberto'),
  'o mesmo aviso no WhatsApp'
);
ok(
  !termico.includes('em aberto'),
  'venda à vista NÃO leva aviso de valor em aberto'
);

// ---------------------------------------------------------------
console.log('\n🏪 LOJA SEM CADASTRO — degradação sem quebrar');

const semLoja = reciboTermico(VENDA, {});
ok(semLoja.includes('PRUMO'), 'sem nome cadastrado, usa a marca PRUMO');
ok(semLoja.includes('R$ 315,00'), 'e o recibo continua completo');
ok(
  semLoja.split('\n').every((l) => l.length <= COLUNAS),
  'e continua dentro da largura'
);

// ---------------------------------------------------------------
console.log('\n📱 WHATSAPP — texto e link');

const zap = reciboWhatsApp(VENDA, LOJA);
ok(zap.includes('*Total: R$ 315,00*'), 'o total vai em negrito');
ok(zap.includes('Cimento CP-II 50kg'), 'os itens aparecem');
ok(zap.includes('Obrigado pela preferência!'), 'o WhatsApp mantém os acentos');

const link = linkWhatsApp(VENDA, LOJA, '(11) 98765-4321');
ok(link.startsWith('https://wa.me/5511987654321?text='), 'número recebe DDI 55');
ok(
  linkWhatsApp(VENDA, LOJA, '5511987654321').startsWith('https://wa.me/5511987654321'),
  'número que já tem DDI não ganha outro'
);
ok(
  linkWhatsApp(VENDA, LOJA, '').startsWith('https://wa.me/?text='),
  'sem telefone, abre o seletor de contato em vez de falhar'
);
ok(
  decodeURIComponent(link.split('?text=')[1]).includes('R$ 315,00'),
  'o texto do link carrega o recibo'
);

// ---------------------------------------------------------------
console.log('\n🛡️ ENTRADA ESTRANHA — não pode explodir na mão do vendedor');

ok(reciboTermico(null, LOJA) === '', 'venda nula devolve texto vazio');
ok(reciboWhatsApp(undefined, LOJA) === '', 'venda indefinida devolve texto vazio');
ok(
  reciboTermico({ ...VENDA, itens: [] }, LOJA).includes('R$ 315,00'),
  'venda sem itens ainda imprime o total'
);
ok(
  reciboTermico({ ...VENDA, itens: undefined }, LOJA).length > 0,
  'venda sem a lista de itens não quebra'
);
ok(
  reciboTermico({ ...VENDA, vendida_em: 'data-invalida' }, LOJA).length > 0,
  'data inválida não quebra o recibo'
);

console.log(`\n${passou} passaram, ${falhou} falharam\n`);
process.exit(falhou > 0 ? 1 : 0);
