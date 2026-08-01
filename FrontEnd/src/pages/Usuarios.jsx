import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UserCog, X, KeyRound, Check } from 'lucide-react';
import LayoutApp from '../components/LayoutApp';
import { usuariosService, PAPEIS, rotuloPapel } from '../services/usuarios';
import { useAuth } from '../auth/AuthContext';

export default function Usuarios() {
  const { usuario: eu } = useAuth();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);
  const [resetando, setResetando] = useState(null); // usuário para resetar senha

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setUsuarios(await usuariosService.listar());
    } catch (e) {
      setErro(e.message || 'Falha ao carregar usuários.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function alternar(u) {
    await usuariosService.alternarAtivo(u.id, !u.ativo);
    carregar();
  }

  return (
    <LayoutApp
      titulo="Usuários"
      acao={
        <button
          onClick={() => setCriando(true)}
          className="h-8 px-4 rounded-p bg-trena hover:bg-trena-escuro text-white font-bold text-[13px] transition-colors flex items-center gap-1.5"
        >
          <Plus size={15} /> Novo usuário
        </button>
      }
    >
      <div className="flex flex-col gap-4 h-[calc(100vh-56px-32px)] min-h-[500px]">
        <div className="bg-superficie border border-linha rounded-md overflow-hidden flex-1 flex flex-col min-h-0">
          {carregando ? (
            <div className="flex-1 flex items-center justify-center text-grafite-medio text-[13px]">
              Carregando…
            </div>
          ) : erro ? (
            <div className="flex-1 flex items-center justify-center text-prumo font-semibold text-[14px] px-6 text-center">
              {erro}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-superficie z-10">
                  <tr className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio border-b border-linha">
                    <th className="text-left px-5 py-3">Usuário</th>
                    <th className="text-left px-3 py-3">E-mail</th>
                    <th className="text-left px-3 py-3">Papel</th>
                    <th className="text-center px-3 py-3">Status</th>
                    <th className="text-right px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const souEu = u.id === eu?.id;
                    return (
                      <tr
                        key={u.id}
                        onClick={() => navigate(`/usuarios/${u.id}`)}
                        className={`text-[14px] border-b border-linha cursor-pointer hover:bg-concreto ${!u.ativo ? 'opacity-55' : ''}`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-trena/15 text-trena-escuro font-bold text-[13px] flex items-center justify-center shrink-0">
                              {u.nome.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-semibold">
                              {u.nome}
                              {souEu && (
                                <span className="ml-2 text-[10px] font-bold uppercase text-nivel bg-nivel/10 px-1.5 py-0.5 rounded">
                                  você
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-grafite-medio">{u.email}</td>
                        <td className="px-3 py-3">
                          <span className="text-[12px] font-semibold text-grafite bg-concreto px-2 py-0.5 rounded">
                            {rotuloPapel(u.papel)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {u.ativo ? (
                            <span className="text-[11px] font-bold uppercase text-nivel bg-nivel/10 px-2 py-0.5 rounded">
                              ativo
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold uppercase text-grafite-medio bg-concreto px-2 py-0.5 rounded">
                              inativo
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setResetando(u)}
                              className="flex items-center gap-1 text-[12px] font-semibold text-grafite-medio hover:text-grafite px-2 py-1 rounded-p hover:bg-concreto"
                              title="Resetar senha"
                            >
                              <KeyRound size={14} /> Senha
                            </button>
                            {!souEu && (
                              <button
                                onClick={() => alternar(u)}
                                className={`text-[12px] font-semibold px-2 py-1 rounded-p hover:bg-concreto ${
                                  u.ativo ? 'text-prumo' : 'text-nivel'
                                }`}
                              >
                                {u.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!carregando && !erro && (
            <div className="shrink-0 px-5 py-2.5 border-t border-linha text-[12px] text-grafite-medio">
              {usuarios.length} usuário(s)
            </div>
          )}
        </div>
      </div>

      {criando && (
        <ModalNovoUsuario onFechar={() => setCriando(false)} onSalvo={() => { setCriando(false); carregar(); }} />
      )}
      {resetando && (
        <ModalResetarSenha usuario={resetando} onFechar={() => setResetando(null)} onSalvo={() => setResetando(null)} />
      )}
    </LayoutApp>
  );
}

const inputU =
  'w-full min-w-0 py-2.5 px-3 text-[14px] border-2 border-linha rounded-p bg-superficie focus:border-grafite outline-none';

function CampoU({ rotulo, children }) {
  return (
    <label className="block min-w-0 mb-3">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-grafite-medio mb-1.5">{rotulo}</span>
      {children}
    </label>
  );
}

// ---------- Modal novo usuário ----------
function ModalNovoUsuario({ onFechar, onSalvo }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState('vendedor');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    if (!nome.trim() || !email.trim() || !senha.trim()) return setErro('Preencha todos os campos.');
    setSalvando(true);
    try {
      await usuariosService.criar({ nome: nome.trim(), email: email.trim(), senha, papel });
      onSalvo();
    } catch (e) {
      setErro(e.message || 'Falha ao criar usuário.');
      setSalvando(false);
    }
  }

  return (
    <Overlay onFechar={onFechar} titulo="Novo usuário">
      <CampoU rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus className={inputU} />
      </CampoU>
      <CampoU rotulo="E-mail">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputU} />
      </CampoU>
      <CampoU rotulo="Senha inicial">
        <input value={senha} onChange={(e) => setSenha(e.target.value)} className={inputU} />
      </CampoU>
      <CampoU rotulo="Papel">
        <div className="grid grid-cols-4 gap-2">
          {PAPEIS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPapel(p.id)}
              className={`py-2 rounded-p text-[12.5px] font-semibold border-2 transition-colors ${
                papel === p.id
                  ? 'bg-trena text-white border-trena'
                  : 'bg-superficie text-grafite border-linha hover:border-grafite-medio'
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </CampoU>
      {erro && <p className="text-[12.5px] text-prumo font-semibold mb-3">{erro}</p>}
      <AcoesModal onFechar={onFechar} onSalvar={salvar} salvando={salvando} rotulo="Cadastrar" />
    </Overlay>
  );
}

// ---------- Modal resetar senha ----------
function ModalResetarSenha({ usuario, onFechar, onSalvo }) {
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
      setTimeout(onSalvo, 1200);
    } catch (e) {
      setErro(e.message || 'Falha ao resetar senha.');
      setSalvando(false);
    }
  }

  return (
    <Overlay onFechar={onFechar} titulo="Resetar senha">
      <p className="text-[13px] text-grafite-medio mb-4">
        Definir uma nova senha para <span className="font-semibold text-grafite">{usuario.nome}</span>.
      </p>
      {ok ? (
        <div className="flex items-center gap-2 text-[14px] font-semibold text-nivel py-4">
          <Check size={18} /> Senha atualizada!
        </div>
      ) : (
        <>
          <CampoU rotulo="Nova senha">
            <input value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus className={inputU} />
          </CampoU>
          {erro && <p className="text-[12.5px] text-prumo font-semibold mb-3">{erro}</p>}
          <AcoesModal onFechar={onFechar} onSalvar={salvar} salvando={salvando} rotulo="Resetar" />
        </>
      )}
    </Overlay>
  );
}

// ---------- Componentes compartilhados ----------
function Overlay({ titulo, onFechar, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-superficie rounded-md w-full max-w-[420px] p-5 overflow-x-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold">{titulo}</p>
          <button onClick={onFechar} className="text-grafite-medio hover:text-grafite">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AcoesModal({ onFechar, onSalvar, salvando, rotulo }) {
  return (
    <div className="flex gap-2 mt-4">
      <button onClick={onFechar} className="flex-1 py-2.5 rounded-p border border-linha text-[14px] font-semibold hover:bg-concreto">
        Cancelar
      </button>
      <button
        onClick={onSalvar}
        disabled={salvando}
        className="flex-1 py-2.5 rounded-p bg-trena hover:bg-trena-escuro text-white text-[14px] font-bold disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : rotulo}
      </button>
    </div>
  );
}
