// Modal para o usuário logado trocar a própria senha (confere a atual).
import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { usuariosService } from '../services/usuarios';

const inputS =
  'w-full min-w-0 py-2.5 px-3 text-[14px] border-2 border-linha rounded-p bg-superficie focus:border-grafite outline-none';

export default function ModalTrocarSenha({ onFechar }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setErro('');
    if (!atual || !nova) return setErro('Preencha a senha atual e a nova.');
    if (nova.length < 4) return setErro('A nova senha deve ter ao menos 4 caracteres.');
    if (nova !== confirma) return setErro('A confirmação não confere com a nova senha.');

    setSalvando(true);
    try {
      await usuariosService.trocarMinhaSenha(atual, nova);
      setOk(true);
      setTimeout(onFechar, 1300);
    } catch (e) {
      setErro(e.message || 'Falha ao trocar senha.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-superficie rounded-md w-full max-w-[400px] p-5 overflow-x-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[16px] font-bold text-grafite">Trocar minha senha</p>
          <button onClick={onFechar} className="text-grafite-medio hover:text-grafite">
            <X size={18} />
          </button>
        </div>

        {ok ? (
          <div className="flex items-center gap-2 text-[14px] font-semibold text-nivel py-4">
            <Check size={18} /> Senha alterada com sucesso!
          </div>
        ) : (
          <>
            <Campo rotulo="Senha atual">
              <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoFocus className={inputS} />
            </Campo>
            <Campo rotulo="Nova senha">
              <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} className={inputS} />
            </Campo>
            <Campo rotulo="Confirmar nova senha">
              <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className={inputS} />
            </Campo>

            {erro && <p className="text-[12.5px] text-prumo font-semibold mb-3">{erro}</p>}

            <div className="flex gap-2 mt-2">
              <button onClick={onFechar} className="flex-1 py-2.5 rounded-p border border-linha text-[14px] font-semibold text-grafite hover:bg-concreto">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 py-2.5 rounded-p bg-trena hover:bg-trena-escuro text-white text-[14px] font-bold disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Trocar senha'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Campo({ rotulo, children }) {
  return (
    <label className="block min-w-0 mb-3">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-grafite-medio mb-1.5">{rotulo}</span>
      {children}
    </label>
  );
}
