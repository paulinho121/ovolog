import { useMemo } from 'react';
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Navigation,
  PackageCheck,
  Play,
  ShoppingBag,
  Timer,
  TrendingUp,
  Truck,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { Header, Screen } from '../components/layout/chrome';
import { Button, Card, Progress, SectionTitle, Stat } from '../components/ui/primitives';
import { AlertCard } from '../components/domain';
import { MapCanvas } from '../components/map/MapCanvas';
import { useApp } from '../store/app';
import { useNav } from '../store/navigation';
import { products } from '../data/catalog';
import {
  accountsTotal,
  available,
  expiringBatches,
  nextStop,
  orderTotal,
  ordersOfDay,
  routeOrders,
  routeProgress,
  stockLevel,
} from '../lib/domain';
import { km, money, moneyShort, num, duration, daysUntil } from '../lib/format';

/* A Home muda conforme o perfil (§54). Quem está na rua abre no que vai
   fazer agora; quem está na gestão abre no que precisa decidir. */

export function HomeScreen() {
  const { session } = useApp();
  const role = session?.role ?? 'vendedor';
  return (
    <>
      <Header />
      {role === 'gestor' && <ManagerHome />}
      {(role === 'vendedor' || role === 'motorista') && <FieldHome />}
      {role === 'estoque' && <StockHome />}
      {role === 'compras' && <PurchasingHome />}
      {role === 'financeiro' && <FinanceHome />}
    </>
  );
}

/* --------------------------------------------------- Vendedor / Motorista */

function FieldHome() {
  const { activeRoute, orders, customers, stock, distanceToNextStop, session } = useApp();
  const { navigate, switchTab } = useNav();

  const route = activeRoute;
  const stop = route ? nextStop(route) : undefined;
  const customer = customers.find((c) => c.id === stop?.customerId);
  const list = route ? routeOrders(route, orders) : [];
  const sales = list.reduce((s, o) => s + orderTotal(o), 0);
  const progress = route ? routeProgress(route) : { done: 0, total: 0, ratio: 0 };
  const running = route?.status === 'em_andamento';
  const finished = route?.status === 'finalizada';

  const urgentBatch = expiringBatches(stock, 6)[0];
  const urgentProduct = urgentBatch ? products.find((p) => p.id === urgentBatch.productId) : undefined;

  if (!route) {
    return (
      <Screen className="px-4 pt-2">
        <Card className="p-6 text-center">
          <h2 className="text-subtitle font-bold text-shell-900">Nenhuma rota hoje</h2>
          <p className="mt-1 text-body text-shell-600">
            Você não tem rota atribuída. Fale com o gestor da operação.
          </p>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen className="space-y-4 px-4 pt-2">
      <p className="text-body text-shell-600">
        {finished
          ? 'Sua rota de hoje foi finalizada.'
          : running
            ? `Rota em andamento — ${progress.total - progress.done} paradas restantes.`
            : 'Você tem uma rota hoje.'}
      </p>

      {/* Card principal: o que o usuário veio fazer. Uma ação, grande. */}
      <Card className="overflow-hidden">
        <div className="bg-brand-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-micro font-bold uppercase tracking-widest text-brand-100">
              Rota de hoje
            </span>
            <span className="text-micro font-bold tnum text-brand-100">#{route.number}</span>
          </div>
        </div>
        <div className="p-4">
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
              <div className="text-title font-bold tnum text-shell-900">{moneyShort(sales)}</div>
              <div className="text-meta text-shell-600">em vendas</div>
            </div>
          </div>

          {running && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-meta">
                <span className="text-shell-600">Progresso</span>
                <span className="font-bold tnum text-shell-900">
                  {progress.done} de {progress.total}
                </span>
              </div>
              <Progress value={progress.ratio} tone="ok" />
            </div>
          )}

          <div className="mt-4">
            {finished ? (
              <Button size="lg" block variant="secondary" onClick={() => navigate('route-close', { routeId: route.id })}>
                Ver fechamento da rota
              </Button>
            ) : running ? (
              <Button size="lg" block icon={<Navigation size={18} />} onClick={() => navigate('route-map', { routeId: route.id })}>
                Continuar rota
              </Button>
            ) : (
              <Button size="lg" block icon={<Play size={18} />} onClick={() => navigate('route-start', { routeId: route.id })}>
                Iniciar rota
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Prioridade FEFO — o lote mais velho sai primeiro, ou vira perda. */}
      {urgentBatch && urgentProduct && (
        <AlertCard
          tone="warn"
          title={`Prioridade FEFO • lote ${urgentBatch.code}`}
          body={`${urgentProduct.name} vence em ${daysUntil(urgentBatch.expiresAt)} dias. Entregar primeiro.`}
          onClick={() => navigate('product', { productId: urgentProduct.id })}
        />
      )}

      {stop && customer && !finished && (
        <div>
          <SectionTitle>Próximo cliente</SectionTitle>
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-subtitle font-bold text-shell-900">
                  {customer.tradeName}
                </h3>
                <p className="mt-0.5 truncate text-meta text-shell-600">{customer.address}</p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700 text-meta font-bold text-white">
                {stop.sequence}
              </span>
            </div>
            <div className="mt-3 flex gap-4 text-body">
              <span className="flex items-center gap-1.5 font-semibold text-shell-800">
                📍 {km(running ? distanceToNextStop : stop.distanceKm)}
              </span>
              <span className="flex items-center gap-1.5 text-shell-600">
                <Timer size={15} /> {duration(stop.etaMinutes)}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => navigate('customer', { customerId: customer.id })}
              >
                Ver cliente
              </Button>
              <Button
                size="md"
                className="flex-1"
                icon={<Navigation size={16} />}
                onClick={() => navigate('route-map', { routeId: route.id })}
              >
                Navegar
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div>
        <SectionTitle>Atalhos</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            icon={<ShoppingBag size={20} />}
            label="Novo pedido"
            onClick={() => navigate('customer-search', { intent: 'order' })}
          />
          <QuickAction
            icon={<ClipboardList size={20} />}
            label="Meus pedidos"
            onClick={() => switchTab('orders')}
          />
          <QuickAction
            icon={<PackageCheck size={20} />}
            label="Carga do dia"
            onClick={() => navigate('route-start', { routeId: route.id })}
          />
          <QuickAction
            icon={<Wallet size={20} />}
            label="Receber"
            onClick={() => navigate('finance')}
          />
        </div>
      </div>

      <MiniOperationCard
        title={`Operação de ${session?.name.split(' ')[0] ?? 'hoje'}`}
        onClick={() => navigate('route-map', { routeId: route.id })}
      />
    </Screen>
  );
}

/* ------------------------------------------------------------- Gestor */

function ManagerHome() {
  const { orders, customers, vehicles, cashEntries, accounts, stock, routes, notifications } = useApp();
  const { navigate, switchTab } = useNav();

  const today = new Date();
  const todayOrders = useMemo(() => ordersOfDay(orders, today), [orders]);
  const sales = todayOrders.reduce((s, o) => s + orderTotal(o), 0);
  const received = cashEntries
    .filter((c) => c.direction === 'in' && new Date(c.at).toDateString() === today.toDateString())
    .reduce((s, c) => s + c.amount, 0);
  const onRoute = vehicles.filter((v) => v.status === 'em_rota');

  const lowStock = stock.filter((s) => stockLevel(s) !== 'normal');
  const overdue = accounts.filter((a) => a.kind === 'receber' && a.status === 'vencido');
  const expiring = expiringBatches(stock, 7);
  const lateRoute = routes.find((r) => r.status === 'em_andamento');
  const unread = notifications.filter((n) => !n.read);

  /* O mapa da Home mostra as paradas de quem está rodando agora — sem elas
     seria só uma malha de ruas vazia. */
  const liveStops = useMemo(
    () =>
      routes
        .filter((r) => r.status === 'em_andamento')
        .flatMap((r) =>
          r.stops.map((s) => ({
            id: s.id,
            customer: customers.find((c) => c.id === s.customerId)!,
            status: s.status,
            sequence: s.sequence,
          })),
        )
        .filter((s) => s.customer),
    [routes, customers],
  );

  return (
    <Screen className="space-y-4 px-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Vendas hoje"
          value={moneyShort(sales)}
          hint={`${todayOrders.length} pedidos`}
          tone="brand"
          icon={<TrendingUp size={16} className="text-brand-600" />}
          onClick={() => navigate('reports')}
        />
        <Stat
          label="Pedidos"
          value={num(todayOrders.length)}
          hint={(() => {
            const n = todayOrders.filter((o) => o.status === 'entregue').length;
            return `${n} ${n === 1 ? 'entregue' : 'entregues'}`;
          })()}
          onClick={() => switchTab('orders')}
        />
        <Stat
          label="Recebido"
          value={moneyShort(received)}
          hint={`${moneyShort(accountsTotal(accounts, 'receber'))} a receber`}
          tone="ok"
          onClick={() => navigate('finance')}
        />
        <Stat
          label="Veículos em rota"
          value={num(onRoute.length)}
          hint={`${vehicles.length} na frota`}
          icon={<Truck size={16} className="text-shell-500" />}
          onClick={() => navigate('tracking')}
        />
      </div>

      <div>
        <SectionTitle
          action={
            <button
              onClick={() => navigate('tracking')}
              className="flex items-center gap-1 text-meta font-bold text-brand-800"
            >
              Rastrear <ArrowRight size={14} />
            </button>
          }
        >
          Operação agora
        </SectionTitle>
        <Card className="overflow-hidden">
          <button onClick={() => navigate('tracking')} className="block w-full">
            <MapCanvas
              vehicles={vehicles}
              stops={liveStops}
              className="h-44 w-full"
              interactive={false}
            />
          </button>
          <div className="flex divide-x divide-shell-200 border-t border-shell-200">
            {onRoute.map((v) => {
              const route = routes.find((r) => r.id === v.routeId);
              const p = route ? routeProgress(route) : { done: 0, total: 0 };
              return (
                <button
                  key={v.id}
                  onClick={() => navigate('vehicle', { vehicleId: v.id })}
                  className="flex-1 px-3 py-2.5 text-left active:bg-shell-50"
                >
                  <div className="text-meta font-bold text-shell-900">{v.name}</div>
                  <div className="text-meta tnum text-shell-600">
                    {p.done}/{p.total} paradas
                  </div>
                </button>
              );
            })}
            {onRoute.length === 0 && (
              <div className="flex-1 px-3 py-3 text-center text-meta text-shell-500">
                Nenhum veículo em rota
              </div>
            )}
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle
          action={
            unread.length > 0 ? (
              <span className="rounded-full bg-bad-50 px-2 py-0.5 text-micro font-bold text-bad-700">
                {unread.length} novos
              </span>
            ) : undefined
          }
        >
          Alertas
        </SectionTitle>
        <div className="space-y-2.5">
          {lowStock.slice(0, 1).map((s) => {
            const product = products.find((p) => p.id === s.productId)!;
            return (
              <AlertCard
                key={s.productId}
                tone={stockLevel(s) === 'critico' ? 'bad' : 'warn'}
                title="Estoque baixo"
                body={`${product.name} com ${num(available(s))} cx disponíveis — mínimo ${num(s.minimum)}.`}
                onClick={() => navigate('product', { productId: product.id })}
              />
            );
          })}
          {lateRoute && (
            <AlertCard
              tone="bad"
              title="Rota atrasada"
              body={`Rota #${lateRoute.number} está acima do tempo previsto.`}
              onClick={() => navigate('route', { routeId: lateRoute.id })}
            />
          )}
          {overdue.slice(0, 1).map((a) => (
            <AlertCard
              key={a.id}
              tone="bad"
              title="Pagamento vencido"
              body={`${a.partyName} está com ${money(a.amount - a.paidAmount)} em atraso.`}
              onClick={() => navigate('receivable', { accountId: a.id })}
            />
          ))}
          {expiring.slice(0, 1).map((b) => {
            const product = products.find((p) => p.id === b.productId)!;
            return (
              <AlertCard
                key={b.id}
                tone="warn"
                title="Produto próximo da validade"
                body={`Lote ${b.code} de ${product.name} vence em ${daysUntil(b.expiresAt)} dias.`}
                onClick={() => navigate('product', { productId: product.id })}
              />
            );
          })}
        </div>
      </div>

      <div>
        <SectionTitle>Atalhos</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={<TrendingUp size={20} />} label="Relatórios" onClick={() => navigate('reports')} />
          <QuickAction icon={<Wallet size={20} />} label="Financeiro" onClick={() => navigate('finance')} />
          <QuickAction icon={<Warehouse size={20} />} label="Estoque" onClick={() => navigate('stock')} />
          <QuickAction icon={<Truck size={20} />} label="Frota" onClick={() => navigate('fleet')} />
        </div>
      </div>

      <div className="pb-2">
        <SectionTitle>Clientes</SectionTitle>
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-title font-bold tnum text-shell-900">{customers.length}</div>
              <div className="text-meta text-shell-600">cadastrados</div>
            </div>
            <div className="border-x border-shell-200">
              <div className="text-title font-bold tnum text-ok-700">
                {customers.filter((c) => c.status === 'ativo').length}
              </div>
              <div className="text-meta text-shell-600">ativos</div>
            </div>
            <div>
              <div className="text-title font-bold tnum text-bad-700">
                {customers.filter((c) => c.status === 'inadimplente').length}
              </div>
              <div className="text-meta text-shell-600">inadimplentes</div>
            </div>
          </div>
        </Card>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------ Estoque */

function StockHome() {
  const { stock } = useApp();
  const { navigate } = useNav();
  const totalBoxes = stock.reduce((s, i) => s + i.onHand, 0);
  const reserved = stock.reduce((s, i) => s + i.reserved, 0);
  const low = stock.filter((s) => stockLevel(s) !== 'normal');
  const expiring = expiringBatches(stock, 7);

  return (
    <Screen className="space-y-4 px-4 pt-2">
      <p className="text-body text-shell-600">Situação do estoque agora.</p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Estoque total" value={`${num(totalBoxes)} cx`} tone="brand" onClick={() => navigate('stock')} />
        <Stat label="Reservado" value={`${num(reserved)} cx`} onClick={() => navigate('stock')} />
        <Stat label="Estoque baixo" value={num(low.length)} tone={low.length ? 'warn' : 'ok'} hint="produtos" onClick={() => navigate('stock')} />
        <Stat label="Perto da validade" value={num(expiring.length)} tone={expiring.length ? 'warn' : 'ok'} hint="lotes" onClick={() => navigate('stock')} />
      </div>
      <div>
        <SectionTitle>Ações rápidas</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={<Boxes size={20} />} label="Movimentar" onClick={() => navigate('stock-move')} />
          <QuickAction icon={<Warehouse size={20} />} label="Ver estoque" onClick={() => navigate('stock')} />
          <QuickAction icon={<PackageCheck size={20} />} label="Compras" onClick={() => navigate('purchases')} />
          <QuickAction icon={<ClipboardList size={20} />} label="Inventário" onClick={() => navigate('stock-move', { kind: 'inventario' })} />
        </div>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------ Compras */

function PurchasingHome() {
  const { purchases } = useApp();
  const { navigate } = useNav();
  const open = purchases.filter((p) => p.status === 'aberta');
  const cost = open.reduce(
    (s, p) => s + p.items.reduce((x, i) => x + i.boxes * i.unitCost, 0),
    0,
  );

  return (
    <Screen className="space-y-4 px-4 pt-2">
      <p className="text-body text-shell-600">Suprimento da operação.</p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Pedidos abertos" value={num(open.length)} tone="brand" onClick={() => navigate('purchases')} />
        <Stat label="A receber" value={`${num(open.reduce((s, p) => s + p.items.reduce((x, i) => x + i.boxes, 0), 0))} cx`} onClick={() => navigate('purchases')} />
        <Stat label="Valor em aberto" value={moneyShort(cost)} onClick={() => navigate('purchases')} />
        <Stat label="Fornecedores" value="4" onClick={() => navigate('purchases')} />
      </div>
      <div>
        <SectionTitle>Ações rápidas</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={<ShoppingBag size={20} />} label="Nova compra" onClick={() => navigate('purchase-new')} />
          <QuickAction icon={<ClipboardList size={20} />} label="Ver compras" onClick={() => navigate('purchases')} />
          <QuickAction icon={<Warehouse size={20} />} label="Estoque" onClick={() => navigate('stock')} />
          <QuickAction icon={<Wallet size={20} />} label="A pagar" onClick={() => navigate('finance')} />
        </div>
      </div>
    </Screen>
  );
}

/* --------------------------------------------------------- Financeiro */

function FinanceHome() {
  const { accounts, cashEntries } = useApp();
  const { navigate } = useNav();
  const today = new Date().toDateString();
  const receivedToday = cashEntries
    .filter((c) => c.direction === 'in' && new Date(c.at).toDateString() === today)
    .reduce((s, c) => s + c.amount, 0);
  const paidToday = cashEntries
    .filter((c) => c.direction === 'out' && new Date(c.at).toDateString() === today)
    .reduce((s, c) => s + c.amount, 0);

  return (
    <Screen className="space-y-4 px-4 pt-2">
      <p className="text-body text-shell-600">Caixa e contas do dia.</p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="A receber" value={moneyShort(accountsTotal(accounts, 'receber'))} tone="brand" onClick={() => navigate('finance')} />
        <Stat label="A pagar" value={moneyShort(accountsTotal(accounts, 'pagar'))} tone="bad" onClick={() => navigate('finance')} />
        <Stat label="Recebido hoje" value={moneyShort(receivedToday)} tone="ok" onClick={() => navigate('finance')} />
        <Stat label="Pago hoje" value={moneyShort(paidToday)} onClick={() => navigate('finance')} />
      </div>
      <div>
        <SectionTitle>Vencido</SectionTitle>
        <Card className="p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-body text-shell-600">Contas a receber vencidas</span>
            <span className="text-subtitle font-bold tnum text-bad-700">
              {moneyShort(accountsTotal(accounts, 'receber', 'vencido'))}
            </span>
          </div>
          <Button variant="secondary" size="md" block className="mt-3" onClick={() => navigate('finance')}>
            Abrir financeiro
          </Button>
        </Card>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------- Comuns */

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[4.5rem] flex-col items-start justify-between rounded-card border border-shell-200 bg-white p-3.5 text-left shadow-card active:bg-shell-50"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-brand-100 text-brand-800">
        {icon}
      </span>
      <span className="text-body font-semibold text-shell-900">{label}</span>
    </button>
  );
}

function MiniOperationCard({ title, onClick }: { title: string; onClick: () => void }) {
  const { activeRoute, customers, position } = useApp();
  if (!activeRoute) return null;
  const stops = activeRoute.stops.map((s) => ({
    id: s.id,
    customer: customers.find((c) => c.id === s.customerId)!,
    status: s.status,
    sequence: s.sequence,
  }));
  return (
    <div className="pb-2">
      <SectionTitle>{title}</SectionTitle>
      <Card className="overflow-hidden">
        <button onClick={onClick} className="block w-full">
          <MapCanvas stops={stops} position={position} className="h-40 w-full" interactive={false} />
        </button>
      </Card>
    </div>
  );
}
