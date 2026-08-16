// Traduz uma linha do log de auditoria para português de gente.
//
// Módulo PURO, como `recibo.js` e `cobranca.js`. O log guarda nome de
// coluna e valor cru (`preco_venda`, `"42.00"`, `null`); a tela precisa
// dizer "Preço de venda: R$ 42,00 → R$ 45,00".
//
// Sem isso a tela viraria um dump de banco — legível para quem escreveu o
// schema, inútil para quem está tentando descobrir quem mudou o preço.

import { moeda } from './formato.js';

// Nome de coluna → como a pessoa chama aquilo.
const ROTULOS = {
  nome: 'Nome',
  telefone: 'Telefone',
  tipo: 'Tipo',
  observacao: 'Observação',
  unidade: 'Unidade',
  preco_venda: 'Preço de venda',
  preco_custo: 'Preço de custo',
  categoria_id: 'Categoria',
  imagem_url: 'Imagem',
  ativo: 'Situação',
};

// Campos que são dinheiro e precisam sair formatados.
const CAMPOS_MOEDA = new Set(['preco_venda', 'preco_custo']);

const ACOES = {
  criar: { verbo: 'cadastrou', cor: 'nivel' },
  editar: { verbo: 'alterou', cor: 'grafite' },
  desativar: { verbo: 'desativou', cor: 'prumo' },
  reativar: { verbo: 'reativou', cor: 'nivel' },
  remover: { verbo: 'apagou', cor: 'prumo' },
};

export function rotuloCampo(campo) {
  return ROTULOS[campo] ?? campo;
}

// Valor cru → texto. `null` vira "vazio" em vez de sumir: é justamente o
// campo esvaziado que a pessoa precisa enxergar.
export function formatarValor(campo, valor) {
  const vazio = valor === null || valor === undefined || valor === '';

  // Categoria vem ANTES da checagem de vazio: "sem categoria" diz mais
  // que "vazio" para um campo que é uma escolha, não um texto livre.
  // O log não guarda o nome da categoria, só o id — dizer "outra
  // categoria" é honesto; mostrar o UUID não ajudaria ninguém.
  if (campo === 'categoria_id') return vazio ? 'sem categoria' : 'outra categoria';

  // `ativo` também precisa vir antes: `false` não é "vazio", é "inativo".
  if (campo === 'ativo') return String(valor) === 'true' ? 'ativo' : 'inativo';

  if (vazio) return 'vazio';
  if (CAMPOS_MOEDA.has(campo)) return moeda(valor);
  if (campo === 'tipo') return String(valor).replace(/_/g, ' ');
  return String(valor);
}

// "Preço de venda: R$ 42,00 → R$ 45,00"
export function descreverAlteracao({ campo, de, para }) {
  return `${rotuloCampo(campo)}: ${formatarValor(campo, de)} → ${formatarValor(campo, para)}`;
}

// Frase de uma linha do log: "Benedito alterou o produto Cimento CP-II".
export function descreverAcao(linha) {
  if (!linha) return '';
  const { verbo } = ACOES[linha.acao] ?? { verbo: linha.acao };
  const artigo = linha.entidade === 'produto' ? 'o produto' : 'o cliente';
  const nome = linha.entidade_nome || 'sem nome';
  return `${linha.usuario_nome} ${verbo} ${artigo} ${nome}`;
}

export function corDaAcao(acao) {
  return ACOES[acao]?.cor ?? 'grafite';
}

// Data e hora curtas: quem consulta o histórico quer saber "quando",
// não escrever um relatório.
export function quando(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
