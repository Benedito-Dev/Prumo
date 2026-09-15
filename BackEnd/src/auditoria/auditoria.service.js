// Log de auditoria de cadastros.
//
// Responde "quem mexeu nisso?" para produto e cliente — as duas entidades
// que não tinham rastro nenhum. Venda e pagamento de fiado já guardam
// autoria em coluna própria e ficam de fora de propósito.
//
// A regra que sustenta o resto: **registrar nunca derruba a operação.**
// Se o log falhar, a venda, o cadastro ou o ajuste de preço já
// aconteceram — abortar por causa da anotação seria trocar um problema
// pequeno (perdi uma linha de histórico) por um grande (o balcão parou).
// Por isso `registrar` engole o próprio erro e só grita no console.
import { query } from '../config/db.js';

export const ACOES = {
  CRIAR: 'criar',
  EDITAR: 'editar',
  DESATIVAR: 'desativar',
  REATIVAR: 'reativar',
  REMOVER: 'remover',
};

// Campos que nunca entram no log, mesmo se alguém os passar por engano.
// senha_hash é o óbvio; o log é lido na tela pelo dono e não é lugar de
// material sensível.
const NUNCA_REGISTRAR = new Set(['senha', 'senha_hash', 'senha_nova', 'senha_atual']);

// Compara o registro ANTES e DEPOIS e devolve [{campo, de, para}].
//
// Compara o que o BANCO gravou nos dois momentos, não o que foi pedido:
// o INSERT/UPDATE aplica defaults, trunca VARCHAR e normaliza. Registrar
// a intenção em vez do fato faria o log mentir. Mesma razão do
// `diferencas()` das tools do Zé.
export function calcularAlteracoes(antes, depois) {
  if (!antes || !depois) return null;

  const mudancas = [];
  for (const campo of Object.keys(depois)) {
    if (NUNCA_REGISTRAR.has(campo)) continue;
    // Colunas de controle não são "alteração" que interesse a alguém.
    if (campo === 'id' || campo === 'criado_em') continue;

    const de = antes[campo];
    const para = depois[campo];

    // NUMERIC volta do driver como string: comparar "45.00" com 45 daria
    // alteração onde não houve. String() nos dois lados resolve, e null
    // vira '' para não marcar mudança entre null e undefined.
    const iguais = String(de ?? '') === String(para ?? '');
    if (!iguais) mudancas.push({ campo, de: de ?? null, para: para ?? null });
  }
  return mudancas.length > 0 ? mudancas : null;
}

// Grava uma linha no log. Nunca lança.
//
// `usuario` é o do token (`req.usuario`). Sem ele não há o que registrar
// — mas isso também não pode derrubar a operação, então só avisa.
export async function registrar({
  usuario,
  acao,
  entidade,
  entidade_id = null,
  entidade_nome = null,
  alteracoes = null,
}) {
  try {
    if (!usuario?.id) {
      console.error('[auditoria] ação sem usuário identificado:', acao, entidade);
      return;
    }
    await query(
      `INSERT INTO log_auditoria
         (usuario_id, usuario_nome, acao, entidade, entidade_id, entidade_nome, alteracoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        usuario.id,
        usuario.nome ?? 'desconhecido',
        acao,
        entidade,
        entidade_id,
        entidade_nome,
        alteracoes ? JSON.stringify(alteracoes) : null,
      ]
    );
  } catch (erro) {
    // Engolido de propósito — ver a nota no topo do arquivo.
    console.error('[auditoria] falha ao registrar:', erro.message);
  }
}

// Lista o histórico, do mais recente para o mais antigo.
export async function listar({ usuario_id, entidade, limite = 100, de, ate } = {}) {
  const condicoes = [];
  const params = [];

  if (usuario_id) {
    params.push(usuario_id);
    condicoes.push(`usuario_id = $${params.length}`);
  }
  if (entidade) {
    params.push(entidade);
    condicoes.push(`entidade = $${params.length}`);
  }
  if (de) {
    params.push(de);
    condicoes.push(`criado_em >= $${params.length}`);
  }
  if (ate) {
    params.push(ate);
    condicoes.push(`criado_em < ($${params.length}::date + INTERVAL '1 day')`);
  }

  // Teto de 500 mesmo se pedirem mais: a tela é uma lista de leitura, não
  // uma exportação, e o log é a tabela que mais cresce sem podar.
  params.push(Math.min(Number(limite) || 100, 500));

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT * FROM log_auditoria ${where}
      ORDER BY criado_em DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

// Histórico de UM registro — para mostrar dentro da ficha do produto ou
// do cliente, quando essa tela existir.
export async function historicoDe(entidade, entidade_id) {
  const { rows } = await query(
    `SELECT * FROM log_auditoria
      WHERE entidade = $1 AND entidade_id = $2
      ORDER BY criado_em DESC
      LIMIT 50`,
    [entidade, entidade_id]
  );
  return rows;
}
