import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutApp from '../components/LayoutApp';
import { Botao, EstadoVazio, GraficoBarras } from '../components';
import { painelService } from '../services/painel';
import { api } from '../services/api';
import { moedaCurta, moeda, numero } from '../utils/formato';

const FORMAS = {
  dinheiro: { rotulo: 'Dinheiro', cor: '#1B7A46' },
  pix: { rotulo: 'Pix', cor: '#16191D' },
  cartao: { rotulo: 'Cartão', cor: '#565D66' },
  fiado: { rotulo: 'Fiado', cor: '#FFC400' },
};

const PERIODOS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'ano', rotulo: 'Ano' },
];

// Painel de indicadores (RF16–RF22). Grade modular com filtro de período.
export default function Painel() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState('mes');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);

  const carregar = useCallback(async (per) => {
    setErro('');
    try {
      const [faturamento, resumo, ranking, evolucao, produtos, vendas] = await Promise.all([
        painelService.faturamento(),
        painelService.resumo(per),
        painelService.rankingClientes(per, 5),
        painelService.evolucaoFaturamento(per),
        painelService.produtosMaisVendidos(per, 5),
        api.get('/vendas?status=concluida'),
      ]);
      setDados({ faturamento, resumo, ranking, evolucao, produtos, vendas });
    } catch {
      setErro('Não foi possível carregar os indicadores.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    setCarregando(true);
    carregar(periodo);
  }, [periodo, carregar]);

  const periodoLabel = new Date()
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .toUpperCase();

  // Barra de filtros + ação — sempre visível
  const filtros = (
    <div className="flex items-center gap-1 bg-concreto rounded-p p-0.5">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          onClick={() => setPeriodo(p.id)}
          className={`px-3 py-1 rounded-[4px] text-[12px] font-bold transition-colors ${
            periodo === p.id
              ? 'bg-superficie text-grafite shadow-sm'
              : 'text-grafite-medio hover:text-grafite'
          }`}
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  );

  const acaoTopbar = (
    <div className="flex items-center gap-3">
      {filtros}
      <button
        onClick={() => navigate('/vendas/nova')}
        className="h-8 px-4 rounded-p bg-trena hover:bg-trena-escuro text-grafite font-bold text-[13px] transition-colors"
      >
        + Nova venda
      </button>
    </div>
  );

  if (carregando || erro) {
    return (
      <LayoutApp titulo="Painel" periodo={periodoLabel} acao={acaoTopbar}>
        {erro ? (
          <div className="text-prumo font-semibold text-center py-10">{erro}</div>
        ) : (
          <PainelEsqueleto />
        )}
      </LayoutApp>
    );
  }

  const { faturamento, resumo, ranking, evolucao, produtos, vendas } = dados;
  const semVendas = resumo.qtd_vendas === 0;

  // Breakdown por forma de pagamento
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

  const recentes = [...vendas]
    .sort((a, b) => new Date(b.vendida_em) - new Date(a.vendida_em))
    .slice(0, 6);

  const serie = evolucao.map((e) => {
    const d = new Date(e.dia);
    return { rotulo: String(d.getUTCDate()), valor: e.total };
  });

  const variacao =
    faturamento.variacao_pct == null
      ? null
      : `${Math.abs(faturamento.variacao_pct)}% vs. mês anterior`;
  const sentido =
    faturamento.variacao_pct == null
      ? undefined
      : faturamento.variacao_pct >= 0
        ? 'sobe'
        : 'desce';

  return (
    <LayoutApp titulo="Painel" periodo={periodoLabel} acao={acaoTopbar}>
      {semVendas ? (
        <EstadoVazio
          titulo="Nenhuma venda no período"
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
        // GRADE MODULAR: 12 colunas, linhas de altura fixa que preenchem a tela
        <div className="grid grid-cols-12 auto-rows-[minmax(0,1fr)] gap-3 h-[calc(100vh-56px-32px)] min-h-[600px]">
          {/* ---- LINHA 1: KPIs (4 módulos) ---- */}
          <KpiModulo
            className="col-span-3"
            rotulo="Faturamento"
            valor={moedaCurta(faturamento.mes_atual)}
            variacao={variacao}
            sentido={sentido}
            destaque
          />
          <KpiModulo
            className="col-span-3"
            rotulo="Ticket médio"
            valor={moedaCurta(resumo.ticket_medio)}
          />
          <KpiModulo
            className="col-span-3"
            rotulo="Vendas"
            valor={numero(resumo.qtd_vendas)}
          />
          <KpiModulo
            className="col-span-3"
            rotulo="Nº de clientes"
            valor={numero(ranking.filter((r) => r.cliente_id).length)}
          />

          {/* ---- LINHA 2-3: gráfico grande (esq) + clientes (dir) ---- */}
          <Modulo className="col-span-8 row-span-2" titulo="Faturamento por dia" extra={periodoLabel}>
            <div className="flex-1 min-h-0">
              <GraficoBarras dados={serie} preencher />
            </div>
          </Modulo>

          <Modulo className="col-span-4 row-span-2" titulo="Quem mais comprou" extra={`Top ${ranking.length}`}>
            <ListaCartao vazio={ranking.length === 0} textoVazio="Sem clientes.">
              {ranking.slice(0, 5).map((c, i) => (
                <LinhaRank
                  key={c.cliente_id ?? `c-${i}`}
                  pos={i + 1}
                  nome={c.cliente_nome}
                  meta={`${c.qtd_compras} ${c.qtd_compras === 1 ? 'compra' : 'compras'}`}
                  valor={moeda(c.total_gasto)}
                />
              ))}
            </ListaCartao>
          </Modulo>

          {/* ---- LINHA 4-5: 3 módulos embaixo ---- */}
          <Modulo className="col-span-4 row-span-2" titulo="Produtos mais vendidos" extra={`Top ${produtos.length}`}>
            <ListaCartao vazio={produtos.length === 0} textoVazio="Sem produtos.">
              {produtos.slice(0, 5).map((p, i) => (
                <LinhaRank
                  key={p.produto_id ?? `p-${i}`}
                  pos={i + 1}
                  nome={p.produto_nome}
                  meta={`${numero(p.quantidade_total)} un.`}
                  valor={moeda(p.valor_total)}
                />
              ))}
            </ListaCartao>
          </Modulo>

          <Modulo className="col-span-4 row-span-2" titulo="Recebimento por forma" extra="Composição">
            <div className="flex-1 flex flex-col justify-center gap-2.5">
              <div className="flex h-2.5 rounded-full overflow-hidden">
                {porForma.map((x) => (
                  <div
                    key={x.forma}
                    style={{ width: `${(x.total / totalPago) * 100}%`, background: FORMAS[x.forma].cor }}
                    title={`${FORMAS[x.forma].rotulo}: ${moeda(x.total)}`}
                  />
                ))}
              </div>
              {porForma.map((x) => (
                <div key={x.forma} className="flex items-center gap-2 py-1 border-b border-linha last:border-b-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: FORMAS[x.forma].cor }} />
                  <span className="text-[12.5px] font-semibold flex-1">{FORMAS[x.forma].rotulo}</span>
                  <span className="text-[11px] text-grafite-medio w-9 text-right">
                    {Math.round((x.total / totalPago) * 100)}%
                  </span>
                  <span className="text-[12.5px] font-bold tabular-nums w-20 text-right">
                    {moeda(x.total)}
                  </span>
                </div>
              ))}
            </div>
          </Modulo>

          <Modulo className="col-span-4 row-span-2" titulo="Vendas recentes" extra={`${vendas.length}`}>
            <ListaCartao vazio={recentes.length === 0} textoVazio="Nenhuma venda.">
              {recentes.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-center gap-2.5 py-1 border-b border-linha last:border-b-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: FORMAS[v.forma_pagamento]?.cor || '#565D66' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold truncate leading-tight">
                      {v.cliente_nome || 'Consumidor'}
                    </p>
                    <p className="text-[10.5px] text-grafite-medio leading-tight">
                      {FORMAS[v.forma_pagamento]?.rotulo || v.forma_pagamento} ·{' '}
                      {new Date(v.vendida_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                  <span className="font-bold text-[12.5px] tabular-nums whitespace-nowrap">
                    {moeda(v.valor_total)}
                  </span>
                </div>
              ))}
            </ListaCartao>
          </Modulo>
        </div>
      )}
    </LayoutApp>
  );
}

// ---------- Módulos da grade ----------

// Módulo genérico: cartão que preenche sua célula da grade.
function Modulo({ className = '', titulo, extra, children }) {
  return (
    <div className={`bg-superficie border border-linha rounded-md px-4 py-3 flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between mb-2 shrink-0">
        <p className="text-[10.5px] font-bold tracking-[0.1em] uppercase text-grafite-medio">{titulo}</p>
        {extra && <span className="text-[10.5px] text-grafite-medio">{extra}</span>}
      </div>
      {children}
    </div>
  );
}

// KPI como módulo da grade (preenche a célula).
function KpiModulo({ className = '', rotulo, valor, variacao, sentido, destaque = false }) {
  const seta = sentido === 'sobe' ? '↑' : sentido === 'desce' ? '↓' : '';
  const base = destaque ? 'bg-grafite text-superficie' : 'bg-superficie border border-linha';
  const corRotulo = destaque ? 'text-[#A8B0B8]' : 'text-grafite-medio';
  const corVar =
    sentido === 'sobe'
      ? destaque ? 'text-[#5fcf94]' : 'text-nivel'
      : sentido === 'desce'
        ? destaque ? 'text-[#ff8a7a]' : 'text-prumo'
        : 'text-grafite-medio';

  return (
    <div className={`relative overflow-hidden rounded-md px-4 flex flex-col justify-center ${base} ${className}`}>
      {destaque && <div className="absolute left-0 top-0 bottom-0 w-1 bg-trena" />}
      <p className={`text-[10.5px] font-bold tracking-[0.09em] uppercase ${corRotulo}`}>{rotulo}</p>
      <p className="font-display text-[24px] leading-none mt-1 tabular-nums tracking-[-0.02em]">{valor}</p>
      {variacao && <p className={`text-[11px] font-bold mt-1 tabular-nums ${corVar}`}>{seta} {variacao}</p>}
    </div>
  );
}

// Lista que estica e distribui as linhas dentro do módulo.
function ListaCartao({ vazio, textoVazio, children }) {
  if (vazio) {
    return (
      <div className="flex-1 flex items-center">
        <p className="text-[12px] text-grafite-medio">{textoVazio}</p>
      </div>
    );
  }
  return <div className="flex-1 flex flex-col justify-around min-h-0">{children}</div>;
}

// Linha de ranking compacta.
function LinhaRank({ pos, nome, meta, valor }) {
  return (
    <div className="flex items-center gap-2.5 py-1 border-b border-linha last:border-b-0">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center font-display text-[11px] shrink-0 ${
          pos === 1 ? 'bg-trena text-grafite' : 'bg-concreto text-grafite-medio'
        }`}
      >
        {pos}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold truncate leading-tight">{nome}</p>
        <p className="text-[10.5px] text-grafite-medio leading-tight">{meta}</p>
      </div>
      <span className="font-bold text-[12.5px] tabular-nums whitespace-nowrap">{valor}</span>
    </div>
  );
}

// Esqueleto de carregamento — silhueta da grade.
function PainelEsqueleto() {
  return (
    <div className="grid grid-cols-12 auto-rows-[minmax(0,1fr)] gap-3 h-[calc(100vh-56px-32px)] min-h-[600px] animate-pulse">
      <div className="col-span-3 bg-grafite/80 rounded-md" />
      <div className="col-span-3 bg-superficie border border-linha rounded-md" />
      <div className="col-span-3 bg-superficie border border-linha rounded-md" />
      <div className="col-span-3 bg-superficie border border-linha rounded-md" />
      <div className="col-span-8 row-span-2 bg-superficie border border-linha rounded-md" />
      <div className="col-span-4 row-span-2 bg-superficie border border-linha rounded-md" />
      <div className="col-span-4 row-span-2 bg-superficie border border-linha rounded-md" />
      <div className="col-span-4 row-span-2 bg-superficie border border-linha rounded-md" />
      <div className="col-span-4 row-span-2 bg-superficie border border-linha rounded-md" />
    </div>
  );
}
