#!/usr/bin/env node
// Banco de provas das contas da venda.
//
// Roda em Node puro, sem navegador — é por isso que a lógica saiu de
// dentro de NovaVenda.jsx. Aqui mora o dinheiro: um erro de arredondamento
// ou uma string virando concatenação não aparece na tela, aparece no caixa
// do fim do dia.
//
// Uso:
//   node FrontEnd/src/utils/calculoVenda.test.mjs
import {
  emReais,
  calcularSubtotal,
  calcularQuantidadeTotal,
  calcularDesconto,
  calcularVenda,
  validarVenda,
  montarPayload,
  adicionarItem,
} from './calculoVenda.js';

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

const item = (over = {}) => ({
  produto_id: 'p1',
  nome: 'Cimento CP-II 50kg',
  unidade: 'saco',
  quantidade: 1,
  preco_unitario: 42,
  ...over,
});

// ---------------------------------------------------------------
console.log('\n💵 STRING VIRANDO NÚMERO — o bug clássico do driver pg');

// O <input type="number"> devolve STRING. Somar sem converter concatena.
ok(
  calcularSubtotal([item({ quantidade: '2', preco_unitario: '42' })]) === 84,
  'quantidade e preço como string somam, não concatenam',
  `veio ${calcularSubtotal([item({ quantidade: '2', preco_unitario: '42' })])}`
);

ok(
  calcularSubtotal([
    item({ quantidade: '1', preco_unitario: '315' }),
    item({ produto_id: 'p2', quantidade: '1', preco_unitario: '425' }),
  ]) === 740,
  '"315" + "425" dá 740, não 315425'
);

// Campo vazio é 0, nunca NaN — NaN contamina toda a conta seguinte.
ok(calcularSubtotal([item({ quantidade: '', preco_unitario: '42' })]) === 0,
  'quantidade vazia conta como zero, não NaN');
ok(calcularSubtotal([item({ quantidade: '2', preco_unitario: '' })]) === 0,
  'preço vazio conta como zero, não NaN');
ok(calcularSubtotal([item({ quantidade: 'abc' })]) === 0,
  'texto digitado no campo não vira NaN');
ok(calcularSubtotal([]) === 0, 'lista vazia dá zero');
ok(calcularSubtotal() === 0, 'sem argumento nenhum dá zero');

// ---------------------------------------------------------------
console.log('\n🔢 ARREDONDAMENTO — a tela e o banco têm de bater');

ok(emReais(0.1 + 0.2) === 0.3, '0.1 + 0.2 vira 0.3, não 0.30000000000000004');
ok(
  calcularSubtotal([item({ quantidade: 3, preco_unitario: 33.33 })]) === 99.99,
  '3 x 33,33 = 99,99'
);
// Caso que gera dízima: 1/3 do preço em três parcelas de quantidade.
ok(
  calcularSubtotal([item({ quantidade: 0.333, preco_unitario: 100 })]) === 33.3,
  'quantidade fracionária arredonda a 2 casas'
);
ok(
  Number.isInteger(calcularSubtotal([item({ quantidade: 7, preco_unitario: 12.5 })]) * 100),
  'o subtotal nunca sai com mais de 2 casas'
);

// ---------------------------------------------------------------
console.log('\n🏷️ DESCONTO — em valor e em percentual');

ok(calcularDesconto(100, '15', 'valor') === 15, 'desconto em reais');
ok(calcularDesconto(100, '15', 'percentual') === 15, '15% de 100 = 15');
ok(calcularDesconto(315, '10', 'percentual') === 31.5, '10% de 315 = 31,50');
ok(calcularDesconto(99.99, '33', 'percentual') === 33, '33% de 99,99 arredonda a 33,00');

// Desconto maior que a venda daria total negativo — o backend recusaria só
// depois do clique em salvar.
ok(calcularDesconto(100, '150', 'valor') === 100, 'desconto maior que o subtotal é limitado ao subtotal');
ok(calcularDesconto(100, '200', 'percentual') === 100, 'desconto de 200% também é limitado');
ok(calcularDesconto(100, '-50', 'valor') === 0, 'desconto negativo vira zero');
ok(calcularDesconto(100, '', 'valor') === 0, 'desconto vazio é zero');
ok(calcularDesconto(100, 'abc', 'valor') === 0, 'desconto com texto é zero');
ok(calcularDesconto(0, '10', 'percentual') === 0, 'percentual sobre venda zerada é zero');

// ---------------------------------------------------------------
console.log('\n🧮 A VENDA INTEIRA');

const venda = calcularVenda({
  itens: [
    item({ quantidade: 5, preco_unitario: 42 }),   // 210
    item({ produto_id: 'p2', quantidade: 1.5, preco_unitario: 70 }), // 105
  ],
  descontoInput: '15',
});
ok(venda.subtotal === 315, 'subtotal soma os dois itens', `veio ${venda.subtotal}`);
ok(venda.desconto === 15, 'desconto aplicado');
ok(venda.total === 300, 'total = subtotal − desconto', `veio ${venda.total}`);
ok(venda.quantidadeTotal === 6.5, 'quantidade total soma decimais');

ok(calcularQuantidadeTotal([item({ quantidade: 5 }), item({ quantidade: 3 })]) === 8,
  'quantidade total soma os itens');
ok(calcularQuantidadeTotal([item({ quantidade: '2' })]) === 2,
  'quantidade em string entra na soma como número');
ok(calcularQuantidadeTotal([]) === 0, 'quantidade total de lista vazia é zero');

// ---------------------------------------------------------------
console.log('\n💰 TROCO');

const comTroco = calcularVenda({
  itens: [item({ quantidade: 5, preco_unitario: 42 })],
  recebido: '250',
});
ok(comTroco.troco === 40, 'recebeu 250 numa venda de 210 → troco 40', `veio ${comTroco.troco}`);
ok(comTroco.faltaReceber === 0, 'nada faltando quando o troco é positivo');

const semDigitar = calcularVenda({ itens: [item({ quantidade: 5, preco_unitario: 42 })] });
ok(semDigitar.troco === null,
  'campo de recebido vazio NÃO mostra troco negativo (é null)');
ok(semDigitar.faltaReceber === 0, 'e nada falta enquanto ninguém digitou');

const faltando = calcularVenda({
  itens: [item({ quantidade: 5, preco_unitario: 42 })],
  recebido: '200',
});
ok(faltando.troco === -10, 'recebeu menos que o total → troco negativo');
ok(faltando.faltaReceber === 10, 'e faltaReceber diz quanto falta');

const exato = calcularVenda({
  itens: [item({ quantidade: 5, preco_unitario: 42 })],
  recebido: '210',
});
ok(exato.troco === 0, 'valor exato → troco zero (e não null)');

// ---------------------------------------------------------------
console.log('\n🚦 VALIDAÇÃO — o que barra o salvamento');

ok(validarVenda({ itens: [] }) === 'Adicione ao menos um item.', 'venda sem item é barrada');
ok(validarVenda({}) !== null, 'venda sem nada é barrada');
ok(validarVenda({ itens: [item()] }) === null, 'venda com um item válido passa');
ok(
  validarVenda({ itens: [item({ quantidade: 0 })] }) === 'Quantidade deve ser maior que zero.',
  'quantidade zero é barrada'
);
ok(
  validarVenda({ itens: [item({ quantidade: -1 })] }) !== null,
  'quantidade negativa é barrada'
);
ok(
  validarVenda({ itens: [item({ preco_unitario: -5 })] }) === 'Preço não pode ser negativo.',
  'preço negativo é barrado'
);
// Preço zero é legítimo: brinde, bonificação, item de cortesia.
ok(validarVenda({ itens: [item({ preco_unitario: 0 })] }) === null,
  'preço ZERO é aceito (brinde não é erro)');
// O item ruim pode não ser o primeiro.
ok(
  validarVenda({ itens: [item(), item({ produto_id: 'p2', quantidade: 0 })] }) !== null,
  'item inválido no fim da lista também é pego'
);

// ---------------------------------------------------------------
console.log('\n📦 PAYLOAD — o que vai para a API');

const payload = montarPayload({
  cliente: { id: 'c1', nome: 'Marcos' },
  itens: [item({ quantidade: '5', preco_unitario: '42' })],
  pagamento: 'fiado',
  descontoInput: '10',
});
ok(payload.cliente_id === 'c1', 'manda o id do cliente');
ok(payload.forma_pagamento === 'fiado', 'manda a forma de pagamento');
ok(payload.desconto === 10, 'manda o desconto já calculado em reais');
ok(payload.itens[0].quantidade === 5, 'quantidade vai como número, não string');
ok(payload.itens[0].preco_unitario === 42, 'preço vai como número, não string');

// Regra dura do projeto: quem vendeu sai do token, nunca do corpo.
ok(!('usuario_id' in payload), 'NÃO manda usuario_id (quem vendeu sai do token)');

// Campos de tela não podem vazar para a API.
ok(!('nome' in payload.itens[0]), 'o item não leva o nome (o back congela o dele)');
ok(!('unidade' in payload.itens[0]), 'o item não leva a unidade');

const semCliente = montarPayload({ itens: [item()] });
ok(semCliente.cliente_id === null,
  'sem cliente manda null explícito (venda Consumidor), não undefined');
ok('cliente_id' in semCliente, 'e a chave existe no corpo');

const percentual = montarPayload({
  itens: [item({ quantidade: 1, preco_unitario: 200 })],
  descontoInput: '10',
  tipoDesconto: 'percentual',
});
ok(percentual.desconto === 20, 'desconto percentual vira reais antes de ir para a API');

// ---------------------------------------------------------------
console.log('\n➕ ADICIONAR ITEM');

const produto = { id: 'p1', nome: 'Cimento', unidade: 'saco', preco_venda: '42' };
const lista1 = adicionarItem([], produto);
ok(lista1.length === 1, 'produto novo entra na lista');
ok(lista1[0].quantidade === 1, 'entra com quantidade 1');
ok(lista1[0].preco_unitario === 42, 'preco_venda string vira número');

const lista2 = adicionarItem(lista1, produto);
ok(lista2.length === 1, 'o mesmo produto NÃO duplica a linha');
ok(lista2[0].quantidade === 2, 'incrementa a quantidade');

const lista3 = adicionarItem(lista2, { id: 'p2', nome: 'Areia', unidade: 'm3', preco_venda: 70 });
ok(lista3.length === 2, 'produto diferente cria linha nova');

// Imutabilidade importa: o React compara referência para re-renderizar.
ok(lista2 !== lista1, 'devolve lista nova (não muda a recebida)');
ok(lista1[0].quantidade === 1, 'a lista original continua intacta após incremento');

// Preço editado à mão sobrevive ao incremento — negociação é regra no ramo.
const negociado = [{ ...lista1[0], preco_unitario: 38 }];
ok(adicionarItem(negociado, produto)[0].preco_unitario === 38,
  'incrementar não reseta o preço negociado');

console.log(`\n${passou} passaram, ${falhou} falharam\n`);
process.exit(falhou > 0 ? 1 : 0);
