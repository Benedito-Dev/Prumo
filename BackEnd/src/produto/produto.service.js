// Regras de negócio de produto (RF06–RF09).
//
// Funções puras de HTTP: recebem dados, devolvem dados, lançam
// ErroNegocio quando a regra barra. Servem tanto ao controller REST
// quanto às tools do Zé, sem que nenhum dos dois duplique SQL.
import { query } from '../config/db.js';
import { ErroNegocio, naoEncontrado, conflito } from '../config/erros.js';
import { textoValido, numeroValido, opcaoValida } from '../config/validar.js';
import { registrar, calcularAlteracoes, ACOES } from '../auditoria/auditoria.service.js';

export const UNIDADES_VALIDAS = [
  'saco', 'milheiro', 'm3', 'peca', 'barra', 'kg', 'metro', 'carrada',
];

// Traz o nome da categoria junto (LEFT JOIN: categoria é opcional).
const SELECT_PRODUTO = `
  SELECT p.*, c.nome AS categoria_nome
    FROM produto p
    LEFT JOIN categoria c ON c.id = p.categoria_id
`;

// Valida os campos obrigatórios. Lança em vez de retornar string:
// quem chama não pode esquecer de checar o retorno.
// `Number(preco_venda) < 0` não pegava lixo: `Number('abc')` é NaN, e NaN
// não é menor que zero, então a comparação dava false e o valor seguia
// para o SQL — que respondia 500 em vez de dizer o que está errado.
// Preço zero é aceito de propósito: brinde e bonificação existem.
function validarProduto({ nome, unidade, preco_venda, preco_custo }) {
  textoValido(nome, 'nome');
  opcaoValida(unidade, 'unidade', UNIDADES_VALIDAS, { feminino: true });
  numeroValido(preco_venda, 'preço de venda', { permitirZero: true });
  if (preco_custo !== undefined && preco_custo !== null && preco_custo !== '') {
    numeroValido(preco_custo, 'preço de custo', { permitirZero: true });
  }
}

// A FK de categoria_id é a mesma nos dois caminhos de escrita.
function traduzirErroDeBanco(erro) {
  if (erro.code === '23503') {
    return new ErroNegocio('Categoria informada não existe');
  }
  return erro;
}

export async function listarProdutos({ categoria_id, ativos } = {}) {
  const condicoes = [];
  const params = [];

  if (categoria_id) {
    params.push(categoria_id);
    condicoes.push(`p.categoria_id = $${params.length}`);
  }
  if (ativos === 'true' || ativos === true) {
    condicoes.push('p.ativo = TRUE');
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const { rows } = await query(`${SELECT_PRODUTO} ${where} ORDER BY p.nome`, params);
  return rows;
}

// Devolve null quando não existe — quem chama decide se isso é erro.
export async function buscarProduto(id) {
  const { rows } = await query(`${SELECT_PRODUTO} WHERE p.id = $1`, [id]);
  return rows[0] ?? null;
}

// Igual a buscarProduto, mas lança 404. Evita repetir o if em todo chamador.
export async function exigirProduto(id) {
  const produto = await buscarProduto(id);
  if (!produto) throw naoEncontrado('Produto não encontrado');
  return produto;
}

// `usuario` é o do token, usado só para o log de auditoria. Opcional para
// não quebrar quem já chamava sem ele — mas quem escreve fica registrado
// como desconhecido, então passe sempre a partir do controller e das
// tools do Zé.
export async function criarProduto(dados, usuario = null) {
  const { nome, unidade, preco_venda, preco_custo, categoria_id, imagem_url } = dados;
  validarProduto(dados);

  try {
    const { rows } = await query(
      `INSERT INTO produto (nome, unidade, preco_venda, preco_custo, categoria_id, imagem_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nome, unidade, preco_venda, preco_custo ?? null, categoria_id ?? null, imagem_url ?? null]
    );

    await registrar({
      usuario,
      acao: ACOES.CRIAR,
      entidade: 'produto',
      entidade_id: rows[0].id,
      entidade_nome: rows[0].nome,
    });
    return rows[0];
  } catch (erro) {
    throw traduzirErroDeBanco(erro);
  }
}

// Substituição TOTAL: campo ausente vira NULL. É o que o formulário da
// tela faz, porque ele sempre manda a ficha inteira.
// Para alterar só alguns campos, use atualizarProdutoParcial.
export async function atualizarProduto(id, dados, usuario = null) {
  const { nome, unidade, preco_venda, preco_custo, categoria_id, ativo, imagem_url } = dados;
  validarProduto(dados);

  // Estado ANTES, para o log dizer o que mudou. Também resolve o 404 sem
  // depender do rowCount depois.
  const antes = await buscarProduto(id);
  if (!antes) throw naoEncontrado('Produto não encontrado');

  let rows, rowCount;
  try {
    ({ rows, rowCount } = await query(
      `UPDATE produto
          SET nome = $1, unidade = $2, preco_venda = $3,
              preco_custo = $4, categoria_id = $5, ativo = $6, imagem_url = $7
        WHERE id = $8
      RETURNING *`,
      [nome, unidade, preco_venda, preco_custo ?? null, categoria_id ?? null, ativo ?? true, imagem_url ?? null, id]
    ));
  } catch (erro) {
    throw traduzirErroDeBanco(erro);
  }

  // Fora do try: o 404 não é erro de banco.
  if (rowCount === 0) throw naoEncontrado('Produto não encontrado');

  const alteracoes = calcularAlteracoes(antes, rows[0]);
  // Só registra se algo mudou de fato: salvar o formulário sem alterar
  // nada encheria o log de linhas vazias.
  if (alteracoes) {
    // Ativar/desativar é a mudança que a pessoa percebe na tela ("sumiu
    // da venda"), então ganha ação própria em vez de virar uma linha de
    // "editar" com um booleano no meio.
    const soAtivo = alteracoes.length === 1 && alteracoes[0].campo === 'ativo';
    const acao = soAtivo
      ? (rows[0].ativo ? ACOES.REATIVAR : ACOES.DESATIVAR)
      : ACOES.EDITAR;

    await registrar({
      usuario,
      acao,
      entidade: 'produto',
      entidade_id: rows[0].id,
      entidade_nome: rows[0].nome,
      alteracoes: soAtivo ? null : alteracoes,
    });
  }
  return rows[0];
}

// Substituição PARCIAL: lê o que existe, sobrepõe só os campos citados
// e grava. É o que a IA precisa — "muda o preço do cimento para 45" não
// pode zerar categoria, custo e imagem.
// Ainda não é usada por nenhuma rota; entra em uso na Fatia 2.
export async function atualizarProdutoParcial(id, alteracoes = {}, usuario = null) {
  const atual = await exigirProduto(id);

  // Só as chaves realmente enviadas sobrescrevem. `undefined` é
  // "não mencionou"; `null` é "apague este campo", e passa.
  const CAMPOS = ['nome', 'unidade', 'preco_venda', 'preco_custo', 'categoria_id', 'ativo', 'imagem_url'];
  const merged = { ...atual };
  for (const campo of CAMPOS) {
    if (alteracoes[campo] !== undefined) merged[campo] = alteracoes[campo];
  }

  // Repassa o usuário: sem isso, toda escrita vinda do Zé ficaria
  // anônima no log.
  return atualizarProduto(id, merged, usuario);
}

// Busca por nome parcial — como a pessoa fala ("cimento"), não como o
// cadastro está escrito. Quem chama decide o que fazer com 0 ou N
// resultados; aqui não há chute.
// O teto de 10 existe para o modelo não receber o catálogo inteiro
// quando o termo for genérico demais.
export async function buscarProdutosPorNome(termo, { apenasAtivos = false } = {}) {
  const busca = String(termo ?? '').trim();
  if (!busca) return [];

  const where = apenasAtivos ? 'AND p.ativo = TRUE' : '';
  const { rows } = await query(
    `${SELECT_PRODUTO} WHERE p.nome ILIKE $1 ${where} ORDER BY p.nome LIMIT 10`,
    [`%${busca}%`]
  );
  return rows;
}

// Categoria por nome exato (o schema garante UNIQUE). O Zé recebe
// "cimento" do usuário, não um UUID — mas ele também NÃO cria categoria:
// não achou, quem chama avisa em vez de inventar cadastro novo.
export async function buscarCategoriaPorNome(nome) {
  const busca = String(nome ?? '').trim();
  if (!busca) return null;

  const { rows } = await query(
    'SELECT * FROM categoria WHERE nome ILIKE $1 ORDER BY nome LIMIT 1',
    [busca]
  );
  return rows[0] ?? null;
}

// Quantas vendas já levaram este produto. Alimenta o aviso da
// confirmação: "tem 34 vendas no histórico — elas continuam intactas".
// Sem esse número, desativar parece perder dado, e a pessoa hesita.
export async function contarVendasDoProduto(id) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS n FROM item_venda WHERE produto_id = $1',
    [id]
  );
  return rows[0].n;
}

// Desativa sem apagar — preserva o histórico de vendas (princípio P6).
export async function definirAtivoProduto(id, ativo, usuario = null) {
  const { rows, rowCount } = await query(
    `UPDATE produto SET ativo = $1 WHERE id = $2 RETURNING *`,
    [ativo, id]
  );
  if (rowCount === 0) throw naoEncontrado('Produto não encontrado');

  // Desativar some da tela de venda; é a mudança que alguém nota e
  // pergunta "quem tirou isso daqui?".
  await registrar({
    usuario,
    acao: ativo ? ACOES.REATIVAR : ACOES.DESATIVAR,
    entidade: 'produto',
    entidade_id: rows[0].id,
    entidade_nome: rows[0].nome,
  });
  return rows[0];
}

// DELETE de verdade. Só passa em produto sem venda: a FK de item_venda
// barra o resto, e é isso que preserva o histórico.
export async function removerProduto(id, usuario = null) {
  // Lê antes de apagar: depois do DELETE não há mais nome para registrar,
  // e o log precisa dizer QUAL produto sumiu, não só um id.
  const antes = await buscarProduto(id);

  let rowCount;
  try {
    ({ rowCount } = await query('DELETE FROM produto WHERE id = $1 RETURNING id', [id]));
  } catch (erro) {
    if (erro.code === '23503') {
      throw conflito(
        'Produto possui vendas e não pode ser removido. Desative-o (ativo=false) em vez de excluir.'
      );
    }
    throw erro;
  }
  // Fora do try: o 404 não é erro de banco e não deve passar pelo catch.
  if (rowCount === 0) throw naoEncontrado('Produto não encontrado');

  await registrar({
    usuario,
    acao: ACOES.REMOVER,
    entidade: 'produto',
    entidade_id: id,
    entidade_nome: antes?.nome ?? null,
  });
}
