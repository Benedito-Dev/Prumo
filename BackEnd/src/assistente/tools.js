// Catálogo de tools do assistente.
//
// O modelo NUNCA escreve SQL: ele escolhe o nome de uma função daqui e os
// argumentos. Cada tool é um envelope fino sobre uma query que já existe
// nos controllers do Painel, Fiados e Clientes.
//
// As 7 tools deste arquivo são SOMENTE LEITURA. As de escrita moram em
// arquivos por domínio (tools.produto.js, tools.cliente.js, …) e entram
// aqui pelo spread no fim do catálogo — um arquivo por domínio para que
// duas frentes de trabalho não briguem pelas mesmas linhas.
//
// Formato de cada entrada:
//   schema   -> o que vai para o modelo (function calling da OpenAI)
//   papeis   -> quem pode usar ('*' = qualquer usuário logado)
//   fonte    -> atalho que a resposta oferece ("a tela comprova")
//   executar -> a query real; recebe (args, usuario)

import { query } from '../config/db.js';
import { resolverPeriodo, mesCorrenteEAnterior } from '../painel/periodo.js';
import { TOOLS_FIADO } from './tools.fiado.js';
import { TOOLS_PRODUTO } from './tools.produto.js';
import { TOOLS_CLIENTE } from './tools.cliente.js';

const PERIODOS = ['hoje', 'semana', 'mes', 'ano'];

// Parâmetro reaproveitado por várias tools.
const argPeriodo = {
  type: 'string',
  enum: PERIODOS,
  description: 'Intervalo a consultar. Padrão: mes (mês corrente).',
};

// Limita o quanto o modelo pode pedir de uma vez.
const limitar = (n, padrao = 5, teto = 20) =>
  Math.min(Math.max(Number(n) || padrao, 1), teto);

export const TOOLS = {
  // ---------------------------------------------------------------- painel
  resumo_do_periodo: {
    papeis: ['dono'],
    fonte: { rotulo: 'Painel', para: '/' },
    schema: {
      name: 'resumo_do_periodo',
      description:
        'Números-chave das vendas em um período: total faturado, quantidade de vendas, ticket médio e quantos clientes compraram. Traz também a variação em relação ao período anterior de mesma duração. Use para perguntas como "como foram as vendas esse mês?" ou "quanto vendi essa semana?".',
      parameters: {
        type: 'object',
        properties: { periodo: argPeriodo },
        required: [],
      },
    },
    async executar({ periodo }) {
      const { de, ate } = resolverPeriodo({ periodo: periodo || 'mes' });
      const dur = new Date(ate) - new Date(de);
      const antDe = new Date(new Date(de) - dur).toISOString();

      const sql = `
        SELECT
          COALESCE(SUM(valor_total), 0) AS total,
          COUNT(*)                      AS qtd_vendas,
          COALESCE(AVG(valor_total), 0) AS ticket_medio,
          COUNT(DISTINCT cliente_id)    AS clientes
        FROM venda
        WHERE status = 'concluida' AND vendida_em >= $1 AND vendida_em < $2
      `;
      const [atual, anterior] = await Promise.all([
        query(sql, [de, ate]),
        query(sql, [antDe, de]),
      ]);
      const a = atual.rows[0];
      const b = anterior.rows[0];
      const varPct = (novo, velho) =>
        Number(velho) > 0 ? Number((((novo - velho) / velho) * 100).toFixed(1)) : null;

      return {
        periodo: periodo || 'mes',
        total: Number(a.total),
        qtd_vendas: Number(a.qtd_vendas),
        ticket_medio: Number(Number(a.ticket_medio).toFixed(2)),
        clientes: Number(a.clientes),
        variacao_pct_vs_periodo_anterior: {
          total: varPct(Number(a.total), Number(b.total)),
          qtd_vendas: varPct(Number(a.qtd_vendas), Number(b.qtd_vendas)),
        },
      };
    },
  },

  faturamento_do_mes: {
    papeis: ['dono'],
    fonte: { rotulo: 'Painel', para: '/' },
    schema: {
      name: 'faturamento_do_mes',
      description:
        'Faturamento do mês corrente comparado ao mês anterior, com a variação percentual. Use para "quanto faturei esse mês?" ou "vendi mais que mês passado?".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    async executar() {
      const { inicioMes, inicioMesAnterior } = mesCorrenteEAnterior();
      const r = await query(
        `SELECT
           COALESCE(SUM(valor_total) FILTER (WHERE vendida_em >= $1), 0) AS mes_atual,
           COALESCE(SUM(valor_total) FILTER (WHERE vendida_em >= $2 AND vendida_em < $1), 0) AS mes_anterior,
           COUNT(*) FILTER (WHERE vendida_em >= $1) AS vendas_mes_atual
         FROM venda
         WHERE status = 'concluida' AND vendida_em >= $2`,
        [inicioMes, inicioMesAnterior]
      );
      const { mes_atual, mes_anterior, vendas_mes_atual } = r.rows[0];
      const atual = Number(mes_atual);
      const anterior = Number(mes_anterior);
      return {
        mes_atual: atual,
        mes_anterior: anterior,
        vendas_mes_atual: Number(vendas_mes_atual),
        variacao_pct:
          anterior > 0 ? Number((((atual - anterior) / anterior) * 100).toFixed(1)) : null,
      };
    },
  },

  ranking_clientes: {
    papeis: ['dono'],
    fonte: { rotulo: 'Clientes', para: '/clientes' },
    schema: {
      name: 'ranking_clientes',
      description:
        'Clientes que mais compraram no período, do maior para o menor valor gasto. Use para "quem são meus melhores clientes?" ou "quem mais compra aqui?".',
      parameters: {
        type: 'object',
        properties: {
          periodo: argPeriodo,
          limite: { type: 'integer', description: 'Quantos clientes trazer (1 a 20). Padrão 5.' },
        },
        required: [],
      },
    },
    async executar({ periodo, limite }) {
      const { de, ate } = resolverPeriodo({ periodo: periodo || 'mes' });
      const r = await query(
        `SELECT
           COALESCE(c.nome, 'Consumidor') AS cliente_nome,
           SUM(v.valor_total) AS total_gasto,
           COUNT(*)           AS qtd_compras
         FROM venda v
         LEFT JOIN cliente c ON c.id = v.cliente_id
         WHERE v.status = 'concluida' AND v.vendida_em >= $1 AND v.vendida_em < $2
         GROUP BY v.cliente_id, c.nome
         ORDER BY total_gasto DESC
         LIMIT $3`,
        [de, ate, limitar(limite)]
      );
      return {
        periodo: periodo || 'mes',
        clientes: r.rows.map((row) => ({
          nome: row.cliente_nome,
          total_gasto: Number(row.total_gasto),
          qtd_compras: Number(row.qtd_compras),
        })),
      };
    },
  },

  produtos_mais_vendidos: {
    papeis: '*',
    fonte: { rotulo: 'Produtos', para: '/produtos' },
    schema: {
      name: 'produtos_mais_vendidos',
      description:
        'Produtos que mais saíram no período, por quantidade vendida. Use para "o que mais vende aqui?" ou "qual produto saiu mais esse mês?".',
      parameters: {
        type: 'object',
        properties: {
          periodo: argPeriodo,
          limite: { type: 'integer', description: 'Quantos produtos trazer (1 a 20). Padrão 5.' },
        },
        required: [],
      },
    },
    async executar({ periodo, limite }) {
      const { de, ate } = resolverPeriodo({ periodo: periodo || 'mes' });
      const r = await query(
        `SELECT
           i.produto_nome,
           SUM(i.quantidade) AS quantidade_total,
           SUM(i.subtotal)   AS valor_total
         FROM item_venda i
         JOIN venda v ON v.id = i.venda_id
         WHERE v.status = 'concluida' AND v.vendida_em >= $1 AND v.vendida_em < $2
         GROUP BY i.produto_id, i.produto_nome
         ORDER BY quantidade_total DESC
         LIMIT $3`,
        [de, ate, limitar(limite)]
      );
      return {
        periodo: periodo || 'mes',
        produtos: r.rows.map((row) => ({
          nome: row.produto_nome,
          quantidade_total: Number(row.quantidade_total),
          valor_total: Number(row.valor_total),
        })),
      };
    },
  },

  desempenho_vendedores: {
    papeis: ['dono'],
    fonte: { rotulo: 'Usuários', para: '/usuarios' },
    schema: {
      name: 'desempenho_vendedores',
      description:
        'Quanto cada vendedor vendeu no período, em valor e em número de vendas. Use para "quem vendeu mais?" ou "como está o desempenho da equipe?".',
      parameters: {
        type: 'object',
        properties: { periodo: argPeriodo },
        required: [],
      },
    },
    async executar({ periodo }) {
      const { de, ate } = resolverPeriodo({ periodo: periodo || 'mes' });
      const r = await query(
        `SELECT
           u.nome AS usuario_nome,
           SUM(v.valor_total) AS total_vendido,
           COUNT(*)           AS qtd_vendas
         FROM venda v
         JOIN usuario u ON u.id = v.usuario_id
         WHERE v.status = 'concluida' AND v.vendida_em >= $1 AND v.vendida_em < $2
         GROUP BY v.usuario_id, u.nome
         ORDER BY total_vendido DESC`,
        [de, ate]
      );
      return {
        periodo: periodo || 'mes',
        vendedores: r.rows.map((row) => ({
          nome: row.usuario_nome,
          total_vendido: Number(row.total_vendido),
          qtd_vendas: Number(row.qtd_vendas),
        })),
      };
    },
  },

  // ---------------------------------------------------------------- fiados
  fiados_em_aberto: {
    papeis: '*',
    fonte: { rotulo: 'Fiados', para: '/fiados' },
    schema: {
      name: 'fiados_em_aberto',
      description:
        'Contas a receber: quanto o depósito tem para receber de fiado, quantas dívidas estão em aberto e quem deve (com o saldo e há quantos dias). Use para "quanto tenho a receber?", "quem está me devendo?" ou "quem está devendo há mais tempo?".',
      parameters: {
        type: 'object',
        properties: {
          limite: { type: 'integer', description: 'Quantas dívidas listar (1 a 20). Padrão 10.' },
        },
        required: [],
      },
    },
    async executar({ limite }) {
      const r = await query(
        `SELECT
           COALESCE(c.nome, 'Consumidor') AS cliente_nome,
           v.valor_total,
           COALESCE(SUM(pf.valor), 0)                 AS pago,
           v.valor_total - COALESCE(SUM(pf.valor), 0) AS saldo,
           EXTRACT(DAY FROM NOW() - v.vendida_em)::int AS dias,
           v.vendida_em
         FROM venda v
         LEFT JOIN cliente c ON c.id = v.cliente_id
         LEFT JOIN pagamento_fiado pf ON pf.venda_id = v.id
         WHERE v.status = 'concluida' AND v.forma_pagamento = 'fiado'
         GROUP BY v.id, c.nome
         HAVING v.valor_total - COALESCE(SUM(pf.valor), 0) > 0.009
         ORDER BY v.vendida_em ASC`
      );
      const dividas = r.rows.map((row) => ({
        cliente: row.cliente_nome,
        saldo: Number(row.saldo),
        dias_em_aberto: row.dias,
        vendida_em: row.vendida_em,
      }));
      return {
        total_a_receber: Number(dividas.reduce((s, d) => s + d.saldo, 0).toFixed(2)),
        qtd_dividas: dividas.length,
        dividas: dividas.slice(0, limitar(limite, 10)),
      };
    },
  },

  // -------------------------------------------------------------- clientes
  buscar_cliente: {
    papeis: '*',
    fonte: { rotulo: 'Clientes', para: '/clientes' },
    schema: {
      name: 'buscar_cliente',
      description:
        'Procura um cliente pelo nome ou telefone e traz o histórico dele: quanto já gastou, quantas compras fez, quando comprou pela última vez e quanto deve de fiado. Use para "quanto o João já comprou?" ou "o Zé está devendo?".',
      parameters: {
        type: 'object',
        properties: {
          busca: { type: 'string', description: 'Parte do nome ou do telefone do cliente.' },
        },
        required: ['busca'],
      },
    },
    async executar({ busca }) {
      if (!busca || !String(busca).trim()) {
        return { erro: 'Informe parte do nome ou do telefone do cliente.' };
      }
      const r = await query(
        `SELECT
           c.nome,
           c.telefone,
           c.tipo,
           COALESCE(SUM(v.valor_total), 0) AS total_gasto,
           COUNT(v.id)                     AS qtd_compras,
           MAX(v.vendida_em)               AS ultima_compra,
           CASE WHEN MAX(v.vendida_em) IS NOT NULL
                THEN EXTRACT(DAY FROM NOW() - MAX(v.vendida_em))::int
                ELSE NULL END              AS dias_sem_comprar,
           COALESCE(SUM(v.valor_total) FILTER (WHERE v.forma_pagamento = 'fiado'), 0)
             - COALESCE((
                 SELECT SUM(pf.valor) FROM pagamento_fiado pf
                  JOIN venda vv ON vv.id = pf.venda_id
                 WHERE vv.cliente_id = c.id
               ), 0)                       AS deve_de_fiado
         FROM cliente c
         LEFT JOIN venda v ON v.cliente_id = c.id AND v.status = 'concluida'
         WHERE c.nome ILIKE $1 OR c.telefone ILIKE $1
         GROUP BY c.id
         ORDER BY total_gasto DESC
         LIMIT 5`,
        [`%${String(busca).trim()}%`]
      );

      if (r.rowCount === 0) {
        return { encontrados: 0, aviso: `Nenhum cliente encontrado para "${busca}".` };
      }
      return {
        encontrados: r.rowCount,
        clientes: r.rows.map((row) => ({
          nome: row.nome,
          telefone: row.telefone,
          tipo: row.tipo,
          total_gasto: Number(row.total_gasto),
          qtd_compras: Number(row.qtd_compras),
          ultima_compra: row.ultima_compra,
          dias_sem_comprar: row.dias_sem_comprar,
          deve_de_fiado: Math.max(0, Number(row.deve_de_fiado)),
        })),
      };
    },
  },

  // ---------------------------------------------------------- escrita
  ...TOOLS_PRODUTO,
  ...TOOLS_CLIENTE,
  ...TOOLS_FIADO,
};

// Tools que o papel pode usar. O catálogo enviado ao modelo já vai filtrado,
// então ele nem sabe que as outras existem.
export function toolsDoPapel(papel) {
  return Object.entries(TOOLS)
    .filter(([, t]) => t.papeis === '*' || t.papeis.includes(papel))
    .map(([nome]) => nome);
}

// Formato que o OpenRouter espera no campo `tools`.
export function schemasParaModelo(papel) {
  return toolsDoPapel(papel).map((nome) => ({
    type: 'function',
    function: TOOLS[nome].schema,
  }));
}

// Executa uma tool pelo nome. Valida existência e permissão — nome
// desconhecido é rejeitado, nunca "tenta assim mesmo".
export async function executarTool(nome, args, usuario) {
  const tool = TOOLS[nome];
  if (!tool) {
    return { resultado: { erro: `Função desconhecida: ${nome}` }, fonte: null };
  }
  if (!toolsDoPapel(usuario?.papel).includes(nome)) {
    return {
      resultado: { erro: 'Você não tem permissão para consultar essa informação.' },
      fonte: null,
    };
  }
  const resultado = await tool.executar(args || {}, usuario);
  return { resultado, fonte: tool.fonte };
}
