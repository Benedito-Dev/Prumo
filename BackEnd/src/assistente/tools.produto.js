// Tools de escrita de produto (Fatia 2).
//
// Só o dono usa: preço é margem, e margem é decisão de dono.
//
// Nenhuma das duas confirma antes de gravar. Criar ou editar produto é
// barato de corrigir, e exigir confirmação transformaria o chat no
// formulário que ele existe para evitar. A conferência vem DEPOIS, na
// leitura do registro — por isso o retorno não é um "ok", é a ficha do
// que ficou gravado, montada a partir do que o banco devolveu.

import {
  UNIDADES_VALIDAS,
  criarProduto,
  atualizarProdutoParcial,
  buscarProdutosPorNome,
  buscarCategoriaPorNome,
} from '../produto/produto.service.js';
import { protegido, resolverUnico, moeda, diferencas } from './tools.escrita.comum.js';

const FONTE = { rotulo: 'Produtos', para: '/produtos' };

// Campos que a edição sabe comparar, na ordem em que fazem sentido lidos.
const CAMPOS_COMPARADOS = [
  { campo: 'nome', rotulo: 'Nome' },
  { campo: 'unidade', rotulo: 'Unidade' },
  { campo: 'preco_venda', rotulo: 'Preço de venda', formatar: moeda },
  { campo: 'preco_custo', rotulo: 'Preço de custo', formatar: moeda },
  { campo: 'categoria_nome', rotulo: 'Categoria' },
];

// A linha que o modelo transcreve. Campo vazio aparece EXPLÍCITO ("sem
// categoria"): é justamente o campo omitido que a pessoa precisa ver
// para perceber que faltou — se sumir do resumo, o erro passa batido.
function resumirProduto(p) {
  const partes = [
    p.nome,
    moeda(p.preco_venda),
    p.unidade,
    p.categoria_nome ? p.categoria_nome : 'sem categoria',
    p.preco_custo === null || p.preco_custo === undefined
      ? 'sem preço de custo'
      : `custo ${moeda(p.preco_custo)}`,
  ];
  if (!p.ativo) partes.push('INATIVO');
  return partes.join(' · ');
}

// Traduz o nome de categoria que o usuário falou em um id.
// Não cria categoria: criar catálogo é trabalho de mesa, não de balcão.
async function resolverCategoria(nomeCategoria) {
  const categoria = await buscarCategoriaPorNome(nomeCategoria);
  if (!categoria) {
    return {
      falha: {
        ok: false,
        erro: `Não existe a categoria "${nomeCategoria}". Crie a categoria na tela de Produtos antes, ou deixe o produto sem categoria.`,
      },
    };
  }
  return { id: categoria.id };
}

// Acha UM produto pelo nome falado. Devolve { falha } quando não achou ou
// achou vários — e aí nada é gravado.
async function acharProduto(busca) {
  const candidatos = await buscarProdutosPorNome(busca);
  return resolverUnico(
    candidatos,
    busca,
    'produto',
    (p) => `${p.nome} (${p.unidade}, ${moeda(p.preco_venda)})`
  );
}

export const TOOLS_PRODUTO = {
  criar_produto: {
    papeis: ['dono'],
    fonte: FONTE,
    schema: {
      name: 'criar_produto',
      description:
        'Cadastra um produto novo no catálogo do depósito. Use para "cadastra cimento CP-II saco a 42 reais" ou "adiciona areia média, m3, 95". Grava na hora — não peça confirmação antes. Se o usuário não disser a unidade ou o preço de venda, pergunte: os dois são obrigatórios.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome do produto, como aparece no catálogo.' },
          unidade: {
            type: 'string',
            enum: UNIDADES_VALIDAS,
            description: 'Unidade de venda do produto.',
          },
          preco_venda: { type: 'number', description: 'Preço de venda sugerido, em reais.' },
          preco_custo: { type: 'number', description: 'Quanto o depósito paga por ele, em reais. Opcional.' },
          categoria: {
            type: 'string',
            description:
              'Nome de uma categoria que JÁ existe. Opcional. Não invente: se o usuário não citou, deixe de fora.',
          },
        },
        required: ['nome', 'unidade', 'preco_venda'],
      },
    },
    async executar(args) {
      return protegido(async () => {
        let categoria_id = null;
        if (args.categoria) {
          const r = await resolverCategoria(args.categoria);
          if (r.falha) return r.falha;
          categoria_id = r.id;
        }

        const registro = await criarProduto({
          nome: args.nome,
          unidade: args.unidade,
          preco_venda: args.preco_venda,
          preco_custo: args.preco_custo,
          categoria_id,
        });

        // criarProduto devolve a linha crua (sem categoria_nome, que vem
        // do JOIN). Recompõe com o nome que já foi resolvido acima.
        const ficha = { ...registro, categoria_nome: args.categoria ?? null };

        return {
          ok: true,
          acao: 'criado',
          entidade: 'produto',
          registro: ficha,
          resumo: resumirProduto(ficha),
        };
      }, 'Não consegui cadastrar o produto agora.');
    },
  },

  editar_produto: {
    papeis: ['dono'],
    fonte: FONTE,
    schema: {
      name: 'editar_produto',
      description:
        'Altera um produto que já existe, achando-o pelo nome. Use para "muda o preço do cimento para 45" ou "o vergalhão agora é barra". Mande APENAS os campos que o usuário pediu para mudar: o que você não mandar continua como está. Grava na hora — não peça confirmação antes.',
      parameters: {
        type: 'object',
        properties: {
          busca: {
            type: 'string',
            description: 'Parte do nome do produto a alterar, como o usuário falou.',
          },
          nome: { type: 'string', description: 'Novo nome. Só mande se o usuário pediu para renomear.' },
          unidade: { type: 'string', enum: UNIDADES_VALIDAS, description: 'Nova unidade.' },
          preco_venda: { type: 'number', description: 'Novo preço de venda, em reais.' },
          preco_custo: { type: 'number', description: 'Novo preço de custo, em reais.' },
          categoria: { type: 'string', description: 'Nome de uma categoria que JÁ existe.' },
        },
        required: ['busca'],
      },
    },
    async executar(args) {
      return protegido(async () => {
        const achado = await acharProduto(args.busca);
        if (achado.falha) return achado.falha;
        const antes = achado.item;

        // Merge parcial de verdade: só as chaves citadas entram. Mandar
        // undefined aqui é o que faz atualizarProdutoParcial preservar
        // custo, imagem e categoria de "muda o preço para 45".
        const alteracoes = {};
        if (args.nome !== undefined) alteracoes.nome = args.nome;
        if (args.unidade !== undefined) alteracoes.unidade = args.unidade;
        if (args.preco_venda !== undefined) alteracoes.preco_venda = args.preco_venda;
        if (args.preco_custo !== undefined) alteracoes.preco_custo = args.preco_custo;

        let categoriaNova;
        if (args.categoria !== undefined) {
          const r = await resolverCategoria(args.categoria);
          if (r.falha) return r.falha;
          alteracoes.categoria_id = r.id;
          categoriaNova = args.categoria;
        }

        const gravado = await atualizarProdutoParcial(antes.id, alteracoes);
        const depois = {
          ...gravado,
          categoria_nome: categoriaNova ?? antes.categoria_nome ?? null,
        };

        const mudancas = diferencas(antes, depois, CAMPOS_COMPARADOS);

        return {
          ok: true,
          acao: 'editado',
          entidade: 'produto',
          registro: depois,
          alteracoes: mudancas,
          resumo: mudancas.length
            ? `${depois.nome}: ${mudancas
                .map((m) => `${m.rotulo} ${m.de ?? 'vazio'} → ${m.para ?? 'vazio'}`)
                .join('; ')}`
            : `Nada mudou em ${depois.nome} — os valores enviados já eram os que estavam gravados.`,
        };
      }, 'Não consegui alterar o produto agora.');
    },
  },
};
