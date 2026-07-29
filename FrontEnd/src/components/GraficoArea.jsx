// Gráfico de área com linha para série temporal (RF22).
// Linha suave preenchida, escala no eixo Y e datas no eixo X.
// Cor da identidade Prumo (trena). Recebe dados [{ rotulo, valor }].
import { moedaCurta } from '../utils/formato';

export default function GraficoArea({ dados = [], cor = '#D9A500' }) {
  if (dados.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-grafite-medio">Sem dados no período.</p>
      </div>
    );
  }

  const max = Math.max(...dados.map((d) => d.valor), 1);
  const W = 1000;
  const H = 300;
  const padL = 8;
  const n = dados.length;

  // pontos em coordenadas do viewBox
  const px = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * (W - padL) + padL);
  const py = (v) => H - (v / max) * (H - 10) - 4;
  const pts = dados.map((d, i) => [px(i), py(d.valor)]);

  // caminho suave (curva de Catmull-Rom simplificada -> Bézier)
  const linha = pts
    .map((p, i) => {
      if (i === 0) return `M ${p[0]},${p[1]}`;
      const prev = pts[i - 1];
      const cx = (prev[0] + p[0]) / 2;
      return `C ${cx},${prev[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
    })
    .join(' ');
  const area = `${linha} L ${pts[n - 1][0]},${H} L ${pts[0][0]},${H} Z`;

  // 5 níveis de grade
  const niveis = [1, 0.75, 0.5, 0.25, 0];

  // rótulos do eixo X (no máx ~8 para não poluir)
  const passoX = Math.ceil(n / 8);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex">
        {/* eixo Y */}
        <div className="flex flex-col justify-between pr-2 py-1 shrink-0">
          {niveis.map((f) => (
            <span key={f} className="text-[9.5px] text-grafite-medio/70 tabular-nums text-right">
              {f === 0 ? 'R$ 0' : moedaCurta(max * f)}
            </span>
          ))}
        </div>

        {/* área do gráfico */}
        <div className="flex-1 min-w-0 relative">
          {/* linhas de grade */}
          <div className="absolute inset-0 flex flex-col justify-between py-1">
            {niveis.map((f) => (
              <div key={f} className="border-t border-linha/50" />
            ))}
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <linearGradient id="preenchArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={cor} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#preenchArea)" />
            <path
              d={linha}
              fill="none"
              stroke={cor}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* eixo X */}
      <div className="flex justify-between pl-[46px] pr-1 mt-1 shrink-0">
        {dados.map((d, i) =>
          i % passoX === 0 || i === n - 1 ? (
            <span key={i} className="text-[9.5px] text-grafite-medio tabular-nums">
              {d.rotulo}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}
