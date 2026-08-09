import { useState, useEffect } from 'react';
import { NotebookPen, Wallet, Users, X, Check, ChevronDown, ChevronRight, Search } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { fiadosService } from '../services/fiados';
import { moeda, numero } from '../utils/formato';

/* Avatar do cliente: sem foto, sem cadastro. A cor sai do próprio nome, então
   o mesmo cliente aparece sempre com a mesma cor — o balconista reconhece pela
   mancha de cor antes de ler o nome. */
const CORES_AVATAR = [
  { bg: '#0e7c86', texto: '#ffffff' }, // teal
  { bg: '#1b7a46', texto: '#ffffff' }, // verde
  { bg: '#c42e1e', texto: '#ffffff' }, // vermelho prumo
  { bg: '#b45309', texto: '#ffffff' }, // âmbar
  { bg: '#6d28d9', texto: '#ffffff' }, // roxo
  { bg: '#1d4ed8', texto: '#ffffff' }, // azul
  { bg: '#be185d', texto: '#ffffff' }, // magenta
  { bg: '#3f6212', texto: '#ffffff' }, // oliva
];

function corDoNome(nome) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return CORES_AVATAR[h % CORES_AVATAR.length];
}

// "Marcos Andrade" -> "MA"; "Consumidor" -> "CO". Duas letras leem melhor que uma.
function iniciais(nome) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function Fiados() {
  const [dividas, setDividas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pagando, setPagando] = useState(null); // dívida sendo paga
  const [expandido, setExpandido] = useState({}); // cliente_id -> bool
  const [busca, setBusca] = useState('');

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
  // Dentro de cada cliente, a dívida mais antiga vem primeiro: é ela que o
  // botão "Receber" quita, e é assim que o pagamento acontece no balcão.
  Object.values(grupos).forEach((g) =>
    g.vendas.sort((a, b) => new Date(a.vendida_em) - new Date(b.vendida_em))
  );
  const listaGrupos = Object.values(grupos).sort((a, b) => b.total - a.total);

  const totalReceber = dividas.reduce((s, d) => s + d.saldo, 0);
  const devedores = listaGrupos.length;

  // A busca filtra só a lista — os KPIs continuam mostrando o total do negócio.
  const termo = busca.trim().toLowerCase();
  const gruposVisiveis = termo
    ? listaGrupos.filter(
        (g) =>
          g.nome.toLowerCase().includes(termo) || (g.telefone || '').includes(busca.trim())
      )
    : listaGrupos;

  return (
    <LayoutApp titulo="Fiados">
      <div className="flex flex-col gap-4 h-full min-h-[500px]">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 shrink-0 max-w-[560px]">
          <KpiF Icone={Wallet} rotulo="Total a receber" valor={moeda(totalReceber)} destaque />
          <KpiF Icone={Users} rotulo="Clientes devendo" valor={numero(devedores)} />
        </div>

        {/* busca por nome — com 30 clientes devendo, rolar a lista não funciona */}
        {!carregando && listaGrupos.length > 0 && (
          <div className="flex items-center gap-2 border-2 border-linha rounded-p px-3 bg-superficie focus-within:border-grafite shrink-0 max-w-[560px]">
            <Search size={18} className="text-grafite-medio shrink-0" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente…"
              className="flex-1 py-2.5 bg-transparent text-[15px] outline-none"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                className="text-grafite-medio hover:text-grafite shrink-0"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

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
          ) : gruposVisiveis.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <Search size={32} className="text-grafite-medio/40 mb-3" />
              <p className="text-[15px] font-semibold">Nenhum cliente com esse nome</p>
              <p className="text-[13px] text-grafite-medio mt-1">Tente outra busca.</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-linha">
              {gruposVisiveis.map((g) => {
                const chave = g.cliente_id || 'consumidor';
                const aberto = expandido[chave];
                const cor = corDoNome(g.nome);
                const umaSo = g.vendas.length === 1;

                function alternar() {
                  setExpandido((e) => ({ ...e, [chave]: !aberto }));
                }

                return (
                  <div key={chave}>
                    {/* Cabeçalho do cliente. Até sm vira duas faixas: nome e
                        valor em cima, "Receber" numa linha própria — os três
                        lado a lado deixam ~80px para o nome num celular. */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* área clicável: abre/fecha as dívidas */}
                        <button
                          onClick={alternar}
                          aria-expanded={!!aberto}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left py-1 rounded-p hover:bg-concreto/40"
                        >
                          <span
                            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full font-bold text-[15px] sm:text-[16px] flex items-center justify-center shrink-0"
                            style={{ backgroundColor: cor.bg, color: cor.texto }}
                          >
                            {iniciais(g.nome)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[16px] font-bold truncate">{g.nome}</p>
                            <p className="text-[13px] text-grafite-medio flex items-center gap-1">
                              {aberto ? (
                                <ChevronDown size={14} className="shrink-0" />
                              ) : (
                                <ChevronRight size={14} className="shrink-0" />
                              )}
                              <span className="truncate">
                                {umaSo ? 'ver a dívida' : `ver as ${g.vendas.length} dívidas`}
                                {g.telefone ? ` · ${g.telefone}` : ''}
                              </span>
                            </p>
                          </div>
                        </button>

                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-bold uppercase text-grafite-medio">Deve</p>
                          <p className="text-[20px] font-bold tabular-nums text-trena-escuro leading-tight">
                            {moeda(g.total)}
                          </p>
                        </div>
                      </div>

                      {/* Ação principal. Sempre abre o modal, já na dívida mais
                          antiga — no balcão o cliente quita a mais velha
                          primeiro. Pra pagar outra, basta expandir e escolher. */}
                      <button
                        onClick={() => setPagando(g.vendas[0])}
                        className="shrink-0 w-full sm:w-auto px-4 sm:px-5 h-12 rounded-p bg-nivel text-white text-[14px] font-bold hover:bg-nivel/90"
                      >
                        Receber
                      </button>
                    </div>

                    {/* dívidas do cliente (expandido) */}
                    {aberto && (
                      <div className="bg-concreto/30 px-4 sm:px-5 pb-3">
                        {g.vendas.map((d) => (
                          <div
                            key={d.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 border-t border-linha/60 first:border-t-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium">
                                Venda de {new Date(d.vendida_em).toLocaleDateString('pt-BR')}
                              </p>
                              <p className="text-[11.5px] text-grafite-medio tabular-nums">
                                Total {moeda(d.valor_total)}
                                {d.pago > 0 && ` · pago ${moeda(d.pago)}`} · {d.dias} dias
                              </p>
                            </div>
                            {/* O saldo desta venda só informa algo novo quando
                                há várias — com uma só ele repete o "Deve". */}
                            {!umaSo && (
                              <div className="text-right">
                                <p className="text-[10px] font-bold uppercase text-grafite-medio">
                                  Saldo
                                </p>
                                <p className="text-[14px] font-bold tabular-nums">
                                  {moeda(d.saldo)}
                                </p>
                              </div>
                            )}
                            {/* Com uma dívida só, o botão do cabeçalho já faz
                                isso — repetir aqui é ruído. Só aparece quando
                                há mais de uma e é preciso escolher qual. */}
                            {!umaSo && (
                              <button
                                onClick={() => setPagando(d)}
                                className="px-4 h-10 rounded-p bg-nivel text-white text-[13.5px] font-bold hover:bg-nivel/90 shrink-0"
                              >
                                Receber
                              </button>
                            )}
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
          outras={(grupos[pagando.cliente_id || 'consumidor']?.vendas.length ?? 1) - 1}
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
function ModalPagar({ divida, outras = 0, onFechar, onPago }) {
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div className="bg-superficie rounded-md w-full max-w-[400px] my-auto p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
          {/* Deixa explícito que isto quita UMA venda, não tudo que o cliente
              deve — senão o usuário acha que zerou a conta dele. */}
          {outras > 0 && (
            <p className="text-[12px] text-grafite-medio mt-1.5 pt-1.5 border-t border-linha">
              Dívida mais antiga. Este cliente tem mais{' '}
              <span className="font-bold">
                {outras} {outras === 1 ? 'venda' : 'vendas'}
              </span>{' '}
              em aberto.
            </p>
          )}
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
