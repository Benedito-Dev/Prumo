// Botão do design system (seção 05).
// Variantes: primario (ação amarela, 64px, largura total), secundario,
// perigo, texto. Regra: uma ação amarela (primário) por tela.
const VARIANTES = {
  primario:
    'w-full min-h-[64px] bg-trena text-grafite text-[19px] hover:bg-trena-escuro',
  secundario:
    'min-h-[56px] bg-superficie text-grafite border-2 border-grafite hover:bg-concreto',
  perigo:
    'min-h-[56px] bg-superficie text-prumo border-2 border-prumo hover:bg-prumo/5',
  texto:
    'bg-transparent text-grafite-medio font-semibold underline underline-offset-4 px-2',
};

export default function Botao({ variante = 'secundario', className = '', children, ...props }) {
  return (
    <button
      className={`font-ui font-bold text-[17px] rounded-p px-6 cursor-pointer
        transition-[transform,background] duration-100 active:translate-y-px
        focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-grafite focus-visible:outline-offset-[3px]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
