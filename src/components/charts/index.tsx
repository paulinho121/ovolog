import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

/* Gráficos em SVG puro — nenhuma biblioteca. Em telas de 390px, uma legenda
   grande e poucos rótulos diretos leem melhor que um eixo cheio de números.

   Cor: séries únicas usam a cor da marca (#C2560A, contraste 4.6:1 sobre
   branco). Onde há mais de uma série, a paleta validada (azul/laranja/verde-
   água) entra com rótulo direto — nunca cor sozinha. */

const BRAND = '#C2560A';
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];
const GRID = '#ECEBE6';
const AXIS_TEXT = '#6B6660';
const INK = '#1C1917';

/* Largura real do contêiner.

   Sem isso o viewBox seria fixo e o SVG escalaria proporcionalmente: um
   gráfico de 340×172 dentro de um painel de 660px viraria 660×334, alto
   demais. Medindo, desenhamos em pixels reais e a altura é a pedida — o que
   importa quando a mesma peça serve um celular de 360px e um painel de
   desktop. */
function useLargura(fallback = 340) {
  const ref = useRef<HTMLElement | null>(null);
  const [largura, setLargura] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(240, Math.round(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, largura] as const;
}

/** Retângulo com as duas pontas de cima arredondadas, ancorado na base. */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x} ${y + h} L${x} ${y + rr} Q${x} ${y} ${x + rr} ${y} L${x + w - rr} ${y} Q${x + w} ${y} ${x + w} ${y + rr} L${x + w} ${y + h} Z`;
}

/** Barra horizontal com a ponta direita arredondada. */
function endRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w, h / 2);
  return `M${x} ${y} L${x + w - rr} ${y} Q${x + w} ${y} ${x + w} ${y + rr} L${x + w} ${y + h - rr} Q${x + w} ${y + h} ${x + w - rr} ${y + h} L${x} ${y + h} Z`;
}

/* ------------------------------------------------------- Barras verticais */

export function BarChart({
  data,
  formatValue,
  height = 172,
  label,
}: {
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
  height?: number;
  /** Nome da série — o título nomeia o dado, então não há legenda. */
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [ref, W] = useLargura();
  const padL = 8;
  const padR = 8;
  const padT = 26;
  const padB = 26;
  const max = Math.max(...data.map((d) => d.value), 1);
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const slot = plotW / data.length;
  const barW = Math.min(44, Math.max(6, slot - 10));
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <figure ref={ref as React.RefObject<HTMLElement>} className="m-0 w-full">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width={W}
        height={height}
        className="block"
        role="img"
        aria-label={label}
      >
        {/* Grade recessiva: três linhas bastam para dar escala. */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={padL}
            x2={W - padR}
            y1={padT + plotH * (1 - t)}
            y2={padT + plotH * (1 - t)}
            stroke={GRID}
            strokeWidth={1}
          />
        ))}

        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * plotH);
          const x = padL + slot * i + (slot - barW) / 2;
          const y = padT + plotH - h;
          const shown = active === i || (active === null && i === peak);
          return (
            <g key={`${d.label}-${i}`}>
              <path
                d={topRounded(x, y, barW, h, 4)}
                fill={BRAND}
                opacity={active === null || active === i ? 1 : 0.4}
              />
              {shown && (
                <text x={x + barW / 2} y={y - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK}>
                  {formatValue(d.value)}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={11}
                fill={AXIS_TEXT}
                fontWeight={shown ? 700 : 400}
              >
                {d.label}
              </text>
              {/* Alvo de toque maior que a barra. */}
              <rect
                x={padL + slot * i}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                onClick={() => setActive(active === i ? null : i)}
                className="cursor-pointer"
              />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/* ----------------------------------------------------- Barras horizontais */

/* Ranking: cada barra já vem com nome e valor escritos — nada depende de
   comparar comprimentos no olho. */
export function RankBars({
  data,
  formatValue,
  label,
}: {
  data: { label: string; value: number; hint?: string }[];
  formatValue: (v: number) => string;
  label: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-3" aria-label={label}>
      {data.map((d, i) => (
        <li key={`${d.label}-${i}`}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              {/* Posição é informação, não enfeite: os três primeiros ganham
                  peso porque é isso que se procura num ranking. Do quarto em
                  diante o número volta a ser discreto. */}
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-micro font-bold tnum',
                  i === 0
                    ? 'bg-brand-100 text-brand-800 ring-1 ring-brand-200'
                    : i === 1
                      ? 'bg-shell-200 text-shell-700'
                      : i === 2
                        ? 'bg-warn-50 text-warn-700'
                        : 'text-shell-500',
                )}
              >
                {i + 1}
              </span>
              <span className="truncate text-body font-semibold text-shell-900">{d.label}</span>
            </span>
            <span className="shrink-0 text-body font-bold tnum text-shell-900">
              {formatValue(d.value)}
            </span>
          </div>
          <svg viewBox="0 0 340 8" className="h-2 w-full" aria-hidden="true">
            <rect x={0} y={0} width={340} height={8} rx={4} fill={GRID} />
            <path d={endRounded(0, 0, Math.max(4, (d.value / max) * 340), 8, 4)} fill={BRAND} />
          </svg>
          {d.hint && <div className="mt-1 text-meta text-shell-500">{d.hint}</div>}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ Linha */

export function LineChart({
  data,
  formatValue,
  height = 168,
  label,
}: {
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
  height?: number;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [ref, W] = useLargura();
  const padL = 8;
  const padR = 8;
  const padT = 28;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const span = max - min || 1;
  const px = (i: number) => padL + (plotW / Math.max(1, data.length - 1)) * i;
  const py = (v: number) => padT + plotH - ((v - min) / span) * plotH;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i)} ${py(d.value)}`).join(' ');
  const area = `${line} L${px(data.length - 1)} ${padT + plotH} L${px(0)} ${padT + plotH} Z`;
  const shown = active ?? data.length - 1;

  return (
    <figure ref={ref as React.RefObject<HTMLElement>} className="m-0 w-full">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width={W}
        height={height}
        className="block"
        role="img"
        aria-label={label}
      >
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={padL} x2={W - padR} y1={padT + plotH * t} y2={padT + plotH * t} stroke={GRID} strokeWidth={1} />
        ))}
        <path d={area} fill={BRAND} opacity={0.08} />
        <path d={line} fill="none" stroke={BRAND} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Ponto em destaque + valor. Um rótulo, não doze. */}
        <line x1={px(shown)} x2={px(shown)} y1={padT} y2={padT + plotH} stroke={GRID} strokeWidth={1} />
        <circle cx={px(shown)} cy={py(data[shown].value)} r={5} fill="#FFFFFF" stroke={BRAND} strokeWidth={2.5} />
        <text
          x={Math.min(W - padR - 30, Math.max(padL + 30, px(shown)))}
          y={padT - 12}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill={INK}
        >
          {formatValue(data[shown].value)}
        </text>

        {data.map((d, i) => (
          <g key={`${d.label}-${i}`}>
            {(i === 0 || i === data.length - 1 || i === shown) && (
              <text x={px(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize={11} fill={AXIS_TEXT}>
                {d.label}
              </text>
            )}
            <rect
              x={px(i) - plotW / data.length / 2}
              y={0}
              width={plotW / data.length}
              height={height}
              fill="transparent"
              onClick={() => setActive(i)}
              className="cursor-pointer"
            />
          </g>
        ))}
      </svg>
    </figure>
  );
}

/* ---------------------------------------------------------- Barra composta */

/* Até 3 séries — a paleta validada garante distinção inclusive em daltonismo,
   e cada fatia carrega rótulo e valor por escrito. */
export function StackedBar({
  data,
  formatValue,
  label,
}: {
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
  label: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const W = 340;
  const H = 18;
  let cursor = 0;
  return (
    <figure className="m-0" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[18px] w-full" role="img" aria-label={label}>
        <rect x={0} y={0} width={W} height={H} rx={9} fill={GRID} />
        {data.map((d, i) => {
          const w = (d.value / total) * W;
          const x = cursor;
          cursor += w;
          if (w <= 0) return null;
          return (
            <rect
              key={d.label}
              x={x}
              // 2px de respiro entre fatias — a separação não depende da cor.
              width={Math.max(0, w - 2)}
              y={0}
              height={H}
              rx={i === 0 || i === data.length - 1 ? 9 : 2}
              fill={SERIES[i % SERIES.length]}
            />
          );
        })}
      </svg>
      <ul className="mt-3 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: SERIES[i % SERIES.length] }}
              aria-hidden="true"
            />
            <span className="flex-1 text-meta text-shell-600">{d.label}</span>
            <span className="text-meta font-bold tnum text-shell-900">{formatValue(d.value)}</span>
            <span className="w-10 text-right text-meta tnum text-shell-500">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* -------------------------------------------------------------- Sparkline */

export function Sparkline({
  values,
  className,
  tone = 'brand',
}: {
  values: number[];
  className?: string;
  tone?: 'brand' | 'ok' | 'bad';
}) {
  const color = tone === 'ok' ? '#15803D' : tone === 'bad' ? '#B91C1C' : BRAND;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / Math.max(1, values.length - 1)) * 64} ${20 - ((v - min) / span) * 18}`)
    .join(' ');
  return (
    <svg viewBox="0 0 64 22" className={cn('h-5 w-16', className)} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
