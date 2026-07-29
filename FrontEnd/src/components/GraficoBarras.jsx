// Gráfico de barras simples do design system (seção 06 / RF22).
// Barras cinza, última em destaque amarelo (trena). Legível de relance,
// sem eixo Y — "um número por vez". Recebe dados [{ rotulo, valor }].
// preencher=true: ocupa toda a altura do contêiner (para cards altos).
export default function GraficoBarras({ dados = [], preencher = false }) {
  const max = Math.max(...dados.map((d) => d.valor), 1);

  if (dados.length === 0) {
    return (
      <p className="text-[13.5px] text-grafite-medio text-center py-6">
        Sem dados no período.
      </p>
    );
  }

  return (
    <div className={preencher ? 'h-full flex flex-col' : ''}>
      <div className={`flex items-end gap-2 pt-2 ${preencher ? 'flex-1 min-h-0' : 'h-[130px]'}`}>
        {dados.map((d, i) => {
          const altura = Math.max((d.valor / max) * 100, 2);
          const ultima = i === dados.length - 1;
          return (
            <div
              key={i}
              title={`${d.rotulo}: ${d.valor}`}
              className={`group relative flex-1 rounded-t-[3px] transition-[height,background] hover:opacity-90 ${
                ultima ? 'bg-trena' : 'bg-linha hover:bg-grafite-medio'
              }`}
              style={{ height: `${altura}%` }}
            />
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5 shrink-0">
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
