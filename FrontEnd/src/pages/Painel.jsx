import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutApp from '../components/LayoutApp';
import { Kpi, Lista, Item, Botao, EstadoVazio, GraficoBarras } from '../components';
import { painelService } from '../services/painel';
import { moedaCurta, moeda, numero } from '../utils/formato';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

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
        const [faturamento, resumo, ranking, evolucao] = await Promise.all([
          painelService.faturamento(),
          painelService.resumo('mes'),
          painelService.rankingClientes('mes', 5),
          painelService.evolucaoFaturamento('mes'),
        ]);
        if (ativo) setDados({ faturamento, resumo, ranking, evolucao });
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
      <LayoutApp titulo="PRUMO" periodo={periodoLabel}>
        <PainelEsqueleto />
      </LayoutApp>
    );
  }

  if (erro) {
    return (
      <LayoutApp titulo="PRUMO" periodo={periodoLabel}>
        <div className="text-prumo font-semibold text-center py-10">{erro}</div>
      </LayoutApp>
    );
  }

  const { faturamento, resumo, ranking, evolucao } = dados;
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
    <LayoutApp titulo="PRUMO" periodo={periodoLabel}>
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
        <div className="flex flex-col gap-4">
          {/* KPI principal — faturamento do mês */}
          <Kpi
            rotulo="Faturamento do mês"
            valor={moedaCurta(faturamento.mes_atual)}
            variacao={variacao}
            sentido={sentido}
          />

          {/* KPIs secundários */}
          <div className="grid grid-cols-2 gap-4">
            <Kpi rotulo="Ticket médio" valor={moedaCurta(resumo.ticket_medio)} />
            <Kpi rotulo="Vendas no mês" valor={numero(resumo.qtd_vendas)} />
          </div>

          {/* Evolução (gráfico) */}
          <div className="bg-superficie border border-linha rounded-g p-4">
            <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-grafite-medio mb-2">
              Faturamento por dia
            </p>
            <GraficoBarras dados={serie} />
          </div>

          {/* Ranking de clientes */}
          <div>
            <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-grafite-medio mb-2 px-1">
              Quem mais comprou
            </p>
            {ranking.length === 0 ? (
              <p className="text-[13.5px] text-grafite-medio px-1">Sem clientes no período.</p>
            ) : (
              <Lista>
                {ranking.map((c, i) => (
                  <Item
                    key={c.cliente_id ?? `consumidor-${i}`}
                    posicao={i + 1}
                    nome={c.cliente_nome}
                    meta={`${c.qtd_compras} ${c.qtd_compras === 1 ? 'compra' : 'compras'}`}
                    valor={moeda(c.total_gasto)}
                  />
                ))}
              </Lista>
            )}
          </div>

          {/* ação principal */}
          <div className="mt-2">
            <Botao variante="primario" onClick={() => navigate('/vendas/nova')}>
              Nova venda
            </Botao>
          </div>
        </div>
      )}
    </LayoutApp>
  );
}

// Esqueleto de carregamento — silhueta dos cartões.
function PainelEsqueleto() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-28 bg-superficie border border-linha rounded-g" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-superficie border border-linha rounded-g" />
        <div className="h-24 bg-superficie border border-linha rounded-g" />
      </div>
      <div className="h-40 bg-superficie border border-linha rounded-g" />
    </div>
  );
}
