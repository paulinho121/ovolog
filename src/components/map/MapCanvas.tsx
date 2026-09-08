import { Crosshair, Layers } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import type { Customer, RouteStop, Vehicle } from '../../types';
import type { Position } from '../../store/app';

/* Mapa estilizado desenhado em SVG num plano 0–100.

   Não há provedor de mapas: o protótipo entrega a *experiência* de navegação
   (traçado, paradas numeradas, posição pulsante, veículos em movimento) sem
   depender de rede — o que também é coerente com a operação offline. Trocar
   por um mapa real significa substituir só este componente: as coordenadas
   x/y viram lat/lng e o resto do app não muda. */

/* Malha viária fixa — desenhada à mão para parecer uma cidade, não um xadrez. */
const ARTERIALS = [
  'M0 22 H100',
  'M0 47 H100',
  'M0 71 H100',
  'M24 0 V100',
  'M53 0 V100',
  'M79 0 V100',
  'M0 92 Q30 78 52 71 T100 44',
];

const STREETS = [
  'M0 10 H100', 'M0 34 H100', 'M0 59 H100', 'M0 83 H100',
  'M12 0 V100', 'M38 0 V100', 'M66 0 V100', 'M91 0 V100',
  'M24 34 L38 10', 'M53 59 L66 34', 'M79 83 L91 59',
];

const BLOCKS = [
  { x: 26, y: 24, w: 25, h: 21 }, { x: 55, y: 24, w: 22, h: 21 },
  { x: 26, y: 49, w: 25, h: 20 }, { x: 55, y: 49, w: 22, h: 20 },
  { x: 2, y: 24, w: 20, h: 21 }, { x: 81, y: 24, w: 17, h: 21 },
  { x: 2, y: 49, w: 20, h: 20 }, { x: 81, y: 49, w: 17, h: 20 },
  { x: 26, y: 2, w: 25, h: 18 }, { x: 55, y: 2, w: 22, h: 18 },
];

export interface MapStop {
  id: string;
  customer: Customer;
  status: RouteStop['status'];
  sequence: number;
}

export function MapCanvas({
  stops = [],
  position,
  vehicles = [],
  className,
  /** Recorte do plano — usado para "aproximar" na parada atual. */
  focus,
  showLabels = false,
  onStopClick,
  onRecenter,
  interactive = true,
}: {
  stops?: MapStop[];
  position?: Position;
  vehicles?: Vehicle[];
  className?: string;
  focus?: { x: number; y: number; zoom: number };
  showLabels?: boolean;
  onStopClick?: (stopId: string) => void;
  onRecenter?: () => void;
  interactive?: boolean;
}) {
  const viewBox = useMemo(() => {
    if (!focus) return '0 0 100 100';
    const size = 100 / focus.zoom;
    const x = Math.min(100 - size, Math.max(0, focus.x - size / 2));
    const y = Math.min(100 - size, Math.max(0, focus.y - size / 2));
    return `${x} ${y} ${size} ${size}`;
  }, [focus]);

  /* O traçado liga as paradas na ordem; o trecho já cumprido fica sólido e
     apagado, o que falta fica tracejado na cor da marca — a mesma convenção
     dos apps de navegação. */
  const { donePath, todoPath } = useMemo(() => {
    if (stops.length < 2) return { donePath: '', todoPath: '' };
    const pts = stops.map((s) => `${s.customer.x} ${s.customer.y}`);
    const firstPending = stops.findIndex(
      (s) => s.status !== 'concluida' && s.status !== 'nao_atendida',
    );
    const cut = firstPending === -1 ? stops.length : Math.max(1, firstPending);
    return {
      donePath: `M${pts.slice(0, cut).join(' L')}`,
      todoPath: `M${pts.slice(Math.max(0, cut - 1)).join(' L')}`,
    };
  }, [stops]);

  const scale = focus ? 1 / focus.zoom : 1;

  return (
    <div className={cn('relative overflow-hidden bg-[#EFEDE8]', className)}>
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid slice"
        className="size-full"
        role="img"
        aria-label="Mapa da operação"
      >
        {/* Água e áreas verdes dão referência visual ao traçado. */}
        <path d="M0 100 L0 74 Q18 68 30 82 Q42 96 56 100 Z" fill="#CFE0EE" />
        <rect x="4" y="4" width="16" height="14" rx="3" fill="#DCE8DA" />
        <rect x="84" y="72" width="14" height="16" rx="3" fill="#DCE8DA" />

        {BLOCKS.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="1.2" fill="#E6E3DC" />
        ))}

        {/* Ruas: casing escuro por baixo, asfalto claro por cima. */}
        <g stroke="#DEDAD1" fill="none" strokeLinecap="round">
          {STREETS.map((d, i) => (
            <path key={i} d={d} strokeWidth={1.4 * scale} />
          ))}
          {ARTERIALS.map((d, i) => (
            <path key={i} d={d} strokeWidth={3.4 * scale} />
          ))}
        </g>
        <g stroke="#FFFFFF" fill="none" strokeLinecap="round">
          {STREETS.map((d, i) => (
            <path key={i} d={d} strokeWidth={0.9 * scale} />
          ))}
          {ARTERIALS.map((d, i) => (
            <path key={i} d={d} strokeWidth={2.6 * scale} />
          ))}
        </g>

        {/* Traçado da rota */}
        {donePath && (
          <path
            d={donePath}
            fill="none"
            stroke="#B8B4AA"
            strokeWidth={1.6 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {todoPath && (
          <>
            <path
              d={todoPath}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2.8 * scale}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={todoPath}
              fill="none"
              stroke="#C2560A"
              strokeWidth={1.8 * scale}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${2.4 * scale} ${1.8 * scale}`}
            />
          </>
        )}

        {/* Paradas */}
        {stops.map((s) => {
          const done = s.status === 'concluida';
          const failed = s.status === 'nao_atendida';
          const current = s.status === 'a_caminho' || s.status === 'chegou';
          const fill = done ? '#16A34A' : failed ? '#B91C1C' : current ? '#C2560A' : '#FFFFFF';
          const text = done || failed || current ? '#FFFFFF' : '#504B46';
          const r = (current ? 3.4 : 2.8) * scale;
          return (
            <g
              key={s.id}
              onClick={onStopClick ? () => onStopClick(s.id) : undefined}
              className={onStopClick ? 'cursor-pointer' : undefined}
            >
              <circle cx={s.customer.x} cy={s.customer.y} r={r + 0.7 * scale} fill="#FFFFFF" />
              <circle
                cx={s.customer.x}
                cy={s.customer.y}
                r={r}
                fill={fill}
                stroke={done || failed || current ? 'none' : '#B8B4AA'}
                strokeWidth={0.5 * scale}
              />
              <text
                x={s.customer.x}
                y={s.customer.y + 1.15 * scale}
                textAnchor="middle"
                fontSize={3.2 * scale}
                fontWeight="700"
                fill={text}
              >
                {done ? '✓' : s.sequence}
              </text>
              {showLabels && (
                <text
                  x={s.customer.x}
                  y={s.customer.y - (r + 1.6 * scale)}
                  textAnchor="middle"
                  fontSize={2.6 * scale}
                  fontWeight="600"
                  fill="#33302C"
                  stroke="#FFFFFF"
                  strokeWidth={0.7 * scale}
                  paintOrder="stroke"
                >
                  {s.customer.tradeName}
                </text>
              )}
            </g>
          );
        })}

        {/* Outros veículos da frota */}
        {vehicles.map((v) => (
          <g key={v.id}>
            <circle cx={v.x} cy={v.y} r={3 * scale} fill="#FFFFFF" />
            <circle
              cx={v.x}
              cy={v.y}
              r={2.4 * scale}
              fill={v.status === 'em_rota' ? '#1D4ED8' : v.status === 'manutencao' ? '#A16207' : '#6B6660'}
            />
            <text
              x={v.x}
              y={v.y + 0.9 * scale}
              textAnchor="middle"
              fontSize={2.6 * scale}
              fill="#FFFFFF"
            >
              🚐
            </text>
          </g>
        ))}
      </svg>

      {/* Posição atual — fora do SVG para o pulso usar animação CSS. */}
      {position && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${percentIn(position.x, viewBox, 'x')}%`,
            top: `${percentIn(position.y, viewBox, 'y')}%`,
            transform: 'translate(-50%, -50%)',
            transition: 'left 900ms linear, top 900ms linear',
          }}
        >
          <span className="gps-ping absolute inset-0 rounded-full bg-info-500" />
          <span className="relative block size-4 rounded-full border-[3px] border-white bg-info-500 shadow-raised" />
        </div>
      )}

      {interactive && (
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          {onRecenter && (
            <button
              onClick={onRecenter}
              aria-label="Centralizar no meu local"
              className="grid size-11 place-items-center rounded-xl border border-shell-200 bg-white/95 text-shell-700 shadow-raised active:bg-shell-100"
            >
              <Crosshair size={18} />
            </button>
          )}
          <button
            aria-label="Camadas do mapa"
            className="grid size-11 place-items-center rounded-xl border border-shell-200 bg-white/95 text-shell-700 shadow-raised active:bg-shell-100"
          >
            <Layers size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

/* Converte a coordenada do plano para porcentagem dentro do viewBox atual,
   para posicionar o marcador HTML por cima do SVG. */
function percentIn(value: number, viewBox: string, axis: 'x' | 'y') {
  const [vx, vy, w, h] = viewBox.split(' ').map(Number);
  const origin = axis === 'x' ? vx : vy;
  const size = axis === 'x' ? w : h;
  return ((value - origin) / size) * 100;
}
