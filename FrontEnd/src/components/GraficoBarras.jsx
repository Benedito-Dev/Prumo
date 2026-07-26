// Gráfico de barras simples do design system (seção 06 / RF22).
// Barras cinza, última em destaque amarelo (trena). Legível de relance,
// sem eixo Y — "um número por vez". Recebe dados [{ rotulo, valor }].
export default function GraficoBarras({ dados = [] }) {
  const max = Math.max(...dados.map((d) => d.valor), 1);

  if (dados.length === 0) {
    return (
      <p className="text-[13.5px] text-grafite-medio text-center py-6">
        Sem dados no período.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-1.5 h-24 pt-2">
        {dados.map((d, i) => {
          const altura = Math.max((d.valor / max) * 100, 2);
          const ultima = i === dados.length - 1;
          return (
            <div
              key={i}
              title={`${d.rotulo}: ${d.valor}`}
              className={`flex-1 rounded-t-sm transition-[height] ${
                ultima ? 'bg-trena' : 'bg-linha'
              }`}
              style={{ height: `${altura}%` }}
            />
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {dados.map((d, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[10.5px] text-grafite-medio font-semibold uppercase"
          >
            {d.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
