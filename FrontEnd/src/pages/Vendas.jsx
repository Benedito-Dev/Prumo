import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, X, Ban, Search } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import Seletor from '../components/Seletor';
import AcoesRecibo from '../components/AcoesRecibo';
import { vendasService } from '../services/vendas';
import { useAuth } from '../auth/AuthContext';
import { moeda, numero } from '../utils/formato';

const FORMAS = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
  fiado: 'Fiado',
};
const CORES_FORMA = {
  dinheiro: '#1B7A46',
  pix: '#2AA9B8',
  cartao: '#7C6FE8',
  fiado: '#D9A500',
};

const PERIODOS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'ano', rotulo: 'Ano' },
  { id: 'tudo', rotulo: 'Tudo' },
];
const STATUS = [
  { id: 'concluida', rotulo: 'Concluídas' },
  { id: 'cancelada', rotulo: 'Canceladas' },
  { id: '', rotulo: 'Todas' },
];

// converte período em datas (de/ate) — 'tudo' não filtra
function rangePeriodo(periodo) {
  const agora = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (periodo === 'hoje') return { de: iso(agora), ate: iso(agora) };
  if (periodo === 'semana') {
    const d = new Date(agora);
    d.setDate(d.getDate() - 6);
    return { de: iso(d), ate: iso(agora) };
  }
  if (periodo === 'mes') {
    return { de: iso(new Date(agora.getFullYear(), agora.getMonth(), 1)), ate: iso(agora) };
  }
  if (periodo === 'ano') {
    return { de: iso(new Date(agora.getFullYear(), 0, 1)), ate: iso(agora) };
  }
  return {}; // tudo
}

export default function Vendas() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const ehDono = usuario?.papel === 'dono';
  const [vendas, setVendas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [status, setStatus] = useState('concluida');
  const [busca, setBusca] = useState('');
  const [pagamento, setPagamento] = useState(''); // '' = todas
  const [detalhe, setDetalhe] = useState(null); // id da venda aberta

  async function carregar() {
    setCarregando(true);
    try {
      const { de, ate } = rangePeriodo(periodo);
      setVendas(await vendasService.listar({ de, ate, status: status || undefined }));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [periodo, status]);

  // filtro no front (busca por cliente/vendedor + forma de pagamento)
  const filtradas = vendas
    .filter((v) => (pagamento ? v.forma_pagamento === pagamento : true))
    .filter((v) => {
      const t = busca.trim().toLowerCase();
      if (!t) return true;
      return (
        (v.cliente_nome || 'consumidor').toLowerCase().includes(t) ||
        (v.usuario_nome || '').toLowerCase().includes(t)
      );
    });

  // KPIs (só concluídas contam no total)
  const concluidas = filtradas.filter((v) => v.status === 'concluida');
  const total = concluidas.reduce((s, v) => s + Number(v.valor_total), 0);
  const ticket = concluidas.length ? total / concluidas.length : 0;

  return (
    <LayoutApp
      // O back já devolve ao vendedor só as vendas dele; o título diz isso
      // na tela, senão ele acha que a loja vendeu pouco.
      titulo={ehDono ? 'Vendas' : 'Minhas vendas'}
      acao={
        <button
          onClick={() => navigate('/vendas/nova')}
          className="h-8 px-4 rounded-p bg-trena hover:bg-trena-escuro text-white font-bold text-[13px] transition-colors flex items-center gap-1.5"
        >
          <Plus size={15} /> Nova venda
        </button>
      }
    >
      <div className="flex flex-col gap-4 h-full min-h-[500px]">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <KpiV rotulo="Faturado no período" valor={moeda(total)} destaque />
          <KpiV rotulo="Vendas concluídas" valor={numero(concluidas.length)} />
          <KpiV rotulo="Ticket médio" valor={moeda(ticket)} />
        </div>

        {/* filtros */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2 border-2 border-linha rounded-p px-3 bg-superficie focus-within:border-grafite flex-1 min-w-[220px]">
            <Search size={16} className="text-grafite-medio shrink-0" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente ou vendedor…"
              className="flex-1 py-2 bg-transparent text-[14px] outline-none"
            />
          </div>
          <Seletor
            className="min-w-[130px]"
            valor={periodo}
            onChange={setPeriodo}
            prefixo="Período:"
            opcoes={PERIODOS}
          />
          <Seletor
            className="min-w-[150px]"
            valor={pagamento}
            onChange={setPagamento}
            opcoes={[
              { id: '', rotulo: 'Todo pagamento' },
              { id: 'dinheiro', rotulo: 'Dinheiro' },
              { id: 'pix', rotulo: 'Pix' },
              { id: 'cartao', rotulo: 'Cartão' },
              { id: 'fiado', rotulo: 'Fiado' },
            ]}
          />
          <Seletor className="min-w-[150px]" valor={status} onChange={setStatus} opcoes={STATUS} />
        </div>

        {/* tabela */}
        <div className="bg-superficie border border-linha rounded-md overflow-hidden flex-1 flex flex-col min-h-0">
          {carregando ? (
            <div className="flex-1 flex items-center justify-center text-grafite-medio text-[13px]">
              Carregando…
            </div>
          ) : filtradas.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <Receipt size={32} className="text-grafite-medio/40 mb-3" />
              <p className="text-[15px] font-semibold">Nenhuma venda no período</p>
              <p className="text-[13px] text-grafite-medio mt-1">Ajuste os filtros ou lance uma venda.</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Até md: cartões (a tabela de 6 colunas não cabe no balcão). */}
              <ul className="md:hidden divide-y divide-linha">
                {filtradas.map((v) => {
                  const cancelada = v.status === 'cancelada';
                  return (
                    <li key={v.id}>
                      <button
                        onClick={() => setDetalhe(v.id)}
                        className={`w-full text-left px-4 py-3 min-h-[64px] hover:bg-concreto/40 ${
                          cancelada ? 'opacity-55' : ''
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[15px] font-semibold truncate">
                            {v.cliente_nome || 'Consumidor'}
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
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums shrink-0">
                            {new Date(v.vendida_em).toLocaleDateString('pt-BR')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{v.usuario_nome}</span>
                          {cancelada && (
                            <span className="ml-auto text-[10px] font-bold uppercase text-prumo bg-prumo/10 px-1.5 py-0.5 rounded shrink-0">
                              cancelada
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <table className="w-full hidden md:table">
                <thead className="sticky top-0 bg-superficie z-10">
                  <tr className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio border-b border-linha">
                    <th className="text-left px-5 py-3">Cliente</th>
                    <th className="text-left px-3 py-3">Pagamento</th>
                    <th className="text-left px-3 py-3">Vendedor</th>
                    <th className="text-left px-3 py-3">Data</th>
                    <th className="text-right px-3 py-3">Valor</th>
                    <th className="text-center px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((v) => {
                    const cancelada = v.status === 'cancelada';
                    return (
                      <tr
                        key={v.id}
                        onClick={() => setDetalhe(v.id)}
                        className={`text-[14px] border-b border-linha hover:bg-concreto/40 cursor-pointer ${
                          cancelada ? 'opacity-55' : ''
                        }`}
                      >
                        <td className="px-5 py-3 font-semibold">{v.cliente_nome || 'Consumidor'}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-2 text-grafite-medio">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: CORES_FORMA[v.forma_pagamento] }}
                            />
                            {FORMAS[v.forma_pagamento] || v.forma_pagamento}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-grafite-medio">{v.usuario_nome}</td>
                        <td className="px-3 py-3 text-grafite-medio tabular-nums">
                          {new Date(v.vendida_em).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums">
                          {moeda(v.valor_total)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {cancelada ? (
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!carregando && filtradas.length > 0 && (
            <div className="shrink-0 px-5 py-2.5 border-t border-linha text-[12px] text-grafite-medio">
              {filtradas.length} venda(s)
            </div>
          )}
        </div>
      </div>

      {detalhe && (
        <ModalDetalheVenda
          id={detalhe}
          onFechar={() => setDetalhe(null)}
          onCancelada={() => {
            setDetalhe(null);
            carregar();
          }}
        />
      )}
    </LayoutApp>
  );
}

function KpiV({ rotulo, valor, destaque = false }) {
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

// ---------- Modal de detalhe da venda ----------
function ModalDetalheVenda({ id, onFechar, onCancelada }) {
  const [venda, setVenda] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    let ativo = true;
    vendasService
      .detalhar(id)
      .then((v) => ativo && setVenda(v))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [id]);

  async function cancelar() {
    setCancelando(true);
    try {
      await vendasService.cancelar(id);
      onCancelada();
    } catch {
      setCancelando(false);
    }
  }

  const subtotal = venda?.itens?.reduce((s, i) => s + Number(i.subtotal), 0) || 0;
  const desconto = Number(venda?.desconto || 0);
  const cancelada = venda?.status === 'cancelada';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div
        className="bg-superficie rounded-md w-full max-w-[480px] my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-linha sticky top-0 bg-superficie">
          <p className="text-[16px] font-bold">Detalhe da venda</p>
          <button onClick={onFechar} className="text-grafite-medio hover:text-grafite">
            <X size={18} />
          </button>
        </div>

        {carregando ? (
          <div className="p-10 text-center text-grafite-medio text-[13px]">Carregando…</div>
        ) : !venda ? (
          <div className="p-10 text-center text-prumo font-semibold">Venda não encontrada.</div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {/* meta */}
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <Info rotulo="Cliente" valor={venda.cliente_nome || 'Consumidor'} />
              <Info rotulo="Vendedor" valor={venda.usuario_nome} />
              <Info rotulo="Pagamento" valor={FORMAS[venda.forma_pagamento]} />
              <Info
                rotulo="Data"
                valor={new Date(venda.vendida_em).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              />
            </div>

            {cancelada && (
              <div className="flex items-center gap-2 text-[13px] font-semibold text-prumo bg-prumo/10 px-3 py-2 rounded-p">
                <Ban size={15} /> Esta venda foi cancelada
              </div>
            )}

            {/* itens */}
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-grafite-medio mb-2">
                Itens
              </p>
              <div className="border border-linha rounded-p divide-y divide-linha">
                {venda.itens.map((i) => (
                  <div key={i.id} className="flex items-center justify-between px-3 py-2.5 text-[13px]">
                    <div>
                      <p className="font-semibold">{i.produto_nome}</p>
                      <p className="text-[11.5px] text-grafite-medio tabular-nums">
                        {numero(i.quantidade)} × {moeda(i.preco_unitario)}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums">{moeda(i.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* totais */}
            <div className="flex flex-col gap-1.5 text-[13px]">
              <div className="flex justify-between text-grafite-medio">
                <span>Subtotal</span>
                <span className="tabular-nums">{moeda(subtotal)}</span>
              </div>
              {desconto > 0 && (
                <div className="flex justify-between text-prumo">
                  <span>Desconto</span>
                  <span className="tabular-nums">− {moeda(desconto)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-linha">
                <span className="font-semibold">Total</span>
                <span className="text-[22px] font-bold tabular-nums text-nivel">
                  {moeda(venda.valor_total)}
                </span>
              </div>
            </div>

            {/* Recibo — segunda via para o cliente que volta com dúvida.
                Venda cancelada não tem recibo: o papel diria que a compra
                aconteceu, e ela foi desfeita. */}
            {!cancelada && (
              <AcoesRecibo venda={venda} telefoneCliente={venda.cliente_telefone} compacto />
            )}

            {/* ação cancelar (só se concluída) */}
            {!cancelada &&
              (confirmando ? (
                <div className="border-2 border-prumo/30 rounded-p p-3 bg-prumo/5">
                  <p className="text-[13px] font-semibold text-prumo mb-2">
                    Cancelar esta venda? Não pode ser desfeito.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmando(false)}
                      className="flex-1 py-2 rounded-p border border-linha text-[13px] font-semibold hover:bg-concreto"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={cancelar}
                      disabled={cancelando}
                      className="flex-1 py-2 rounded-p bg-prumo text-white text-[13px] font-bold disabled:opacity-50"
                    >
                      {cancelando ? 'Cancelando…' : 'Confirmar cancelamento'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmando(true)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-p border-2 border-prumo text-prumo text-[13px] font-bold hover:bg-prumo/5"
                >
                  <Ban size={15} /> Cancelar venda
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ rotulo, valor }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-grafite-medio">{rotulo}</p>
      <p className="font-semibold mt-0.5">{valor}</p>
    </div>
  );
}
