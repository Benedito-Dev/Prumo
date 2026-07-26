// Fio de prumo — elemento assinatura da marca (design system).
// Fio vertical com a "ponta" triangular embaixo. Marca hierarquia,
// não enfeite: só em cabeçalho de seção e cartão de indicador.
// claro=true para uso sobre fundo grafite.
export default function Fio({ claro = false, className = '' }) {
  const cor = claro ? 'bg-superficie' : 'bg-grafite';
  const ponta = claro ? 'border-t-superficie' : 'border-t-grafite';
  return (
    <div className={`w-[3px] self-stretch relative ${cor} ${className}`}>
      <span
        className={`absolute left-1/2 -translate-x-1/2 -bottom-[9px]
          w-0 h-0 border-x-[6px] border-x-transparent border-t-[10px] ${ponta}`}
      />
    </div>
  );
}
