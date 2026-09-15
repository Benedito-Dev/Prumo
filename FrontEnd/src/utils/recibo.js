// Monta o texto do recibo de uma venda.
//
// Módulo PURO: sem React, sem DOM, sem rede. É o que permite testá-lo em
// Node sem navegador nem impressora (ver recibo.test.mjs). Quem imprime ou
// abre o WhatsApp é a tela; aqui só se decide o que está escrito.
//
// Dois formatos, mesma fonte de dados:
//  - `reciboTermico`  → 32 colunas, para bobina de 80mm
//  - `reciboWhatsApp` → texto livre com marcação do WhatsApp
//
// Regra que vale para os dois: **todo valor vem da venda gravada**, nunca
// recalculado aqui. O item traz `subtotal` do banco, onde ele foi
// congelado (RF12); refazer a conta na tela abriria espaço para o recibo
// discordar do sistema — e o papel na mão do cliente é a versão que vale
// numa discussão de balcão.

// Extensão explícita: este módulo também roda em Node puro na suíte de
// testes, e o Node não resolve import sem extensão como o Vite faz.
import { moeda as moedaBR, quantidade } from './formato.js';

// Bobina de 80mm em fonte monoespaçada padrão: 32 caracteres por linha.
// 48 é o de 80mm em fonte condensada, que nem toda impressora tem.
export const COLUNAS = 32;

// O toLocaleString devolve "R$ 42,00" com espaço NÃO-QUEBRÁVEL (U+00A0)
// depois do R$. Ele é invisível na tela, mas impressora térmica costuma
// imprimi-lo como lixo, e ele conta como caractere no alinhamento das
// colunas. Trocado por espaço comum antes de entrar no recibo.
const moeda = (v) => moedaBR(v).replace(/ /g, ' ');

const FORMAS = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartao',
  fiado: 'Fiado',
};

// ---------- auxiliares de layout ----------

// Rótulo à esquerda, valor à direita, pontilhado no meio. Se não couber na
// linha, o valor manda: é o número que a pessoa confere.
function linhaDupla(esquerda, direita, colunas = COLUNAS) {
  const dir = String(direita).slice(0, colunas);
  const esq = String(esquerda);
  const espaco = colunas - dir.length;
  // Valor tão largo que não sobra espaço útil à esquerda: cada um na sua
  // linha, e o rótulo também precisa caber.
  if (espaco <= 1) return `${esq.slice(0, colunas)}\n${dir.padStart(colunas)}`;
  return esq.slice(0, espaco - 1).padEnd(espaco) + dir;
}

// Rótulo e valor onde o VALOR é o que importa ler inteiro (nome de cliente,
// de vendedor). Cabendo na linha, fica como `linhaDupla`; não cabendo, o
// rótulo fica sozinho e o valor desce quebrado em palavras — truncar o
// nome do cliente no recibo dele é pior que gastar duas linhas.
function linhaDuplaOuQuebrada(rotulo, valor, colunas = COLUNAS) {
  const v = String(valor);
  if (rotulo.length + 1 + v.length <= colunas) return linhaDupla(rotulo, v, colunas);
  return [rotulo, ...quebrar(v, colunas).map((l) => `  ${l}`.slice(0, colunas))].join('\n');
}

function centralizar(texto, colunas = COLUNAS) {
  const t = String(texto).slice(0, colunas);
  const sobra = colunas - t.length;
  return ' '.repeat(Math.floor(sobra / 2)) + t;
}

// Quebra em palavras; palavra maior que a linha é cortada no limite.
function quebrar(texto, colunas = COLUNAS) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    if (!atual) {
      atual = p.length > colunas ? p.slice(0, colunas) : p;
      continue;
    }
    if (atual.length + 1 + p.length <= colunas) {
      atual += ` ${p}`;
    } else {
      linhas.push(atual);
      atual = p.length > colunas ? p.slice(0, colunas) : p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

const regua = (c = '-', colunas = COLUNAS) => c.repeat(colunas);

function dataHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// O id inteiro (UUID) não cabe e ninguém lê. Os 8 primeiros caracteres
// bastam para achar a venda no sistema quando o cliente volta com o papel.
const codigoCurto = (id) => String(id || '').slice(0, 8).toUpperCase();

// ---------- recibo térmico (bobina 80mm) ----------

export function reciboTermico(venda, loja = {}) {
  if (!venda) return '';
  const L = [];

  // cabeçalho da loja
  L.push(centralizar((loja.nome || 'PRUMO').toUpperCase()));
  if (loja.telefone) L.push(centralizar(loja.telefone));
  if (loja.endereco) quebrar(loja.endereco).forEach((l) => L.push(centralizar(l)));
  L.push(regua('='));

  // Não é documento fiscal — dizer isso no papel evita que alguém o
  // apresente como nota. É comprovante de balcão, e só.
  L.push(centralizar('COMPROVANTE DE VENDA'));
  L.push(centralizar('(nao e documento fiscal)'));
  L.push(regua('='));

  L.push(linhaDupla('Venda', codigoCurto(venda.id)));
  L.push(linhaDupla('Data', dataHora(venda.vendida_em)));
  L.push(linhaDuplaOuQuebrada('Cliente', venda.cliente_nome || 'Consumidor'));
  if (venda.usuario_nome) L.push(linhaDuplaOuQuebrada('Vendedor', venda.usuario_nome));
  L.push(regua());

  // itens: nome numa linha, conta na seguinte — 32 colunas não comportam
  // nome + quantidade + preço + subtotal lado a lado sem truncar o nome,
  // que é justamente o que o cliente confere.
  for (const item of venda.itens || []) {
    quebrar(item.produto_nome).forEach((l) => L.push(l));
    const qtd = quantidade(item.quantidade);
    const unit = moeda(item.preco_unitario);
    L.push(linhaDupla(`  ${qtd} x ${unit}`, moeda(item.subtotal)));
  }

  L.push(regua());

  // Subtotal só aparece quando houve desconto: sem desconto ele repetiria
  // o total, e linha repetida em recibo faz a pessoa procurar diferença
  // onde não há.
  const desconto = Number(venda.desconto || 0);
  if (desconto > 0) {
    const subtotal = (venda.itens || []).reduce((s, i) => s + Number(i.subtotal), 0);
    L.push(linhaDupla('Subtotal', moeda(subtotal)));
    L.push(linhaDupla('Desconto', `-${moeda(desconto)}`));
  }

  L.push(linhaDupla('TOTAL', moeda(venda.valor_total)));
  L.push(linhaDupla('Pagamento', FORMAS[venda.forma_pagamento] || venda.forma_pagamento));

  // No fiado o papel precisa dizer que a conta ficou aberta, senão o
  // comprovante parece quitação.
  if (venda.forma_pagamento === 'fiado') {
    L.push('');
    L.push(centralizar('*** COMPRA NO FIADO ***'));
    L.push(centralizar('valor em aberto'));
  }

  L.push(regua('='));
  L.push(centralizar('Obrigado pela preferencia!'));

  return L.join('\n');
}

// ---------- recibo para WhatsApp ----------

// Aqui não há largura fixa: quem quebra a linha é o aplicativo. O que
// muda é a marcação (*negrito*) e o fato de o texto ser lido no celular,
// então ele é mais enxuto que o térmico.
export function reciboWhatsApp(venda, loja = {}) {
  if (!venda) return '';
  const L = [];

  L.push(`*${(loja.nome || 'PRUMO').toUpperCase()}*`);
  if (loja.telefone) L.push(loja.telefone);
  L.push('');
  L.push(`Comprovante de venda ${codigoCurto(venda.id)}`);
  L.push(dataHora(venda.vendida_em));
  L.push('');

  for (const item of venda.itens || []) {
    L.push(
      `• ${item.produto_nome} — ${quantidade(item.quantidade)} x ${moeda(item.preco_unitario)} = ${moeda(item.subtotal)}`
    );
  }

  const desconto = Number(venda.desconto || 0);
  if (desconto > 0) {
    const subtotal = (venda.itens || []).reduce((s, i) => s + Number(i.subtotal), 0);
    L.push('');
    L.push(`Subtotal: ${moeda(subtotal)}`);
    L.push(`Desconto: -${moeda(desconto)}`);
  }

  L.push('');
  L.push(`*Total: ${moeda(venda.valor_total)}*`);
  L.push(`Pagamento: ${FORMAS[venda.forma_pagamento] || venda.forma_pagamento}`);

  if (venda.forma_pagamento === 'fiado') {
    L.push('');
    L.push('_Compra no fiado — valor em aberto._');
  }

  L.push('');
  L.push('Obrigado pela preferência!');

  return L.join('\n');
}

// Link que abre a conversa com o texto pronto. O vendedor ainda precisa
// tocar em enviar — nada sai sozinho no nome do cliente.
//
// Sem telefone cadastrado, cai no seletor de contato do WhatsApp em vez de
// falhar: o cliente pode ter um número que o cadastro não tem.
export function linkWhatsApp(venda, loja = {}, telefone = '') {
  const texto = encodeURIComponent(reciboWhatsApp(venda, loja));
  const numero = String(telefone || '').replace(/\D/g, '');
  if (!numero) return `https://wa.me/?text=${texto}`;
  // Número brasileiro sem DDI: acrescenta 55. Com 12-13 dígitos já veio
  // com DDI e é respeitado como está.
  const comDDI = numero.length <= 11 ? `55${numero}` : numero;
  return `https://wa.me/${comDDI}?text=${texto}`;
}
