import { Crosshair, MapPinOff } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../../lib/utils';
import type { Customer, RouteStop, Vehicle } from '../../types';
import {
  CENTRO_PADRAO,
  TILE_ATTRIBUTION,
  TILE_MAX_ZOOM,
  TILE_URL,
  ZOOM_PADRAO,
  temCoordenada,
  type Coord,
} from '../../lib/mapa';

/* Mapa real, sobre tiles do OpenStreetMap (ver src/lib/mapa.ts).
 *
 * A interface é a mesma de quando o mapa era um SVG desenhado à mão — as oito
 * telas que usam este componente não sabem qual provedor existe por baixo, e é
 * isso que mantém a troca para o Google contida em dois arquivos.
 *
 * O Leaflet é imperativo e o React é declarativo: a saída é criar o mapa uma
 * vez num ref e reconciliar as camadas em efeitos, nunca recriar o mapa a cada
 * render — recriar faz o mapa piscar e tira o mapa da mão de quem arrasta. */

export interface MapStop {
  id: string;
  customer: Customer;
  status: RouteStop['status'];
  sequence: number;
}

/** Parada cujo cliente já tem endereço localizado — a única que vai ao mapa. */
type ParadaLocalizada = MapStop & { customer: Customer & Coord };

/* ------------------------------------------------------------- Marcadores */

/* Os marcadores são HTML (divIcon), não imagens: herdam as cores e o tipo do
   design system e escalam sem borrar. Também evita o problema clássico dos
   ícones padrão do Leaflet, que quebram sob bundler por causa do caminho das
   imagens. */

function iconeParada(stop: MapStop) {
  const done = stop.status === 'concluida';
  const failed = stop.status === 'nao_atendida';
  const current = stop.status === 'a_caminho' || stop.status === 'chegou';

  const cor = done
    ? 'bg-[#16A34A] text-white'
    : failed
      ? 'bg-[#B91C1C] text-white'
      : current
        ? 'bg-[#C2560A] text-white'
        : 'bg-white text-[#504B46]';

  const tamanho = current ? 34 : 28;
  const rotulo = done ? '&#10003;' : failed ? '!' : String(stop.sequence);

  return L.divIcon({
    className: 'ovolog-marcador',
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    html:
      '<span class="grid size-full place-items-center rounded-full text-[13px] font-bold ' +
      'shadow-raised ring-2 ring-white ' +
      cor +
      '">' +
      rotulo +
      '</span>',
  });
}

function iconeVeiculo(v: Vehicle) {
  const cor =
    v.status === 'em_rota' ? '#1D4ED8' : v.status === 'manutencao' ? '#A16207' : '#6B6660';
  return L.divIcon({
    className: 'ovolog-marcador',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html:
      '<span class="grid size-full place-items-center rounded-full text-[14px] ' +
      'shadow-raised ring-2 ring-white" style="background:' +
      cor +
      '">&#128656;</span>',
  });
}

const iconePosicao = () =>
  L.divIcon({
    className: 'ovolog-marcador',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html:
      '<span class="relative block size-full">' +
      '<span class="gps-ping absolute inset-0 rounded-full bg-info-500"></span>' +
      '<span class="relative block size-full rounded-full border-[3px] border-white bg-info-500 shadow-raised"></span>' +
      '</span>',
  });

/* ------------------------------------------------------------------ Mapa */

export function MapCanvas({
  stops = [],
  position,
  vehicles = [],
  className,
  /** Centraliza e aproxima num ponto — usado para seguir o motorista. */
  focus,
  showLabels = false,
  onStopClick,
  onRecenter,
  interactive = true,
}: {
  stops?: MapStop[];
  position?: Coord;
  vehicles?: Vehicle[];
  className?: string;
  focus?: { lat: number; lng: number; zoom: number };
  showLabels?: boolean;
  onStopClick?: (stopId: string) => void;
  onRecenter?: () => void;
  interactive?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camadas = useRef<L.LayerGroup | null>(null);

  /* O enquadramento automático vale só na primeira carga: depois disso quem
     manda é quem está olhando. Reenquadrar a cada atualização de GPS puxaria o
     mapa da mão do motorista a cada poucos segundos. */
  const jaEnquadrou = useRef(false);

  /* Só entra no mapa quem tem coordenada. Cliente sem geocodificar fica de
     fora — some do mapa e continua na lista. */
  const paradas = useMemo(
    () => stops.filter((s): s is ParadaLocalizada => temCoordenada(s.customer)),
    [stops],
  );
  const frota = useMemo(() => vehicles.filter(temCoordenada), [vehicles]);

  const semCoordenada = stops.length > 0 && paradas.length === 0;

  /* --------------------------------------------------- Criação (uma vez) */
  useEffect(() => {
    if (!container.current || mapa.current) return;
    const alvo = container.current;

    const m = L.map(alvo, {
      center: [CENTRO_PADRAO.lat, CENTRO_PADRAO.lng],
      zoom: ZOOM_PADRAO,
      zoomControl: false,
      // Mapa decorativo (card da Home, resumo da rota) não deve roubar o gesto
      // de rolagem da página nem responder a toque.
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    });

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: TILE_MAX_ZOOM,
    }).addTo(m);

    if (interactive) L.control.zoom({ position: 'bottomright' }).addTo(m);

    camadas.current = L.layerGroup().addTo(m);
    mapa.current = m;

    /* O Leaflet mede o container ao criar. Quando o mapa nasce dentro de algo
       que ainda vai crescer (card em sheet, painel que abre), a medida sai
       errada e os tiles ficam cinza até alguém mexer no mapa. */
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(alvo);

    return () => {
      ro.disconnect();
      m.remove();
      mapa.current = null;
      camadas.current = null;
    };
  }, [interactive]);

  /* ------------------------------------------------------------ Camadas */
  useEffect(() => {
    const m = mapa.current;
    const grupo = camadas.current;
    if (!m || !grupo) return;

    grupo.clearLayers();

    /* Traçado: o trecho já cumprido fica sólido e apagado, o que falta fica
       tracejado na cor da marca — a convenção dos apps de navegação.

       São segmentos retos entre paradas, não o caminho pela rua: desenhar rua
       exige um serviço de rotas, que fica para quando entrar o Google. */
    if (paradas.length >= 2) {
      const pts = paradas.map((s) => [s.customer.lat, s.customer.lng] as [number, number]);
      const primeiraPendente = paradas.findIndex(
        (s) => s.status !== 'concluida' && s.status !== 'nao_atendida',
      );
      const corte = primeiraPendente === -1 ? paradas.length : Math.max(1, primeiraPendente);

      const feito = pts.slice(0, corte);
      const falta = pts.slice(Math.max(0, corte - 1));

      if (feito.length >= 2) {
        L.polyline(feito, { color: '#B8B4AA', weight: 5, opacity: 0.9 }).addTo(grupo);
      }
      if (falta.length >= 2) {
        L.polyline(falta, { color: '#FFFFFF', weight: 8, opacity: 0.9 }).addTo(grupo);
        L.polyline(falta, { color: '#C2560A', weight: 5, dashArray: '10 8' }).addTo(grupo);
      }
    }

    for (const s of paradas) {
      const marcador = L.marker([s.customer.lat, s.customer.lng], {
        icon: iconeParada(s),
        keyboard: Boolean(onStopClick),
        interactive: Boolean(onStopClick) || showLabels,
      }).addTo(grupo);

      if (showLabels) {
        marcador.bindTooltip(s.customer.tradeName, {
          direction: 'top',
          offset: [0, -16],
          permanent: true,
          className: 'ovolog-rotulo',
        });
      }
      if (onStopClick) marcador.on('click', () => onStopClick(s.id));
    }

    for (const v of frota) {
      L.marker([v.lat, v.lng], { icon: iconeVeiculo(v), interactive: false })
        .bindTooltip(v.name + ' • ' + v.plate, { direction: 'top', offset: [0, -14] })
        .addTo(grupo);
    }

    if (position) {
      L.marker([position.lat, position.lng], {
        icon: iconePosicao(),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(grupo);
    }
  }, [paradas, frota, position, showLabels, onStopClick]);

  /* ------------------------------------------------------ Enquadramento */
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;

    if (focus) {
      m.setView([focus.lat, focus.lng], focus.zoom, { animate: true });
      return;
    }

    if (jaEnquadrou.current) return;

    const pontos: [number, number][] = [
      ...paradas.map((s) => [s.customer.lat, s.customer.lng] as [number, number]),
      ...frota.map((v) => [v.lat, v.lng] as [number, number]),
    ];
    if (position) pontos.push([position.lat, position.lng]);

    if (pontos.length === 0) return;
    jaEnquadrou.current = true;

    if (pontos.length === 1) {
      m.setView(pontos[0], 15);
    } else {
      m.fitBounds(L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 16 });
    }
  }, [focus, paradas, frota, position]);

  return (
    <div className={cn('relative overflow-hidden bg-[#EFEDE8]', className)}>
      <div ref={container} className="size-full" role="img" aria-label="Mapa da operação" />

      {semCoordenada && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex items-center gap-2 bg-white/95 px-3 py-2">
          <MapPinOff size={16} className="shrink-0 text-shell-500" />
          <p className="text-micro text-shell-600">
            {stops.length === 1
              ? 'Este cliente ainda não tem endereço localizado no mapa.'
              : `${stops.length} paradas sem endereço localizado.`}{' '}
            Edite o cliente para corrigir.
          </p>
        </div>
      )}

      {interactive && onRecenter && (
        <button
          onClick={onRecenter}
          aria-label="Centralizar no meu local"
          className="absolute right-3 top-3 z-[500] grid size-11 place-items-center rounded-xl border border-shell-200 bg-white/95 text-shell-700 shadow-raised active:bg-shell-100"
        >
          <Crosshair size={18} />
        </button>
      )}
    </div>
  );
}
