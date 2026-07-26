// Aviso do design system (seção 05).
// atencao (amarelo trena) para alertas; erro (vermelho) para falhas.
const VARIANTES = {
  atencao: 'bg-[#FFF6D9] border-l-[5px] border-trena',
  erro: 'bg-[#F8E3E1] border-l-[5px] border-prumo',
};

export default function Aviso({ variante = 'atencao', titulo, children, className = '' }) {
  return (
    <div className={`flex gap-[14px] p-[18px] rounded-g items-start ${VARIANTES[variante]} ${className}`}>
      <div>
        {titulo && <h4 className="m-0 mb-1 text-[15.5px] font-bold">{titulo}</h4>}
        {children && (
          <p className="m-0 text-[14.5px] text-grafite-medio leading-[1.5]">{children}</p>
        )}
      </div>
    </div>
  );
}
