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
  contarVendasDoProduto,
  definirAtivoProduto,
} from '../produto/produto.service.js';
import { protegido, moeda, diferencas } from './tools.escrita.comum.js';
import { resolverProduto } from './resolver.js';

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

// Parâmetro que todas as tools de alteração aceitam: o id fecha o
// segundo turno da conversa ("o Mizu" → o modelo repete a chamada com o
// id que veio nas opções). Sem ele, ambiguidade viraria laço.
const ARG_ID = {
  type: 'string',
  description:
    'Id exato do produto, quando já foi escolhido numa pergunta anterior. ' +
    'Tendo o id, não mande `busca`.',
};

export const TOOLS_PRODUTO = {
  criar_produto: {
    escreve: true,
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
    async executar(args, usuario) {
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
        }, usuario);

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
    escreve: true,
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
          id: ARG_ID,
          nome: { type: 'string', description: 'Novo nome. Só mande se o usuário pediu para renomear.' },
          unidade: { type: 'string', enum: UNIDADES_VALIDAS, description: 'Nova unidade.' },
          preco_venda: { type: 'number', description: 'Novo preço de venda, em reais.' },
          preco_custo: { type: 'number', description: 'Novo preço de custo, em reais.' },
          categoria: { type: 'string', description: 'Nome de uma categoria que JÁ existe.' },
        },
        required: [],
      },
    },
    async executar(args, usuario) {
      return protegido(async () => {
        const achado = await resolverProduto(args);
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

        const gravado = await atualizarProdutoParcial(antes.id, alteracoes, usuario);
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

  // ---------------------------------------------------- desativar (Fatia 3)
  // A única tool destrutiva de produto — e por isso a única que CONFIRMA.
  // Nunca faz DELETE: o schema tem `ativo` justamente porque apagar um
  // produto já vendido quebraria o histórico daquelas vendas (princípio
  // P6). "Apagar", aqui, é sumir da tela de venda.
  desativar_produto: {
    escreve: true,
    papeis: ['dono'],
    fonte: FONTE,
    confirma: true,
    schema: {
      name: 'desativar_produto',
      description:
        'Desativa um produto: ele some da tela de venda, mas o histórico é preservado. ' +
        'Use quando pedirem para apagar, remover, excluir ou tirar um produto. ' +
        'Pede confirmação antes de aplicar.',
      parameters: {
        type: 'object',
        properties: {
          busca: {
            type: 'string',
            description: 'Nome (ou parte) do produto a desativar.',
          },
          id: ARG_ID,
        },
        required: [],
      },
    },

    // PASSO 1: resolve e descreve, sem gravar nada.
    async preparar(args) {
      return protegido(async () => {
        const { item, falha } = await resolverProduto(args);
        if (falha) return falha;

        if (!item.ativo) {
          return {
            ok: false,
            erro: `${item.nome} já está desativado.`,
          };
        }

        const vendas = await contarVendasDoProduto(item.id);
        const historico = vendas
          ? ` Tem ${vendas} ${vendas === 1 ? 'venda' : 'vendas'} no histórico — ${
              vendas === 1 ? 'ela continua intacta' : 'elas continuam intactas'
            }.`
          : ' Nunca foi vendido.';

        return {
          ok: true,
          precisa_confirmar: true,
          // args da execução: o id já resolvido, para o passo 2 não
          // refazer a busca e correr o risco de resolver diferente.
          args: { id: item.id },
          rotulo: 'Desativar',
          resumo: `Desativar "${item.nome}" (${item.unidade}, ${moeda(item.preco_venda)}).${historico} O produto some da tela de venda.`,
        };
      }, 'Não consegui preparar a desativação agora.');
    },

    // PASSO 2: só roda com token válido — ver confirmacao.js.
    async executar(args, usuario) {
      return protegido(async () => {
        const produto = await definirAtivoProduto(args.id, false, usuario);
        return {
          ok: true,
          acao: 'desativado',
          entidade: 'produto',
          registro: produto,
          resumo: `${produto.nome} foi desativado. Não aparece mais na hora de vender; o histórico continua igual.`,
        };
      }, 'Não consegui desativar o produto agora.');
    },
  },

  // ---------------------------------------------------- reativar (Fatia 3)
  // NÃO confirma: reativar não destrói nada, e existir sem volta é que
  // seria armadilha — quem conversa com o Zé é justamente quem não quer
  // abrir a tela de Produtos para desfazer.
  reativar_produto: {
    escreve: true,
    papeis: ['dono'],
    fonte: FONTE,
    schema: {
      name: 'reativar_produto',
      description:
        'Reativa um produto desativado, fazendo-o voltar à tela de venda.',
      parameters: {
        type: 'object',
        properties: {
          busca: {
            type: 'string',
            description: 'Nome (ou parte) do produto a reativar.',
          },
          id: ARG_ID,
        },
        required: [],
      },
    },
    async executar(args, usuario) {
      return protegido(async () => {
        const { item, falha } = await resolverProduto(args);
        if (falha) return falha;

        if (item.ativo) {
          return { ok: false, erro: `${item.nome} já está ativo.` };
        }

        const produto = await definirAtivoProduto(item.id, true, usuario);
        return {
          ok: true,
          acao: 'reativado',
          entidade: 'produto',
          registro: produto,
          resumo: `${produto.nome} voltou para a tela de venda.`,
        };
      }, 'Não consegui reativar o produto agora.');
    },
  },
};
