// Corretor de ditado por catálogo (Etapa 1 do plano de ditado).
//
// A Web Speech API é boa em português corrente e péssima em nome de depósito:
// ela nunca ouviu falar de "Vergalhao 10mm". Quem conhece esses nomes é o
// sistema — então o conserto não é ouvir melhor, é cruzar o que foi ouvido
// com o que existe no catálogo.
//
// Módulo puro de propósito: sem React, sem rede, sem DOM. Roda em Node, o que
// deixa o algoritmo testável sem microfone e sem navegador.

// Acima disso substitui; abaixo, deixa como falado. Ver COMENTÁRIO DO CORTE
// no fim do arquivo para o raciocínio por trás do número.
export const CORTE_PADRAO = 0.78;

// Uma segunda opção só ameaça a primeira se chegar perto dela. Empate técnico
// = ambiguidade, e ambiguidade não se corrige (o resolvedor do Zé pergunta).
const MARGEM_DE_EMPATE = 0.04;

// Janelas maiores primeiro: "ver galhão dez" precisa ser visto inteiro, senão
// "dez" casaria sozinho e quebraria o trecho que importa.
const TAMANHOS_DE_JANELA = [3, 2, 1];

// ---------------------------------------------------------------- Normalizar

// minúsculo, sem acento, sem pontuação, espaços colapsados. É o formato em que
// TODA comparação acontece — o banco guarda "Vergalhao" e a pessoa fala
// "vergalhão"; sem isso os dois nunca batem.
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Igual a normalizar(), mas mantém a vírgula quando ela está entre dígitos —
// isto é, quando é separador decimal de preço e não pontuação de frase.
function normalizarPreservandoDecimal(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Tudo que não for letra, dígito, espaço ou vírgula vira espaço.
    .replace(/[^a-z0-9\s,]+/g, ' ')
    // Das vírgulas restantes sobrevive só a que tem dígito dos DOIS lados:
    // "39,90" é preço; a de "Cimento, 50kg" é pontuação e vira espaço.
    .replace(/,(?![0-9])/g, ' ')
    .replace(/(?<![0-9]),/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------- Similaridade

// Levenshtein com duas linhas em vez da matriz inteira: o catálogo pode chegar
// a centenas de nomes e isto roda uma vez por janela por nome.
// `maximo` é uma desistência antecipada: quem chama só quer saber se a
// distância é PEQUENA (nome parecido). Quando a linha inteira já passou do
// teto, nenhuma linha seguinte melhora — o resultado só cresce — então dá
// para parar e devolver algo acima do teto. É o que torna o corretor viável
// com centenas de nomes, onde a esmagadora maioria não tem chance nenhuma.
function distanciaEdicao(a, b, maximo = Infinity) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;

  let anterior = new Array(b.length + 1);
  let atual = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) anterior[j] = j;

  for (let i = 1; i <= a.length; i++) {
    atual[0] = i;
    const ca = a.charCodeAt(i - 1);
    let melhorDaLinha = atual[0];
    for (let j = 1; j <= b.length; j++) {
      const custo = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const d = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
      atual[j] = d;
      if (d < melhorDaLinha) melhorDaLinha = d;
    }
    if (melhorDaLinha > maximo) return maximo + 1;
    const troca = anterior;
    anterior = atual;
    atual = troca;
  }
  return anterior[b.length];
}

// 0 a 1. Espera receber texto JÁ normalizado quando estiver em laço quente —
// normaliza por garantia, mas quem chama muito deve normalizar antes.
export function similaridade(a, b) {
  const x = normalizar(a);
  const y = normalizar(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  return 1 - distanciaEdicao(x, y) / Math.max(x.length, y.length);
}

// ------------------------------------------------------------------ Números

// "um"/"uma" ficam de fora de propósito: em "preciso de UMA nota fiscal" são
// artigo, não quantidade, e não há como distinguir sem entender a frase.
// Trocar por "1" estragaria texto correto — e o Zé lê "uma" sem dificuldade.
// Só valem como número quando compõem outro ("vinte e um", tratado abaixo).
const UNIDADES = {
  zero: 0, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const DEZENAS = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};
const CENTENAS = {
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800,
  novecentos: 900,
};
const MULTIPLICADORES = { mil: 1000, milhao: 1000000, milhoes: 1000000 };

// "reais" e "centavos" não somam nada ao número, mas fazem parte da fala.
// São consumidos e descartados para não sobrar lixo no texto.
const MOEDA = new Set(['real', 'reais', 'conto', 'contos', 'pila']);
const CENTAVOS = new Set(['centavo', 'centavos']);

// "um" só conta como número quando FECHA outro ("vinte e um"), nunca sozinho.
const UNIDADES_LIGADAS = { um: 1, uma: 1 };

const ehNumero = (p) =>
  p in UNIDADES || p in DEZENAS || p in CENTENAS || p in MULTIPLICADORES;

// Converte uma sequência de palavras já sabidamente numéricas em um inteiro.
// "trinta e nove" → 39; "dois mil e quinhentos" → 2500.
function valorDaSequencia(palavras) {
  let total = 0;
  let parcial = 0;
  for (const p of palavras) {
    if (p === 'e') continue;
    if (p in UNIDADES_LIGADAS) parcial += UNIDADES_LIGADAS[p];
    else if (p in UNIDADES) parcial += UNIDADES[p];
    else if (p in DEZENAS) parcial += DEZENAS[p];
    else if (p in CENTENAS) parcial += CENTENAS[p];
    else if (p in MULTIPLICADORES) {
      // "mil" sozinho vale 1000, não 0 × 1000.
      parcial = (parcial || 1) * MULTIPLICADORES[p];
      total += parcial;
      parcial = 0;
    }
  }
  return total + parcial;
}

// Magnitude de cada palavra numérica. É o que decide onde UM número termina e
// outro começa: em pt-BR um número por extenso vai sempre do maior para o
// menor ("cento e trinta e nove"). Quando a magnitude sobe de novo, começou
// outro número — "trinta e nove E NOVENTA" são dois, não 129.
function magnitude(p) {
  if (p in MULTIPLICADORES) return MULTIPLICADORES[p];
  if (p in CENTENAS) return 100;
  if (p in DEZENAS) return 10;
  if (p in UNIDADES) return UNIDADES[p] >= 10 ? 10 : 1; // "dezessete" é dezena
  return 0;
}

// Lê a partir de `i` a maior sequência numérica possível e devolve onde parou.
// O "e" só é engolido quando é ligação de número ("trinta E nove"), nunca
// quando é conjunção de frase ("vergalhão E cimento").
function lerNumero(palavras, i) {
  const usadas = [];
  let j = i;
  let ultima = Infinity;

  while (j < palavras.length) {
    const p = palavras[j];

    if (ehNumero(p)) {
      const m = magnitude(p);
      // Multiplicador ("mil") sempre agrega: "dois mil" sobe de propósito.
      if (m < ultima || p in MULTIPLICADORES) {
        usadas.push(p);
        // Depois de "mil" o teto volta a abrir: em "dois MIL e quinhentos",
        // quinhentos é maior que dois mas continua o MESMO número — o
        // multiplicador fecha um bloco e começa outro.
        ultima = m;
        j++;
        continue;
      }
      break; // magnitude repetiu ou subiu: é outro número
    }

    // O "e" só continua a sequência se o que vem depois for MENOR — senão
    // ele é a ligação entre dois números distintos (reais e centavos).
    const seguinte = palavras[j + 1];
    if (p === 'e' && usadas.length && seguinte) {
      // "vinte e um": aqui o "um" é numeral de verdade, não artigo.
      if (seguinte in UNIDADES_LIGADAS && ultima > 1) {
        usadas.push(p, seguinte);
        ultima = 1;
        j += 2;
        continue;
      }
      if (ehNumero(seguinte) && magnitude(seguinte) < ultima) {
        usadas.push(p);
        j++;
        continue;
      }
    }
    break;
  }

  if (!usadas.length) return null;
  return { valor: valorDaSequencia(usadas), fim: j };
}

// "trinta e nove e noventa" → "39,90" · "dez" → "10" · "dez reais" → "10".
//
// A regra do preço: dois números ligados por "e", com o segundo cabendo em
// centavos (< 100), viram um valor só. É como se fala preço no balcão —
// "trinta e nove e noventa" nunca quis dizer dois números separados.
export function numerosPorExtenso(texto) {
  const palavras = normalizar(texto).split(' ').filter(Boolean);
  const saida = [];
  let i = 0;

  while (i < palavras.length) {
    // "por cento" é porcentagem, não o número 100. Sem esta guarda,
    // "desconto de dez POR CENTO" viraria "10 por 100" — e desconto é
    // exatamente o assunto em que trocar número dá prejuízo.
    if (palavras[i] === 'por' && palavras[i + 1] === 'cento') {
      saida.push('por', 'cento');
      i += 2;
      continue;
    }

    const primeiro = lerNumero(palavras, i);
    if (!primeiro) {
      saida.push(palavras[i]);
      i++;
      continue;
    }

    let escrito = String(primeiro.valor);
    let fim = primeiro.fim;

    // "dez reais" → "10": a unidade monetária já está implícita no número.
    // Consumida ANTES de procurar centavos, senão o "reais" de "trinta e nove
    // REAIS e noventa centavos" esconderia a segunda metade do preço.
    if (MOEDA.has(palavras[fim])) fim++;

    // Parte de centavos: "... e noventa" ou "... e noventa centavos".
    if (palavras[fim] === 'e') {
      const segundo = lerNumero(palavras, fim + 1);
      if (segundo && segundo.valor < 100) {
        escrito = `${primeiro.valor},${String(segundo.valor).padStart(2, '0')}`;
        fim = segundo.fim;
        if (CENTAVOS.has(palavras[fim])) fim++;
      }
    }

    saida.push(escrito);
    i = fim;
  }

  return saida.join(' ');
}

// -------------------------------------------------------------- Vocabulário

// Pré-calcula a forma normalizada de cada nome UMA vez. Com centenas de nomes
// e várias janelas por frase, normalizar dentro do laço seria o gargalo.
function prepararVocabulario(vocabulario) {
  const nomes = [
    ...(vocabulario?.produtos ?? []),
    ...(vocabulario?.clientes ?? []),
  ];
  return nomes
    .filter((n) => typeof n === 'string' && n.trim())
    .map((original) => {
      const alvo = normalizar(original);
      const partes = alvo.split(' ').filter(Boolean);
      // Os prefixos de 1..3 palavras saem prontos daqui: dentro do laço de
      // janelas eles seriam recortados milhares de vezes por frase.
      const prefixos = [];
      const prefixosColados = [];
      for (const n of TAMANHOS_DE_JANELA) {
        prefixos[n] = partes.slice(0, n).join(' ');
        prefixosColados[n] = prefixos[n].replace(/ /g, '');
      }
      return {
        original,
        alvo,
        // Sem espaços: "ver galhao" vs "vergalhao" só bate assim. A fronteira
        // de palavra é justamente o que o reconhecimento erra.
        alvoColado: alvo.replace(/ /g, ''),
        partes,
        prefixos,
        prefixosColados,
        palavras: partes.length,
      };
    });
}

// Converte o corte em "quantas edições ainda são toleráveis" e repassa esse
// teto ao Levenshtein, que desiste assim que o estoura.
const proporcao = (a, b, corte = 0) => {
  const maior = Math.max(a.length, b.length);
  const toleradas = Math.floor(maior * (1 - corte));
  return 1 - distanciaEdicao(a, b, toleradas) / maior;
};

// A distância de edição é no MÍNIMO a diferença de comprimento: para virar uma
// palavra de 30 letras, uma de 5 precisa de pelo menos 25 edições. Isso dá um
// teto de similaridade que sai de uma subtração, sem rodar Levenshtein.
// Com centenas de nomes no catálogo, é o que descarta a grande maioria antes
// de pagar o custo real — e é uma poda exata, nunca perde um candidato bom.
const tetoPorComprimento = (na, nb) => {
  const maior = Math.max(na, nb);
  return maior === 0 ? 1 : 1 - Math.abs(na - nb) / maior;
};

// Compara a janela com o nome por três caminhos e fica com o melhor:
//
// 1. com espaço  — fala e cadastro concordam na separação ("marcos andrade");
// 2. sem espaço  — fronteira de palavra errada, o erro mais comum do
//    reconhecimento ("josefa reira" → "jose ferreira", "ver galhao");
// 3. só o começo  — a pessoa diz o nome usual, o cadastro tem o resto
//    ("vergalhão" → "Vergalhao 10mm"). Sem isso, todo produto com bitola,
//    peso ou marca no nome ficaria fora de alcance, porque ninguém fala
//    "vergalhão dez milímetros" no balcão.
//
// O caminho 3 exige que o começo case QUASE INTEIRO (é o mesmo corte aplicado
// só ao prefixo), então "cimento" não vira "Cimento Mizu" por ser prefixo:
// ele casa igualmente bem com os dois e cai na regra de ambiguidade.
// `corte` entra aqui só para podar: qualquer caminho cujo TETO já esteja
// abaixo dele não precisa de Levenshtein, porque nunca seria escolhido.
function pontuar(janela, janelaColada, entrada, tamanhoJanela, corte) {
  let nota = 0;

  if (tetoPorComprimento(janela.length, entrada.alvo.length) >= corte) {
    nota = proporcao(janela, entrada.alvo, corte);
  }
  if (tetoPorComprimento(janelaColada.length, entrada.alvoColado.length) > nota
    && tetoPorComprimento(janelaColada.length, entrada.alvoColado.length) >= corte) {
    const colado = proporcao(janelaColada, entrada.alvoColado, corte);
    if (colado > nota) nota = colado;
  }

  // Prefixo só faz sentido quando o nome do catálogo é MAIOR que o falado.
  if (entrada.palavras > tamanhoJanela) {
    const prefixo = entrada.prefixos[tamanhoJanela];
    const prefixoColado = entrada.prefixosColados[tamanhoJanela];
    let notaPrefixo = 0;
    if (tetoPorComprimento(janela.length, prefixo.length) >= corte) {
      notaPrefixo = proporcao(janela, prefixo, corte);
    }
    if (tetoPorComprimento(janelaColada.length, prefixoColado.length) >= corte) {
      const p = proporcao(janelaColada, prefixoColado, corte);
      if (p > notaPrefixo) notaPrefixo = p;
    }
    // Desconta um pouco: casar com parte do nome é evidência mais fraca que
    // casar com ele inteiro, e o desconto mantém a preferência pelo completo.
    if (notaPrefixo - 0.02 > nota) nota = notaPrefixo - 0.02;
  }

  return nota;
}

// ------------------------------------------------------------- Por catálogo

// Varre o texto com janelas de 3, 2 e 1 palavra e troca o trecho pelo nome do
// catálogo quando a semelhança passa do corte. Devolve o texto e o placar da
// melhor troca, que a fachada usa para escolher entre as alternativas.
export function corrigirPorCatalogo(texto, vocabulario, opcoes = {}) {
  const corte = opcoes.corte ?? CORTE_PADRAO;
  const entradas = opcoes.entradas ?? prepararVocabulario(vocabulario);
  // A vírgula de decimal sobrevive à normalização aqui: quando este passo roda
  // depois de numerosPorExtenso, o texto já traz "39,90" e normalizar() a
  // trocaria por espaço, desmanchando o preço em "39 90". Nenhum nome de
  // catálogo depende de vírgula, então preservá-la não afeta o casamento.
  const palavras = normalizarPreservandoDecimal(texto).split(' ').filter(Boolean);

  if (!palavras.length || !entradas.length) {
    return { texto: palavras.join(' '), trocas: 0, melhor: 0 };
  }

  // saida[i] guarda o que sai no lugar da palavra i; null = trecho já
  // consumido por uma janela maior. É assim que correções não se sobrepõem.
  const saida = palavras.slice();
  const consumido = new Array(palavras.length).fill(false);
  let trocas = 0;
  let melhor = 0;

  for (const tamanho of TAMANHOS_DE_JANELA) {
    for (let i = 0; i + tamanho <= palavras.length; i++) {
      let livre = true;
      for (let k = i; k < i + tamanho; k++) if (consumido[k]) livre = false;
      if (!livre) continue;

      // Uma janela NUNCA começa com número solto. "2 areia media" casava
      // com "Areia media" porque o 2 some na normalização — e a troca
      // engolia a quantidade, virando "vende Areia media". No balcão isso
      // é vender 1 quando se pediu 2. O número que faz parte do nome
      // (o "10mm" de Vergalhao 10mm) vem colado ou no meio, nunca abrindo
      // a janela logo depois do verbo.
      if (/^\d+([.,]\d+)?$/.test(palavras[i])) continue;

      const janela = palavras.slice(i, i + tamanho).join(' ');
      const janelaColada = janela.replace(/ /g, '');

      let campeao = null;
      let notaCampeao = 0;
      let notaVice = 0;

      for (const entrada of entradas) {
        // Um nome MENOR que a janela nunca vai casar bem — comparar
        // "Areia media" com uma janela de 3 palavras só gera ruído. Já o nome
        // maior que a janela é caso legítimo: é a fala abreviada, tratada
        // pelo caminho de prefixo em pontuar(). O ±1 abaixo é a folga para a
        // fala que junta ou quebra palavras.
        if (entrada.palavras < tamanho - 1) continue;

        // O corte entra na poda, mas com folga: a margem de empate compara o
        // campeão com o vice, e um vice podido cedo demais esconderia uma
        // ambiguidade real. Podar em (corte - margem) preserva essa conta.
        const nota = pontuar(janela, janelaColada, entrada, tamanho,
          corte - MARGEM_DE_EMPATE);
        if (nota > notaCampeao) {
          notaVice = notaCampeao;
          notaCampeao = nota;
          campeao = entrada;
        } else if (nota > notaVice) {
          notaVice = nota;
        }
      }

      if (!campeao || notaCampeao < corte) continue;

      // Empate técnico é ambiguidade: "cimento" fica igualmente perto do CP-II
      // e do Mizu. Escolher um seria adivinhar, e o erro escolhido a pessoa
      // não percebe. Deixa como falado — o resolvedor do Zé pergunta qual.
      if (notaCampeao - notaVice < MARGEM_DE_EMPATE) continue;

      saida[i] = campeao.original;
      for (let k = i + 1; k < i + tamanho; k++) saida[k] = null;
      for (let k = i; k < i + tamanho; k++) consumido[k] = true;
      trocas++;
      if (notaCampeao > melhor) melhor = notaCampeao;
    }
  }

  return { texto: saida.filter((p) => p !== null).join(' '), trocas, melhor };
}

// ------------------------------------------------------------------ Fachada

// Recebe as alternativas do navegador (da mais provável para a menos) e
// devolve uma frase só.
//
// O ganho principal está aqui: se a 1ª hipótese não casa com nada do catálogo
// mas a 3ª casa, vale a 3ª. O navegador não sabe qual das suas hipóteses é a
// boa; o catálogo sabe.
export function corrigir(alternativas, vocabulario, opcoes = {}) {
  const lista = (Array.isArray(alternativas) ? alternativas : [alternativas])
    .filter((t) => typeof t === 'string' && t.trim());
  if (!lista.length) return '';

  // Normalização do catálogo feita uma vez para TODAS as alternativas.
  const entradas = prepararVocabulario(vocabulario);
  const configuracao = { ...opcoes, entradas };

  let vencedor = null;
  for (let posicao = 0; posicao < lista.length; posicao++) {
    // Números primeiro: "ver galhão dez" precisa virar "ver galhao 10" para
    // casar com "Vergalhao 10mm". Com "dez" por extenso, nunca casaria.
    const comNumeros = numerosPorExtenso(lista[posicao]);
    const resultado = corrigirPorCatalogo(comNumeros, null, configuracao);

    if (!vencedor) vencedor = { ...resultado, posicao };
    // Mais trocas ganha; empatado em trocas, ganha a melhor nota. A ordem do
    // navegador só desempata no fim — ele acertou a ordem em português, não
    // em nome próprio, que é exatamente o que estamos consertando.
    else if (
      resultado.trocas > vencedor.trocas ||
      (resultado.trocas === vencedor.trocas && resultado.melhor > vencedor.melhor)
    ) {
      vencedor = { ...resultado, posicao };
    }

    // A primeira alternativa que casa com tudo que dava para casar já basta.
    if (resultado.trocas && resultado.melhor === 1) break;
  }

  return vencedor.texto;
}

// COMENTÁRIO DO CORTE — por que 0.78
//
// O plano fixa ~0.78 e a prática confirmou: "marcos andrade" bate 1.00 contra
// "Marcos Andrade" (só acento e caixa), "ver galhao 10" bate ~0.85 contra
// "Vergalhao 10mm" pelo caminho colado, e "martelo" contra "Areia media" fica
// em ~0.25 — bem longe. A faixa entre 0.6 e 0.78 é onde moram os palpites, e
// palpite errado é o único erro caro aqui: texto errado a pessoa vê e conserta;
// nome trocado por outro do catálogo ela não percebe.
