import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Tag, Calendar, ShoppingBag, AlertTriangle } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { clientesService, rotuloTipo, DIAS_SUMIDO } from '../services/clientes';
import { moeda } from '../utils/formato';

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        // usa o endpoint de estatísticas e encontra o cliente (traz total/compras)
        const todos = await clientesService.estatisticas();
        const c = todos.find((x) => x.id === id) || (await clientesService.buscar(id));
        if (ativo) setCliente(c);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  if (carregando) {
    return (
      <LayoutApp titulo="Cliente">
        <div className="py-10 text-center text-grafite-medio text-[13px]">Carregando…</div>
      </LayoutApp>
    );
  }

  if (!cliente) {
    return (
      <LayoutApp titulo="Cliente">
        <div className="py-10 text-center text-prumo font-semibold">Cliente não encontrado.</div>
      </LayoutApp>
    );
  }

  const sumido = cliente.qtd_compras > 0 && cliente.dias_sem_comprar >= DIAS_SUMIDO;
  const ticketMedio = cliente.qtd_compras ? cliente.total_gasto / cliente.qtd_compras : 0;

  return (
    <LayoutApp
      titulo="Cliente"
      acao={
        <button
          onClick={() => navigate('/clientes')}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-grafite-medio hover:text-grafite"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      }
    >
      <div className="flex flex-col gap-4 h-[calc(100vh-56px-32px)] min-h-[500px]">
        {/* cabeçalho do cliente */}
        <div className="bg-superficie border border-linha rounded-md p-5 flex items-center gap-4">
          <span className="w-16 h-16 rounded-full bg-trena/15 text-trena font-bold text-[26px] flex items-center justify-center shrink-0">
            {cliente.nome.charAt(0).toUpperCase()}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-bold">{cliente.nome}</h2>
              {sumido && (
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-prumo bg-prumo/10 px-2 py-0.5 rounded">
                  <AlertTriangle size={12} /> Sumido
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[13px] text-grafite-medio">
              <span className="flex items-center gap-1.5">
                <Phone size={13} /> {cliente.telefone}
              </span>
              <span className="flex items-center gap-1.5">
                <Tag size={13} /> {rotuloTipo(cliente.tipo)}
              </span>
              {cliente.ultima_compra && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} /> Última compra há {cliente.dias_sem_comprar} dias
                </span>
              )}
            </div>
          </div>
        </div>

        {/* indicadores do cliente */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Indicador rotulo="Total gasto" valor={moeda(cliente.total_gasto)} destaque />
          <Indicador rotulo="Nº de compras" valor={String(cliente.qtd_compras)} />
          <Indicador rotulo="Ticket médio" valor={moeda(ticketMedio)} />
        </div>

        {/* observação */}
        {cliente.observacao && (
          <div className="bg-superficie border border-linha rounded-md p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-grafite-medio mb-1.5">
              Observação
            </p>
            <p className="text-[13.5px]">{cliente.observacao}</p>
          </div>
        )}

        {/* histórico de compras — FRONT montado; dados reais ligam depois */}
        <div className="bg-superficie border border-linha rounded-md p-5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <ShoppingBag size={16} className="text-grafite-medio" />
            <p className="text-[14px] font-semibold">Histórico de compras</p>
          </div>
          <div className="flex-1 min-h-0 border-2 border-dashed border-linha rounded-md flex flex-col items-center justify-center text-center px-6">
            <ShoppingBag size={28} className="text-grafite-medio/30 mb-3" />
            <p className="text-[13.5px] text-grafite-medio">
              O histórico detalhado de compras deste cliente entra aqui.
            </p>
            <p className="text-[12px] text-grafite-medio/70 mt-1">
              (a listagem por cliente será conectada ao back-end na próxima etapa)
            </p>
          </div>
        </div>
      </div>
    </LayoutApp>
  );
}

function Indicador({ rotulo, valor, destaque = false }) {
  return (
    <div
      className={`rounded-md px-4 py-3 border ${
        destaque ? 'bg-nivel/5 border-nivel/25' : 'bg-superficie border-linha'
      }`}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-grafite-medio">{rotulo}</p>
      <p className="text-[22px] font-bold tabular-nums mt-1">{valor}</p>
    </div>
  );
}
