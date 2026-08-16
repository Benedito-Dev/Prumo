// Rascunho da venda em andamento.
//
// Depósito tem Wi-Fi ruim e computador que reinicia. Sem isto, a queda no
// meio de uma venda de 12 itens faz o vendedor recomeçar do zero com o
// cliente na frente dele — exatamente o tipo de coisa que faz o sistema
// perder para o caderno de papel.
//
// Módulo PURO: sem React e sem rede. Recebe e devolve dados; quem chama
// decide quando salvar. O `localStorage` é acessado por trás de try/catch
// porque ele **pode falhar**: modo privado, cota cheia, política do
// navegador. Falhar ao salvar rascunho não pode quebrar a venda — o
// rascunho é rede de segurança, não requisito.

const CHAVE = 'prumo:rascunho-venda';

// Rascunho velho não serve: preço mudou, produto pode ter sido
// desativado, e o cliente daquela venda já foi embora. Meia hora cobre
// "a luz caiu e voltou"; um rascunho de ontem só confundiria.
export const VALIDADE_MINUTOS = 30;

// Nada de `localStorage` direto: em modo privado do Safari o acesso
// lança, e um throw aqui derrubaria a tela de venda inteira.
function comStorage(fn, padrao = null) {
  try {
    if (typeof localStorage === 'undefined') return padrao;
    return fn(localStorage);
  } catch {
    return padrao;
  }
}

// Uma venda só vale a pena guardar se tiver item. Cliente escolhido sem
// nenhum produto não é trabalho perdido — é o começo de tudo.
export function vaiPenaSalvar(venda) {
  return Array.isArray(venda?.itens) && venda.itens.length > 0;
}

export function salvar(venda) {
  if (!vaiPenaSalvar(venda)) {
    limpar();
    return false;
  }
  return comStorage((s) => {
    s.setItem(CHAVE, JSON.stringify({ ...venda, salvo_em: new Date().toISOString() }));
    return true;
  }, false);
}

// Devolve o rascunho, ou null se não existe / expirou / está corrompido.
// Um JSON quebrado no storage não pode impedir a tela de abrir.
export function carregar() {
  return comStorage((s) => {
    const cru = s.getItem(CHAVE);
    if (!cru) return null;

    let dados;
    try {
      dados = JSON.parse(cru);
    } catch {
      // Storage sujo (versão antiga, edição manual): limpa e segue.
      s.removeItem(CHAVE);
      return null;
    }

    if (!vaiPenaSalvar(dados)) return null;
    if (minutosDesde(dados.salvo_em) > VALIDADE_MINUTOS) {
      s.removeItem(CHAVE);
      return null;
    }
    return dados;
  });
}

export function limpar() {
  return comStorage((s) => {
    s.removeItem(CHAVE);
    return true;
  }, false);
}

// Minutos desde uma data ISO. Data inválida devolve Infinity para o
// rascunho ser tratado como expirado — na dúvida, não restaura.
export function minutosDesde(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / 60000;
}

// Frase para o aviso de restauração: "guardada há 3 minutos".
export function descreverIdade(iso) {
  const min = Math.floor(minutosDesde(iso));
  if (!Number.isFinite(min)) return '';
  if (min < 1) return 'agora há pouco';
  if (min === 1) return 'há 1 minuto';
  return `há ${min} minutos`;
}

// Traduz uma falha de rede para português de balcão.
//
// O `fetch` lança TypeError("Failed to fetch") quando não alcança o
// servidor — e era isso, em inglês, que aparecia na tela do vendedor.
// Distinguir "sem internet" de "o sistema recusou" importa: a primeira
// pede tentar de novo, a segunda pede corrigir algo.
export function ehFalhaDeRede(erro) {
  // `semConexao` é a marca que o api.js põe ao não alcançar o servidor.
  // É o caminho normal hoje; os testes de mensagem abaixo cobrem quem
  // chame o fetch por fora e o caso de o erro chegar sem a marca.
  if (erro?.semConexao === true) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String(erro?.message ?? erro ?? '');
  return (
    erro instanceof TypeError ||
    /failed to fetch|networkerror|load failed|network request failed|sem conexão/i.test(msg)
  );
}

export function mensagemDeFalha(erro) {
  if (ehFalhaDeRede(erro)) {
    return 'Sem conexão com o sistema. Sua venda está guardada — tente de novo quando a internet voltar.';
  }
  // Erro de regra de negócio: a mensagem do backend já foi escrita para
  // ser lida por quem não é técnico.
  return erro?.message || 'Não foi possível salvar a venda.';
}
