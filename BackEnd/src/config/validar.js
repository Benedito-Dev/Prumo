// Validação de entrada na borda.
//
// Existe por causa de um bug concreto: `quantidade: "abc"` passava pelo
// `Number()` do service, virava NaN, e o Postgres **aceitava**. NUMERIC
// tem NaN como valor válido — não dá erro, grava. A venda entrava no
// banco com valor_total = NaN e contaminava a soma do faturamento
// inteiro (NaN + qualquer coisa = NaN), sem nada no log para explicar.
//
// A regra que isso ensina: `Number(x)` não valida nada. Ele devolve NaN
// para lixo, Infinity para "1e400", e 0 para string vazia, null e array
// vazio. Quem valida é este módulo.
//
// Módulo PURO — sem HTTP, sem banco. As funções lançam ErroNegocio, que o
// controller traduz em 400 e as tools do Zé em texto para o modelo.
import { ErroNegocio } from './erros.js';

// As mensagens são lidas na tela por quem não é técnico, então começam
// com maiúscula como qualquer frase. O nome do campo entra no meio do
// texto em minúscula ("Informe a quantidade") mas no começo precisa subir
// ("Quantidade precisa ser um número válido").
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Teto de valores monetários e quantidades. NUMERIC(12,2) comporta até
// 10 dígitos antes da vírgula; passar disso é erro de digitação (ou
// tentativa de estourar a coluna), não uma venda de verdade.
const MAX_VALOR = 9_999_999_999;

// Um pedido de balcão não tem 500 linhas. O limite existe para que um
// payload gigante não vire uma transação que segura o banco.
export const MAX_ITENS_VENDA = 100;

// Comprimentos batem com o schema (VARCHAR(120), VARCHAR(20)...). Barrar
// aqui devolve 400 legível em vez do 22001 cru do Postgres virando 500.
const LIMITES_TEXTO = {
  nome: 120,
  telefone: 20,
  email: 160,
  observacao: 2000,
  descricao: 500,
};

// Formato de UUID. Sem esta checagem, um id inventado vai para o SQL e
// estoura com 22P02 — que o usuário lê como "Falha inesperada".
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- números ---

// Número de verdade: finito, não-NaN, dentro do teto.
// `permitirZero` separa preço (0 é brinde, legítimo) de quantidade
// (0 não é venda).
export function numeroValido(valor, campo, { permitirZero = false, max = MAX_VALOR } = {}) {
  // Rejeita antes de converter: `Number([])` é 0, `Number(null)` é 0,
  // `Number('')` é 0, `Number(true)` é 1. Nenhum deles é alguém
  // informando um número.
  if (valor === null || valor === undefined || valor === '') {
    throw new ErroNegocio(`Informe ${campo}`);
  }
  if (typeof valor === 'boolean' || Array.isArray(valor) || typeof valor === 'object') {
    throw new ErroNegocio(`${maiuscula(campo)} precisa ser um número`);
  }

  const n = Number(valor);

  // Number.isFinite pega NaN E Infinity de uma vez — "1e400" vira
  // Infinity, que o NUMERIC também aceitaria.
  if (!Number.isFinite(n)) {
    throw new ErroNegocio(`${maiuscula(campo)} precisa ser um número válido`);
  }
  if (n < 0) {
    throw new ErroNegocio(`${maiuscula(campo)} não pode ser negativo`);
  }
  if (!permitirZero && n === 0) {
    throw new ErroNegocio(`${maiuscula(campo)} precisa ser maior que zero`);
  }
  if (n > max) {
    throw new ErroNegocio(`${maiuscula(campo)} é grande demais`);
  }
  return n;
}

// --- texto ---

export function textoValido(valor, campo, { obrigatorio = true, max } = {}) {
  if (valor === null || valor === undefined || valor === '') {
    if (obrigatorio) throw new ErroNegocio(`Informe ${campo}`);
    return null;
  }
  // Número não é texto: `nome: 12345` virava a string "12345" no banco.
  // Aceitar isso deixa passar erro de quem monta a requisição.
  if (typeof valor !== 'string') {
    throw new ErroNegocio(`${maiuscula(campo)} precisa ser um texto`);
  }

  const limpo = valor.trim();
  if (obrigatorio && limpo === '') {
    throw new ErroNegocio(`Informe ${campo}`);
  }

  const limite = max ?? LIMITES_TEXTO[campo] ?? 255;
  if (limpo.length > limite) {
    throw new ErroNegocio(`${maiuscula(campo)} é longo demais (máximo ${limite} caracteres)`);
  }
  return limpo;
}

// --- identificadores ---

export function uuidValido(valor, campo, { obrigatorio = true } = {}) {
  if (valor === null || valor === undefined || valor === '') {
    if (obrigatorio) throw new ErroNegocio(`Informe ${campo}`);
    return null;
  }
  if (typeof valor !== 'string' || !UUID.test(valor)) {
    // Mensagem sem jargão: quem lê a tela não sabe o que é UUID.
    throw new ErroNegocio(`${maiuscula(campo)} inválido`);
  }
  return valor;
}

// --- listas ---

export function listaValida(valor, campo, { min = 1, max = MAX_ITENS_VENDA } = {}) {
  if (!Array.isArray(valor)) {
    throw new ErroNegocio(`${maiuscula(campo)} precisa ser uma lista`);
  }
  if (valor.length < min) {
    throw new ErroNegocio(
      min === 1 ? `A venda precisa de ao menos um item` : `${maiuscula(campo)} precisa de ao menos ${min}`
    );
  }
  if (valor.length > max) {
    throw new ErroNegocio(`${maiuscula(campo)}: no máximo ${max} de uma vez`);
  }
  return valor;
}

// --- conjuntos fechados ---

// `feminino` só existe para a mensagem sair em português correto —
// "unidade inválido" denuncia texto gerado por máquina para quem lê.
export function opcaoValida(valor, campo, opcoes, { obrigatorio = true, feminino = false } = {}) {
  if (valor === null || valor === undefined || valor === '') {
    if (obrigatorio) throw new ErroNegocio(`Informe ${campo}`);
    return null;
  }
  if (!opcoes.includes(valor)) {
    throw new ErroNegocio(
      `${maiuscula(campo)} ${feminino ? 'inválida' : 'inválido'}. Use: ${opcoes.join(', ')}`
    );
  }
  return valor;
}
