import { useState, useEffect } from 'react';
import { NotebookPen, Wallet, Users, X, Check, ChevronDown, ChevronRight } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { fiadosService } from '../services/fiados';
import { moeda, numero } from '../utils/formato';

export default function Fiados() {
  const [dividas, setDividas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pagando, setPagando] = useState(null); // dívida sendo paga
  const [expandido, setExpandido] = useState({}); // cliente_id -> bool

  async function carregar() {
    setCarregando(true);
    try {
      setDividas(await fiadosService.listar());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Consolidação por cliente (decisão: banco por venda, tela agrupa)
  const grupos = {};
  dividas.forEach((d) => {
    const chave = d.cliente_id || 'consumidor';
    if (!grupos[chave]) {
      grupos[chave] = {
        cliente_id: d.cliente_id,
        nome: d.cliente_nome,
        telefone: d.cliente_telefone,
        total: 0,
        vendas: [],
      };
    }
    grupos[chave].total += d.saldo;
    grupos[chave].vendas.push(d);
  });
  const listaGrupos = Object.values(grupos).sort((a, b) => b.total - a.total);

  const totalReceber = dividas.reduce((s, d) => s + d.saldo, 0);
  const devedores = listaGrupos.length;

  return (
    <LayoutApp titulo="Fiados">
      <div className="flex flex-col gap-4 h-[calc(100vh-56px-32px)] min-h-[500px]">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 shrink-0 max-w-[560px]">
          <KpiF Icone={Wallet} rotulo="Total a receber" valor={moeda(totalReceber)} destaque />
          <KpiF Icone={Users} rotulo="Clientes devendo" valor={numero(devedores)} />
        </div>

        {/* lista agrupada por cliente */}
        <div className="bg-superficie border border-linha rounded-md overflow-hidden flex-1 flex flex-col min-h-0">
          {carregando ? (
            <div className="flex-1 flex items-center justify-center text-grafite-medio text-[13px]">
              Carregando…
            </div>
          ) : listaGrupos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <NotebookPen size={32} className="text-grafite-medio/40 mb-3" />
              <p className="text-[15px] font-semibold">Nenhum fiado em aberto</p>
              <p className="text-[13px] text-grafite-medio mt-1">
                Tudo em dia! As vendas fiado não pagas apareceriam aqui.
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-linha">
              {listaGrupos.map((g) => {
                const aberto = expandido[g.cliente_id || 'consumidor'];
                return (
                  <div key={g.cliente_id || 'consumidor'}>
                    {/* cabeçalho do cliente */}
                    <button
                      onClick={() =>
                        setExpandido((e) => ({
                          ...e,
                          [g.cliente_id || 'consumidor']: !aberto,
                        }))
                      }
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-concreto/40 text-left"
                    >
                      {aberto ? (
                        <ChevronDown size={16} className="text-grafite-medio shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-grafite-medio shrink-0" />
                      )}
                      <span className="w-9 h-9 rounded-full bg-trena/15 text-trena-escuro font-bold text-[14px] flex items-center justify-center shrink-0">
                        {g.nome.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold">{g.nome}</p>
                        <p className="text-[12px] text-grafite-medio">
                          {g.vendas.length} {g.vendas.length === 1 ? 'dívida' : 'dívidas'}
                          {g.telefone ? ` · ${g.telefone}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-grafite-medio">Deve</p>
                        <p className="text-[17px] font-bold tabular-nums text-trena-escuro">
                          {moeda(g.total)}
                        </p>
                      </div>
                    </button>

                    {/* dívidas do cliente (expandido) */}
                    {aberto && (
                      <div className="bg-concreto/30 px-5 pb-3">
                        {g.vendas.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center gap-3 py-2.5 border-t border-linha/60 first:border-t-0"
                          >
                            <div className="flex-1">
                              <p className="text-[13px] font-medium">
                                Venda de {new Date(d.vendida_em).toLocaleDateString('pt-BR')}
                              </p>
                              <p className="text-[11.5px] text-grafite-medio tabular-nums">
                                Total {moeda(d.valor_total)}
                                {d.pago > 0 && ` · pago ${moeda(d.pago)}`} · {d.dias} dias
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase text-grafite-medio">
                                Saldo
                              </p>
                              <p className="text-[14px] font-bold tabular-nums">{moeda(d.saldo)}</p>
                            </div>
                            <button
                              onClick={() => setPagando(d)}
                              className="px-3 py-1.5 rounded-p bg-nivel text-white text-[12.5px] font-bold hover:bg-nivel/90"
                            >
                              Receber
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {pagando && (
        <ModalPagar
          divida={pagando}
          onFechar={() => setPagando(null)}
          onPago={() => {
            setPagando(null);
            carregar();
          }}
        />
      )}
    </LayoutApp>
  );
}

function KpiF({ Icone, rotulo, valor, destaque = false }) {
  return (
    <div
      className={`rounded-md px-4 py-3 border flex items-center justify-between ${
        destaque ? 'bg-trena/5 border-trena/30' : 'bg-superficie border-linha'
      }`}
    >
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-grafite-medio">{rotulo}</p>
        <p className={`text-[22px] font-bold tabular-nums mt-1 ${destaque ? 'text-trena-escuro' : ''}`}>
          {valor}
        </p>
      </div>
      <Icone size={20} className={destaque ? 'text-trena-escuro/50' : 'text-grafite-medio/40'} />
    </div>
  );
}

// ---------- Modal receber pagamento ----------
function ModalPagar({ divida, onFechar, onPago }) {
  const [valor, setValor] = useState(String(divida.saldo));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function pagar() {
    setErro('');
    const v = Number(valor);
    if (!v || v <= 0) return setErro('Informe um valor maior que zero.');
    if (v > divida.saldo + 0.009) return setErro(`Máximo: ${moeda(divida.saldo)} (saldo em aberto).`);

    setSalvando(true);
    try {
      await fiadosService.pagar(divida.id, Number(v.toFixed(2)));
      onPago();
    } catch (e) {
      setErro(e.message || 'Falha ao registrar pagamento.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-superficie rounded-md w-full max-w-[400px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold">Receber pagamento</p>
          <button onClick={onFechar} className="text-grafite-medio hover:text-grafite">
            <X size={18} />
          </button>
        </div>

        <div className="bg-concreto rounded-p px-3 py-2.5 mb-4">
          <p className="text-[13px] font-semibold">{divida.cliente_nome}</p>
          <p className="text-[12px] text-grafite-medio">
            Venda de {new Date(divida.vendida_em).toLocaleDateString('pt-BR')} · saldo{' '}
            <span className="font-bold">{moeda(divida.saldo)}</span>
          </p>
        </div>

        <label className="block mb-2">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-grafite-medio mb-1.5">
            Valor recebido
          </span>
          <div className="flex items-center border-2 border-linha rounded-p px-3 focus-within:border-grafite">
            <span className="text-[13px] text-grafite-medio shrink-0">R$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
              className="w-full min-w-0 py-2.5 pl-2 text-right text-[15px] font-semibold tabular-nums bg-transparent outline-none"
            />
          </div>
        </label>

        {/* atalhos */}
        <div className="flex gap-1.5 mb-3">
          <button
            onClick={() => setValor(String(divida.saldo))}
            className="px-2.5 py-1 rounded-p border border-linha text-[12px] font-semibold text-grafite-medio hover:border-grafite hover:text-grafite"
          >
            Tudo ({moeda(divida.saldo)})
          </button>
          <button
            onClick={() => setValor(String((divida.saldo / 2).toFixed(2)))}
            className="px-2.5 py-1 rounded-p border border-linha text-[12px] font-semibold text-grafite-medio hover:border-grafite hover:text-grafite"
          >
            Metade
          </button>
        </div>

        {erro && <p className="text-[12.5px] text-prumo font-semibold mb-3">{erro}</p>}

        <div className="flex gap-2 mt-2">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-p border border-linha text-[14px] font-semibold hover:bg-concreto"
          >
            Cancelar
          </button>
          <button
            onClick={pagar}
            disabled={salvando}
            className="flex-1 py-2.5 rounded-p bg-nivel hover:bg-nivel/90 text-white text-[14px] font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check size={16} /> {salvando ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
