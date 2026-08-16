import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Trash2, UserPlus, X, Check } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import AcoesRecibo from '../components/AcoesRecibo';
import { vendasService } from '../services/vendas';
import { fiadosService } from '../services/fiados';
import { moeda } from '../utils/formato';
import {
  calcularVenda,
  validarVenda,
  montarPayload,
  adicionarItem,
} from '../utils/calculoVenda';
import * as rascunho from '../utils/rascunhoVenda';

const PAGAMENTOS = [
  { id: 'dinheiro', rotulo: 'Dinheiro' },
  { id: 'pix', rotulo: 'Pix' },
  { id: 'cartao', rotulo: 'Cartão' },
  { id: 'fiado', rotulo: 'Fiado' },
];

export default function NovaVenda() {
  const navigate = useNavigate();
  // Molde de uma venda que está sendo corrigida (veio de Vendas, via
  // navigate state). Fica fora da URL de propósito: recarregar a página
  // não deve reabrir uma correção que já foi salva.
  const { state } = useLocation();
  const correcao = state?.correcao || null;

  const [cliente, setCliente] = useState(null); // null = Consumidor
  const [itens, setItens] = useState([]); // { produto_id, nome, unidade, quantidade, preco_unitario }
  const [pagamento, setPagamento] = useState('dinheiro');
  const [recebido, setRecebido] = useState(''); // valor em dinheiro recebido (troco)
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [modalCliente, setModalCliente] = useState(false);
  const [vendaSalva, setVendaSalva] = useState(null);
  const [tipoDesconto, setTipoDesconto] = useState('valor'); // 'valor' | 'percentual'
  const [descontoInput, setDescontoInput] = useState('');
  // Dívida do cliente escolhido — alimenta o aviso de fiado em aberto.
  const [divida, setDivida] = useState(null);
  // Rascunho encontrado ao abrir a tela (venda interrompida por queda de
  // internet, aba fechada, PC reiniciado). Fica em espera até a pessoa
  // decidir: restaurar não pode acontecer sozinho, senão ela começa uma
  // venda nova e encontra itens que não colocou.
  const [rascunhoAchado, setRascunhoAchado] = useState(null);
  const [semConexao, setSemConexao] = useState(false);

  // Ao abrir: procura venda interrompida. Não restaura sozinho — só
  // oferece. Numa correção de venda o molde já preenche a tela, então
  // nem pergunta.
  useEffect(() => {
    if (correcao) return;
    const achado = rascunho.carregar();
    if (achado) setRascunhoAchado(achado);
  }, [correcao]);

  // Salva a cada mudança. É barato (localStorage é síncrono e local) e
  // cobre o caso real: a queda não avisa antes de acontecer.
  //
  // `vendaSalva` sai fora: depois de gravada, a venda não é mais rascunho.
  useEffect(() => {
    if (vendaSalva || rascunhoAchado) return;
    rascunho.salvar({ cliente, itens, pagamento, descontoInput, tipoDesconto });
  }, [cliente, itens, pagamento, descontoInput, tipoDesconto, vendaSalva, rascunhoAchado]);

  // O navegador avisa quando a conexão volta ou cai. É mais confiável que
  // adivinhar pelo erro da requisição, e permite tirar o aviso da tela
  // sozinho quando a internet volta.
  useEffect(() => {
    const online = () => setSemConexao(false);
    const offline = () => setSemConexao(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    // Estado inicial: a tela pode abrir já sem conexão.
    if (navigator.onLine === false) setSemConexao(true);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  function restaurarRascunho() {
    const r = rascunhoAchado;
    setCliente(r.cliente ?? null);
    setItens(r.itens ?? []);
    setPagamento(r.pagamento ?? 'dinheiro');
    setDescontoInput(r.descontoInput ?? '');
    setTipoDesconto(r.tipoDesconto ?? 'valor');
    setRascunhoAchado(null);
  }

  function descartarRascunho() {
    rascunho.limpar();
    setRascunhoAchado(null);
  }

  // Correção: preenche a tela com o molde da venda cancelada.
  //
  // A unidade de cada item vem do catálogo ATUAL, não do molde — é o que
  // faz um produto desativado desde a venda aparecer como problema aqui
  // em vez de ser revendido em silêncio.
  const [itensSumidos, setItensSumidos] = useState([]);
  useEffect(() => {
    if (!correcao) return;
    const m = correcao.molde;

    if (m.cliente_id) {
      setCliente({
        id: m.cliente_id,
        nome: m.cliente_nome,
        telefone: m.cliente_telefone,
      });
    }
    setPagamento(m.forma_pagamento);
    if (Number(m.desconto) > 0) {
      setTipoDesconto('valor');
      setDescontoInput(String(m.desconto));
    }

    let ativo = true;
    vendasService
      .buscarProdutos()
      .then((catalogo) => {
        if (!ativo) return;
        const porId = new Map(catalogo.map((p) => [p.id, p]));
        const encontrados = [];
        const sumidos = [];
        for (const item of m.itens) {
          const atual = porId.get(item.produto_id);
          if (!atual) {
            sumidos.push(item.produto_nome);
            continue;
          }
          encontrados.push({
            produto_id: item.produto_id,
            nome: atual.nome,
            unidade: atual.unidade,
            quantidade: item.quantidade,
            // O preço praticado na venda original, não o de tabela: se
            // houve negociação no balcão, ela é o que se está corrigindo.
            preco_unitario: item.preco_unitario,
          });
        }
        setItens(encontrados);
        setItensSumidos(sumidos);
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar os itens da venda.');
      });
    return () => {
      ativo = false;
    };
  }, [correcao]);

  // Escolheu um cliente? consulta se ele tem fiado em aberto.
  // Falha em silêncio de propósito: não achar a dívida não pode impedir a
  // venda de acontecer — a meta dos 30 segundos vale mesmo quando a
  // consulta falha.
  useEffect(() => {
    if (!cliente?.id) {
      setDivida(null);
      return;
    }
    let cancelado = false;
    fiadosService
      .dividaDoCliente(cliente.id)
      .then((d) => {
        if (!cancelado) setDivida(Number(d?.total) > 0 ? d : null);
      })
      .catch(() => {
        if (!cancelado) setDivida(null);
      });
    return () => {
      cancelado = true;
    };
  }, [cliente?.id]);

  // As contas moram em utils/calculoVenda.js — módulo puro, com suíte
  // própria (calculoVenda.test.mjs). Aqui a tela só consome o resultado.
  const { subtotal, desconto, total, quantidadeTotal: qtdTotal, troco } =
    calcularVenda({ itens, descontoInput, tipoDesconto, recebido });

  function adicionarProduto(p) {
    setItens((atual) => adicionarItem(atual, p));
  }

  function atualizarItem(idx, campo, valor) {
    setItens((atual) => {
      const copia = [...atual];
      copia[idx] = { ...copia[idx], [campo]: valor };
      return copia;
    });
  }

  function removerItem(idx) {
    setItens((atual) => atual.filter((_, i) => i !== idx));
  }

  async function salvar() {
    setErro('');
    const problema = validarVenda({ itens });
    if (problema) {
      setErro(problema);
      return;
    }

    setSalvando(true);
    try {
      const venda = await vendasService.criarVenda(
        montarPayload({ cliente, itens, pagamento, descontoInput, tipoDesconto })
      );
      // Gravou no servidor: o rascunho cumpriu o papel e sai de cena.
      // Mantê-lo faria a próxima venda começar com os itens desta.
      rascunho.limpar();
      setVendaSalva(venda); // mostra a confirmação
    } catch (e) {
      // Distingue "sem internet" de "o sistema recusou": a primeira pede
      // tentar de novo, a segunda pede corrigir algo. E o rascunho
      // continua salvo — a mensagem diz isso, para a pessoa não achar que
      // perdeu o trabalho.
      setErro(rascunho.mensagemDeFalha(e));
      if (rascunho.ehFalhaDeRede(e)) setSemConexao(true);
    } finally {
      setSalvando(false);
    }
  }

  // reinicia a tela para uma nova venda
  function novaVenda() {
    // A venda anterior já foi gravada; o rascunho dela não pode
    // reaparecer na próxima abertura da tela.
    rascunho.limpar();
    setCliente(null);
    setItens([]);
    setPagamento('dinheiro');
    setDescontoInput('');
    setRecebido('');
    setErro('');
    setVendaSalva(null);
  }

  // ---- Tela de confirmação (pós-venda) ----
  if (vendaSalva) {
    return (
      <LayoutApp titulo="Venda registrada">
        <div className="flex items-center justify-center h-full min-h-[500px]">
          <div className="bg-superficie border border-linha rounded-md px-8 py-10 max-w-[420px] w-full text-center">
            <div className="w-14 h-14 rounded-full bg-nivel/10 flex items-center justify-center mx-auto mb-5">
              <Check size={28} className="text-nivel" strokeWidth={2.5} />
            </div>
            <h2 className="text-[18px] font-bold">Venda registrada!</h2>
            <p className="text-[13px] text-grafite-medio mt-1">
              {vendaSalva.cliente_nome || 'Consumidor'} ·{' '}
              {PAGAMENTOS.find((p) => p.id === vendaSalva.forma_pagamento)?.rotulo}
            </p>
            <p className="text-[40px] font-bold tabular-nums text-nivel my-5">
              {moeda(vendaSalva.valor_total)}
            </p>

            {/* O recibo vem antes de "Nova venda": é agora, com o cliente
                ainda no balcão, que o papel serve para alguma coisa. */}
            <div className="mb-3">
              <AcoesRecibo venda={vendaSalva} telefoneCliente={cliente?.telefone} />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigate('/')}
                className="flex-1 py-3 rounded-p border border-linha text-[14px] font-semibold hover:bg-concreto"
              >
                Ver painel
              </button>
              <button
                onClick={novaVenda}
                className="flex-1 py-3 rounded-p bg-trena hover:bg-trena-escuro text-white text-[14px] font-bold"
              >
                Nova venda
              </button>
            </div>
          </div>
        </div>
      </LayoutApp>
    );
  }

  return (
    <LayoutApp
      titulo={correcao ? 'Corrigir venda' : 'Nova venda'}
      acao={
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-grafite-medio hover:text-grafite"
        >
          <ArrowLeft size={16} /> Voltar ao painel
        </button>
      }
    >
      {/* Venda interrompida. Pergunta em vez de restaurar sozinho: quem
          abriu a tela para vender de novo estranharia encontrar itens que
          não colocou. */}
      {rascunhoAchado && (
        <div className="max-w-[1280px] mx-auto mb-4 rounded-p border border-trena/40 bg-trena/5 px-4 py-3">
          <p className="text-[13.5px] font-semibold text-grafite">
            Você tinha uma venda em andamento
          </p>
          <p className="text-[12.5px] text-grafite-medio mt-0.5">
            {rascunhoAchado.itens.length} item(ns)
            {rascunhoAchado.cliente?.nome ? ` · ${rascunhoAchado.cliente.nome}` : ''}
            {' · guardada '}
            {rascunho.descreverIdade(rascunhoAchado.salvo_em)}.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={restaurarRascunho}
              className="h-11 px-4 rounded-p bg-trena hover:bg-trena-escuro text-white text-[13.5px] font-bold"
            >
              Continuar essa venda
            </button>
            <button
              onClick={descartarRascunho}
              className="h-11 px-4 rounded-p border border-linha text-[13px] font-semibold text-grafite-medio hover:text-grafite"
            >
              Começar do zero
            </button>
          </div>
        </div>
      )}

      {/* Sem conexão. O navegador avisa quando cai e quando volta, então
          este aviso some sozinho — a pessoa não precisa recarregar para
          descobrir que já dá para salvar. */}
      {semConexao && (
        <div className="max-w-[1280px] mx-auto mb-4 rounded-p border border-prumo/40 bg-prumo/5 px-4 py-3">
          <p className="text-[13.5px] font-semibold text-prumo">
            Sem conexão com o sistema
          </p>
          <p className="text-[12.5px] text-grafite-medio mt-0.5">
            Pode continuar lançando: o que você digitar fica guardado aqui e é
            só tocar em concluir quando a internet voltar.
          </p>
        </div>
      )}

      {/* Correção em andamento. A venda antiga JÁ foi cancelada quando
          esta tela abriu — dizer isso evita que a pessoa saia daqui
          achando que a original continua valendo. */}
      {correcao && (
        <div className="max-w-[1280px] mx-auto mb-4 rounded-p border border-trena/40 bg-trena/5 px-4 py-3">
          <p className="text-[13.5px] font-semibold text-grafite">
            Corrigindo a venda {String(correcao.cancelada).slice(0, 8).toUpperCase()}
          </p>
          <p className="text-[12.5px] text-grafite-medio mt-0.5">
            A venda anterior foi cancelada. Ajuste o que estava errado e salve —
            isto entra como uma venda nova.
          </p>
          {itensSumidos.length > 0 && (
            <p className="text-[12.5px] text-prumo font-semibold mt-1.5">
              Fora do catálogo, não foram trazidos: {itensSumidos.join(', ')}.
            </p>
          )}
        </div>
      )}

      {/* pb-24 até lg: espaço para a barra fixa não cobrir o fim do resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 pb-24 lg:pb-0 lg:h-full lg:min-h-[560px] max-w-[1280px] mx-auto">
        {/* ---- COLUNA ESQUERDA: cliente + itens ---- */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Cliente */}
          <div className="bg-superficie border border-linha rounded-md px-5 py-4">
            <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio mb-3">
              Cliente
            </p>
            {cliente ? (
              <div className="flex items-center justify-between bg-concreto rounded-p px-3 py-2.5">
                <div>
                  <p className="text-[14px] font-semibold">{cliente.nome}</p>
                  <p className="text-[12px] text-grafite-medio">{cliente.telefone}</p>
                </div>
                <button
                  onClick={() => setCliente(null)}
                  className="text-grafite-medio hover:text-prumo"
                  title="Remover cliente"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <BuscaCliente
                onSelecionar={setCliente}
                onNovoCliente={() => setModalCliente(true)}
              />
            )}

            {/* Fiado em aberto deste cliente. Aparece aqui, no momento em
                que ele é escolhido, em vez de numa tela de devedores: quem
                atende sabe da conta de quem está na frente dele, e não do
                mapa de quem deve para a loja. */}
            {cliente && divida && (
              <AvisoDivida
                divida={divida}
                onAbatido={(restante) =>
                  setDivida(restante > 0 ? { ...divida, total: restante } : null)
                }
                clienteId={cliente.id}
              />
            )}
          </div>

          {/* Itens — estica para preencher a altura */}
          <div className="bg-superficie border border-linha rounded-md px-5 py-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio">
                Itens da venda
              </p>
              <span className="text-[12px] text-grafite-medio">{itens.length} item(ns)</span>
            </div>

            <div className="shrink-0">
              <BuscaProduto onAdicionar={adicionarProduto} />
            </div>

            {itens.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 py-8">
                <p className="text-[14px] font-semibold text-grafite-medio">Nenhum item ainda</p>
                <p className="text-[13px] text-grafite-medio">
                  Busque um produto acima para adicionar à venda.
                </p>
              </div>
            ) : (
              <div className="mt-3 flex-1 min-h-0 overflow-y-auto flex flex-col divide-y divide-linha">
                {itens.map((item, idx) => (
                  <LinhaItem
                    key={item.produto_id}
                    item={item}
                    onQuantidade={(v) => atualizarItem(idx, 'quantidade', v)}
                    onPreco={(v) => atualizarItem(idx, 'preco_unitario', v)}
                    onRemover={() => removerItem(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- COLUNA DIREITA: resumo ---- */}
        <div className="self-start bg-superficie border border-linha rounded-md px-5 py-5 flex flex-col gap-5">
          <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio">
            Resumo da venda
          </p>

          {/* cliente */}
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-grafite-medio">Cliente</span>
            <span className="font-semibold truncate max-w-[180px]">
              {cliente ? cliente.nome : 'Consumidor'}
            </span>
          </div>

          {/* linhas do resumo */}
          <div className="flex flex-col gap-2 py-3 border-y border-linha">
            <LinhaResumo rotulo={`Itens (${itens.length})`} valor={`${qtdTotal} un.`} />
            <LinhaResumo rotulo="Subtotal" valor={moeda(subtotal)} />
            {desconto > 0 && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-grafite-medio">Desconto</span>
                <span className="font-semibold tabular-nums text-prumo">− {moeda(desconto)}</span>
              </div>
            )}
          </div>

          {/* desconto */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-grafite-medio">Desconto</p>
              {/* toggle % / R$ */}
              <div className="flex bg-concreto rounded-p p-1 gap-1">
                {[
                  { id: 'valor', rotulo: 'R$' },
                  { id: 'percentual', rotulo: '%' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTipoDesconto(t.id)}
                    className={`px-4 py-1.5 rounded-[5px] text-[13px] font-bold transition-colors ${
                      tipoDesconto === t.id
                        ? 'bg-superficie text-grafite shadow-sm'
                        : 'text-grafite-medio hover:text-grafite'
                    }`}
                  >
                    {t.rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center border-2 border-linha rounded-p px-3 focus-within:border-grafite">
              <span className="text-[13px] text-grafite-medio">
                {tipoDesconto === 'valor' ? 'R$' : '%'}
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={descontoInput}
                onChange={(e) => setDescontoInput(e.target.value)}
                placeholder="0"
                className="flex-1 py-2 px-2 text-right text-[14px] font-semibold tabular-nums bg-transparent outline-none"
              />
            </div>
          </div>

          {/* total destacado */}
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-semibold">Total</span>
            <span className="text-[30px] font-bold tabular-nums text-nivel">{moeda(total)}</span>
          </div>

          {/* pagamento */}
          <div>
            <p className="text-[11px] font-semibold text-grafite-medio mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {PAGAMENTOS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPagamento(p.id)}
                  className={`py-2.5 rounded-p text-[13px] font-semibold border transition-colors ${
                    pagamento === p.id
                      ? 'bg-trena text-white border-trena'
                      : 'bg-superficie text-grafite border-linha hover:border-grafite-medio'
                  }`}
                >
                  {p.rotulo}
                </button>
              ))}
            </div>

            {/* troco — só no dinheiro */}
            {pagamento === 'dinheiro' && total > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-grafite-medio mb-1">Valor recebido</p>
                  <div className="flex items-center border-2 border-linha rounded-p px-3 focus-within:border-grafite">
                    <span className="text-[13px] text-grafite-medio shrink-0">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={recebido}
                      onChange={(e) => setRecebido(e.target.value)}
                      placeholder={total.toFixed(2)}
                      className="w-full min-w-0 py-2 pl-2 text-right text-[14px] font-semibold tabular-nums bg-transparent outline-none"
                    />
                  </div>
                </div>
                {/* atalhos de cédulas comuns */}
                <div className="flex flex-wrap gap-1.5">
                  {[total, 50, 100, 200].map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setRecebido(v.toFixed(2))}
                      className="px-2.5 py-1 rounded-p border border-linha text-[12px] font-semibold text-grafite-medio hover:border-grafite hover:text-grafite tabular-nums"
                    >
                      {i === 0 ? 'Exato' : moeda(v)}
                    </button>
                  ))}
                </div>
                {/* Troco calculado. `troco` é null enquanto ninguém
                    digitou — sem isso a tela mostraria "Falta R$ 300,00"
                    com o campo ainda em branco. */}
                {troco !== null && (
                  <div
                    className={`flex items-center justify-between rounded-p px-3 py-2 ${
                      troco < 0 ? 'bg-prumo/10' : 'bg-nivel/10'
                    }`}
                  >
                    <span className={`text-[13px] font-semibold ${troco < 0 ? 'text-prumo' : 'text-nivel'}`}>
                      {troco < 0 ? 'Falta' : 'Troco'}
                    </span>
                    <span className={`text-[16px] font-bold tabular-nums ${troco < 0 ? 'text-prumo' : 'text-nivel'}`}>
                      {moeda(Math.abs(troco))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-[12.5px] text-prumo font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-prumo" />
              {erro}
            </div>
          )}

          {/* Até lg o salvar mora na barra fixa do rodapé, para não ficar
              abaixo da dobra quando a venda tem muitos itens. */}
          <button
            onClick={salvar}
            disabled={salvando || itens.length === 0}
            className="hidden lg:flex min-h-[56px] rounded-p bg-trena hover:bg-trena-escuro text-white font-bold text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed items-center justify-center gap-2"
          >
            <Check size={18} /> {salvando ? 'Salvando…' : 'Salvar venda'}
          </button>
        </div>
      </div>

      {/* ---- Barra fixa (até lg): total sempre à vista + salvar ----
           No balcão o cliente pergunta "quanto deu?" no meio da venda; o
           total não pode depender de rolar até o fim da página. */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-superficie border-t border-linha px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-grafite-medio leading-none">
            Total
          </p>
          <p className="text-[22px] font-bold tabular-nums text-nivel leading-tight">
            {moeda(total)}
          </p>
        </div>
        <button
          onClick={salvar}
          disabled={salvando || itens.length === 0}
          className="flex-1 min-h-[52px] rounded-p bg-trena hover:bg-trena-escuro text-white font-bold text-[15px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Check size={18} /> {salvando ? 'Salvando…' : 'Salvar venda'}
        </button>
      </div>

      {modalCliente && (
        <ModalNovoCliente
          onFechar={() => setModalCliente(false)}
          onCriado={(c) => {
            setCliente(c);
            setModalCliente(false);
          }}
        />
      )}
    </LayoutApp>
  );
}

// ---------- Aviso de fiado em aberto ----------

// O vendedor não tem a tela de Fiados: é por aqui que ele descobre que o
// cliente à sua frente tem conta, e é por aqui que ele recebe.
//
// Mostra o valor e deixa abater na hora (abate da dívida mais antiga para a
// mais nova, no servidor). Não bloqueia nada: se a pessoa quiser vender
// assim mesmo, vende — o aviso informa, não impede.
function AvisoDivida({ divida, clienteId, onAbatido }) {
  const [abrindo, setAbrindo] = useState(false);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [recibo, setRecibo] = useState(null);

  const total = Number(divida.total) || 0;
  const desde = divida.mais_antiga
    ? new Date(divida.mais_antiga).toLocaleDateString('pt-BR')
    : null;

  async function abater() {
    const v = Number(valor);
    if (!v || v <= 0) {
      setErro('Informe quanto ele está pagando.');
      return;
    }
    if (v > total + 0.009) {
      setErro(`O valor não pode passar de ${moeda(total)}.`);
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const r = await fiadosService.pagarCliente(clienteId, v);
      // `total_devido_depois` vem do servidor, que fez a conta na transação.
      const restante = Number(r?.total_devido_depois ?? total - v);
      setRecibo({ pago: v, restante });
      setAbrindo(false);
      setValor('');
      onAbatido(restante);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  // Depois de receber, o aviso vira confirmação — o vendedor precisa poder
  // dizer ao cliente o que ficou registrado.
  if (recibo) {
    return (
      <div className="mt-3 rounded-p border border-nivel/30 bg-nivel/5 px-3 py-2.5">
        <p className="text-[13px] font-semibold text-nivel">
          Recebido {moeda(recibo.pago)}
        </p>
        <p className="text-[12px] text-grafite-medio mt-0.5">
          {recibo.restante > 0
            ? `Ainda restam ${moeda(recibo.restante)} em aberto.`
            : 'A conta deste cliente está quitada.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-p border border-trena/40 bg-trena/5 px-3 py-2.5">
      <p className="text-[13px] font-semibold text-grafite">
        Este cliente tem {moeda(total)} em aberto
      </p>
      <p className="text-[12px] text-grafite-medio mt-0.5">
        {divida.qtd_dividas > 1
          ? `${divida.qtd_dividas} compras no fiado`
          : 'Uma compra no fiado'}
        {desde ? ` · desde ${desde}` : ''}
        {' · em caso de dúvida, consulte o dono.'}
      </p>

      {abrindo ? (
        <div className="mt-2.5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-grafite-medio">R$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={String(total.toFixed(2))}
              className="flex-1 min-w-0 h-11 px-3 rounded-p border border-linha bg-superficie text-[15px] tabular-nums"
            />
            <button
              onClick={() => setValor(String(total.toFixed(2)))}
              className="h-11 px-3 rounded-p border border-linha text-[12.5px] font-semibold text-grafite-medio hover:text-grafite whitespace-nowrap"
            >
              Tudo
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={abater}
              disabled={salvando}
              className="flex-1 h-11 rounded-p bg-trena hover:bg-trena-escuro disabled:opacity-60 text-white font-bold text-[13.5px]"
            >
              {salvando ? 'Registrando…' : 'Confirmar recebimento'}
            </button>
            <button
              onClick={() => {
                setAbrindo(false);
                setErro('');
              }}
              className="h-11 px-3 rounded-p text-[13px] font-semibold text-grafite-medio hover:text-grafite"
            >
              Cancelar
            </button>
          </div>
          {erro && <p className="text-[12.5px] text-prumo font-semibold">{erro}</p>}
        </div>
      ) : (
        <button
          onClick={() => setAbrindo(true)}
          className="mt-2 h-11 px-3 rounded-p border border-trena/50 text-[13px] font-bold text-grafite hover:bg-trena/10"
        >
          Abater da dívida
        </button>
      )}
    </div>
  );
}

// ---------- Busca de cliente ----------
function BuscaCliente({ onSelecionar, onNovoCliente }) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (termo.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        setResultados(await vendasService.buscarClientes(termo.trim()));
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [termo]);

  return (
    <div>
      <div className="flex items-center gap-2 border-2 border-linha rounded-p px-3 focus-within:border-grafite">
        <Search size={16} className="text-grafite-medio shrink-0" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          className="flex-1 py-2.5 bg-transparent text-[14px] outline-none"
          autoFocus
        />
      </div>

      {termo.trim().length >= 2 && (
        <div className="mt-2 border border-linha rounded-p overflow-hidden">
          {buscando ? (
            <p className="text-[12.5px] text-grafite-medio px-3 py-2.5">Buscando…</p>
          ) : resultados.length > 0 ? (
            resultados.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => onSelecionar(c)}
                className="w-full text-left px-3 py-2.5 hover:bg-concreto border-b border-linha last:border-b-0"
              >
                <p className="text-[14px] font-semibold">{c.nome}</p>
                <p className="text-[12px] text-grafite-medio">{c.telefone}</p>
              </button>
            ))
          ) : (
            <div className="px-3 py-2.5 flex items-center justify-between">
              <span className="text-[12.5px] text-grafite-medio">Nenhum cliente encontrado.</span>
              <button
                onClick={onNovoCliente}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-trena hover:underline"
              >
                <UserPlus size={14} /> Cadastrar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => onSelecionar(null)}
          className="text-[12.5px] text-grafite-medio hover:text-grafite font-semibold"
        >
          ou continuar como <span className="underline">Consumidor</span>
        </button>
        <span className="text-linha">·</span>
        <button
          onClick={onNovoCliente}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-grafite-medio hover:text-grafite"
        >
          <UserPlus size={14} /> Novo cliente
        </button>
      </div>
    </div>
  );
}

// ---------- Busca de produto ----------
function BuscaProduto({ onAdicionar }) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setResultados(await vendasService.buscarProdutos(termo.trim()));
      } catch {
        setResultados([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [termo]);

  // fecha o dropdown ao clicar fora
  useEffect(() => {
    function aoClicarFora(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 border-2 border-linha rounded-p px-3 focus-within:border-grafite">
        <Plus size={16} className="text-grafite-medio shrink-0" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onFocus={() => setAberto(true)}
          onKeyDown={(e) => {
            // Enter adiciona o primeiro resultado e mantém o foco (fluxo rápido)
            if (e.key === 'Enter' && resultados.length > 0) {
              e.preventDefault();
              onAdicionar(resultados[0]);
              setTermo('');
            }
          }}
          placeholder="Adicionar item — busque um produto…"
          className="flex-1 py-2.5 bg-transparent text-[14px] outline-none"
        />
      </div>

      {aberto && resultados.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-superficie border border-linha rounded-p shadow-lg max-h-64 overflow-y-auto">
          {resultados.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onAdicionar(p);
                setTermo('');
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-concreto border-b border-linha last:border-b-0 flex items-center justify-between"
            >
              <span className="text-[14px] font-semibold">{p.nome}</span>
              <span className="text-[12.5px] text-grafite-medio tabular-nums">
                {moeda(p.preco_venda)} / {p.unidade}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Linha de item editável ----------
// Até sm: duas faixas (nome em cima, controles embaixo) — os controles somam
// ~310px fixos e não sobra largura para o nome do produto num celular.
// A partir de sm: tudo numa linha só, como era.
function LinhaItem({ item, onQuantidade, onPreco, onRemover }) {
  const subtotal = Number(item.quantidade || 0) * Number(item.preco_unitario || 0);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3">
      {/* nome + lixeira: no mobile a lixeira sobe para esta faixa */}
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold break-words sm:truncate">{item.nome}</p>
          <p className="text-[11.5px] text-grafite-medio">{item.unidade}</p>
        </div>
        <button
          onClick={onRemover}
          className="sm:hidden text-grafite-medio hover:text-prumo p-1 -m-1 shrink-0"
          title="Remover item"
          aria-label={`Remover ${item.nome}`}
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* controles: quantidade x preço = subtotal */}
      <div className="flex items-center gap-2 sm:gap-3">
        <SeletorQuantidade valor={item.quantidade} onChange={onQuantidade} />
        <span className="text-grafite-medio text-[13px]">×</span>
        <div className="flex items-center border border-linha rounded-p focus-within:border-grafite">
          <span className="text-[12px] text-grafite-medio pl-2">R$</span>
          <input
            type="number"
            value={item.preco_unitario}
            onChange={(e) => onPreco(e.target.value)}
            min="0"
            step="0.01"
            className="w-20 py-1.5 px-1.5 text-right text-[14px] font-semibold tabular-nums bg-transparent outline-none"
            title="Preço unitário"
          />
        </div>

        {/* no mobile o subtotal empurra para a direita e ganha rótulo */}
        <span className="flex-1 sm:flex-none sm:w-24 text-right text-[14px] font-bold tabular-nums">
          <span className="sm:hidden text-[11px] font-semibold text-grafite-medio mr-1">=</span>
          {moeda(subtotal)}
        </span>

        <button
          onClick={onRemover}
          className="hidden sm:block text-grafite-medio hover:text-prumo"
          title="Remover item"
          aria-label={`Remover ${item.nome}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------- Linha do resumo ----------
function LinhaResumo({ rotulo, valor }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-grafite-medio">{rotulo}</span>
      <span className="font-semibold tabular-nums">{valor}</span>
    </div>
  );
}

// ---------- Seletor de quantidade (dropdown 1-20 + Outro) ----------
function SeletorQuantidade({ valor, onChange }) {
  const num = Number(valor);
  // modo "livre" quando o valor não está na lista 1-20 (ex: fracionado ou grande)
  const naLista = Number.isInteger(num) && num >= 1 && num <= 20;
  const [livre, setLivre] = useState(!naLista);

  if (livre) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          min="0"
          step="any"
          autoFocus
          className="w-16 py-1.5 px-2 text-right text-[14px] font-semibold tabular-nums border border-linha rounded-p bg-superficie focus:border-grafite outline-none"
          title="Quantidade"
        />
        <button
          onClick={() => {
            setLivre(false);
            onChange(1);
          }}
          className="text-[11px] text-grafite-medio hover:text-grafite"
          title="Voltar à lista"
        >
          lista
        </button>
      </div>
    );
  }

  return (
    <select
      value={num}
      onChange={(e) => {
        if (e.target.value === 'outro') {
          setLivre(true);
        } else {
          onChange(Number(e.target.value));
        }
      }}
      className="w-16 py-1.5 px-2 text-[14px] font-semibold tabular-nums border border-linha rounded-p bg-superficie focus:border-grafite outline-none cursor-pointer"
      title="Quantidade"
    >
      {Array.from({ length: 20 }, (_, i) => i + 1).map((q) => (
        <option key={q} value={q}>
          {q}
        </option>
      ))}
      <option value="outro">Outro…</option>
    </select>
  );
}

// ---------- Modal novo cliente ----------
function ModalNovoCliente({ onFechar, onCriado }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim() || !telefone.trim()) {
      setErro('Preencha nome e telefone.');
      return;
    }
    setSalvando(true);
    try {
      const c = await vendasService.criarCliente({ nome: nome.trim(), telefone: telefone.trim() });
      onCriado(c);
    } catch (e) {
      setErro(e.message || 'Falha ao cadastrar.');
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onFechar}
    >
      <div
        className="bg-superficie rounded-md w-full max-w-[380px] my-auto p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-semibold">Novo cliente</p>
          <button onClick={onFechar} className="text-grafite-medio hover:text-grafite">
            <X size={18} />
          </button>
        </div>

        <label className="block mb-3">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-grafite-medio mb-1.5">
            Nome
          </span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            className="w-full py-2.5 px-3 text-[14px] border-2 border-linha rounded-p bg-superficie focus:border-grafite outline-none"
          />
        </label>
        <label className="block mb-4">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-grafite-medio mb-1.5">
            Telefone
          </span>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full py-2.5 px-3 text-[14px] border-2 border-linha rounded-p bg-superficie focus:border-grafite outline-none"
          />
        </label>

        {erro && <p className="text-[12.5px] text-prumo font-semibold mb-3">{erro}</p>}

        <div className="flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-p border border-linha text-[14px] font-semibold hover:bg-concreto"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex-1 py-2.5 rounded-p bg-trena hover:bg-trena-escuro text-white text-[14px] font-bold disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
