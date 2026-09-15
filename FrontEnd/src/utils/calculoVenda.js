// As contas de uma venda em andamento.
//
// Módulo PURO: sem React, sem DOM, sem rede — o mesmo princípio de
// `recibo.js` e `corrigirDitado.js`. A tela cuida de estado e pixels; aqui
// mora o dinheiro, que é onde um erro custa caro e passa despercebido.
//
// Estava tudo dentro de NovaVenda.jsx, misturado com useState e JSX, num
// arquivo de 850 linhas que não tinha como ser testado sem navegador.
//
// Convenção de moeda do projeto: `NUMERIC(12,2)` volta do driver `pg` como
// string, então **todo valor é convertido antes de entrar na conta** e o
// resultado passa por `emReais` antes de sair. Sem isso, "315" + "425"
// vira "315425".

// Espelha o emReais do backend (`Number(n.toFixed(2))`). Os dois precisam
// arredondar igual, senão a tela mostra um total e o banco grava outro.
export const emReais = (n) => Number(Number(n || 0).toFixed(2));

// Quantia que veio de <input type="number">: string, vazio, ou lixo
// digitado. Vazio é 0, não NaN — campo em branco significa "nada", e NaN
// contaminaria toda a conta seguinte.
const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Soma dos itens, sem desconto.
export function calcularSubtotal(itens = []) {
  const bruto = itens.reduce(
    (soma, i) => soma + numero(i.quantidade) * numero(i.preco_unitario),
    0
  );
  return emReais(bruto);
}

// Quantidade total de unidades (o "12 item(ns)" do resumo).
export function calcularQuantidadeTotal(itens = []) {
  return itens.reduce((soma, i) => soma + numero(i.quantidade), 0);
}

// Desconto em reais, aceitando valor ou percentual.
//
// Limitado ao subtotal e nunca negativo: desconto maior que a venda daria
// total negativo, e o backend recusaria com "Desconto maior que o total
// dos itens" só depois de a pessoa clicar em salvar. Melhor o número na
// tela já ser o verdadeiro.
export function calcularDesconto(subtotal, entrada, tipo = 'valor') {
  const bruto =
    tipo === 'percentual' ? (subtotal * numero(entrada)) / 100 : numero(entrada);
  return emReais(Math.min(Math.max(bruto, 0), subtotal));
}

// Todos os números da venda de uma vez — é o que a tela consome.
export function calcularVenda({
  itens = [],
  descontoInput = '',
  tipoDesconto = 'valor',
  recebido = '',
} = {}) {
  const subtotal = calcularSubtotal(itens);
  const desconto = calcularDesconto(subtotal, descontoInput, tipoDesconto);
  const total = emReais(subtotal - desconto);

  // Troco só existe se algo foi digitado no campo. Sem isso, campo vazio
  // viraria "troco de -R$ 300,00" enquanto a pessoa ainda nem contou o
  // dinheiro.
  const informouRecebido = String(recebido).trim() !== '';
  const troco = informouRecebido ? emReais(numero(recebido) - total) : null;

  return {
    subtotal,
    desconto,
    total,
    quantidadeTotal: calcularQuantidadeTotal(itens),
    troco,
    // Falta dinheiro para fechar? A tela usa para não deixar concluir uma
    // venda em dinheiro com valor recebido menor que o total.
    faltaReceber: troco !== null && troco < 0 ? emReais(-troco) : 0,
  };
}

// O que impede a venda de ser salva. Devolve a mensagem do primeiro
// problema, ou null quando está tudo certo.
//
// A mensagem é o texto que aparece na tela: escrita para quem não é
// técnico, sem nome de campo nem código de erro.
export function validarVenda({ itens = [] } = {}) {
  if (itens.length === 0) return 'Adicione ao menos um item.';

  for (const item of itens) {
    if (numero(item.quantidade) <= 0) return 'Quantidade deve ser maior que zero.';
    if (numero(item.preco_unitario) < 0) return 'Preço não pode ser negativo.';
  }
  return null;
}

// Monta o corpo do POST /vendas.
//
// `usuario_id` NÃO entra de propósito: quem vendeu sai do token no
// servidor. Mandar daqui permitiria lançar venda no nome de outro
// vendedor e fazer o indicador de desempenho mentir.
export function montarPayload({
  cliente,
  itens = [],
  pagamento = 'dinheiro',
  descontoInput = '',
  tipoDesconto = 'valor',
} = {}) {
  const subtotal = calcularSubtotal(itens);

  return {
    // Sem cliente = venda "Consumidor" (RF03). null explícito, não
    // undefined: `undefined` some no JSON.stringify e o backend não
    // distinguiria "não informou" de "mandou vazio".
    cliente_id: cliente?.id ?? null,
    forma_pagamento: pagamento,
    desconto: calcularDesconto(subtotal, descontoInput, tipoDesconto),
    itens: itens.map((i) => ({
      produto_id: i.produto_id,
      quantidade: numero(i.quantidade),
      preco_unitario: numero(i.preco_unitario),
    })),
  };
}

// Adiciona um produto à lista, ou incrementa se ele já está lá.
//
// Devolve uma lista nova (não muda a recebida) porque quem chama é um
// setState do React, que compara referência para decidir se re-renderiza.
export function adicionarItem(itens = [], produto) {
  const idx = itens.findIndex((i) => i.produto_id === produto.id);

  if (idx >= 0) {
    const copia = [...itens];
    copia[idx] = { ...copia[idx], quantidade: numero(copia[idx].quantidade) + 1 };
    return copia;
  }

  return [
    ...itens,
    {
      produto_id: produto.id,
      nome: produto.nome,
      unidade: produto.unidade,
      quantidade: 1,
      // O preço do catálogo é sugestão; o vendedor pode mudar na linha
      // (RF12 — negociação é regra no ramo).
      preco_unitario: numero(produto.preco_venda),
    },
  ];
}
