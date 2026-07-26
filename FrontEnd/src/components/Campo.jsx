// Campo de formulário do design system (seção 05).
// Rótulo em caixa alta, input de 56px, texto de ajuda e estado de erro.
// numero=true: alinhado à direita, tabular, para dinheiro/quantidade.
export default function Campo({
  rotulo,
  ajuda,
  erro,
  numero = false,
  className = '',
  ...props
}) {
  return (
    <label className={`block mb-[18px] ${className}`}>
      {rotulo && (
        <span className="block text-[13px] font-bold tracking-[0.07em] uppercase text-grafite-medio mb-[7px]">
          {rotulo}
        </span>
      )}
      <input
        className={`w-full min-h-[56px] rounded-p px-4 bg-superficie
          font-ui text-[19px] font-medium text-grafite
          border-2 ${erro ? 'border-prumo' : 'border-linha'}
          focus:outline-none focus:border-grafite
          ${numero ? 'text-right tabular-nums font-bold' : ''}`}
        {...props}
      />
      {ajuda && !erro && (
        <span className="block text-[13.5px] text-grafite-medio mt-[6px]">{ajuda}</span>
      )}
      {erro && (
        <span className="block text-[13.5px] text-prumo mt-[6px] font-semibold">{erro}</span>
      )}
    </label>
  );
}
