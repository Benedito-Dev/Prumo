#!/usr/bin/env node
// Banco de provas do rascunho de venda.
//
// Roda em Node puro, sem navegador. Como o módulo fala com localStorage,
// os testes instalam um dublê — inclusive um que FALHA, para provar que
// storage indisponível não derruba a venda.
//
// Uso:
//   node FrontEnd/src/utils/rascunhoVenda.test.mjs

let passou = 0, falhou = 0;
const ok = (c, t, d = '') => {
  if (c) { passou++; console.log(`  ✅ ${t}`); }
  else { falhou++; console.log(`  ❌ ${t}${d ? ` — ${d}` : ''}`); }
};

// Dublê de localStorage instalado ANTES do import do módulo.
function instalarStorage({ quebrado = false } = {}) {
  const dados = new Map();
  globalThis.localStorage = {
    getItem: (k) => {
      if (quebrado) throw new Error('storage indisponível');
      return dados.has(k) ? dados.get(k) : null;
    },
    setItem: (k, v) => {
      if (quebrado) throw new Error('cota excedida');
      dados.set(k, String(v));
    },
    removeItem: (k) => {
      if (quebrado) throw new Error('storage indisponível');
      dados.delete(k);
    },
  };
  return dados;
}

let storage = instalarStorage();

const {
  salvar, carregar, limpar, vaiPenaSalvar, minutosDesde,
  descreverIdade, ehFalhaDeRede, mensagemDeFalha, VALIDADE_MINUTOS,
} = await import('./rascunhoVenda.js');

const venda = (o = {}) => ({
  cliente: { id: 'c1', nome: 'Marcos' },
  pagamento: 'dinheiro',
  itens: [{ produto_id: 'p1', nome: 'Cimento', quantidade: 5, preco_unitario: 42 }],
  ...o,
});

// ---------------------------------------------------------------
console.log('\n💾 SALVAR E RESTAURAR');

ok(salvar(venda()) === true, 'venda com item é salva');
const restaurado = carregar();
ok(restaurado !== null, 'e volta ao carregar');
ok(restaurado?.itens?.length === 1, 'com os itens');
ok(restaurado?.cliente?.nome === 'Marcos', 'e com o cliente');
ok(restaurado?.pagamento === 'dinheiro', 'e com a forma de pagamento');
ok(Boolean(restaurado?.salvo_em), 'carimbando quando foi salvo');

limpar();
ok(carregar() === null, 'limpar apaga o rascunho');

// ---------------------------------------------------------------
console.log('\n🚫 O QUE NÃO VALE A PENA GUARDAR');

ok(vaiPenaSalvar(venda()) === true, 'venda com item vale');
ok(vaiPenaSalvar({ itens: [] }) === false, 'venda sem item não vale');
ok(vaiPenaSalvar({ cliente: { nome: 'X' }, itens: [] }) === false,
  'só cliente escolhido não vale (não é trabalho perdido)');
ok(vaiPenaSalvar(null) === false, 'nulo não vale');
ok(vaiPenaSalvar({}) === false, 'objeto vazio não vale');

salvar(venda());
ok(carregar() !== null, 'há rascunho guardado');
salvar({ itens: [] });
ok(carregar() === null, 'salvar venda vazia LIMPA o rascumho anterior');

// ---------------------------------------------------------------
console.log('\n⏰ VALIDADE');

ok(minutosDesde(new Date().toISOString()) < 1, 'agora dá menos de 1 minuto');
ok(minutosDesde('data-invalida') === Infinity,
  'data inválida vira Infinity (tratado como expirado)');

// Rascunho velho: escreve direto no storage com data antiga.
const antigo = new Date(Date.now() - (VALIDADE_MINUTOS + 5) * 60000).toISOString();
storage.set('prumo:rascunho-venda', JSON.stringify({ ...venda(), salvo_em: antigo }));
ok(carregar() === null, `rascunho de ${VALIDADE_MINUTOS + 5} minutos é descartado`);
ok(storage.get('prumo:rascunho-venda') === undefined,
  'e some do storage (não fica lixo acumulando)');

// No limite ainda vale.
const noLimite = new Date(Date.now() - (VALIDADE_MINUTOS - 2) * 60000).toISOString();
storage.set('prumo:rascunho-venda', JSON.stringify({ ...venda(), salvo_em: noLimite }));
ok(carregar() !== null, 'dentro da validade continua valendo');
limpar();

// ---------------------------------------------------------------
console.log('\n🗑️ STORAGE SUJO');

storage.set('prumo:rascunho-venda', '{isso não é json');
ok(carregar() === null, 'JSON quebrado não derruba a tela');
ok(storage.get('prumo:rascunho-venda') === undefined, 'e é limpo automaticamente');

storage.set('prumo:rascunho-venda', JSON.stringify({ formato: 'antigo' }));
ok(carregar() === null, 'formato desconhecido é ignorado');
limpar();

// ---------------------------------------------------------------
console.log('\n🛡️ STORAGE INDISPONÍVEL (modo privado, cota cheia)');

instalarStorage({ quebrado: true });
ok(salvar(venda()) === false, 'salvar devolve false em vez de lançar');
ok(carregar() === null, 'carregar devolve null em vez de lançar');
ok(limpar() === false, 'limpar devolve false em vez de lançar');
// O ponto: nenhuma das três linhas acima pode derrubar a venda.
ok(true, 'e a tela de venda continua funcionando (nenhum throw acima)');

storage = instalarStorage();

// ---------------------------------------------------------------
console.log('\n📅 IDADE EM PORTUGUÊS');

ok(descreverIdade(new Date().toISOString()) === 'agora há pouco', 'recém-salvo');
ok(descreverIdade(new Date(Date.now() - 60000).toISOString()) === 'há 1 minuto',
  'um minuto no singular');
ok(descreverIdade(new Date(Date.now() - 300000).toISOString()) === 'há 5 minutos',
  'cinco minutos no plural');
ok(descreverIdade('invalida') === '', 'data inválida não vira "NaN minutos"');

// ---------------------------------------------------------------
console.log('\n📡 FALHA DE REDE x ERRO DE REGRA');

ok(ehFalhaDeRede(new TypeError('Failed to fetch')) === true,
  'TypeError do fetch é falha de rede');

// O caminho normal: o api.js já marca o erro antes de chegar aqui.
const marcado = Object.assign(new Error('Sem conexão com o sistema.'), { semConexao: true });
ok(ehFalhaDeRede(marcado) === true, 'erro marcado pelo api.js é reconhecido');
ok(/guardada/i.test(mensagemDeFalha(marcado)),
  'e recebe a mensagem que diz que a venda está guardada');
ok(ehFalhaDeRede(new Error('NetworkError when attempting to fetch resource')) === true,
  'NetworkError do Firefox também');
ok(ehFalhaDeRede(new Error('Load failed')) === true, 'Load failed do Safari também');
ok(ehFalhaDeRede(new Error('Desconto maior que o total dos itens')) === false,
  'erro de regra de negócio NÃO é falha de rede');
ok(ehFalhaDeRede(new Error('Sessão expirada')) === false, 'sessão expirada também não');

const msgRede = mensagemDeFalha(new TypeError('Failed to fetch'));
ok(!/failed to fetch/i.test(msgRede), 'a mensagem não vaza o texto em inglês');
ok(/sem conex/i.test(msgRede), 'e diz que está sem conexão', msgRede);
ok(/guardada/i.test(msgRede), 'e tranquiliza: a venda está guardada', msgRede);

ok(mensagemDeFalha(new Error('Desconto maior que o total dos itens'))
   === 'Desconto maior que o total dos itens',
  'erro de regra passa a mensagem do backend sem reescrever');
ok(mensagemDeFalha({}) === 'Não foi possível salvar a venda.',
  'erro sem mensagem tem texto de reserva');

console.log(`\n${passou} passaram, ${falhou} falharam\n`);
process.exit(falhou > 0 ? 1 : 0);
