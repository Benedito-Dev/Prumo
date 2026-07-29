// Cartão de indicador — densidade de sistema de gestão (compacto).
// Acento lateral em vez do fio-seta. Variante herói (grafite) para o
// número principal.

export default function Kpi({ rotulo, valor, variacao, sentido, heroi = false, icone }) {
  const seta = sentido === 'sobe' ? '↑' : sentido === 'desce' ? '↓' : '';

  if (heroi) {
    return (
      <div className="relative overflow-hidden bg-grafite text-superficie rounded-md px-4 py-3 h-full flex flex-col justify-center">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-trena" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-bold tracking-[0.1em] uppercase text-[#A8B0B8]">
              {rotulo}
            </p>
            <p className="font-display text-[26px] leading-none mt-1 tabular-nums tracking-[-0.02em]">
              {valor}
            </p>
            {variacao && (
              <p
                className={`text-[11.5px] font-bold mt-1 tabular-nums ${
                  sentido === 'sobe'
                    ? 'text-[#5fcf94]'
                    : sentido === 'desce'
                      ? 'text-[#ff8a7a]'
                      : 'text-[#A8B0B8]'
                }`}
              >
                {seta} {variacao}
              </p>
            )}
          </div>
          {icone && <span className="text-[18px] opacity-60">{icone}</span>}
        </div>
      </div>
    );
  }

  const corVariacao =
    sentido === 'sobe' ? 'text-nivel' : sentido === 'desce' ? 'text-prumo' : 'text-grafite-medio';

  return (
    <div className="relative overflow-hidden bg-superficie border border-linha rounded-md px-4 py-3 h-full flex flex-col justify-center">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-grafite-medio">
            {rotulo}
          </p>
          <p className="font-display text-[21px] leading-none mt-1 tabular-nums tracking-[-0.02em]">
            {valor}
          </p>
          {variacao && (
            <p className={`text-[11px] font-bold mt-1 tabular-nums ${corVariacao}`}>
              {seta} {variacao}
            </p>
          )}
        </div>
        {icone && <span className="text-[16px] opacity-45 shrink-0">{icone}</span>}
      </div>
    </div>
  );
}
