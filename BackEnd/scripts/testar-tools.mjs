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
import { executarTool } from '../src/assistente/tools.js';
import { assinarAcao, verificarAcao } from '../src/assistente/confirmacao.js';
import * as fiados from '../src/fiado/fiado.service.js';
import * as vendaSvc from '../src/venda/venda.service.js';
import { query } from '../src/config/db.js';

// Papéis usados nos testes de tool. O papel decide o que passa no filtro
// de permissão; o id precisa ser de um usuário REAL porque toda tool que
// grava autoria (pagamento_fiado.usuario_id, venda.usuario_id) tem FK —
// um id fictício estoura com 22P02.
const DONO = { id: null, nome: 'Teste', papel: 'dono' };
const VENDEDOR = { id: null, nome: 'Teste', papel: 'vendedor' };

// Preenche o id dos papéis com um usuário existente. Chamado uma vez, no
// início da suíte, antes de qualquer tool rodar.
async function carregarUsuarioReal() {
  const { rows } = await query('SELECT id FROM usuario ORDER BY criado_em LIMIT 1');
  if (!rows[0]) throw new Error('Nenhum usuário no banco — a suíte precisa de um para a FK de autoria.');
  DONO.id = rows[0].id;
  VENDEDOR.id = rows[0].id;
  return rows[0].id;
}

// Chama uma tool como o modelo chamaria e devolve só o resultado.
const tool = async (nome, args, usuario = DONO) =>
  (await executarTool(nome, args, usuario)).resultado;

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

  // Tools do Zé (Fatia 2) — chamadas como o modelo chamaria, já passando
  // pelo filtro de papel. Use PAPEL=vendedor para testar a barreira.
  tool_criar_produto: (a) => tool('criar_produto', a, papelDaCli()),
  tool_editar_produto: (a) => tool('editar_produto', a, papelDaCli()),
  tool_criar_cliente: (a) => tool('criar_cliente', a, papelDaCli()),
  tool_editar_cliente: (a) => tool('editar_cliente', a, papelDaCli()),

  // Fiados (Fatia 5).
  listar_fiados: () => fiados.listarAbertos(),
  resumo_fiados: () => fiados.resumoAbertos(),
  fiados_do_cliente: (a) => fiados.fiadosDoCliente(a.cliente_id),
  pagar_fiado: (a) => fiados.registrarPagamento(a),
  pagar_fiado_cascata: (a) => fiados.registrarPagamentoEmCascata(a),
  tool_registrar_pagamento_fiado: (a) =>
    tool('registrar_pagamento_fiado', a, papelDaCli()),

  // Vendas (Fatia 6).
  listar_vendas: (a) => vendaSvc.listarVendas(a ?? {}),
  buscar_venda: (a) => vendaSvc.buscarVenda(a.id),
  simular_venda: (a) => vendaSvc.simularVenda(a),
  tool_criar_venda: (a) => tool('criar_venda', a, papelDaCli()),
  tool_cancelar_venda: (a) => tool('cancelar_venda', a, papelDaCli()),
};

const papelDaCli = () => (process.env.PAPEL === 'vendedor' ? VENDEDOR : DONO);

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

// Versão síncrona do esperaErro: verificarAcao não é async, e envolvê-la
// numa promise esconderia um throw que acontece antes do await.
function esperaErroSync(fn, mensagemEsperada, titulo) {
  try {
    fn();
    ok(false, titulo, 'não lançou erro nenhum');
  } catch (erro) {
    if (!(erro instanceof ErroNegocio)) {
      return ok(false, titulo, `lançou ${erro.name}: ${erro.message}`);
    }
    ok(erro.message === mensagemEsperada, titulo, `mensagem foi "${erro.message}"`);
  }
}

async function suite() {
  const marca = Date.now();
  const criados = { produtos: [], clientes: [] };
  await carregarUsuarioReal();

  console.log('\n🧱 PRODUTO — validação');
  await esperaErro(() => produtos.criarProduto({ unidade: 'saco', preco_venda: 1 }),
    'Informe nome', 'sem nome');
  await esperaErro(() => produtos.criarProduto({ nome: 'X', preco_venda: 1 }),
    'Informe unidade', 'sem unidade');
  await esperaErro(() => produtos.criarProduto({ nome: 'X', unidade: 'caixa', preco_venda: 1 }),
    `Unidade inválida. Use: ${produtos.UNIDADES_VALIDAS.join(', ')}`, 'unidade inválida');
  await esperaErro(() => produtos.criarProduto({ nome: 'X', unidade: 'saco' }),
    'Informe preço de venda', 'sem preço');
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
    'Informe telefone', 'sem telefone');
  await esperaErro(() => clientes.criarCliente({ telefone: '9' }),
    'Informe nome', 'sem nome');
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

  // ============================================================
  //  FATIA 2 — tools de escrita do Zé
  //  Aqui não se testa service: testa-se o que o MODELO recebe de
  //  volta. O formato do retorno é o produto desta fatia.
  // ============================================================

  console.log('\n🤖 TOOL criar_produto');
  const tp = await tool('criar_produto', {
    nome: `Cimento Tool ${marca}`, unidade: 'saco', preco_venda: 42,
  });
  if (tp.ok) criados.produtos.push(tp.registro.id);
  ok(tp.ok === true, 'cria com os campos mínimos', tp.erro);
  ok(tp.acao === 'criado' && tp.entidade === 'produto', 'declara ação e entidade');
  ok(Number(tp.registro?.preco_venda) === 42, 'registro vem do banco, não dos argumentos');
  // O ponto da Decisão 2: o campo VAZIO precisa aparecer, senão o erro passa.
  ok(/sem categoria/.test(tp.resumo || ''), 'resumo diz "sem categoria"', tp.resumo);
  ok(/sem preço de custo/.test(tp.resumo || ''), 'resumo diz "sem preço de custo"', tp.resumo);
  ok(/R\$/.test(tp.resumo || ''), 'resumo traz o preço em reais', tp.resumo);

  const tpCompleto = await tool('criar_produto', {
    nome: `Vergalhao Tool ${marca}`, unidade: 'barra', preco_venda: 38.5, preco_custo: 30,
  });
  if (tpCompleto.ok) criados.produtos.push(tpCompleto.registro.id);
  ok(/custo R\$/.test(tpCompleto.resumo || ''), 'com custo, o resumo mostra o custo',
    tpCompleto.resumo);

  console.log('\n🤖 TOOL criar_produto — recusas');
  const tpUnidade = await tool('criar_produto', {
    nome: 'X', unidade: 'caixa', preco_venda: 1,
  });
  ok(tpUnidade.ok === false && /Unidade inválida/.test(tpUnidade.erro),
    'unidade inválida devolve erro (não lança)', JSON.stringify(tpUnidade));
  const tpNegativo = await tool('criar_produto', {
    nome: 'X', unidade: 'saco', preco_venda: -1,
  });
  ok(tpNegativo.ok === false && /negativo/.test(tpNegativo.erro),
    'preço negativo devolve erro (não lança)', JSON.stringify(tpNegativo));
  const tpCategoria = await tool('criar_produto', {
    nome: 'X', unidade: 'saco', preco_venda: 1, categoria: `Inexistente ${marca}`,
  });
  ok(tpCategoria.ok === false && /categoria/i.test(tpCategoria.erro),
    'categoria inexistente não vira cadastro novo', JSON.stringify(tpCategoria));

  console.log('\n🤖 TOOL editar_produto');
  // O TESTE QUE MAIS IMPORTA: mexer no preço não pode apagar o resto.
  const tpEdit = await tool('editar_produto', {
    busca: `Vergalhao Tool ${marca}`, preco_venda: 45,
  });
  ok(tpEdit.ok === true, 'edita achando pelo nome', tpEdit.erro);
  ok(Number(tpEdit.registro?.preco_venda) === 45, 'preço mudou');
  ok(Number(tpEdit.registro?.preco_custo) === 30, 'PRESERVA o custo',
    `virou ${tpEdit.registro?.preco_custo}`);
  ok(tpEdit.registro?.nome === `Vergalhao Tool ${marca}`, 'PRESERVA o nome');
  ok(tpEdit.registro?.unidade === 'barra', 'PRESERVA a unidade');
  ok(tpEdit.registro?.imagem_url === null, 'não inventa imagem');

  ok(Array.isArray(tpEdit.alteracoes) && tpEdit.alteracoes.length === 1,
    'lista só a alteração que houve', JSON.stringify(tpEdit.alteracoes));
  ok(tpEdit.alteracoes?.[0]?.campo === 'preco_venda', 'aponta o campo certo');
  ok(/38,50/.test(tpEdit.alteracoes?.[0]?.de || ''), '"de" traz o valor anterior',
    tpEdit.alteracoes?.[0]?.de);
  ok(/45,00/.test(tpEdit.alteracoes?.[0]?.para || ''), '"para" traz o valor novo',
    tpEdit.alteracoes?.[0]?.para);

  // Reenviar o mesmo valor não é uma alteração — não inventar mudança.
  const tpIgual = await tool('editar_produto', {
    busca: `Vergalhao Tool ${marca}`, preco_venda: 45,
  });
  ok(tpIgual.ok === true && tpIgual.alteracoes?.length === 0,
    'editar sem mudar nada devolve alteracoes: []', JSON.stringify(tpIgual.alteracoes));
  ok(/Nada mudou/.test(tpIgual.resumo || ''), 'resumo diz que nada mudou', tpIgual.resumo);

  console.log('\n🤖 TOOL editar_produto — ambiguidade e ausência');
  const tpGemeo = await tool('criar_produto', {
    nome: `Cimento Tool ${marca} CP-III`, unidade: 'saco', preco_venda: 44,
  });
  if (tpGemeo.ok) criados.produtos.push(tpGemeo.registro.id);

  // Busca parcial de propósito: "Cimento Tool <marca>" cravado bateria
  // exato em um dos dois e o desempate resolveria — aqui o que se testa
  // é o empate de verdade.
  const tpAmbiguo = await tool('editar_produto', {
    busca: `mento Tool ${marca}`, preco_venda: 99,
  });
  ok(tpAmbiguo.ok === false && Array.isArray(tpAmbiguo.precisa_escolher),
    'dois nomes parecidos devolvem precisa_escolher', JSON.stringify(tpAmbiguo));
  ok(tpAmbiguo.precisa_escolher?.length === 2, 'devolve as duas opções');
  ok(tpAmbiguo.precisa_escolher?.every((o) => o.id && o.rotulo),
    'cada opção tem id e rótulo legível', JSON.stringify(tpAmbiguo.precisa_escolher));
  // O que mais importa na ambiguidade: NADA foi gravado.
  const naoTocado = await produtos.buscarProduto(tp.registro.id);
  ok(Number(naoTocado.preco_venda) === 42, 'ambiguidade NÃO gravou nada',
    `preço virou ${naoTocado.preco_venda}`);

  const tpSumido = await tool('editar_produto', {
    busca: `Nao existe ${marca}`, preco_venda: 1,
  });
  ok(tpSumido.ok === false && /Não achei nenhum produto/.test(tpSumido.erro),
    'nome inexistente devolve erro em português', JSON.stringify(tpSumido));

  console.log('\n🤖 TOOL criar_cliente / editar_cliente');
  const tc = await tool('criar_cliente', {
    nome: `Cliente Tool ${marca}`, telefone: '11955554444',
  });
  if (tc.ok) criados.clientes.push(tc.registro.id);
  ok(tc.ok === true && tc.entidade === 'cliente', 'cria com nome e telefone', tc.erro);
  ok(/sem tipo/.test(tc.resumo || ''), 'resumo diz "sem tipo"', tc.resumo);
  ok(/sem observação/.test(tc.resumo || ''), 'resumo diz "sem observação"', tc.resumo);

  const tcSemTel = await tool('criar_cliente', { nome: `Sem telefone ${marca}` });
  ok(tcSemTel.ok === false && /telefone/i.test(tcSemTel.erro),
    'cliente sem telefone é recusado (NOT NULL)', JSON.stringify(tcSemTel));

  const tcEdit = await tool('editar_cliente', {
    busca: `Cliente Tool ${marca}`, tipo: 'pedreiro',
  });
  ok(tcEdit.ok === true && tcEdit.registro?.tipo === 'pedreiro', 'edita o tipo', tcEdit.erro);
  ok(tcEdit.registro?.telefone === '11955554444', 'PRESERVA o telefone',
    `virou ${tcEdit.registro?.telefone}`);
  ok(tcEdit.alteracoes?.length === 1 && tcEdit.alteracoes[0].de === null,
    '"de" nulo quando o campo estava vazio', JSON.stringify(tcEdit.alteracoes));
  const tcTipo = await tool('editar_cliente', { busca: `Cliente Tool ${marca}`, tipo: 'vip' });
  ok(tcTipo.ok === false && /Tipo inválido/.test(tcTipo.erro),
    'tipo inválido devolve erro (não lança)', JSON.stringify(tcTipo));

  console.log('\n🔐 TOOL — permissão por papel');
  const barrado = await tool('criar_produto', {
    nome: `Nao deveria ${marca}`, unidade: 'saco', preco_venda: 1,
  }, VENDEDOR);
  ok(barrado.erro && !barrado.ok, 'vendedor é barrado em criar_produto',
    JSON.stringify(barrado));
  const barradoEdit = await tool('editar_produto',
    { busca: `Cliente Tool ${marca}`, preco_venda: 1 }, VENDEDOR);
  ok(barradoEdit.erro && !barradoEdit.ok, 'vendedor é barrado em editar_produto');
  const liberado = await tool('editar_cliente',
    { busca: `Cliente Tool ${marca}`, observacao: 'anotado no balcão' }, VENDEDOR);
  ok(liberado.ok === true, 'vendedor PODE editar cliente', JSON.stringify(liberado));
  // O barrado não pode ter deixado rastro no catálogo.
  const rastro = await produtos.buscarProdutosPorNome(`Nao deveria ${marca}`);
  ok(rastro.length === 0, 'tool barrada não gravou nada');

  // ------------------------------------------------------------- FIADOS
  // A cascata só é testável com um cliente que deve VÁRIAS vendas, e o
  // banco é o do usuário — então o cenário é montado aqui e derrubado no
  // fim deste mesmo bloco, sem depender da limpeza geral.
  console.log('\n💰 FIADO — cascata por cliente');

  const { rows: usuarios } = await query('SELECT id FROM usuario LIMIT 1');
  const usuarioId = usuarios[0].id;
  const vendasDeTeste = [];

  // Cria uma venda fiado com data e valor controlados. Sem itens: o saldo
  // do fiado sai de venda.valor_total, e item_venda não entra na conta.
  async function vendaFiado(clienteId, valor, diasAtras) {
    const { rows } = await query(
      `INSERT INTO venda (cliente_id, usuario_id, forma_pagamento, valor_total, vendida_em)
       VALUES ($1, $2, 'fiado', $3, NOW() - ($4 || ' days')::interval)
       RETURNING id, vendida_em`,
      [clienteId, usuarioId, valor, String(diasAtras)]
    );
    vendasDeTeste.push(rows[0].id);
    return rows[0];
  }

  // Devedor com duas dívidas: 100 (mais antiga) e 300.
  const devedor = await clientes.criarCliente({
    nome: `Devedor ${marca}`, telefone: '11900000001', tipo: 'pedreiro',
  });
  criados.clientes.push(devedor.id);
  const antiga = await vendaFiado(devedor.id, 100, 30);
  const nova = await vendaFiado(devedor.id, 300, 5);

  const fila = await fiados.fiadosDoCliente(devedor.id);
  ok(fila.length === 2, 'fiadosDoCliente traz as duas dívidas', `veio ${fila.length}`);
  ok(fila[0].id === antiga.id, 'ordena da mais ANTIGA para a mais nova');
  ok(await fiados.totalDevidoPeloCliente(devedor.id) === 400, 'total devido soma 400');

  // O caso central: 150 quita a de 100 e sobra 50 para a de 300.
  const cascata = await fiados.registrarPagamentoEmCascata({
    cliente_id: devedor.id, valor: 150, usuario_id: usuarioId,
  });
  ok(cascata.abatimentos.length === 2, 'cascata discrimina as DUAS vendas',
    JSON.stringify(cascata.abatimentos));
  ok(cascata.abatimentos[0].venda_id === antiga.id
    && cascata.abatimentos[0].abatido === 100
    && cascata.abatimentos[0].quitada === true,
    'a mais antiga recebe 100 e fica quitada');
  ok(cascata.abatimentos[1].venda_id === nova.id
    && cascata.abatimentos[1].abatido === 50
    && cascata.abatimentos[1].saldo_depois === 250,
    'a sobra de 50 entra na mais nova, que fica devendo 250');
  ok(cascata.total_devido_depois === 250 && cascata.quitou_tudo === false,
    'saldo restante do cliente é 250');
  ok(await fiados.totalDevidoPeloCliente(devedor.id) === 250,
    'o banco confirma os 250');

  // Valor maior que o total devido: recusa e NÃO grava — nunca gera crédito.
  const antesDoEstouro = (await query(
    'SELECT COUNT(*)::int AS n FROM pagamento_fiado WHERE venda_id = ANY($1)',
    [vendasDeTeste]
  )).rows[0].n;
  await esperaErro(() => fiados.registrarPagamentoEmCascata({
    cliente_id: devedor.id, valor: 1000, usuario_id: usuarioId,
  }), 'Valor recebido (R$ 1000.00) é maior que o total devido pelo cliente (R$ 250.00)',
    'valor acima do devido é recusado');
  const depoisDoEstouro = (await query(
    'SELECT COUNT(*)::int AS n FROM pagamento_fiado WHERE venda_id = ANY($1)',
    [vendasDeTeste]
  )).rows[0].n;
  ok(depoisDoEstouro === antesDoEstouro, 'estouro não gravou NADA no banco',
    `pagamentos: ${antesDoEstouro} -> ${depoisDoEstouro}`);
  ok(await fiados.totalDevidoPeloCliente(devedor.id) === 250,
    'saldo do cliente intacto depois do estouro');

  // Pagamento parcial e depois quitação exata do que restou.
  const parcialFiado = await fiados.registrarPagamentoEmCascata({
    cliente_id: devedor.id, valor: 50, usuario_id: usuarioId,
  });
  ok(parcialFiado.total_devido_depois === 200, 'parcial deixa saldo de 200');
  const quitacao = await fiados.registrarPagamentoEmCascata({
    cliente_id: devedor.id, valor: 200, usuario_id: usuarioId,
  });
  ok(quitacao.quitou_tudo === true && quitacao.abatimentos.length === 1,
    'valor exato quita a única dívida restante');
  ok((await fiados.fiadosDoCliente(devedor.id)).length === 0,
    'cliente sai da lista de devedores');

  // Cliente sem dívida nenhuma.
  await esperaErro(() => fiados.registrarPagamentoEmCascata({
    cliente_id: devedor.id, valor: 10,
  }), 'Este cliente não tem fiado em aberto', 'cliente sem dívida avisa claro');
  await esperaErro(() => fiados.registrarPagamentoEmCascata({
    cliente_id: devedor.id, valor: 0,
  }), 'Valor do pagamento deve ser maior que zero', 'valor zero é barrado');

  console.log('\n💰 FIADO — tool do Zé');
  // Esta tool GRAVA autoria (pagamento_fiado.usuario_id é FK). DONO e
  // VENDEDOR já carregam um id real — ver carregarUsuarioReal().
  const devedor2 = await clientes.criarCliente({
    nome: `Fiadeiro ${marca}`, telefone: '11900000002', tipo: 'pedreiro',
  });
  criados.clientes.push(devedor2.id);
  await vendaFiado(devedor2.id, 80, 20);
  await vendaFiado(devedor2.id, 120, 2);

  const tPago = await tool('registrar_pagamento_fiado',
    { cliente: `Fiadeiro ${marca}`, valor: 100 }, VENDEDOR);
  ok(tPago.ok === true, 'vendedor PODE registrar pagamento', JSON.stringify(tPago));
  ok(Array.isArray(tPago.registro) && tPago.registro.length === 2,
    'a tool devolve o registro discriminado por venda');
  ok(tPago.total_devido_depois === 100, 'a tool devolve o saldo restante');
  ok(/quitaram a venda de/.test(tPago.resumo) && /ainda deve/.test(tPago.resumo),
    'o resumo diz onde entrou e quanto resta', tPago.resumo);

  const tExcesso = await tool('registrar_pagamento_fiado',
    { cliente: `Fiadeiro ${marca}`, valor: 999 }, DONO);
  ok(tExcesso.ok === false && /maior que o total devido/.test(tExcesso.erro),
    'a tool devolve o erro em vez de lançar', JSON.stringify(tExcesso));

  const tNinguem = await tool('registrar_pagamento_fiado',
    { cliente: `Inexistente ${marca}`, valor: 10 }, DONO);
  ok(tNinguem.ok === false && /Não achei nenhum cliente/.test(tNinguem.erro),
    'cliente inexistente vira erro claro');

  // Ambíguo: os dois clientes de teste compartilham o sufixo `marca`.
  const tAmbiguo = await tool('registrar_pagamento_fiado',
    { cliente: String(marca), valor: 10 }, DONO);
  ok(tAmbiguo.ok === false && Array.isArray(tAmbiguo.precisa_escolher)
    && tAmbiguo.precisa_escolher.length >= 2,
    'nome ambíguo devolve precisa_escolher', JSON.stringify(tAmbiguo));

  // Ambiguidade não pode ter gravado nada por conta própria.
  ok(await fiados.totalDevidoPeloCliente(devedor2.id) === 100,
    'nada foi gravado no caso ambíguo');

  // Caminho por venda_id: a tool recusa venda que não é do cliente citado.
  const tVendaAlheia = await tool('registrar_pagamento_fiado',
    { cliente: `Fiadeiro ${marca}`, valor: 10, venda_id: antiga.id }, DONO);
  ok(tVendaAlheia.ok === false && /não é uma dívida em aberto/.test(tVendaAlheia.erro),
    'venda de outro cliente é recusada');

  // Limpeza do cenário de fiado, na ordem que as FKs exigem.
  await query('DELETE FROM pagamento_fiado WHERE venda_id = ANY($1)', [vendasDeTeste]);
  await query('DELETE FROM item_venda WHERE venda_id = ANY($1)', [vendasDeTeste]);
  await query('DELETE FROM venda WHERE id = ANY($1)', [vendasDeTeste]);
  const sobrou = (await query(
    'SELECT COUNT(*)::int AS n FROM venda WHERE id = ANY($1)', [vendasDeTeste]
  )).rows[0].n;
  ok(sobrou === 0, 'vendas de teste removidas', `sobraram ${sobrou}`);

  // ---------------------------------------------------------- Fatia 3
  console.log('\n🔏 CONFIRMAÇÃO — o token');

  const acaoBoa = { tool: 'desativar_produto', args: { id: 'abc-123' }, usuarioId: DONO.id };
  const tokenBom = assinarAcao(acaoBoa);

  const verificado = verificarAcao(tokenBom, DONO.id);
  ok(verificado.tool === 'desativar_produto', 'token válido devolve a tool');
  ok(verificado.args.id === 'abc-123', 'token válido devolve os args assinados');

  // Adulterar o corpo sem ter o segredo: a assinatura para de bater.
  const [dadosBom, assinaturaBoa] = tokenBom.split('.');
  const corpoAdulterado = Buffer.from(
    JSON.stringify({ ...acaoBoa, tool: 'cancelar_venda', usuario_id: DONO.id, expira_em: Date.now() + 60000 })
  ).toString('base64url');
  await esperaErroSync(() => verificarAcao(`${corpoAdulterado}.${assinaturaBoa}`, DONO.id),
    'Confirmação inválida. Peça de novo ao Zé.', 'corpo trocado é rejeitado');
  await esperaErroSync(() => verificarAcao(`${dadosBom}.assinaturafalsa`, DONO.id),
    'Confirmação inválida. Peça de novo ao Zé.', 'assinatura falsa é rejeitada');
  await esperaErroSync(() => verificarAcao('sem-ponto-nenhum', DONO.id),
    'Confirmação inválida. Peça de novo ao Zé.', 'token malformado é rejeitado');

  // Token de outro usuário — o cenário do vendedor pegando o do dono.
  await esperaErroSync(() => verificarAcao(tokenBom, 'outro-usuario-qualquer'),
    'Essa confirmação não é sua.', 'token de outro usuário é rejeitado');

  // Expirado: assina com validade no passado manipulando o corpo é
  // impossível (quebraria o HMAC), então usa-se um relógio adiantado.
  const relogioReal = Date.now;
  const tokenVelho = assinarAcao(acaoBoa);
  Date.now = () => relogioReal() + 6 * 60 * 1000; // 6 min depois
  await esperaErroSync(() => verificarAcao(tokenVelho, DONO.id),
    'Essa confirmação expirou. Peça de novo.', 'token expirado é rejeitado');
  Date.now = relogioReal;

  console.log('\n🔏 CONFIRMAÇÃO — desativar produto');

  const alvo = await produtos.criarProduto({
    nome: `Desativavel ${marca}`, unidade: 'saco', preco_venda: 20,
  });
  criados.produtos.push(alvo.id);

  // Passo 1: propõe e NÃO grava.
  const proposta = await tool('desativar_produto', { busca: `Desativavel ${marca}` });
  ok(proposta.precisa_confirmar === true, 'passo 1 pede confirmação');
  ok(proposta.args?.id === alvo.id, 'passo 1 resolve o id e o carrega para o passo 2');
  ok(/some da tela de venda/i.test(proposta.resumo), 'o resumo explica o efeito');
  ok((await produtos.buscarProduto(alvo.id)).ativo === true,
    'passo 1 NÃO desativou nada');

  // Passo 2: confirmada = true executa de verdade.
  const feito = (await executarTool('desativar_produto', { id: alvo.id }, DONO,
    { confirmada: true })).resultado;
  ok(feito.ok === true && feito.acao === 'desativado', 'passo 2 desativa');
  ok((await produtos.buscarProduto(alvo.id)).ativo === false, 'o banco confirma');

  // Idempotência: confirmar de novo não causa dano (o plano conta com isso).
  const derepetido = (await executarTool('desativar_produto', { id: alvo.id }, DONO,
    { confirmada: true })).resultado;
  ok(derepetido.ok === true, 'confirmar duas vezes é inofensivo');

  const revivido = await tool('reativar_produto', { busca: `Desativavel ${marca}` });
  ok(revivido.ok === true && revivido.acao === 'reativado', 'reativar não pede confirmação');
  ok((await produtos.buscarProduto(alvo.id)).ativo === true, 'produto voltou');

  const jaAtivo = await tool('reativar_produto', { busca: `Desativavel ${marca}` });
  ok(jaAtivo.ok === false, 'reativar o que já está ativo avisa');

  const negado = await tool('desativar_produto', { busca: `Desativavel ${marca}` }, VENDEDOR);
  ok(/permissão/i.test(negado.erro || ''), 'vendedor não desativa produto');

  // ---------------------------------------------------------- Fatia 4
  console.log('\n🧭 RESOLVEDOR — o segundo turno da conversa');

  // Dois produtos que empatam de propósito, como os dois cimentos reais
  // do usuário ("Cimento CP-II 50kg" e "Cimento Mizu 50kg").
  const gemeoA = await produtos.criarProduto({
    nome: `Massa Fina ${marca}`, unidade: 'saco', preco_venda: 30,
  });
  const gemeoB = await produtos.criarProduto({
    nome: `Massa Grossa ${marca}`, unidade: 'saco', preco_venda: 40,
  });
  criados.produtos.push(gemeoA.id, gemeoB.id);

  // 1º turno: nome ambíguo. Não grava e devolve as opções COM id.
  const ambiguo = await tool('editar_produto', { busca: `Massa`, preco_venda: 99 });
  ok(ambiguo.ok === false, 'ambíguo não grava');
  ok(Array.isArray(ambiguo.precisa_escolher), 'devolve as opções');
  ok(ambiguo.precisa_escolher.every((o) => o.id && o.rotulo), 'cada opção tem id e rótulo');
  ok(/R\$/.test(ambiguo.precisa_escolher[0].rotulo),
    'o rótulo mostra o preço — é o que distingue um do outro');
  ok(Number((await produtos.buscarProduto(gemeoA.id)).preco_venda) === 30,
    'nada foi alterado no 1º turno');

  // 2º turno: a pessoa escolheu, o modelo repete a chamada com o id.
  // ESTE é o teste da fatia: sem ele, o Zé perguntaria em laço.
  const escolhido = ambiguo.precisa_escolher.find((o) => o.rotulo.includes('Grossa'));
  const resolvido = await tool('editar_produto', { id: escolhido.id, preco_venda: 99 });
  ok(resolvido.ok === true, '2º turno com id funciona');
  ok(Number((await produtos.buscarProduto(gemeoB.id)).preco_venda) === 99,
    'alterou o produto ESCOLHIDO');
  ok(Number((await produtos.buscarProduto(gemeoA.id)).preco_venda) === 30,
    'não encostou no outro');

  // Desempate por nome exato: o nome completo ganha do parcial.
  const exato = await tool('editar_produto', {
    busca: `Massa Fina ${marca}`, preco_custo: 12,
  });
  ok(exato.ok === true, 'nome exato desempata sem perguntar');

  // Teto de opções: com muitos candidatos, o Zé não despeja a lista toda.
  const muitos = [];
  for (let i = 0; i < 7; i++) {
    const x = await produtos.criarProduto({
      nome: `Lote ${marca} n${i}`, unidade: 'peca', preco_venda: 5 + i,
    });
    criados.produtos.push(x.id);
    muitos.push(x.id);
  }
  const demais = await tool('editar_produto', { busca: `Lote ${marca}`, preco_venda: 1 });
  ok(demais.precisa_escolher.length === 5, 'mostra no máximo 5 opções',
    `mostrou ${demais.precisa_escolher?.length}`);
  ok(/7 produtos/.test(demais.erro), 'mas diz quantos existem de verdade');

  // Id que não existe mais: erro claro, não estouro.
  const sumido = await tool('editar_produto', {
    id: '00000000-0000-0000-0000-000000000000', preco_venda: 1,
  });
  ok(sumido.ok === false && /não existe mais/.test(sumido.erro),
    'id inexistente avisa em português');

  // Sem busca e sem id.
  const semNada = await tool('editar_produto', { preco_venda: 1 });
  ok(semNada.ok === false, 'sem busca e sem id é recusado');

  // Achado na Fatia 7, com o modelo real: ele mandou id "1" — o número
  // da opção que ele mesmo tinha listado. Estourava 22P02 no SQL e a
  // pessoa lia "não consegui agora", sem entender nada.
  const idNumerico = await tool('editar_produto', { id: '1', preco_venda: 1 });
  ok(idNumerico.ok === false && /número da lista/.test(idNumerico.erro),
    'id numérico vira instrução clara, não erro de SQL', idNumerico.erro);
  const idNumericoCli = await tool('editar_cliente', { id: '2', tipo: 'pedreiro' });
  ok(idNumericoCli.ok === false && /número da lista/.test(idNumericoCli.erro),
    'o mesmo vale para cliente');

  // O mesmo vale para cliente, inclusive na tool de fiado.
  const homonimoA = await clientes.criarCliente({
    nome: `Irmao Um ${marca}`, telefone: '11955550001',
  });
  const homonimoB = await clientes.criarCliente({
    nome: `Irmao Dois ${marca}`, telefone: '11955550002',
  });
  criados.clientes.push(homonimoA.id, homonimoB.id);

  const cliAmbiguo = await tool('editar_cliente', { busca: `Irmao`, tipo: 'pedreiro' });
  ok(cliAmbiguo.ok === false && cliAmbiguo.precisa_escolher?.length === 2,
    'cliente ambíguo devolve as duas opções');
  ok(/1195555000/.test(cliAmbiguo.precisa_escolher[0].rotulo),
    'o rótulo do cliente mostra o telefone');

  const cliResolvido = await tool('editar_cliente', {
    id: homonimoB.id, tipo: 'construtora',
  });
  ok(cliResolvido.ok === true, 'cliente: 2º turno com id funciona');
  ok((await clientes.buscarCliente(homonimoB.id)).tipo === 'construtora',
    'alterou o cliente escolhido');
  ok((await clientes.buscarCliente(homonimoA.id)).tipo === null,
    'não encostou no outro cliente');

  // A tool de fiado usa o MESMO resolvedor — mesma leitura, mesmo formato.
  const fiadoAmbiguo = await tool('registrar_pagamento_fiado', {
    cliente: `Irmao`, valor: 10,
  });
  ok(Array.isArray(fiadoAmbiguo.precisa_escolher),
    'fiado usa o mesmo resolvedor e devolve precisa_escolher');

  // ---------------------------------------------------------- Fatia 6
  console.log('\n🧾 VENDA — nota, confirmação e gravação');

  const vendasCriadas = [];
  const pv1 = await produtos.criarProduto({
    nome: `Telha Onda ${marca}`, unidade: 'peca', preco_venda: 12,
  });
  const pv2 = await produtos.criarProduto({
    nome: `Prego Ponta ${marca}`, unidade: 'kg', preco_venda: 8,
  });
  criados.produtos.push(pv1.id, pv2.id);
  const compradorV = await clientes.criarCliente({
    nome: `Comprador ${marca}`, telefone: '11944440000',
  });
  criados.clientes.push(compradorV.id);

  const vendasAntes = Number((await query('SELECT COUNT(*)::int n FROM venda')).rows[0].n);

  // Passo 1: monta a nota. NADA gravado.
  const notaV = await tool('criar_venda', {
    cliente: `Comprador ${marca}`,
    forma_pagamento: 'dinheiro',
    itens: [
      { produto: `Telha Onda ${marca}`, quantidade: 10 },
      { produto: `Prego Ponta ${marca}`, quantidade: 2 },
    ],
  });
  ok(notaV.precisa_confirmar === true, 'venda pede confirmação');
  ok(/Telha Onda/.test(notaV.resumo) && /Prego Ponta/.test(notaV.resumo),
    'a nota lista os dois itens');
  ok(/120,00/.test(notaV.resumo), 'a nota calcula 10 × 12 = 120');
  ok(/TOTAL R\$ 136,00/.test(notaV.resumo), 'a nota soma o total (120 + 16)',
    notaV.resumo);
  ok(notaV.args.itens.every((i) => i.produto_id && !i.produto),
    'só IDs resolvidos viajam para o passo 2');
  ok(Number((await query('SELECT COUNT(*)::int n FROM venda')).rows[0].n) === vendasAntes,
    'passo 1 NÃO gravou venda nenhuma');

  // Passo 2: grava.
  const gravada = (await executarTool('criar_venda', notaV.args, DONO,
    { confirmada: true })).resultado;
  ok(gravada.ok === true && gravada.acao === 'venda_lancada', 'passo 2 grava');
  vendasCriadas.push(gravada.registro.id);
  ok(Number(gravada.registro.valor_total) === 136, 'valor_total confere');
  ok(gravada.registro.itens.length === 2, 'gravou os dois itens');
  ok(gravada.registro.usuario_id === DONO.id, 'quem vendeu vem do usuário, não do pedido');

  // Desconto entra na nota e no total.
  const comDesconto = await tool('criar_venda', {
    cliente_id: compradorV.id, forma_pagamento: 'pix', desconto: 6,
    itens: [{ produto_id: pv1.id, quantidade: 5 }],
  });
  ok(/Desconto/.test(comDesconto.resumo), 'a nota mostra o desconto');
  ok(/TOTAL R\$ 54,00/.test(comDesconto.resumo), 'desconto abatido no total (60 − 6)',
    comDesconto.resumo);

  // Ambiguidade em UM item devolve tudo de uma vez, sem gravar.
  const pvAmbA = await produtos.criarProduto({
    nome: `Cola Branca ${marca}`, unidade: 'kg', preco_venda: 9,
  });
  const pvAmbB = await produtos.criarProduto({
    nome: `Cola Preta ${marca}`, unidade: 'kg', preco_venda: 11,
  });
  criados.produtos.push(pvAmbA.id, pvAmbB.id);

  const ambigua = await tool('criar_venda', {
    forma_pagamento: 'dinheiro',
    itens: [
      { produto: `Telha Onda ${marca}`, quantidade: 1 },
      { produto: `Cola`, quantidade: 1 },
    ],
  });
  ok(ambigua.ok === false, 'venda com item ambíguo não grava');
  ok(ambigua.precisa_escolher && Object.keys(ambigua.precisa_escolher).some((k) => /item 2/.test(k)),
    'aponta QUAL item está ambíguo');
  ok(Number((await query('SELECT COUNT(*)::int n FROM venda')).rows[0].n) === vendasAntes + 1,
    'nada gravado no caso ambíguo');

  // Validações continuam valendo pela camada de service.
  const semPagamento = await tool('criar_venda', {
    itens: [{ produto_id: pv1.id, quantidade: 1 }], forma_pagamento: 'cheque',
  });
  // A mensagem diz "forma de pagamento", não "forma_pagamento": nome de
  // coluna não é texto de tela, e o modelo repassa isto ao usuário.
  ok(semPagamento.ok === false && /forma de pagamento/i.test(semPagamento.erro),
    'forma de pagamento inválida é recusada', JSON.stringify(semPagamento));

  const semItem = await tool('criar_venda', { itens: [], forma_pagamento: 'dinheiro' });
  ok(semItem.ok === false, 'venda sem item é recusada');

  // Venda fiado entra no módulo de fiados.
  const notaFiado = await tool('criar_venda', {
    cliente_id: compradorV.id, forma_pagamento: 'fiado',
    itens: [{ produto_id: pv2.id, quantidade: 5 }],
  });
  const fiadoGravado = (await executarTool('criar_venda', notaFiado.args, DONO,
    { confirmada: true })).resultado;
  vendasCriadas.push(fiadoGravado.registro.id);
  ok(/fiado/i.test(fiadoGravado.resumo), 'o desfecho avisa que entrou no fiado');
  const dividas = await fiados.fiadosDoCliente(compradorV.id);
  ok(dividas.some((d) => d.id === fiadoGravado.registro.id),
    'a venda fiado aparece nas dívidas do cliente');

  console.log('\n🧾 VENDA — cancelamento');

  const paraCancelar = gravada.registro.id;
  const propostaCancel = await tool('cancelar_venda', { venda_id: paraCancelar });
  ok(propostaCancel.precisa_confirmar === true, 'cancelar pede confirmação');
  ok(/sai do faturamento/i.test(propostaCancel.resumo), 'explica o efeito');
  ok((await vendaSvc.buscarVenda(paraCancelar)).status === 'concluida',
    'passo 1 NÃO cancelou');

  const cancelou = (await executarTool('cancelar_venda', propostaCancel.args, DONO,
    { confirmada: true })).resultado;
  ok(cancelou.ok === true, 'passo 2 cancela');
  ok((await vendaSvc.buscarVenda(paraCancelar)).status === 'cancelada', 'o banco confirma');

  const deNovo = await tool('cancelar_venda', { venda_id: paraCancelar });
  ok(deNovo.ok === false && /já está cancelada/.test(deNovo.erro),
    'cancelar duas vezes avisa');

  const cancelVendedor = await tool('cancelar_venda', { venda_id: paraCancelar }, VENDEDOR);
  ok(/permissão/i.test(cancelVendedor.erro || ''), 'vendedor não cancela venda');

  // Limpeza das vendas de teste, antes da limpeza geral (FK).
  for (const id of vendasCriadas) {
    await query('DELETE FROM item_venda WHERE venda_id = $1', [id]);
    await query('DELETE FROM venda WHERE id = $1', [id]);
  }
  const sobrouVenda = Number((await query('SELECT COUNT(*)::int n FROM venda')).rows[0].n);
  ok(sobrouVenda === vendasAntes, 'vendas de teste removidas',
    `esperado ${vendasAntes}, achei ${sobrouVenda}`);

  // Limpeza — nada de lixo de teste no banco do usuário.
  console.log('\n🧹 LIMPEZA');
  for (const id of criados.produtos) await produtos.removerProduto(id);
  for (const id of criados.clientes) await clientes.removerCliente(id);
  ok(await produtos.buscarProduto(criados.produtos[0]) === null, 'produto de teste removido');
  ok(await clientes.buscarCliente(criados.clientes[0]) === null, 'cliente de teste removido');
  // A marca é única por execução: sobrar qualquer coisa com ela é resíduo.
  ok((await produtos.buscarProdutosPorNome(String(marca))).length === 0,
    'nenhum produto de teste sobrou');
  ok((await clientes.buscarClientesPorNome(String(marca))).length === 0,
    'nenhum cliente de teste sobrou');

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
