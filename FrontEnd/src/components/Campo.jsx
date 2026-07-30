// Campo de formulário do design system (seção 05).
// Rótulo em caixa alta, input de 56px, texto de ajuda e estado de erro.
// numero=true: alinhado à direita, tabular, para dinheiro/quantidade.
// type="password": mostra um botão de olho para revelar/ocultar a senha.
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Campo({
  rotulo,
  ajuda,
  erro,
  numero = false,
  type = 'text',
  className = '',
  ...props
}) {
  const ehSenha = type === 'password';
  const [mostrar, setMostrar] = useState(false);
  const tipoInput = ehSenha ? (mostrar ? 'text' : 'password') : type;

  return (
    <label className={`block mb-[18px] ${className}`}>
      {rotulo && (
        <span className="block text-[13px] font-bold tracking-[0.07em] uppercase text-grafite-medio mb-[7px]">
          {rotulo}
        </span>
      )}
      <div className="relative">
        <input
          type={tipoInput}
          className={`w-full min-h-[56px] rounded-p px-4 bg-superficie
            font-ui text-[19px] font-medium text-grafite
            border-2 ${erro ? 'border-prumo' : 'border-linha'}
            transition-[border-color,box-shadow] duration-150
            focus:outline-none focus:border-grafite focus:shadow-[0_0_0_4px_rgba(22,25,29,0.08)]
            placeholder:text-grafite-medio/50 placeholder:font-normal
            [&:-webkit-autofill]:shadow-[inset_0_0_0_100px_#fff]
            ${ehSenha ? 'pr-12' : ''}
            ${numero ? 'text-right tabular-nums font-bold' : ''}`}
          {...props}
        />
        {ehSenha && (
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            title={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-grafite-medio hover:text-grafite p-1"
            tabIndex={-1}
          >
            {mostrar ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {ajuda && !erro && (
        <span className="block text-[13.5px] text-grafite-medio mt-[6px]">{ajuda}</span>
      )}
      {erro && (
        <span className="block text-[13.5px] text-prumo mt-[6px] font-semibold">{erro}</span>
      )}
    </label>
  );
}
