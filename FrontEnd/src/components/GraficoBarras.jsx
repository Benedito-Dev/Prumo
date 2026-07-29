// Gráfico de barras do design system (seção 06 / RF22).
// Barras cinza, última em destaque amarelo (trena). Mostra o valor em
// cima de cada barra e linhas de grade horizontais de referência.
// preencher=true: ocupa toda a altura do contêiner (para cards altos).
import { moedaCurta } from '../utils/formato';

export default function GraficoBarras({ dados = [], preencher = false }) {
  const max = Math.max(...dados.map((d) => d.valor), 1);

  if (dados.length === 0) {
    return (
      <p className="text-[13.5px] text-grafite-medio text-center py-6">
        Sem dados no período.
      </p>
    );
  }

  // 4 linhas de grade (0, 25, 50, 75, 100% do máximo)
  const linhas = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className={preencher ? 'h-full flex flex-col' : ''}>
      <div className={`relative ${preencher ? 'flex-1 min-h-0' : 'h-[130px]'}`}>
        {/* linhas de grade + rótulos do eixo Y */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {linhas.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="text-[9.5px] text-grafite-medio/70 tabular-nums w-10 text-right shrink-0">
                {f === 0 ? '0' : moedaCurta(max * f)}
              </span>
              <div className="flex-1 border-t border-linha/60" />
            </div>
          ))}
        </div>

        {/* barras (com recuo à esquerda p/ não cobrir os rótulos do eixo) */}
        <div className="absolute inset-0 pl-12 flex items-end justify-around gap-3">
          {dados.map((d, i) => {
            const altura = Math.max((d.valor / max) * 100, 1.5);
            const ultima = i === dados.length - 1;
            return (
              <div key={i} className="flex-1 max-w-[64px] h-full flex flex-col justify-end items-center">
                {/* valor em cima */}
                <span className="text-[10px] font-bold text-grafite tabular-nums mb-1 whitespace-nowrap">
                  {moedaCurta(d.valor)}
                </span>
                <div
                  title={`${d.rotulo}: ${moedaCurta(d.valor)}`}
                  className={`w-full rounded-t-[3px] transition-[height] hover:opacity-80 ${
                    ultima ? 'bg-trena' : 'bg-linha'
                  }`}
                  style={{ height: `${altura}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* eixo X (dias) */}
      <div className="flex justify-around gap-3 mt-1.5 pl-12 shrink-0">
        {dados.map((d, i) => (
          <span
            key={i}
            className="flex-1 max-w-[64px] text-center text-[10px] text-grafite-medio font-semibold tabular-nums"
          >
            {d.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
