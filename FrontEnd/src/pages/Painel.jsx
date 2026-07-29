import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutApp from '../components/LayoutApp';
import { Kpi, Botao, EstadoVazio, GraficoBarras } from '../components';
import { painelService } from '../services/painel';
import { api } from '../services/api';
import { moedaCurta, moeda, numero } from '../utils/formato';

const FORMAS = {
  dinheiro: { rotulo: 'Dinheiro', cor: '#1B7A46' },
  pix: { rotulo: 'Pix', cor: '#16191D' },
  cartao: { rotulo: 'Cartão', cor: '#565D66' },
  fiado: { rotulo: 'Fiado', cor: '#FFC400' },
};

// Painel de indicadores (RF16–RF22). Abre direto no faturamento.
export default function Painel() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [faturamento, resumo, ranking, evolucao, produtos, vendas] = await Promise.all([
          painelService.faturamento(),
          painelService.resumo('mes'),
          painelService.rankingClientes('mes', 5),
          painelService.evolucaoFaturamento('mes'),
          painelService.produtosMaisVendidos('mes', 5),
          api.get('/vendas?status=concluida'),
        ]);
        if (ativo) setDados({ faturamento, resumo, ranking, evolucao, produtos, vendas });
      } catch {
        if (ativo) setErro('Não foi possível carregar os indicadores.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const periodoLabel = new Date()
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .toUpperCase();

  if (carregando) {
    return (
      <LayoutApp titulo="Painel" periodo={periodoLabel}>
        <PainelEsqueleto />
      </LayoutApp>
    );
  }

  if (erro) {
    return (
      <LayoutApp titulo="Painel" periodo={periodoLabel}>
        <div className="text-prumo font-semibold text-center py-10">{erro}</div>
      </LayoutApp>
    );
  }

  const { faturamento, resumo, ranking, evolucao, produtos, vendas } = dados;

  // Breakdown por forma de pagamento (derivado das vendas concluídas)
  const porForma = Object.keys(FORMAS)
    .map((f) => {
      const doTipo = vendas.filter((v) => v.forma_pagamento === f);
      return {
        forma: f,
        total: doTipo.reduce((s, v) => s + Number(v.valor_total), 0),
        qtd: doTipo.length,
      };
    })
    .filter((x) => x.qtd > 0)
    .sort((a, b) => b.total - a.total);
  const totalPago = porForma.reduce((s, x) => s + x.total, 0) || 1;

  // Vendas recentes (as últimas lançadas)
  const recentes = [...vendas]
    .sort((a, b) => new Date(b.vendida_em) - new Date(a.vendida_em))
    .slice(0, 5);
  const semVendas = resumo.qtd_vendas === 0;

  // prepara série do gráfico (dia -> rótulo curto)
  const serie = evolucao.map((e) => {
    const d = new Date(e.dia);
    return { rotulo: String(d.getUTCDate()), valor: e.total };
  });

  const variacao =
    faturamento.variacao_pct == null
      ? null
      : `${Math.abs(faturamento.variacao_pct)}% sobre o mês anterior`;
  const sentido =
    faturamento.variacao_pct == null
      ? undefined
      : faturamento.variacao_pct >= 0
        ? 'sobe'
        : 'desce';

  return (
    <LayoutApp
      titulo="Painel"
      periodo={periodoLabel}
      acao={
        <button
          onClick={() => navigate('/vendas/nova')}
          className="h-8 px-4 rounded-p bg-trena hover:bg-trena-escuro text-grafite font-bold text-[13px] transition-colors"
        >
          + Nova venda
        </button>
      }
    >
      {semVendas ? (
        <EstadoVazio
          titulo="Nenhuma venda ainda este mês"
          acao={
            <div className="max-w-[280px] mx-auto">
              <Botao variante="primario" onClick={() => navigate('/vendas/nova')}>
                Nova venda
              </Botao>
            </div>
          }
        >
          Lance a primeira venda e os números do painel começam a aparecer.
        </EstadoVazio>
      ) : (
        <div className="flex flex-col gap-3 max-w-[1400px]">
          {/* KPIs compactos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <Kpi
                heroi
                icone="💰"
                rotulo="Faturamento do mês"
                valor={moedaCurta(faturamento.mes_atual)}
                variacao={variacao}
                sentido={sentido}
              />
            </div>
            <Kpi icone="🎯" rotulo="Ticket médio" valor={moedaCurta(resumo.ticket_medio)} />
            <Kpi icone="🧾" rotulo="Vendas no mês" valor={numero(resumo.qtd_vendas)} />
          </div>

          {/* Gráfico — largura total, altura contida */}
          <Cartao>
            <CabecalhoCartao titulo="Faturamento por dia" extra={periodoLabel} />
            <GraficoBarras dados={serie} />
          </Cartao>

          {/* Duas listas lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Cartao>
              <CabecalhoCartao titulo="Quem mais comprou" extra={`Top ${ranking.length}`} />
              {ranking.length === 0 ? (
                <p className="text-[12.5px] text-grafite-medio">Sem clientes no período.</p>
              ) : (
                ranking.slice(0, 5).map((c, i) => (
                  <LinhaRank
                    key={c.cliente_id ?? `c-${i}`}
                    pos={i + 1}
                    nome={c.cliente_nome}
                    meta={`${c.qtd_compras} ${c.qtd_compras === 1 ? 'compra' : 'compras'}`}
                    valor={moeda(c.total_gasto)}
                  />
                ))
              )}
            </Cartao>

            <Cartao>
              <CabecalhoCartao titulo="Produtos mais vendidos" extra={`Top ${produtos.length}`} />
              {produtos.length === 0 ? (
                <p className="text-[12.5px] text-grafite-medio">Sem produtos no período.</p>
              ) : (
                produtos.slice(0, 5).map((p, i) => (
                  <LinhaRank
                    key={p.produto_id ?? `p-${i}`}
                    pos={i + 1}
                    nome={p.produto_nome}
                    meta={`${numero(p.quantidade_total)} un. vendidas`}
                    valor={moeda(p.valor_total)}
                  />
                ))
              )}
            </Cartao>
          </div>

          {/* Terceira linha: formas de pagamento | vendas recentes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Cartao>
              <CabecalhoCartao titulo="Recebimento por forma" extra="No mês" />
              {porForma.length === 0 ? (
                <p className="text-[12.5px] text-grafite-medio">Sem recebimentos.</p>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  {/* barra de composição */}
                  <div className="flex h-2 rounded-full overflow-hidden">
                    {porForma.map((x) => (
                      <div
                        key={x.forma}
                        style={{ width: `${(x.total / totalPago) * 100}%`, background: FORMAS[x.forma].cor }}
                        title={`${FORMAS[x.forma].rotulo}: ${moeda(x.total)}`}
                      />
                    ))}
                  </div>
                  {/* legenda */}
                  {porForma.map((x) => (
                    <div key={x.forma} className="flex items-center gap-2 py-0.5">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: FORMAS[x.forma].cor }} />
                      <span className="text-[13px] font-semibold flex-1">{FORMAS[x.forma].rotulo}</span>
                      <span className="text-[11px] text-grafite-medio">
                        {Math.round((x.total / totalPago) * 100)}%
                      </span>
                      <span className="text-[13px] font-bold tabular-nums w-24 text-right">
                        {moeda(x.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Cartao>

            <Cartao>
              <CabecalhoCartao titulo="Vendas recentes" extra={`${vendas.length} no mês`} />
              {recentes.length === 0 ? (
                <p className="text-[12.5px] text-grafite-medio">Nenhuma venda.</p>
              ) : (
                recentes.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-2.5 py-1.5 border-b border-linha last:border-b-0"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: FORMAS[v.forma_pagamento]?.cor || '#565D66' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate leading-tight">
                        {v.cliente_nome || 'Consumidor'}
                      </p>
                      <p className="text-[11px] text-grafite-medio leading-tight">
                        {FORMAS[v.forma_pagamento]?.rotulo || v.forma_pagamento} ·{' '}
                        {new Date(v.vendida_em).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className="font-bold text-[13px] tabular-nums whitespace-nowrap">
                      {moeda(v.valor_total)}
                    </span>
                  </div>
                ))
              )}
            </Cartao>
          </div>
        </div>
      )}
    </LayoutApp>
  );
}

// Cartão base compacto.
function Cartao({ children }) {
  return (
    <div className="bg-superficie border border-linha rounded-md px-4 py-3">{children}</div>
  );
}

// Cabeçalho de cartão (rótulo + extra à direita).
function CabecalhoCartao({ titulo, extra }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10.5px] font-bold tracking-[0.1em] uppercase text-grafite-medio">
        {titulo}
      </p>
      {extra && <span className="text-[10.5px] text-grafite-medio">{extra}</span>}
    </div>
  );
}

// Linha de ranking compacta.
function LinhaRank({ pos, nome, meta, valor }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-linha last:border-b-0">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center font-display text-[11px] shrink-0 ${
          pos === 1 ? 'bg-trena text-grafite' : 'bg-concreto text-grafite-medio'
        }`}
      >
        {pos}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold truncate leading-tight">{nome}</p>
        <p className="text-[11px] text-grafite-medio leading-tight">{meta}</p>
      </div>
      <span className="font-bold text-[13px] tabular-nums whitespace-nowrap">{valor}</span>
    </div>
  );
}

// Esqueleto de carregamento — silhueta do novo layout.
function PainelEsqueleto() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-10 w-64 bg-superficie border border-linha rounded-g" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 h-32 bg-grafite/80 rounded-g" />
        <div className="h-32 bg-superficie border border-linha rounded-g" />
        <div className="h-32 bg-superficie border border-linha rounded-g" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-56 bg-superficie border border-linha rounded-g" />
        <div className="h-56 bg-superficie border border-linha rounded-g" />
      </div>
    </div>
  );
}
