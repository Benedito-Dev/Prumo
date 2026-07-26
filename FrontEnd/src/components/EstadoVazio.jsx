// Estado vazio do design system (seção 05).
// Borda tracejada, título, texto e uma ação para sair do zero.
export default function EstadoVazio({ titulo, children, acao, className = '' }) {
  return (
    <div
      className={`text-center px-6 py-11 border-2 border-dashed border-linha
        rounded-g bg-superficie ${className}`}
    >
      <h4 className="m-0 mb-[6px] text-[18px]">{titulo}</h4>
      {children && <p className="m-0 mb-5 text-grafite-medio text-[15px]">{children}</p>}
      {acao}
    </div>
  );
}
