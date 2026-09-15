// Texto da cobrança de fiado no WhatsApp.
//
// Módulo PURO, como `recibo.js` — sem React, sem DOM, sem rede.
//
// O tom aqui é decisão de produto, não detalhe de implementação. Quem
// deve no depósito costuma ser cliente antigo, pedreiro do bairro, gente
// que vai voltar. Uma cobrança ríspida resolve uma conta e perde um
// cliente. Por isso o texto:
//   - lembra em vez de exigir ("passando para lembrar");
//   - não usa "dívida", "devedor", "inadimplente", "pendência";
//   - não ameaça, não cita juros, não fala em nome sujo;
//   - abre a porta para a pessoa negociar ("se precisar, é só falar").
//
// Nada é enviado sozinho: o link abre o WhatsApp com o texto pronto e
// quem manda é a pessoa, depois de ler.

import { moeda } from './formato.js';

function dataBR(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

// Só o primeiro nome: "Oi, Marcos" é como se fala no balcão. "Prezado
// Marcos Andrade da Silva" é como se fala numa carta de banco.
function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

// Cobrança de UM cliente, somando o que ele tem em aberto.
//
// `dividas` são as vendas fiado dele; `loja` entra para assinar a
// mensagem — o cliente precisa saber quem está falando.
export function textoCobranca(cliente, dividas = [], loja = {}) {
  const emAberto = dividas.filter((d) => Number(d.saldo) > 0);
  if (emAberto.length === 0) return '';

  const total = emAberto.reduce((s, d) => s + Number(d.saldo), 0);
  const vencidas = emAberto.filter((d) => d.vencida);
  const maisAntiga = emAberto[0];

  const L = [];
  const nome = primeiroNome(cliente?.nome);
  L.push(nome ? `Oi, ${nome}! Tudo bem?` : 'Oi! Tudo bem?');
  L.push('');

  if (emAberto.length === 1) {
    L.push(
      `Passando para lembrar da sua compra de ${dataBR(maisAntiga.vendida_em)}, ` +
        `no valor de *${moeda(total)}*.`
    );
  } else {
    L.push(
      `Passando para lembrar das suas ${emAberto.length} compras em aberto, ` +
        `que somam *${moeda(total)}*.`
    );
  }

  // O aviso de atraso é uma frase, não um alarme — e só aparece quando de
  // fato há atraso.
  if (vencidas.length > 0) {
    const dias = Math.max(...vencidas.map((d) => Number(d.dias_atraso) || 0));
    L.push('');
    L.push(
      dias === 1
        ? 'O prazo combinado venceu ontem.'
        : `O prazo combinado venceu faz ${dias} dias.`
    );
  }

  L.push('');
  L.push('Quando puder passar aqui para acertar, a gente agradece.');
  L.push('Se precisar de mais prazo, é só falar que a gente combina.');

  if (loja.nome) {
    L.push('');
    L.push(`*${loja.nome}*`);
    if (loja.telefone) L.push(loja.telefone);
  }

  return L.join('\n');
}

// Link que abre a conversa com o texto pronto. Mesma mecânica do recibo:
// sem telefone cadastrado cai no seletor de contato em vez de falhar.
export function linkCobranca(cliente, dividas = [], loja = {}) {
  const texto = textoCobranca(cliente, dividas, loja);
  const numero = String(cliente?.telefone || '').replace(/\D/g, '');
  const params = `?text=${encodeURIComponent(texto)}`;
  if (!numero) return `https://wa.me/${params}`;
  const comDDI = numero.length <= 11 ? `55${numero}` : numero;
  return `https://wa.me/${comDDI}${params}`;
}
