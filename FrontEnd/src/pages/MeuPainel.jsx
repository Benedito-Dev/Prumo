import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutApp from '../components/LayoutApp';
import { Botao, EstadoVazio } from '../components';
import GraficoArea from '../components/GraficoArea';
import { painelService } from '../services/painel';
import { useAuth } from '../auth/AuthContext';
import { moeda, numero } from '../utils/formato';
import { Wallet, Receipt, ShoppingCart } from 'lucide-react';

// Painel do vendedor — o que ELE vendeu, nunca a loja.
//
// O painel do dono (Painel.jsx) mostra faturamento da loja, ranking de
// clientes e o quanto cada colega vendeu. Nada disso é do balcão: a lista de
// melhores clientes é o ativo da loja, e comparar vendedores entre si é
// assunto de quem administra. As rotas correspondentes são requireDono, e
// esta tela existe para que trancá-las não deixasse o vendedor com uma tela
// de erro na entrada do sistema.
//
// Aqui não há comparação com período anterior de propósito: no painel do
// dono a tendência orienta decisão; aqui viraria cobrança silenciosa em cima
// de quem só quer saber como foi o próprio dia.
const PERIODOS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'ano', rotulo: 'Ano' },
];

export default function MeuPainel() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState('hoje');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);

  const carregar = useCallback(async (per) => {
    setErro('');
    try {
      const [resumo, evolucao] = await Promise.all([
        painelService.meuResumo(per),
        painelService.minhaEvolucao(per),
      ]);
      setDados({ resumo, evolucao });
    } catch {
      setErro('Não foi possível carregar seus números.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    setCarregando(true);
    carregar(periodo);
  }, [periodo, carregar]);

  const trilhoPeriodos = (
    <div className="flex items-center gap-0.5 bg-concreto rounded-p p-0.5">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          onClick={() => setPeriodo(p.id)}
          className={`flex-1 px-3 py-1 rounded-[4px] text-[12px] font-bold transition-colors ${
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

  // Mesma divisão da topbar do painel do dono: o trilho só cabe a partir de
  // md; abaixo disso desce para o corpo.
  const acaoTopbar = (
    <div className="flex items-center gap-2">
      <div className="hidden md:block">{trilhoPeriodos}</div>
      <button
        onClick={() => navigate('/vendas/nova')}
        className="h-8 px-3 sm:px-4 rounded-p bg-trena hover:bg-trena-escuro text-white font-bold text-[13px] transition-colors whitespace-nowrap"
      >
        <span className="sm:hidden">+ Venda</span>
        <span className="hidden sm:inline">+ Nova venda</span>
      </button>
    </div>
  );

  const periodosNoCorpo = <div className="md:hidden mb-4">{trilhoPeriodos}</div>;

  // O primeiro nome basta: é a tela dele, não um cabeçalho de relatório.
  const primeiroNome = usuario?.nome?.split(' ')[0] || '';
  const titulo = primeiroNome ? `Olá, ${primeiroNome}` : 'Minhas vendas';

  if (carregando || erro) {
    return (
      <LayoutApp titulo={titulo} acao={acaoTopbar}>
        {periodosNoCorpo}
        {erro ? (
          <div className="text-prumo font-semibold text-center py-10">{erro}</div>
        ) : (
          <MeuPainelEsqueleto />
        )}
      </LayoutApp>
    );
  }

  const { resumo, evolucao } = dados;
  const semVendas = resumo.qtd_vendas === 0;

  const serie = evolucao.map((e) => {
    const d = new Date(e.dia);
    return {
      rotulo: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      valor: e.total,
    };
  });

  return (
    <LayoutApp titulo={titulo} acao={acaoTopbar}>
      {periodosNoCorpo}
      {semVendas ? (
        <EstadoVazio
          titulo="Nenhuma venda sua no período"
          acao={
            <div className="max-w-[280px] mx-auto">
              <Botao variante="primario" onClick={() => navigate('/vendas/nova')}>
                Nova venda
              </Botao>
            </div>
          }
        >
          Lance uma venda e seus números aparecem aqui.
        </EstadoVazio>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiSimples
              Icone={Wallet}
              rotulo="Você vendeu"
              valor={moeda(resumo.total)}
              destaque
            />
            <KpiSimples
              Icone={ShoppingCart}
              rotulo="Vendas lançadas"
              valor={numero(resumo.qtd_vendas)}
            />
            <KpiSimples
              Icone={Receipt}
              rotulo="Ticket médio"
              valor={moeda(resumo.ticket_medio)}
              sub="valor médio por venda"
            />
          </div>

          {/* Um dia só não faz linha: o gráfico aparece a partir de dois
              pontos, senão o período "Hoje" mostra um traço solto. */}
          {serie.length > 1 && (
            <div className="bg-superficie border border-linha rounded-md px-5 py-4">
              <p className="text-[15px] font-semibold text-grafite mb-4">
                Suas vendas por dia
              </p>
              <div className="h-[280px]">
                <GraficoArea dados={serie} />
              </div>
            </div>
          )}
        </div>
      )}
    </LayoutApp>
  );
}

// ---------- Componentes ----------

// Versão sem chip de tendência do Kpi do painel do dono. As três zonas de
// altura fixa são as mesmas, para os cards baterem entre si.
function KpiSimples({ Icone, rotulo, valor, sub, destaque = false }) {
  return (
    <div className="relative overflow-hidden rounded-md px-5 py-4 border bg-superficie border-linha">
      {destaque && <div className="absolute left-0 top-0 bottom-0 w-1 bg-nivel" />}

      <div className="h-[24px] flex items-start justify-between">
        <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio leading-tight">
          {rotulo}
        </p>
        {Icone && <Icone size={17} strokeWidth={1.75} className="text-grafite-medio/50 shrink-0" />}
      </div>

      <div className="h-[36px] flex items-end">
        <p className="leading-none tabular-nums tracking-[-0.01em] text-[27px] text-grafite font-ui font-bold">
          {valor}
        </p>
      </div>

      <div className="h-[20px] mt-2.5 flex items-center">
        {sub && <p className="text-[12px] text-grafite-medio">{sub}</p>}
      </div>
    </div>
  );
}

function MeuPainelEsqueleto() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {/* Espelha os breakpoints do conteúdo real — se divergirem, a tela
          salta quando os dados chegam. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-superficie border border-linha rounded-md" />
        ))}
      </div>
      <div className="h-80 bg-superficie border border-linha rounded-md" />
    </div>
  );
}
