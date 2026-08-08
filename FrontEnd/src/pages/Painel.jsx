import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutApp from '../components/LayoutApp';
import { Botao, EstadoVazio } from '../components';
import GraficoArea from '../components/GraficoArea';
import { painelService } from '../services/painel';
import { api } from '../services/api';
import { moeda, numero } from '../utils/formato';
import {
  Banknote,
  Landmark,
  CreditCard,
  NotebookPen,
  Wallet,
  Receipt,
  ShoppingCart,
  Users,
} from 'lucide-react';

// Cores das formas de pagamento — escolhidas para ter contraste nos
// dois temas (evita grafite escuro que some no tema escuro).
const FORMAS = {
  dinheiro: { rotulo: 'Dinheiro', Icone: Banknote, cor: '#1B7A46' }, // verde
  pix: { rotulo: 'Pix', Icone: Landmark, cor: '#2AA9B8' },           // ciano (cor do Pix)
  cartao: { rotulo: 'Cartão', Icone: CreditCard, cor: '#7C6FE8' },   // roxo
  fiado: { rotulo: 'Fiado', Icone: NotebookPen, cor: '#D9A500' },    // trena
};

const PERIODOS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'ano', rotulo: 'Ano' },
];

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
        painelService.rankingClientes(per, 6),
        painelService.evolucaoFaturamento(per),
        painelService.produtosMaisVendidos(per, 6),
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

  const acaoTopbar = (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 bg-concreto rounded-p p-0.5">
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
      <button
        onClick={() => navigate('/vendas/nova')}
        className="h-8 px-4 rounded-p bg-trena hover:bg-trena-escuro text-white font-bold text-[13px] transition-colors"
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

  // recebimento por forma
  const porForma = Object.keys(FORMAS).map((f) => {
    const doTipo = vendas.filter((v) => v.forma_pagamento === f);
    return { forma: f, total: doTipo.reduce((s, v) => s + Number(v.valor_total), 0) };
  });
  const totalRecebido = porForma.reduce((s, x) => s + x.total, 0) || 1;

  const recentes = [...vendas]
    .sort((a, b) => new Date(b.vendida_em) - new Date(a.vendida_em))
    .slice(0, 6);

  const serie = evolucao.map((e) => {
    const d = new Date(e.dia);
    return { rotulo: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), valor: e.total };
  });

  // Tendência de cada KPI vs. período anterior (seta + %).
  // Estável quando |variação| < 1%. null = sem base de comparação.
  const tendencia = (pct) => {
    if (pct == null) return {};
    const sentido = Math.abs(pct) < 1 ? 'estavel' : pct > 0 ? 'sobe' : 'desce';
    return { chip: `${Math.abs(pct)}%`, sentido };
  };
  const v = resumo.variacao || {};
  const tFat = tendencia(v.total);
  const tTicket = tendencia(v.ticket_medio);
  const tVendas = tendencia(v.qtd_vendas);
  const tClientes = tendencia(v.clientes);

  // sub-informações dos KPIs
  const diasNoPeriodo = Math.max(serie.length, 1);
  const porDia = resumo.total / diasNoPeriodo;
  const clientesDistintos = resumo.clientes ?? 0;
  const comprasPorCliente = clientesDistintos ? resumo.qtd_vendas / clientesDistintos : 0;

  const maxCliente = Math.max(...ranking.map((c) => Number(c.total_gasto)), 1);
  const maxProduto = Math.max(...produtos.map((p) => Number(p.valor_total)), 1);

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
        <div className="flex flex-col gap-4">
          {/* ---- KPIs ---- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              Icone={Wallet}
              rotulo="Faturamento do período"
              valor={moeda(resumo.total)}
              destaque
              chip={tFat.chip}
              sentido={tFat.sentido}
              sub={`${moeda(porDia)} por dia em média`}
            />
            <Kpi
              Icone={Receipt}
              rotulo="Ticket médio"
              valor={moeda(resumo.ticket_medio)}
              chip={tTicket.chip}
              sentido={tTicket.sentido}
              sub="valor médio por venda"
            />
            <Kpi
              Icone={ShoppingCart}
              rotulo="Vendas realizadas"
              valor={numero(resumo.qtd_vendas)}
              chip={tVendas.chip}
              sentido={tVendas.sentido}
              sub={`${moeda(porDia)} por dia em média`}
            />
            <Kpi
              Icone={Users}
              rotulo="Clientes distintos"
              valor={numero(clientesDistintos)}
              chip={tClientes.chip}
              sentido={tClientes.sentido}
              sub={`${comprasPorCliente.toFixed(1)} compras por cliente`}
            />
          </div>

          {/* ---- Gráfico + Recebimento ---- */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">
            <Cartao titulo="Faturamento por dia">
              <div className="h-[280px]">
                <GraficoArea dados={serie} />
              </div>
            </Cartao>

            <Cartao titulo="Recebimento por forma de pagamento">
              <div className="flex flex-col gap-4">
                {porForma.map((x) => {
                  const pct = (x.total / totalRecebido) * 100;
                  const I = FORMAS[x.forma].Icone;
                  return (
                    <div key={x.forma}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[14px] font-semibold flex items-center gap-2">
                          <I size={16} strokeWidth={1.75} className="text-grafite-medio" />
                          {FORMAS[x.forma].rotulo}
                        </span>
                        <span className="text-[14px] font-bold tabular-nums">{moeda(x.total)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-concreto rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: FORMAS[x.forma].cor }}
                          />
                        </div>
                        <span className="text-[12px] text-grafite-medio tabular-nums w-9 text-right">
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-3 border-t border-linha">
                  <span className="text-[13px] text-grafite-medio font-semibold">Total recebido</span>
                  <span className="text-[15px] font-bold tabular-nums">{moeda(totalRecebido)}</span>
                </div>
              </div>
            </Cartao>
          </div>

          {/* ---- Rankings com barra de proporção ---- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Cartao titulo="Clientes que mais compraram" acao="Ver todos" onAcao={() => navigate('/clientes')}>
              {ranking.map((c, i) => (
                <LinhaBarra
                  key={c.cliente_id ?? `c-${i}`}
                  pos={i + 1}
                  nome={c.cliente_nome}
                  meta={`${c.qtd_compras} compras`}
                  valor={moeda(c.total_gasto)}
                  proporcao={Number(c.total_gasto) / maxCliente}
                  cor="#1B7A46"
                />
              ))}
            </Cartao>

            <Cartao titulo="Produtos mais vendidos" acao="Ver todos" onAcao={() => navigate('/produtos')}>
              {produtos.map((p, i) => (
                <LinhaBarra
                  key={p.produto_id ?? `p-${i}`}
                  pos={i + 1}
                  nome={p.produto_nome}
                  meta={`${numero(p.quantidade_total)} un.`}
                  valor={moeda(p.valor_total)}
                  proporcao={Number(p.valor_total) / maxProduto}
                  cor="#0E7C86"
                />
              ))}
            </Cartao>
          </div>

          {/* ---- Vendas recentes (tabela) ---- */}
          <Cartao titulo="Vendas recentes" acao="Ver todas as vendas" onAcao={() => navigate('/vendas')}>
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-bold tracking-[0.08em] uppercase text-grafite-medio">
                  <th className="text-left pb-3 font-bold">Cliente</th>
                  {/* Pagamento e Data saem no mobile — viram a segunda linha do Cliente. */}
                  <th className="text-left pb-3 font-bold hidden sm:table-cell">Pagamento</th>
                  <th className="text-left pb-3 font-bold hidden sm:table-cell">Data</th>
                  <th className="text-right pb-3 font-bold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((v) => (
                  <tr key={v.id} className="border-t border-linha text-[14px]">
                    <td className="py-3 font-semibold">
                      {v.cliente_nome || 'Consumidor'}
                      {/* No mobile, pagamento e data descem para cá. */}
                      <span className="flex sm:hidden items-center gap-1.5 mt-1 text-[12px] font-normal text-grafite-medio">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: FORMAS[v.forma_pagamento]?.cor }} />
                        {FORMAS[v.forma_pagamento]?.rotulo || v.forma_pagamento}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {new Date(v.vendida_em).toLocaleDateString('pt-BR')}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-2 text-grafite-medio">
                        <span className="w-2 h-2 rounded-full" style={{ background: FORMAS[v.forma_pagamento]?.cor }} />
                        {FORMAS[v.forma_pagamento]?.rotulo || v.forma_pagamento}
                      </span>
                    </td>
                    <td className="py-3 text-grafite-medio tabular-nums hidden sm:table-cell">
                      {new Date(v.vendida_em).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 text-right font-bold tabular-nums">{moeda(v.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        </div>
      )}
    </LayoutApp>
  );
}

// ---------- Componentes ----------

function Cartao({ titulo, acao, onAcao, children }) {
  return (
    <div className="bg-superficie border border-linha rounded-md px-5 py-4">
      {titulo && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-semibold text-grafite">{titulo}</p>
          {acao && (
            <button onClick={onAcao} className="text-[12.5px] font-semibold text-grafite-medio hover:text-grafite">
              {acao}
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function Kpi({ Icone, rotulo, valor, sub, chip, sentido, destaque = false }) {
  // sentido: 'sobe' (verde) | 'desce' (vermelho) | 'estavel' (cinza)
  const corChip =
    sentido === 'sobe'
      ? 'bg-nivel/10 text-nivel'
      : sentido === 'desce'
        ? 'bg-prumo/10 text-prumo'
        : 'bg-grafite-medio/10 text-grafite-medio';
  const seta = sentido === 'sobe' ? '↗' : sentido === 'desce' ? '↘' : '→';

  return (
    // 3 zonas de ALTURA FIXA para os 4 cards baterem exatamente:
    // topo (24px), número+chip (36px), rodapé subtexto (20px).
    // O card de destaque (faturamento) tem fundo verde claro.
    <div className="relative overflow-hidden rounded-md px-5 py-4 border bg-superficie border-linha">
      {/* card de destaque: só o acento lateral verde, fundo branco como os demais */}
      {destaque && <div className="absolute left-0 top-0 bottom-0 w-1 bg-nivel" />}

      {/* topo: rótulo + ícone */}
      <div className="h-[24px] flex items-start justify-between">
        <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio leading-tight">
          {rotulo}
        </p>
        {Icone && <Icone size={17} strokeWidth={1.75} className="text-grafite-medio/50 shrink-0" />}
      </div>

      {/* número + chip de tendência ao lado */}
      <div className="h-[36px] flex items-end gap-2">
        <p className="leading-none tabular-nums tracking-[-0.01em] text-[27px] text-grafite font-ui font-bold">
          {valor}
        </p>
        {chip && (
          <span className={`mb-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums ${corChip}`}>
            {seta} {chip}
          </span>
        )}
      </div>

      {/* rodapé: subtexto */}
      <div className="h-[20px] mt-2.5 flex items-center">
        {sub && <p className="text-[12px] text-grafite-medio">{sub}</p>}
      </div>
    </div>
  );
}

// Linha de ranking com barra de proporção sob o nome.
function LinhaBarra({ pos, nome, meta, valor, proporcao, cor }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-linha last:border-b-0">
      <span className="w-5 font-ui font-semibold text-[13px] text-grafite-medio tabular-nums text-center shrink-0">
        {pos}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold truncate mb-1.5">{nome}</p>
        <div className="h-1 bg-concreto rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.max(proporcao * 100, 3)}%`, background: cor }} />
        </div>
      </div>
      <span className="text-[12px] text-grafite-medio tabular-nums whitespace-nowrap w-20 text-right">
        {meta}
      </span>
      <span className="text-[14px] font-bold tabular-nums whitespace-nowrap w-24 text-right">{valor}</span>
    </div>
  );
}

function PainelEsqueleto() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-superficie border border-linha rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-[1.7fr_1fr] gap-4">
        <div className="h-80 bg-superficie border border-linha rounded-md" />
        <div className="h-80 bg-superficie border border-linha rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-56 bg-superficie border border-linha rounded-md" />
        <div className="h-56 bg-superficie border border-linha rounded-md" />
      </div>
    </div>
  );
}
