// Dropdown customizado (substitui o <select> nativo, que não segue o tema).
// opcoes: [{ id, rotulo }]. Fecha ao clicar fora ou selecionar.
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Seletor({ valor, opcoes, onChange, prefixo = '', className = '' }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function aoClicarFora(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const selecionada = opcoes.find((o) => o.id === valor);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`flex items-center justify-between gap-2 w-full py-2 px-3 text-[13px] font-medium border-2 rounded-p bg-superficie cursor-pointer transition-colors ${
          aberto ? 'border-grafite' : 'border-linha hover:border-grafite-medio'
        }`}
      >
        <span className="truncate">
          {prefixo && <span className="text-grafite-medio">{prefixo} </span>}
          {selecionada?.rotulo}
        </span>
        <ChevronDown
          size={15}
          className={`text-grafite-medio shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-superficie border border-linha rounded-p shadow-lg overflow-hidden min-w-[160px]">
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id);
                setAberto(false);
              }}
              className={`flex items-center justify-between w-full text-left px-3 py-2 text-[13px] cursor-pointer hover:bg-concreto transition-colors ${
                o.id === valor ? 'font-semibold text-grafite' : 'text-grafite-medio'
              }`}
            >
              {o.rotulo}
              {o.id === valor && <Check size={14} className="text-trena shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
