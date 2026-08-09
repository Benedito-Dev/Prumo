import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Shield, Calendar, KeyRound, Check, X, TrendingUp, Receipt, Wallet } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { usuariosService, rotuloPapel } from '../services/usuarios';
import { useAuth } from '../auth/AuthContext';
import { moeda, numero } from '../utils/formato';

export default function UsuarioDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario: eu } = useAuth();
  const [usuario, setUsuario] = useState(null);
  const [desempenho, setDesempenho] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [resetando, setResetando] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const [u, vendedores] = await Promise.all([
        usuariosService.buscar(id),
        usuariosService.desempenho().catch(() => []),
      ]);
      setUsuario(u);
      setDesempenho(vendedores.find((v) => v.usuario_id === id) || null);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [id]);

  async function alternarAtivo() {
    await usuariosService.alternarAtivo(id, !usuario.ativo);
    carregar();
  }

  if (carregando) {
    return (
      <LayoutApp titulo="Usuário">
        <div className="py-10 text-center text-grafite-medio text-[13px]">Carregando…</div>
      </LayoutApp>
    );
  }

  if (!usuario) {
    return (
      <LayoutApp titulo="Usuário">
        <div className="py-10 text-center text-prumo font-semibold">Usuário não encontrado.</div>
      </LayoutApp>
    );
  }

  const souEu = usuario.id === eu?.id;
  const totalVendido = desempenho?.total_vendido || 0;
  const qtdVendas = desempenho?.qtd_vendas || 0;
  const ticket = qtdVendas ? totalVendido / qtdVendas : 0;

  return (
    <LayoutApp
      titulo="Usuário"
      acao={
        <button
          onClick={() => navigate('/usuarios')}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-grafite-medio hover:text-grafite"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      }
    >
      {/* A altura travada só vale a partir de lg — no mobile as colunas
          empilham e precisam crescer com o conteúdo, senão ele vaza. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:h-full lg:min-h-[500px]">
        {/* ---- coluna principal ---- */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* cabeçalho */}
          <div className="bg-superficie border border-linha rounded-md p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-trena/15 text-trena-escuro font-bold text-[26px] sm:text-[32px] flex items-center justify-center shrink-0">
              {usuario.nome.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[20px] sm:text-[24px] font-bold min-w-0 break-words">{usuario.nome}</h2>
                {souEu && (
                  <span className="text-[11px] font-bold uppercase text-nivel bg-nivel/10 px-2 py-0.5 rounded shrink-0">você</span>
                )}
                {!usuario.ativo && (
                  <span className="text-[11px] font-bold uppercase text-grafite-medio bg-concreto px-2 py-0.5 rounded shrink-0">inativo</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[13.5px] text-grafite-medio">
                <span className="flex items-center gap-1.5"><Mail size={14} /> {usuario.email}</span>
                <span className="flex items-center gap-1.5"><Shield size={14} /> {rotuloPapel(usuario.papel)}</span>
                {usuario.criado_em && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} /> desde {new Date(usuario.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* desempenho de vendas — ocupa o resto da altura */}
          <div className="flex-1 flex flex-col min-h-0 bg-superficie border border-linha rounded-md p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-grafite-medio shrink-0" />
              <p className="text-[13px] font-semibold text-grafite">Desempenho como vendedor</p>
              <span className="text-[11px] text-grafite-medio">(no ano)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Indicador Icone={Wallet} rotulo="Total vendido" valor={moeda(totalVendido)} destaque />
              <Indicador Icone={Receipt} rotulo="Nº de vendas" valor={numero(qtdVendas)} />
              <Indicador Icone={TrendingUp} rotulo="Ticket médio" valor={moeda(ticket)} />
            </div>
            {qtdVendas === 0 && (
              <div className="flex-1 flex items-center justify-center text-[13px] text-grafite-medio">
                Nenhuma venda registrada no ano.
              </div>
            )}
          </div>
        </div>

        {/* ---- lateral de ações ---- */}
        <div className="bg-superficie border border-linha rounded-md p-5 sm:p-6 flex flex-col lg:self-start">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-grafite-medio mb-4">Ações</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setResetando(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-p border border-linha text-[13px] font-semibold hover:bg-concreto"
            >
              <KeyRound size={15} /> Resetar senha
            </button>
            {!souEu && (
              <button
                onClick={alternarAtivo}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-p border text-[13px] font-semibold ${
                  usuario.ativo
                    ? 'border-prumo/40 text-prumo hover:bg-prumo/5'
                    : 'border-nivel/40 text-nivel hover:bg-nivel/5'
                }`}
              >
                {usuario.ativo ? 'Desativar usuário' : 'Reativar usuário'}
              </button>
            )}
          </div>
          {souEu && (
            <p className="text-[12px] text-grafite-medio mt-3">
              Você não pode desativar a própria conta.
            </p>
          )}
        </div>
      </div>

      {resetando && (
        <ModalResetar usuario={usuario} onFechar={() => setResetando(false)} />
      )}
    </LayoutApp>
  );
}

function Indicador({ Icone, rotulo, valor, destaque = false }) {
  return (
    <div
      className={`rounded-md px-4 py-3 border flex items-center justify-between ${
        destaque ? 'bg-nivel/5 border-nivel/25' : 'bg-superficie border-linha'
      }`}
    >
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-grafite-medio">{rotulo}</p>
        <p className="text-[22px] font-bold tabular-nums mt-1">{valor}</p>
      </div>
      <Icone size={20} className="text-grafite-medio/40" />
    </div>
  );
}

// ---------- Modal resetar senha ----------
function ModalResetar({ usuario, onFechar }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setErro('');
    if (senha.length < 4) return setErro('A senha deve ter ao menos 4 caracteres.');
    setSalvando(true);
    try {
      await usuariosService.resetarSenha(usuario.id, senha);
      setOk(true);
      setTimeout(onFechar, 1200);
    } catch (e) {
      setErro(e.message || 'Falha ao resetar senha.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div className="bg-superficie rounded-md w-full max-w-[400px] my-auto p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold">Resetar senha</p>
          <button onClick={onFechar} className="text-grafite-medio hover:text-grafite"><X size={18} /></button>
        </div>
        {ok ? (
          <div className="flex items-center gap-2 text-[14px] font-semibold text-nivel py-4">
            <Check size={18} /> Senha atualizada!
          </div>
        ) : (
          <>
            <p className="text-[13px] text-grafite-medio mb-4">
              Nova senha para <span className="font-semibold text-grafite">{usuario.nome}</span>.
            </p>
            <input
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
              placeholder="Nova senha"
              className="w-full min-w-0 py-2.5 px-3 text-[14px] border-2 border-linha rounded-p bg-superficie focus:border-grafite outline-none mb-3"
            />
            {erro && <p className="text-[12.5px] text-prumo font-semibold mb-3">{erro}</p>}
            <div className="flex gap-2">
              <button onClick={onFechar} className="flex-1 py-2.5 rounded-p border border-linha text-[14px] font-semibold hover:bg-concreto">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 py-2.5 rounded-p bg-trena hover:bg-trena-escuro text-white text-[14px] font-bold disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Resetar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
