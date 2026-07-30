import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, X, AlertTriangle } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { clientesService, TIPOS, rotuloTipo, DIAS_SUMIDO } from '../services/clientes';
import { moeda } from '../utils/formato';

export default function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null); // cliente, {} (novo) ou null

  async function carregar() {
    setCarregando(true);
    try {
      setClientes(await clientesService.estatisticas());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(busca.trim().toLowerCase()) ||
      (c.telefone || '').includes(busca.trim())
  );

  const sumidos = clientes.filter((c) => c.qtd_compras > 0 && c.dias_sem_comprar >= DIAS_SUMIDO).length;

  return (
    <LayoutApp
      titulo="Clientes"
      acao={
        <button
          onClick={() => setEditando({})}
          className="h-8 px-4 rounded-p bg-trena hover:bg-trena-escuro text-white font-bold text-[13px] transition-colors flex items-center gap-1.5"
        >
          <Plus size={15} /> Novo cliente
        </button>
      }
    >
      <div className="flex flex-col gap-4 h-[calc(100vh-56px-32px)] min-h-[500px]">
        {/* busca + alerta de sumidos */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2 border-2 border-linha rounded-p px-3 bg-superficie focus-within:border-grafite flex-1 min-w-[240px]">
            <Search size={16} className="text-grafite-medio shrink-0" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone…"
              className="flex-1 py-2 bg-transparent text-[14px] outline-none"
            />
          </div>
          {sumidos > 0 && (
            <div className="flex items-center gap-2 text-[13px] font-semibold text-prumo bg-prumo/10 px-3 py-2 rounded-p">
              <AlertTriangle size={15} />
              {sumidos} cliente(s) sumido(s)
            </div>
          )}
        </div>

        {/* tabela */}
        <div className="bg-superficie border border-linha rounded-md overflow-hidden flex-1 flex flex-col min-h-0">
          {carregando ? (
            <div className="flex-1 flex items-center justify-center text-grafite-medio text-[13px]">
              Carregando…
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <Users size={32} className="text-grafite-medio/40 mb-3" />
              <p className="text-[15px] font-semibold">Nenhum cliente encontrado</p>
              <p className="text-[13px] text-grafite-medio mt-1">
                {busca ? 'Tente outra busca.' : 'Cadastre o primeiro cliente.'}
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-superficie z-10">
                  <tr className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio border-b border-linha">
                    <th className="text-left px-5 py-3">Cliente</th>
                    <th className="text-left px-3 py-3">Tipo</th>
                    <th className="text-right px-3 py-3">Total gasto</th>
                    <th className="text-right px-3 py-3">Compras</th>
                    <th className="text-left px-3 py-3">Última compra</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((c) => {
                    const sumido = c.qtd_compras > 0 && c.dias_sem_comprar >= DIAS_SUMIDO;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/clientes/${c.id}`)}
                        className="text-[14px] border-b border-linha hover:bg-concreto/40 cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-trena/15 text-trena font-bold text-[13px] flex items-center justify-center shrink-0">
                              {c.nome.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <p className="font-semibold flex items-center gap-2">
                                {c.nome}
                                {sumido && (
                                  <span className="text-[10px] font-bold uppercase text-prumo bg-prumo/10 px-1.5 py-0.5 rounded">
                                    sumido
                                  </span>
                                )}
                              </p>
                              <p className="text-[12px] text-grafite-medio">{c.telefone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-grafite-medio">{rotuloTipo(c.tipo)}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {moeda(c.total_gasto)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{c.qtd_compras}</td>
                        <td className="px-3 py-3 text-grafite-medio">
                          {c.ultima_compra
                            ? `${new Date(c.ultima_compra).toLocaleDateString('pt-BR')} · ${c.dias_sem_comprar}d atrás`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!carregando && filtrados.length > 0 && (
            <div className="shrink-0 px-5 py-2.5 border-t border-linha text-[12px] text-grafite-medio">
              {filtrados.length} cliente(s){busca && ` para "${busca}"`}
            </div>
          )}
        </div>
      </div>

      {editando !== null && (
        <ModalCliente
          cliente={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </LayoutApp>
  );
}

// ---------- Modal criar/editar cliente ----------
function ModalCliente({ cliente, onFechar, onSalvo }) {
  const edicao = !!cliente.id;
  const [nome, setNome] = useState(cliente.nome || '');
  const [telefone, setTelefone] = useState(cliente.telefone || '');
  const [tipo, setTipo] = useState(cliente.tipo || '');
  const [observacao, setObservacao] = useState(cliente.observacao || '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    if (!nome.trim() || !telefone.trim()) return setErro('Nome e telefone são obrigatórios.');

    setSalvando(true);
    try {
      const dados = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        tipo: tipo || null,
        observacao: observacao.trim() || null,
      };
      if (edicao) await clientesService.atualizar(cliente.id, dados);
      else await clientesService.criar(dados);
      onSalvo();
    } catch (e) {
      setErro(e.message || 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-superficie rounded-md w-full max-w-[400px] p-5 overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold">{edicao ? 'Editar cliente' : 'Novo cliente'}</p>
          <button onClick={onFechar} className="text-grafite-medio hover:text-grafite">
            <X size={18} />
          </button>
        </div>

        <CampoCli rotulo="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus className={inputCli} />
        </CampoCli>
        <CampoCli rotulo="Telefone">
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCli} />
        </CampoCli>
        <CampoCli rotulo="Tipo de cliente">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCli}>
            <option value="">Sem tipo</option>
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </CampoCli>
        <CampoCli rotulo="Observação (opcional)">
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            className={`${inputCli} resize-none`}
          />
        </CampoCli>

        {erro && <p className="text-[12.5px] text-prumo font-semibold my-3">{erro}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-p border border-linha text-[14px] font-semibold hover:bg-concreto"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex-1 py-2.5 rounded-p bg-trena hover:bg-trena-escuro text-white text-[14px] font-bold disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : edicao ? 'Salvar' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCli =
  'w-full min-w-0 py-2.5 px-3 text-[14px] border-2 border-linha rounded-p bg-superficie focus:border-grafite outline-none';

function CampoCli({ rotulo, children }) {
  return (
    <label className="block min-w-0 mb-3">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-grafite-medio mb-1.5">
        {rotulo}
      </span>
      {children}
    </label>
  );
}
