// Lista e item do design system (seção 05).
// Usada em rankings e listagens. Item tem 56px de altura mínima (toque),
// posição opcional (ranking), corpo (nome + meta) e valor à direita.

export function Lista({ className = '', children }) {
  return (
    <div className={`border border-linha rounded-g overflow-hidden bg-superficie ${className}`}>
      {children}
    </div>
  );
}

export function Item({ posicao, nome, meta, valor, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-[14px] px-[18px] py-4 min-h-[56px]
        border-b border-linha last:border-b-0
        ${onClick ? 'cursor-pointer hover:bg-concreto' : ''}`}
    >
      {posicao != null && (
        <span className="font-display text-[15px] text-grafite-medio w-6 text-center tabular-nums">
          {posicao}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-semibold m-0 truncate">{nome}</p>
        {meta && <p className="text-[13.5px] text-grafite-medio mt-[3px] m-0">{meta}</p>}
      </div>
      {valor != null && (
        <span className="font-ui font-bold text-[17px] tabular-nums whitespace-nowrap">
          {valor}
        </span>
      )}
    </div>
  );
}
