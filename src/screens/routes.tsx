import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Flag,
  Navigation,
  Package,
  Play,
  Timer,
  Truck,
  User,
} from 'lucide-react';
import { AppBar, Screen, StickyAction, TabHeader } from '../components/layout/chrome';
import {
  Badge,
  Button,
  Card,
  Divider,
  KeyValue,
  Progress,
  SectionTitle,
} from '../components/ui/primitives';
import { ConfirmSheet } from '../components/ui/overlays';
import { EmptyState } from '../components/ui/states';
import { STOP_STATUS, StopRow } from '../components/domain';
import { MapCanvas, type MapStop } from '../components/map/MapCanvas';
import { useApp, useRoute } from '../store/app';
import { useNav, useParams } from '../store/navigation';
import { products, userById, vehicleById } from '../data/catalog';
import { temCoordenada } from '../lib/mapa';
import {
  nextStop,
  orderTotal,
  remainingDistance,
  remainingMinutes,
  routeLoadBoxes,
  routeOrders,
  routeProgress,
} from '../lib/domain';
import { duration, km, money, num, time } from '../lib/format';
import { cn } from '../lib/utils';
import type { Route } from '../types';

/* O mapa é o centro da operação de campo: o usuário nunca o perde de vista,
   e tudo que ele precisa fazer aparece num bottom sheet por cima (§16). */

function useMapStops(route: Route | undefined): MapStop[] {
  const { customers } = useApp();
  return useMemo(() => {
    if (!route) return [];
    return route.stops.map((s) => ({
      id: s.id,
      customer: customers.find((c) => c.id === s.customerId)!,
      status: s.status,
      sequence: s.sequence,
    }));
  }, [route, customers]);
}

/* --------------------------------------------------------- Aba de rotas */

export function RoutesScreen() {
  const { routes, orders, activeRoute } = useApp();
  const { navigate } = useNav();

  const today = routes.filter((r) => r.status !== 'finalizada');
  const finished = routes.filter((r) => r.status === 'finalizada');

  return (
    <>
      <TabHeader title="Rotas" />
      <Screen className="space-y-3 px-4 pt-3">
        {activeRoute && <RouteSummaryCard route={activeRoute} highlight />}

        {today.filter((r) => r.id !== activeRoute?.id).length > 0 && (
          <>
            <SectionTitle className="pt-2">Outras rotas de hoje</SectionTitle>
            {today
              .filter((r) => r.id !== activeRoute?.id)
              .map((r) => (
                <RouteSummaryCard key={r.id} route={r} />
              ))}
          </>
        )}

        <SectionTitle className="pt-2">Histórico</SectionTitle>
        {finished.length === 0 ? (
          <Card className="p-4">
            <p className="text-body text-shell-600">
              Nenhuma rota finalizada ainda. O histórico aparece aqui ao fim do dia.
            </p>
            <Button
              variant="secondary"
              size="md"
              block
              className="mt-3"
              onClick={() => navigate('route-history')}
            >
              Ver rotas anteriores
            </Button>
          </Card>
        ) : (
          finished.map((r) => <RouteSummaryCard key={r.id} route={r} />)
        )}

        {routes.length === 0 && (
          <EmptyState title="Nenhuma rota" message="Não há rotas atribuídas a você hoje." />
        )}

        <div className="pt-1 text-center text-meta text-shell-500">
          {orders.filter((o) => o.routeId).length} pedidos vinculados a rotas
        </div>
      </Screen>
    </>
  );
}

function RouteSummaryCard({ route, highlight }: { route: Route; highlight?: boolean }) {
  const { orders } = useApp();
  const { navigate } = useNav();
  const progress = routeProgress(route);
  const list = routeOrders(route, orders);
  const driver = userById(route.driverId);
  const vehicle = vehicleById(route.vehicleId);

  const tone =
    route.status === 'em_andamento' ? 'ok' : route.status === 'finalizada' ? 'neutral' : 'info';
  const label =
    route.status === 'em_andamento'
      ? 'Em andamento'
      : route.status === 'finalizada'
        ? 'Finalizada'
        : 'Planejada';

  return (
    <Card className={cn('overflow-hidden', highlight && 'ring-2 ring-brand-200')}>
      <button
        onClick={() =>
          navigate(route.status === 'em_andamento' ? 'route-map' : 'route', { routeId: route.id })
        }
        className="w-full p-4 text-left active:bg-shell-50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-subtitle font-bold text-shell-900">Rota #{route.number}</span>
            </div>
            <div className="mt-0.5 truncate text-meta text-shell-600">
              {driver.name} • {vehicle.name}
            </div>
          </div>
          <Badge tone={tone}>{label}</Badge>
        </div>

        <div className="mt-3 flex gap-4 text-meta text-shell-600">
          <span>
            <strong className="tnum text-shell-900">{route.stops.length}</strong> clientes
          </span>
          <span>
            <strong className="tnum text-shell-900">{list.length}</strong> pedidos
          </span>
          <span>
            <strong className="tnum text-shell-900">{km(route.distanceKm)}</strong>
          </span>
        </div>

        {route.status !== 'planejada' && (
          <div className="mt-3">
            <div className="mb-1.5 flex justify-between text-meta">
              <span className="text-shell-600">Paradas</span>
              <span className="font-bold tnum text-shell-900">
                {progress.done} de {progress.total}
              </span>
            </div>
            <Progress value={progress.ratio} tone="ok" />
          </div>
        )}
      </button>
    </Card>
  );
}

/* ------------------------------------------------------- Detalhes da rota */

export function RouteScreen() {
  const { routeId } = useParams();
  const route = useRoute(String(routeId));
  const { orders, customers } = useApp();
  const { navigate } = useNav();
  const mapStops = useMapStops(route);

  if (!route) return <EmptyState title="Rota não encontrada" />;

  const list = routeOrders(route, orders);
  const sales = list.reduce((s, o) => s + orderTotal(o), 0);
  const progress = routeProgress(route);
  const driver = userById(route.driverId);
  const vehicle = vehicleById(route.vehicleId);

  return (
    <>
      <AppBar title={`Rota #${route.number}`} subtitle={`${driver.name} • ${vehicle.name}`} />
      <Screen action={route.status === 'planejada' ? 'single' : 'none'}>
        <div className="bg-white px-4 pb-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-title font-bold tnum text-shell-900">{route.stops.length}</div>
              <div className="text-meta text-shell-600">clientes</div>
            </div>
            <div className="border-x border-shell-200">
              <div className="text-title font-bold tnum text-shell-900">{list.length}</div>
              <div className="text-meta text-shell-600">pedidos</div>
            </div>
            <div>
              <div className="text-title font-bold tnum text-shell-900">{money(sales)}</div>
              <div className="text-meta text-shell-600">em vendas</div>
            </div>
          </div>
          {route.status !== 'planejada' && (
            <div className="mt-4">
              <Progress value={progress.ratio} tone="ok" />
              <div className="mt-1.5 text-center text-meta text-shell-600">
                {progress.done} de {progress.total} paradas concluídas
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          <Card className="overflow-hidden">
            <MapCanvas stops={mapStops} className="h-44 w-full" interactive={false} />
          </Card>
        </div>

        <div className="px-4">
          <SectionTitle>Paradas da rota</SectionTitle>
          <Card className="divide-y divide-shell-200 overflow-hidden">
            {route.stops.map((s) => (
              <StopRow
                key={s.id}
                stop={s}
                customer={customers.find((c) => c.id === s.customerId)}
                onClick={() => navigate('customer', { customerId: s.customerId })}
              />
            ))}
          </Card>
        </div>

        <div className="p-4">
          <SectionTitle>Carga</SectionTitle>
          <Card className="px-4 py-1">
            {route.load.map((l) => {
              const p = products.find((x) => x.id === l.productId)!;
              return <KeyValue key={l.productId} label={`${p.emoji} ${p.name}`} value={`${num(l.boxes)} cx`} />;
            })}
            <Divider />
            <KeyValue label="Total embarcado" value={`${num(routeLoadBoxes(route))} cx`} strong />
          </Card>
        </div>

        {route.status === 'finalizada' && (
          <div className="px-4 pb-4">
            <Button
              variant="secondary"
              size="lg"
              block
              onClick={() => navigate('route-close', { routeId: route.id })}
            >
              Ver fechamento
            </Button>
          </div>
        )}
      </Screen>

      {route.status === 'planejada' && (
        <StickyAction>
          <Button size="lg" block icon={<Play size={18} />} onClick={() => navigate('route-start', { routeId: route.id })}>
            Preparar início
          </Button>
        </StickyAction>
      )}
    </>
  );
}

/* ---------------------------------------------------------- Iniciar rota */

export function RouteStartScreen() {
  const { routeId } = useParams();
  const route = useRoute(String(routeId));
  const { orders, startRoute } = useApp();
  const { replace } = useNav();

  if (!route) return <EmptyState title="Rota não encontrada" />;

  const list = routeOrders(route, orders);
  const driver = userById(route.driverId);
  const vehicle = vehicleById(route.vehicleId);
  const started = route.status !== 'planejada';

  return (
    <>
      <AppBar title="Iniciar rota" subtitle={`#${route.number}`} />
      <Screen action="single">
        <div className="p-4">
          {started && (
            <div className="mb-4 flex items-center gap-2 rounded-card bg-ok-50 px-4 py-3">
              <span className="size-2.5 rounded-full bg-ok-500" />
              <span className="font-bold text-ok-700">Rota em andamento</span>
              <span className="ml-auto text-meta tnum text-ok-700">
                desde {route.startedAt ? time(route.startedAt) : '—'}
              </span>
            </div>
          )}

          <Card className="px-4 py-1">
            <KeyValue label={<span className="flex items-center gap-2"><User size={15} /> Motorista</span>} value={driver.name} />
            <Divider />
            <KeyValue label={<span className="flex items-center gap-2"><Truck size={15} /> Veículo</span>} value={`${vehicle.name} • ${vehicle.plate}`} />
            <Divider />
            <KeyValue label="Clientes" value={num(route.stops.length)} />
            <Divider />
            <KeyValue label="Pedidos" value={num(list.length)} />
            <Divider />
            <KeyValue label={<span className="flex items-center gap-2"><Package size={15} /> Carga</span>} value={`${num(routeLoadBoxes(route))} caixas`} />
            <Divider />
            <KeyValue label="Distância" value={km(route.distanceKm)} />
            <Divider />
            <KeyValue label={<span className="flex items-center gap-2"><Timer size={15} /> Tempo estimado</span>} value={duration(route.estimatedMinutes)} strong />
          </Card>

          <SectionTitle className="pt-5">Conferência de carga</SectionTitle>
          <Card className="px-4 py-1">
            {route.load.map((l) => {
              const p = products.find((x) => x.id === l.productId)!;
              return (
                <KeyValue
                  key={l.productId}
                  label={`${p.emoji} ${p.name}`}
                  value={`${num(l.boxes)} cx`}
                />
              );
            })}
          </Card>

          <p className="mt-4 px-1 text-meta text-shell-600">
            Ao iniciar, o rastreamento de localização é ativado e os pedidos passam para
            “em rota”.
          </p>
        </div>
      </Screen>

      <StickyAction>
        {started ? (
          <Button size="lg" block icon={<Navigation size={18} />} onClick={() => replace('route-map', { routeId: route.id })}>
            Abrir mapa da rota
          </Button>
        ) : (
          <Button
            size="lg"
            block
            icon={<Play size={18} />}
            onClick={() => {
              startRoute(route.id);
              replace('route-map', { routeId: route.id });
            }}
          >
            Iniciar rota
          </Button>
        )}
      </StickyAction>
    </>
  );
}

/* ------------------------------------------------------- Mapa da rota */

export function RouteMapScreen() {
  const { routeId } = useParams();
  const route = useRoute(String(routeId));
  const { customers, position, distanceToNextStop, isAtNextStop, vehicles } = useApp();
  const { navigate, back } = useNav();
  const [expanded, setExpanded] = useState(false);
  const [followMe, setFollowMe] = useState(true);
  const stops = useMapStops(route);

  if (!route) return <EmptyState title="Rota não encontrada" />;

  const stop = nextStop(route);
  const customer = customers.find((c) => c.id === stop?.customerId);
  const progress = routeProgress(route);
  const done = !stop;

  return (
    <div className="relative h-screen overflow-hidden bg-shell-100">
      {/* Mapa ocupa a tela inteira; o conteúdo flutua por cima. */}
      <MapCanvas
        stops={stops}
        position={position}
        vehicles={vehicles.filter((v) => v.id !== route.vehicleId && v.status === 'em_rota')}
        className="absolute inset-0"
        focus={
          followMe && position ? { lat: position.lat, lng: position.lng, zoom: 16 } : undefined
        }
        onRecenter={() => setFollowMe((v) => !v)}
        onStopClick={(id) => {
          const s = route.stops.find((x) => x.id === id);
          if (s) navigate('customer', { customerId: s.customerId });
        }}
      />

      {/* Cabeçalho flutuante */}
      <div
        className="absolute inset-x-0 top-0 flex items-center gap-2 px-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 0.75rem)' }}
      >
        <button
          onClick={back}
          aria-label="Voltar"
          className="grid size-11 place-items-center rounded-xl border border-shell-200 bg-white/95 text-shell-800 shadow-raised active:bg-shell-100"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-2 rounded-xl border border-shell-200 bg-white/95 px-3 py-2 shadow-raised">
          <span className="size-2 rounded-full bg-ok-500" />
          <span className="text-meta font-bold text-shell-900">Rota #{route.number}</span>
          <span className="text-meta tnum text-shell-600">
            {progress.done}/{progress.total}
          </span>
        </div>
      </div>

      {/* Bottom sheet persistente — a operação inteira acontece aqui. */}
      <motion.div
        animate={{ height: expanded ? '68vh' : done ? '13rem' : '17.5rem' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-sheet bg-white shadow-sheet"
      >
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Recolher lista' : 'Expandir lista'}
          className="flex shrink-0 flex-col items-center gap-1 pb-1 pt-2.5"
        >
          <span className="h-1 w-10 rounded-full bg-shell-300" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {done ? (
            <div className="px-4 py-2 text-center">
              <Flag size={28} className="mx-auto text-ok-700" />
              <h2 className="mt-2 text-subtitle font-bold text-shell-900">Todas as paradas feitas</h2>
              <p className="mt-1 text-meta text-shell-600">Faça o fechamento para encerrar o dia.</p>
            </div>
          ) : (
            <div className="px-4">
              <div className="flex items-center justify-between">
                <span className="text-micro font-bold uppercase tracking-widest text-shell-500">
                  Próxima parada
                </span>
                <Badge tone={STOP_STATUS[stop!.status].tone}>{STOP_STATUS[stop!.status].label}</Badge>
              </div>
              <h2 className="mt-1 truncate text-title font-bold leading-tight text-shell-900">
                {customer?.tradeName}
              </h2>
              <p className="mt-0.5 truncate text-meta text-shell-600">
                📍 {customer?.address} • {customer?.district}
              </p>
              <div className="mt-2 flex gap-4 text-body">
                <span className="font-bold tnum text-shell-900">{km(distanceToNextStop)}</span>
                <span className="flex items-center gap-1.5 text-shell-600">
                  <Timer size={15} /> {duration(stop!.etaMinutes)}
                </span>
                <span className="text-shell-600">
                  {stop!.orderIds.length} pedido{stop!.orderIds.length !== 1 && 's'}
                </span>
              </div>
            </div>
          )}

          {expanded && (
            <div className="mt-4">
              <SectionTitle className="px-4">Paradas da rota</SectionTitle>
              <div className="divide-y divide-shell-200">
                {route.stops.map((s) => (
                  <StopRow
                    key={s.id}
                    stop={s}
                    customer={customers.find((c) => c.id === s.customerId)}
                    onClick={() => navigate('customer', { customerId: s.customerId })}
                  />
                ))}
              </div>
              <div className="p-4">
                <Card className="px-4 py-1">
                  <KeyValue label="Distância restante" value={km(remainingDistance(route))} />
                  <Divider />
                  <KeyValue label="Tempo restante" value={duration(remainingMinutes(route))} />
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* Ação principal, sempre visível e ao alcance do polegar. */}
        <div
          className="shrink-0 border-t border-shell-200 p-4"
          style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}
        >
          {done ? (
            <Button size="lg" block icon={<Flag size={18} />} onClick={() => navigate('route-close', { routeId: route.id })}>
              Fechar rota
            </Button>
          ) : isAtNextStop ? (
            <Button size="lg" block onClick={() => navigate('checkin', { stopId: stop!.id, routeId: route.id })}>
              Você chegou — fazer check-in
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => navigate('next-stop', { stopId: stop!.id, routeId: route.id })}
              >
                Detalhes
              </Button>
              <Button
                size="lg"
                className="flex-[1.4]"
                icon={<Navigation size={18} />}
                onClick={() => setFollowMe(true)}
              >
                Navegar
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* --------------------------------------------------------- Próxima parada */

export function NextStopScreen() {
  const { routeId, stopId } = useParams();
  const route = useRoute(String(routeId));
  const { customers, orders, markStopNotServed, isAtNextStop, distanceToNextStop } = useApp();
  const { navigate, back } = useNav();
  const [skipOpen, setSkipOpen] = useState(false);

  const stop = route?.stops.find((s) => s.id === stopId) ?? (route ? nextStop(route) : undefined);
  const customer = customers.find((c) => c.id === stop?.customerId);

  if (!route || !stop || !customer) return <EmptyState title="Parada não encontrada" />;

  const stopOrders = orders.filter((o) => stop.orderIds.includes(o.id));

  return (
    <>
      <AppBar title={`Parada ${stop.sequence}`} subtitle={`Rota #${route.number}`} />
      <Screen action="double">
        <div className="bg-white px-4 pb-4">
          <h1 className="text-title font-bold leading-tight text-shell-900">{customer.tradeName}</h1>
          <p className="mt-1 text-meta text-shell-600">
            📍 {customer.address} • {customer.district}
          </p>
          <div className="mt-3 flex gap-4 text-body">
            <span className="font-bold tnum text-shell-900">{km(distanceToNextStop)}</span>
            <span className="flex items-center gap-1.5 text-shell-600">
              <Timer size={15} /> {duration(stop.etaMinutes)}
            </span>
          </div>
        </div>

        <div className="p-4">
          <Card className="overflow-hidden">
            <MapCanvas
              stops={[{ id: stop.id, customer, status: stop.status, sequence: stop.sequence }]}
              focus={
                temCoordenada(customer)
                  ? { lat: customer.lat, lng: customer.lng, zoom: 16 }
                  : undefined
              }
              className="h-40 w-full"
              interactive={false}
            />
          </Card>
        </div>

        <div className="px-4">
          <SectionTitle>Pedidos a entregar</SectionTitle>
          {stopOrders.length === 0 ? (
            <Card className="p-4">
              <p className="text-body text-shell-600">
                Sem pedido para esta parada — é uma visita de prospecção ou cobrança.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-shell-200 overflow-hidden">
              {stopOrders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate('order', { orderId: o.id })}
                  className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-shell-50"
                >
                  <div>
                    <div className="font-semibold text-shell-900">#{o.number}</div>
                    <div className="text-meta text-shell-600">
                      {o.items.reduce((s, i) => s + i.quantity, 0)} caixas
                    </div>
                  </div>
                  <span className="font-bold tnum text-shell-900">{money(orderTotal(o))}</span>
                </button>
              ))}
            </Card>
          )}
        </div>
      </Screen>

      <StickyAction>
        <div className="space-y-2">
          <Button
            size="lg"
            block
            disabled={!isAtNextStop && distanceToNextStop !== undefined}
            onClick={() => navigate('checkin', { stopId: stop.id, routeId: route.id })}
          >
            {isAtNextStop
              ? 'Confirmar chegada'
              : distanceToNextStop === undefined
                ? 'Confirmar chegada (sem GPS)'
                : `Aproxime-se — ${km(distanceToNextStop)}`}
          </Button>
          <Button variant="ghost" size="md" block onClick={() => setSkipOpen(true)}>
            Não foi possível atender
          </Button>
        </div>
      </StickyAction>

      <ConfirmSheet
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        onConfirm={() => {
          markStopNotServed(route.id, stop.id);
          setSkipOpen(false);
          back();
        }}
        title="Marcar como não atendida?"
        message="A parada sai da fila e entra no fechamento como não atendida. Registre a ocorrência em seguida."
        confirmLabel="Não atendida"
        tone="danger"
      />
    </>
  );
}
