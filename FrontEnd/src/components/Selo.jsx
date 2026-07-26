// Selo de situação do design system (seção 05).
// O fiado usa listra diagonal, como fita de sinalização de obra —
// reconhecível de relance, sem precisar ler.
const VARIANTES = {
  pago: 'bg-[#E2F1E9] text-nivel',
  vencido: 'bg-[#F8E3E1] text-prumo',
  sumido: 'bg-grafite text-superficie',
  neutro: 'bg-concreto text-grafite-medio',
};

const ESTILO_FIADO = {
  background:
    'repeating-linear-gradient(-45deg,#FFC400,#FFC400 7px,#EAB400 7px,#EAB400 14px)',
};

export default function Selo({ variante = 'neutro', children }) {
  const fiado = variante === 'fiado';
  return (
    <span
      className={`inline-flex items-center text-[12px] font-bold tracking-[0.08em] uppercase
        px-[10px] py-[5px] rounded-[4px] ${fiado ? 'text-grafite' : VARIANTES[variante]}`}
      style={fiado ? ESTILO_FIADO : undefined}
    >
      {children}
    </span>
  );
}
