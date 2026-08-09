import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Tag, Calendar, ShoppingBag, AlertTriangle } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { clientesService, rotuloTipo, DIAS_SUMIDO } from '../services/clientes';
import { moeda } from '../utils/formato';

const FORMAS = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', fiado: 'Fiado' };
const CORES_FORMA = { dinheiro: '#1B7A46', pix: '#2AA9B8', cartao: '#7C6FE8', fiado: '#D9A500' };

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [todos, vendas] = await Promise.all([
          clientesService.estatisticas(),
          clientesService.historico(id),
        ]);
        const c = todos.find((x) => x.id === id) || (await clientesService.buscar(id));
        if (ativo) {
          setCliente(c);
          setHistorico(vendas);
        }
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
      {/* Até sm o cabeçalho empilha e fica mais alto: prender a altura em
          100vh espremeria o histórico. Ali a altura é piso, não teto. */}
      <div className="flex flex-col gap-4 min-h-[500px] sm:h-full">
        {/* cabeçalho do cliente */}
        <div className="bg-superficie border border-linha rounded-md p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-trena/15 text-trena font-bold text-[22px] sm:text-[26px] flex items-center justify-center shrink-0">
            {cliente.nome.charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] sm:text-[20px] font-bold min-w-0 break-words">{cliente.nome}</h2>
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

        {/* histórico de compras (dados reais) */}
        <div className="bg-superficie border border-linha rounded-md flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-linha shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-grafite-medio" />
              <p className="text-[14px] font-semibold">Histórico de compras</p>
            </div>
            <span className="text-[12px] text-grafite-medio">{historico.length} venda(s)</span>
          </div>

          {historico.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <ShoppingBag size={28} className="text-grafite-medio/30 mb-3" />
              <p className="text-[13.5px] text-grafite-medio">
                Este cliente ainda não tem compras registradas.
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Até md: cartões (a tabela de 5 colunas não cabe no balcão). */}
              <ul className="md:hidden divide-y divide-linha">
                {historico.map((v) => (
                  <li
                    key={v.id}
                    className={`px-4 py-3 ${v.status === 'cancelada' ? 'opacity-55' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-semibold tabular-nums">
                        {new Date(v.vendida_em).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-[15px] font-bold tabular-nums shrink-0">
                        {moeda(v.valor_total)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[12px] text-grafite-medio">
                      <span className="inline-flex items-center gap-1.5 shrink-0">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: CORES_FORMA[v.forma_pagamento] }}
                        />
                        {FORMAS[v.forma_pagamento] || v.forma_pagamento}
                      </span>
                      {Number(v.desconto) > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">− {moeda(v.desconto)}</span>
                        </>
                      )}
                      {v.status === 'cancelada' && (
                        <span className="ml-auto text-[10px] font-bold uppercase text-prumo bg-prumo/10 px-1.5 py-0.5 rounded shrink-0">
                          cancelada
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <table className="w-full hidden md:table">
                <thead className="sticky top-0 bg-superficie">
                  <tr className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio border-b border-linha">
                    <th className="text-left px-5 py-3">Data</th>
                    <th className="text-left px-3 py-3">Pagamento</th>
                    <th className="text-right px-3 py-3">Desconto</th>
                    <th className="text-right px-5 py-3">Valor</th>
                    <th className="text-center px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((v) => (
                    <tr
                      key={v.id}
                      className={`text-[14px] border-b border-linha last:border-b-0 ${
                        v.status === 'cancelada' ? 'opacity-55' : ''
                      }`}
                    >
                      <td className="px-5 py-3 tabular-nums">
                        {new Date(v.vendida_em).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-2 text-grafite-medio">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: CORES_FORMA[v.forma_pagamento] }}
                          />
                          {FORMAS[v.forma_pagamento] || v.forma_pagamento}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-grafite-medio tabular-nums">
                        {Number(v.desconto) > 0 ? `− ${moeda(v.desconto)}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums">
                        {moeda(v.valor_total)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {v.status === 'cancelada' ? (
                          <span className="text-[11px] font-bold uppercase text-prumo bg-prumo/10 px-2 py-0.5 rounded">
                            cancelada
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold uppercase text-nivel bg-nivel/10 px-2 py-0.5 rounded">
                            concluída
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
