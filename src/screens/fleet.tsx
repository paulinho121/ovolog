import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Fuel,
  Gauge,
  History,
  MapPin,
  Timer,
  Truck,
  Wrench,
} from 'lucide-react';
import { AppBar, Screen } from '../components/layout/chrome';
import {
  Badge,
  Button,
  Card,
  Divider,
  KeyValue,
  Progress,
  SectionTitle,
} from '../components/ui/primitives';
import { EmptyState } from '../components/ui/states';
import { VEHICLE_STATUS, VehicleCard } from '../components/domain';
import { MapCanvas } from '../components/map/MapCanvas';
import { useApp } from '../store/app';
import { useNav, useParams } from '../store/navigation';
import { userById } from '../data/catalog';
import { nextStop, remainingDistance, routeProgress } from '../lib/domain';
import { duration, fullDate, km, num, pct, time } from '../lib/format';

/* Frota e rastreamento: a mesma informação em duas leituras — lista para
   decidir, mapa para acompanhar. */

export function FleetScreen() {
  const { vehicles, routes } = useApp();
  const { navigate } = useNav();

  return (
    <>
      <AppBar title="Frota" />
      <Screen className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-3">
          {(['em_rota', 'disponivel', 'manutencao'] as const).map((s) => (
            <Card key={s} className="p-3 text-center">
              <div className="text-title font-bold tnum text-shell-900">
                {vehicles.filter((v) => v.status === s).length}
              </div>
              <div className="mt-0.5 text-meta text-shell-600">{VEHICLE_STATUS[s].label}</div>
            </Card>
          ))}
        </div>

        <Button variant="secondary" size="md" block onClick={() => navigate('tracking')}>
          Abrir rastreamento
        </Button>

        <SectionTitle className="pt-2">Veículos</SectionTitle>
        {vehicles.map((v) => {
          const route = routes.find((r) => r.id === v.routeId);
          return (
            <VehicleCard
              key={v.id}
              vehicle={v}
              driverName={userById(v.driverId).name}
              progress={route ? routeProgress(route) : undefined}
              onClick={() => navigate('vehicle', { vehicleId: v.id })}
            />
          );
        })}
      </Screen>
    </>
  );
}

/* --------------------------------------------------- Detalhes do veículo */

export function VehicleScreen() {
  const { vehicleId } = useParams();
  const { vehicles, routes, customers } = useApp();
  const { navigate } = useNav();

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return <EmptyState title="Veículo não encontrado" />;

  const route = routes.find((r) => r.id === vehicle.routeId);
  const status = VEHICLE_STATUS[vehicle.status];
  const progress = route ? routeProgress(route) : undefined;
  const stop = route ? nextStop(route) : undefined;
  const customer = customers.find((c) => c.id === stop?.customerId);
  const driver = userById(vehicle.driverId);

  return (
    <>
      <AppBar title={vehicle.name} subtitle={`${vehicle.plate} • ${vehicle.model}`} />
      <Screen>
        <div className="bg-white px-4 pb-4">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-shell-100 text-shell-600">
              <Truck size={30} />
            </span>
            <div className="min-w-0 flex-1">
              <Badge tone={status.tone}>{status.label}</Badge>
              <div className="mt-1.5 truncate font-semibold text-shell-900">{driver.name}</div>
              <div className="text-meta text-shell-600">
                {route ? `Rota #${route.number}` : 'Sem rota atribuída'}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-meta">
              <span className="flex items-center gap-1.5 text-shell-600">
                <Fuel size={14} /> Combustível
              </span>
              <span className="font-bold tnum text-shell-900">{pct(vehicle.fuelLevel)}</span>
            </div>
            <Progress
              value={vehicle.fuelLevel}
              tone={vehicle.fuelLevel < 0.25 ? 'bad' : vehicle.fuelLevel < 0.5 ? 'warn' : 'ok'}
            />
          </div>
        </div>

        {route && (
          <div className="p-4">
            <Card className="overflow-hidden">
              <MapCanvas
                stops={route.stops.map((s) => ({
                  id: s.id,
                  customer: customers.find((c) => c.id === s.customerId)!,
                  status: s.status,
                  sequence: s.sequence,
                }))}
                vehicles={[vehicle]}
                className="h-40 w-full"
                interactive={false}
              />
            </Card>
          </div>
        )}

        <div className="space-y-3 px-4 pb-4">
          <SectionTitle>Hoje</SectionTitle>
          <Card className="px-4 py-1">
            <KeyValue
              label={<span className="flex items-center gap-2"><Gauge size={15} /> Km rodados</span>}
              value={km(vehicle.kmToday)}
            />
            {route?.startedAt && (
              <>
                <Divider />
                <KeyValue
                  label={<span className="flex items-center gap-2"><Timer size={15} /> Em rota desde</span>}
                  value={time(route.startedAt)}
                />
              </>
            )}
            {progress && (
              <>
                <Divider />
                <KeyValue label="Clientes visitados" value={`${progress.done} de ${progress.total}`} />
              </>
            )}
            {route && (
              <>
                <Divider />
                <KeyValue label="Distância restante" value={km(remainingDistance(route))} />
              </>
            )}
          </Card>

          {stop && customer && (
            <Card className="p-4">
              <div className="text-meta text-shell-600">Próxima parada</div>
              <div className="mt-0.5 font-bold text-shell-900">{customer.tradeName}</div>
              <div className="text-meta text-shell-600">
                {customer.district} • {duration(stop.etaMinutes)}
              </div>
            </Card>
          )}

          <SectionTitle className="pt-2">Cadastro</SectionTitle>
          <Card className="px-4 py-1">
            <KeyValue label="Placa" value={vehicle.plate} />
            <Divider />
            <KeyValue label="Modelo" value={vehicle.model} />
            <Divider />
            <KeyValue label="Capacidade" value={`${num(vehicle.capacityBoxes)} cx`} />
            <Divider />
            <KeyValue label="Odômetro" value={km(vehicle.odometer)} />
            <Divider />
            <KeyValue label="Última manutenção" value={fullDate(vehicle.lastMaintenance)} />
          </Card>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button variant="secondary" size="md" icon={<MapPin size={16} />} onClick={() => navigate('tracking')}>
              Localização
            </Button>
            <Button variant="secondary" size="md" icon={<History size={16} />} onClick={() => navigate('route-history')}>
              Histórico
            </Button>
            <Button variant="secondary" size="md" icon={<Wrench size={16} />}>
              Manutenção
            </Button>
            <Button variant="secondary" size="md" icon={<Fuel size={16} />}>
              Abastecimento
            </Button>
          </div>
        </div>
      </Screen>
    </>
  );
}

/* --------------------------------------------------------- Rastreamento */

export function TrackingScreen() {
  const { vehicles, routes, customers, position, activeRoute } = useApp();
  const { navigate, back } = useNav();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onRoute = vehicles.filter((v) => v.status === 'em_rota');
  const selected = vehicles.find((v) => v.id === selectedId) ?? onRoute[0];
  const route = routes.find((r) => r.id === selected?.routeId);
  const progress = route ? routeProgress(route) : undefined;
  const stop = route ? nextStop(route) : undefined;
  const customer = customers.find((c) => c.id === stop?.customerId);

  return (
    <div className="relative h-screen overflow-hidden bg-shell-100">
      <MapCanvas
        stops={
          route
            ? route.stops.map((s) => ({
                id: s.id,
                customer: customers.find((c) => c.id === s.customerId)!,
                status: s.status,
                sequence: s.sequence,
              }))
            : []
        }
        vehicles={vehicles.filter((v) => v.status !== 'manutencao')}
        position={activeRoute && selected?.id === activeRoute.vehicleId ? position : undefined}
        className="absolute inset-0"
        showLabels
        onStopClick={(id) => {
          const s = route?.stops.find((x) => x.id === id);
          if (s) navigate('customer', { customerId: s.customerId });
        }}
      />

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
        <div className="rounded-xl border border-shell-200 bg-white/95 px-3 py-2 shadow-raised">
          <span className="text-meta font-bold text-shell-900">Rastreamento</span>
        </div>
      </div>

      {/* Seletor de veículo — rola na horizontal por cima do mapa. */}
      <div className="absolute inset-x-0 top-[calc(var(--safe-top)+4.25rem)]">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3">
          {onRoute.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedId(v.id)}
              className={`h-10 shrink-0 rounded-full px-4 text-meta font-bold shadow-raised transition-colors ${
                selected?.id === v.id
                  ? 'bg-shell-900 text-white'
                  : 'border border-shell-200 bg-white/95 text-shell-700'
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute inset-x-0 bottom-0 rounded-t-sheet bg-white p-5 shadow-sheet"
          style={{ paddingBottom: 'calc(1.25rem + var(--safe-bottom))' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-subtitle font-bold text-shell-900">{selected.name}</h2>
              <p className="text-meta text-shell-600">{userById(selected.driverId).name}</p>
            </div>
            <Badge tone="ok" icon={<span className="size-2 rounded-full bg-ok-500" />}>
              Em movimento
            </Badge>
          </div>

          {route && progress && (
            <>
              <div className="mt-3 text-meta text-shell-600">
                Rota #{route.number} •{' '}
                <strong className="tnum text-shell-900">
                  {progress.done} de {progress.total}
                </strong>{' '}
                clientes visitados
              </div>
              <div className="mt-2">
                <Progress value={progress.ratio} tone="ok" />
              </div>
            </>
          )}

          {customer && (
            <div className="mt-4 rounded-xl bg-shell-100 p-3">
              <div className="text-meta text-shell-600">Próxima parada</div>
              <div className="mt-0.5 font-bold text-shell-900">{customer.tradeName}</div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => route && navigate('route', { routeId: route.id })}
            >
              Ver rota
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => navigate('vehicle', { vehicleId: selected.id })}
            >
              Ver detalhes
            </Button>
          </div>
        </motion.div>
      ) : (
        <div
          className="absolute inset-x-0 bottom-0 rounded-t-sheet bg-white p-5 text-center shadow-sheet"
          style={{ paddingBottom: 'calc(1.25rem + var(--safe-bottom))' }}
        >
          <p className="font-semibold text-shell-900">Nenhum veículo em rota</p>
          <p className="mt-1 text-meta text-shell-600">
            Assim que uma rota iniciar, o veículo aparece aqui em tempo real.
          </p>
        </div>
      )}
    </div>
  );
}
