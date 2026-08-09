#!/usr/bin/env node
// Banco de provas dos services e (a partir da Fatia 2) das tools do Zé.
//
// Existe porque a OPENROUTER_API_KEY não está configurada: sem ela o
// assistente responde 503 e não dá para exercitar tool calling rodando.
// Este script chama a camada de baixo direto, simulando o que o modelo
// mandaria — cobre service, validação e regra de negócio. O que fica de
// fora é só "o modelo escolheu a tool certa?".
//
// Uso:
//   node scripts/testar-tools.mjs                    # roda a suíte
//   node scripts/testar-tools.mjs listar_produtos    # chama uma função
//   node scripts/testar-tools.mjs criar_produto '{"nome":"X","unidade":"saco","preco_venda":10}'
//
// Precisa do banco de pé. Dentro do Docker:
//   docker exec prumo-api node scripts/testar-tools.mjs
import 'dotenv/config';
import { pool } from '../src/config/db.js';
import { ErroNegocio } from '../src/config/erros.js';
import * as produtos from '../src/produto/produto.service.js';
import * as clientes from '../src/cliente/cliente.service.js';

// Funções expostas à linha de comando.
const FUNCOES = {
  listar_produtos: (a) => produtos.listarProdutos(a ?? {}),
  buscar_produto: (a) => produtos.buscarProduto(a.id),
  criar_produto: (a) => produtos.criarProduto(a),
  atualizar_produto: (a) => produtos.atualizarProduto(a.id, a),
  atualizar_produto_parcial: (a) => produtos.atualizarProdutoParcial(a.id, a),
  definir_ativo_produto: (a) => produtos.definirAtivoProduto(a.id, a.ativo),
  remover_produto: (a) => produtos.removerProduto(a.id),

  listar_clientes: (a) => clientes.listarClientes(a ?? {}),
  buscar_cliente: (a) => clientes.buscarCliente(a.id),
  estatisticas_clientes: () => clientes.estatisticasClientes(),
  criar_cliente: (a) => clientes.criarCliente(a),
  atualizar_cliente: (a) => clientes.atualizarCliente(a.id, a),
  atualizar_cliente_parcial: (a) => clientes.atualizarClienteParcial(a.id, a),
  remover_cliente: (a) => clientes.removerCliente(a.id),
};

// ---------- Suíte ----------

let passou = 0;
let falhou = 0;

function ok(condicao, titulo, detalhe = '') {
  if (condicao) {
    passou++;
    console.log(`  ✅ ${titulo}`);
  } else {
    falhou++;
    console.log(`  ❌ ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

// Espera que a chamada lance ErroNegocio com a mensagem dada.
async function esperaErro(fn, mensagemEsperada, titulo) {
  try {
    await fn();
    ok(false, titulo, 'não lançou erro nenhum');
  } catch (erro) {
    if (!(erro instanceof ErroNegocio)) {
      return ok(false, titulo, `lançou ${erro.name}, não ErroNegocio: ${erro.message}`);
    }
    ok(erro.message === mensagemEsperada, titulo, `mensagem foi "${erro.message}"`);
  }
}

async function suite() {
  const marca = Date.now();
  const criados = { produtos: [], clientes: [] };

  console.log('\n🧱 PRODUTO — validação');
  await esperaErro(() => produtos.criarProduto({ unidade: 'saco', preco_venda: 1 }),
    'Nome é obrigatório', 'sem nome');
  await esperaErro(() => produtos.criarProduto({ nome: 'X', preco_venda: 1 }),
    'Unidade é obrigatória', 'sem unidade');
  await esperaErro(() => produtos.criarProduto({ nome: 'X', unidade: 'caixa', preco_venda: 1 }),
    `Unidade inválida. Use: ${produtos.UNIDADES_VALIDAS.join(', ')}`, 'unidade inválida');
  await esperaErro(() => produtos.criarProduto({ nome: 'X', unidade: 'saco' }),
    'Preço de venda é obrigatório', 'sem preço');
  await esperaErro(() => produtos.criarProduto({ nome: 'X', unidade: 'saco', preco_venda: -1 }),
    'Preço de venda não pode ser negativo', 'preço negativo');
  await esperaErro(() => produtos.criarProduto({
    nome: 'X', unidade: 'saco', preco_venda: 1,
    categoria_id: '00000000-0000-0000-0000-000000000000',
  }), 'Categoria informada não existe', 'categoria inexistente');
  await esperaErro(() => produtos.exigirProduto('00000000-0000-0000-0000-000000000000'),
    'Produto não encontrado', 'exigirProduto 404');

  console.log('\n🧱 PRODUTO — escrita');
  const p = await produtos.criarProduto({
    nome: `Teste ${marca}`, unidade: 'saco', preco_venda: 10,
    preco_custo: 6, imagem_url: 'http://x/y.png',
  });
  criados.produtos.push(p.id);
  ok(p.id && p.nome === `Teste ${marca}`, 'cria e devolve o registro gravado');
  ok(p.ativo === true, 'nasce ativo');
  ok(Number(p.preco_custo) === 6, 'grava o custo');

  // O teste que importa da Fatia 2: parcial NÃO apaga o que não foi citado.
  const parcial = await produtos.atualizarProdutoParcial(p.id, { preco_venda: 45 });
  ok(Number(parcial.preco_venda) === 45, 'parcial altera o preço');
  ok(Number(parcial.preco_custo) === 6, 'parcial PRESERVA o custo', `virou ${parcial.preco_custo}`);
  ok(parcial.imagem_url === 'http://x/y.png', 'parcial PRESERVA a imagem', `virou ${parcial.imagem_url}`);
  ok(parcial.nome === `Teste ${marca}`, 'parcial PRESERVA o nome');

  // Substituição total continua destrutiva — é o contrato do PUT da tela.
  const total = await produtos.atualizarProduto(p.id, {
    nome: `Teste ${marca}`, unidade: 'saco', preco_venda: 45,
  });
  ok(total.preco_custo === null, 'total zera o que não veio (contrato do PUT)');

  const desativado = await produtos.definirAtivoProduto(p.id, false);
  ok(desativado.ativo === false, 'desativa');
  const reativado = await produtos.definirAtivoProduto(p.id, true);
  ok(reativado.ativo === true, 'reativa');

  console.log('\n👤 CLIENTE — validação');
  await esperaErro(() => clientes.criarCliente({ nome: 'X' }),
    'Nome e telefone são obrigatórios', 'sem telefone');
  await esperaErro(() => clientes.criarCliente({ telefone: '9' }),
    'Nome e telefone são obrigatórios', 'sem nome');
  await esperaErro(() => clientes.criarCliente({ nome: 'X', telefone: '9', tipo: 'vip' }),
    `Tipo inválido. Use: ${clientes.TIPOS_VALIDOS.join(', ')}`, 'tipo inválido');
  await esperaErro(() => clientes.exigirCliente('00000000-0000-0000-0000-000000000000'),
    'Cliente não encontrado', 'exigirCliente 404');

  console.log('\n👤 CLIENTE — escrita');
  const c = await clientes.criarCliente({
    nome: `Cliente ${marca}`, telefone: '11999998888',
    tipo: 'pedreiro', observacao: 'anotação original',
  });
  criados.clientes.push(c.id);
  ok(c.id && c.tipo === 'pedreiro', 'cria e devolve o registro gravado');

  const cParcial = await clientes.atualizarClienteParcial(c.id, { telefone: '11777776666' });
  ok(cParcial.telefone === '11777776666', 'parcial altera o telefone');
  ok(cParcial.observacao === 'anotação original', 'parcial PRESERVA a observação',
    `virou ${cParcial.observacao}`);
  ok(cParcial.tipo === 'pedreiro', 'parcial PRESERVA o tipo');

  console.log('\n📖 LEITURA');
  const lista = await produtos.listarProdutos({});
  ok(Array.isArray(lista) && lista.length > 0, 'lista produtos');
  ok('categoria_nome' in lista[0], 'traz categoria_nome (LEFT JOIN)');
  const ativos = await produtos.listarProdutos({ ativos: 'true' });
  ok(ativos.every((x) => x.ativo), 'filtro ativos=true');
  const est = await clientes.estatisticasClientes();
  ok(Array.isArray(est) && typeof est[0]?.total_gasto === 'number',
    'estatísticas devolvem total_gasto numérico');
  const busca = await clientes.listarClientes({ busca: String(marca) });
  ok(busca.length === 1 && busca[0].id === c.id, 'busca por nome parcial');

  // Limpeza — nada de lixo de teste no banco do usuário.
  console.log('\n🧹 LIMPEZA');
  for (const id of criados.produtos) await produtos.removerProduto(id);
  for (const id of criados.clientes) await clientes.removerCliente(id);
  ok(await produtos.buscarProduto(criados.produtos[0]) === null, 'produto de teste removido');
  ok(await clientes.buscarCliente(criados.clientes[0]) === null, 'cliente de teste removido');

  console.log(`\n${falhou === 0 ? '✅' : '❌'} ${passou} passaram, ${falhou} falharam\n`);
  return falhou === 0;
}

// ---------- Entrada ----------

const [nome, argsJson] = process.argv.slice(2);

try {
  if (!nome) {
    const tudoOk = await suite();
    process.exitCode = tudoOk ? 0 : 1;
  } else if (!FUNCOES[nome]) {
    console.error(`Função desconhecida: ${nome}`);
    console.error(`Disponíveis: ${Object.keys(FUNCOES).join(', ')}`);
    process.exitCode = 1;
  } else {
    const args = argsJson ? JSON.parse(argsJson) : {};
    console.log(JSON.stringify(await FUNCOES[nome](args), null, 2));
  }
} catch (erro) {
  if (erro instanceof ErroNegocio) {
    console.error(`ErroNegocio [${erro.status}/${erro.codigo}]: ${erro.message}`);
  } else {
    console.error(erro);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
