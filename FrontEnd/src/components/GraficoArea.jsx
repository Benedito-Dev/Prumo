// Gráfico de área com linha para série temporal (RF22).
// Linha suave preenchida, escala no eixo Y, datas no eixo X e tooltip
// interativo ao passar o mouse (linha-guia + ponto + balão com valor).
import { useRef, useState } from 'react';
import { moedaCurta, moeda } from '../utils/formato';

export default function GraficoArea({ dados = [], cor = '#0E7C86' }) {
  const areaRef = useRef(null);
  const [hover, setHover] = useState(null); // índice do ponto sob o mouse

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

  const px = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * (W - padL) + padL);
  const py = (v) => H - (v / max) * (H - 10) - 4;
  const pts = dados.map((d, i) => [px(i), py(d.valor)]);

  const linha = pts
    .map((p, i) => {
      if (i === 0) return `M ${p[0]},${p[1]}`;
      const prev = pts[i - 1];
      const cx = (prev[0] + p[0]) / 2;
      return `C ${cx},${prev[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
    })
    .join(' ');
  const area = `${linha} L ${pts[n - 1][0]},${H} L ${pts[0][0]},${H} Z`;

  const niveis = [1, 0.75, 0.5, 0.25, 0];
  const passoX = Math.ceil(n / 8);

  // Ao mover o mouse: converte X do cursor -> índice do ponto mais próximo.
  function aoMover(e) {
    const rect = areaRef.current.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width; // 0..1
    const alvoX = rel * W;
    // acha o índice cujo px está mais perto
    let melhor = 0;
    let dist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p[0] - alvoX);
      if (d < dist) {
        dist = d;
        melhor = i;
      }
    });
    setHover(melhor);
  }

  // posição do tooltip em % (para posicionar via CSS, seguindo o ponto)
  const hoverPctX = hover != null ? (pts[hover][0] / W) * 100 : 0;
  const hoverPctY = hover != null ? (pts[hover][1] / H) * 100 : 0;

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

        {/* área do gráfico (com interação) */}
        <div
          ref={areaRef}
          className="flex-1 min-w-0 relative cursor-crosshair"
          onMouseMove={aoMover}
          onMouseLeave={() => setHover(null)}
        >
          {/* linhas de grade */}
          <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
            {niveis.map((f) => (
              <div key={f} className="border-t border-linha/50" />
            ))}
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
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

          {/* linha-guia vertical (fora do SVG, para deslizar suave) */}
          <div
            className="absolute top-0 bottom-0 w-px pointer-events-none transition-[left,opacity] duration-150 ease-out"
            style={{
              left: `${hoverPctX}%`,
              opacity: hover != null ? 0.5 : 0,
              backgroundImage: `repeating-linear-gradient(to bottom, ${cor} 0 4px, transparent 4px 8px)`,
            }}
          />

          {/* ponto destacado (círculo) — desliza entre os pontos */}
          <span
            className="absolute w-2.5 h-2.5 rounded-full border-2 border-superficie -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-[left,top,opacity] duration-150 ease-out"
            style={{
              left: `${hoverPctX}%`,
              top: `${hoverPctY}%`,
              background: cor,
              opacity: hover != null ? 1 : 0,
            }}
          />

          {/* tooltip — desliza junto com o ponto */}
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none transition-[left,top,opacity] duration-150 ease-out"
            style={{
              left: `${hoverPctX}%`,
              top: `calc(${hoverPctY}% - 12px)`,
              opacity: hover != null ? 1 : 0,
            }}
          >
            <div className="bg-[#16191d] text-white rounded-md px-2.5 py-1.5 shadow-lg ring-1 ring-white/10 whitespace-nowrap">
              <p className="text-[10px] text-white/55 font-semibold">
                {hover != null ? dados[hover].rotulo : ''}
              </p>
              <p className="text-[13px] font-bold tabular-nums">
                {hover != null ? moeda(dados[hover].valor) : ''}
              </p>
            </div>
            <div className="w-2 h-2 bg-[#16191d] rotate-45 mx-auto -mt-1" />
          </div>
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
