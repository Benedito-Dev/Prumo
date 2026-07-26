// Cartão de indicador do design system (seção 05).
// O número "pendura no fio". Variação sempre com seta + texto (regra:
// verde/vermelho nunca sozinhos).
import Fio from './Fio';

export default function Kpi({ rotulo, valor, variacao, sentido }) {
  // sentido: 'sobe' (verde) | 'desce' (vermelho) | undefined (neutro)
  const corVariacao =
    sentido === 'sobe' ? 'text-nivel' : sentido === 'desce' ? 'text-prumo' : 'text-grafite-medio';
  const seta = sentido === 'sobe' ? '↑' : sentido === 'desce' ? '↓' : '';

  return (
    <div className="bg-superficie border border-linha rounded-g p-5 flex gap-[14px]">
      <Fio />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-grafite-medio m-0">
          {rotulo}
        </p>
        <p className="font-display text-[38px] leading-[1.05] mt-2 tabular-nums tracking-[-0.02em]">
          {valor}
        </p>
        {variacao && (
          <p className={`text-[14px] font-bold mt-[6px] tabular-nums ${corVariacao}`}>
            {seta} {variacao}
          </p>
        )}
      </div>
    </div>
  );
}
