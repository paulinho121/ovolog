import { useState } from 'react';
import { motion } from 'motion/react';
import { Home, Map, Menu, ShoppingCart, TriangleAlert, Users } from 'lucide-react';
import type { ComponentType, CSSProperties } from 'react';
import './index.css';

import { AppProvider, useApp } from './store/app';
import { NavigationProvider, useNav, type ScreenName, type TabName } from './store/navigation';
import { supabaseConfigurado } from './lib/supabase';
import { useDesktop } from './lib/viewport';
import { BottomNav } from './components/layout/chrome';
import { Toasts } from './components/ui/overlays';
import { MapCanvas } from './components/map/MapCanvas';
import { MarcaOvolog } from './components/ui/marca';
import { Avatar, Card, Progress } from './components/ui/primitives';
import { cn } from './lib/utils';
import { moneyShort, num } from './lib/format';
import { orderTotal, ordersOfDay, routeProgress } from './lib/domain';

import { ForgotScreen, LoginScreen, SplashScreen } from './screens/auth';
import { PlataformaScreen } from './screens/plataforma';
import { HomeScreen } from './screens/home';
import {
  CustomerHistoryScreen,
  CustomerNewScreen,
  CustomerScreen,
  CustomerSearchScreen,
  CustomersScreen,
} from './screens/customers';
import {
  CartScreen,
  OrderDoneScreen,
  OrderNewScreen,
  OrderProductsScreen,
  OrderScreen,
  OrdersScreen,
  PaymentScreen,
} from './screens/orders';
import {
  NextStopScreen,
  RouteMapScreen,
  RouteScreen,
  RouteStartScreen,
  RoutesScreen,
} from './screens/routes';
import {
  CheckInScreen,
  DeliveryScreen,
  IncidentScreen,
  ReceiptScreen,
  ReturnScreen,
  RouteCloseScreen,
  RouteHistoryScreen,
  VisitScreen,
} from './screens/field';
import {
  ProductScreen,
  PurchaseNewScreen,
  PurchasesScreen,
  StockMoveScreen,
  StockScreen,
} from './screens/inventory';
import { FinanceScreen, PayableScreen, ReceivableScreen } from './screens/finance';
import { FleetScreen, TrackingScreen, VehicleScreen } from './screens/fleet';
import { ReportsScreen } from './screens/reports';
import {
  MoreScreen,
  NotificationsScreen,
  ProfileScreen,
  SettingsScreen,
} from './screens/more';

import { DashboardDesktop } from './screens/desktop/dashboard';
import { ClientesDesktop } from './screens/desktop/clientes';
import { PedidosDesktop } from './screens/desktop/pedidos';
import { EstoqueDesktop } from './screens/desktop/estoque';
import { ComprasDesktop } from './screens/desktop/compras';
import { FinanceiroDesktop } from './screens/desktop/financeiro';
import { RelatoriosDesktop } from './screens/desktop/relatorios';

/* Registro das 45 telas. A navegação é uma pilha em memória (sem URL), o que
   mantém o contexto do usuário e torna o "voltar" sempre previsível. */
const SCREENS: Record<ScreenName, ComponentType> = {
  splash: SplashScreen,
  login: LoginScreen,
  forgot: ForgotScreen,

  home: HomeScreen,
  notifications: NotificationsScreen,

  customers: CustomersScreen,
  'customer-search': CustomerSearchScreen,
  'customer-new': CustomerNewScreen,
  customer: CustomerScreen,
  'customer-history': CustomerHistoryScreen,

  'order-new': OrderNewScreen,
  'order-products': OrderProductsScreen,
  cart: CartScreen,
  payment: PaymentScreen,
  'order-done': OrderDoneScreen,
  orders: OrdersScreen,
  order: OrderScreen,

  routes: RoutesScreen,
  route: RouteScreen,
  'route-start': RouteStartScreen,
  'route-map': RouteMapScreen,
  'next-stop': NextStopScreen,
  checkin: CheckInScreen,
  visit: VisitScreen,
  delivery: DeliveryScreen,
  receipt: ReceiptScreen,
  incident: IncidentScreen,
  return: ReturnScreen,
  'route-close': RouteCloseScreen,
  'route-history': RouteHistoryScreen,

  stock: StockScreen,
  product: ProductScreen,
  'stock-move': StockMoveScreen,
  purchases: PurchasesScreen,
  'purchase-new': PurchaseNewScreen,

  finance: FinanceScreen,
  receivable: ReceivableScreen,
  payable: PayableScreen,
  fleet: FleetScreen,
  vehicle: VehicleScreen,
  tracking: TrackingScreen,
  reports: ReportsScreen,

  more: MoreScreen,
  profile: ProfileScreen,
  settings: SettingsScreen,
};

/** Telas de acesso ocupam a janela inteira, sem sidebar nem painel. */
const FULLSCREEN: ScreenName[] = ['splash', 'login', 'forgot'];

/* ------------------------------------------------------------ Transição */

function ScreenStack() {
  const { current, direction } = useNav();
  const Component = SCREENS[current.screen];

  /* Só a tela que entra anima, e só o deslocamento — nunca a opacidade.

     Duas armadilhas evitadas aqui: com AnimatePresence as duas telas ficam
     montadas durante a transição (a anterior aparece por trás da nova); e um
     `initial` com opacidade 0 deixa a tela invisível se a animação não
     terminar — o que acontece de verdade quando a aba está em segundo plano
     e o navegador congela o requestAnimationFrame. Trocar a `key` desmonta a
     anterior na hora, e o pior caso de uma animação travada é um conteúdo
     legível deslocado alguns pixels. */
  return (
    <motion.div
      key={current.key}
      initial={{ x: direction * 20 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.19, ease: [0.32, 0.72, 0, 1] }}
    >
      <Component />
    </motion.div>
  );
}

/* -------------------------------------------------- Sidebar (desktop) */

const TABS: { id: TabName; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
  { id: 'routes', label: 'Rotas', icon: Map },
  { id: 'more', label: 'Mais', icon: Menu },
];

const SHORTCUTS: { screen: ScreenName; label: string }[] = [
  { screen: 'stock', label: 'Estoque' },
  { screen: 'purchases', label: 'Compras' },
  { screen: 'finance', label: 'Financeiro' },
  { screen: 'fleet', label: 'Frota' },
  { screen: 'tracking', label: 'Rastreamento' },
  { screen: 'reports', label: 'Relatórios' },
];

function Sidebar() {
  const { tab, switchTab, navigate, current } = useNav();
  const { session } = useApp();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-shell-200 bg-white lg:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-700 text-white">
          <MarcaOvolog size={22} />
        </span>
        <div>
          <div className="font-bold leading-tight text-shell-900">OVOLOG</div>
          <div className="text-micro text-shell-500">Distribuição de ovos</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                onClick={() => switchTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-body font-semibold transition-colors',
                  tab === id
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-shell-700 hover:bg-shell-100',
                )}
              >
                <Icon size={20} strokeWidth={tab === id ? 2.4 : 1.9} />
                {label}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 px-3 text-micro font-bold uppercase tracking-widest text-shell-400">
          Gestão
        </div>
        <ul className="mt-2 space-y-1">
          {SHORTCUTS.map((s) => (
            <li key={s.screen}>
              <button
                onClick={() => navigate(s.screen)}
                className={cn(
                  'flex h-10 w-full items-center rounded-xl px-3 text-meta font-semibold transition-colors',
                  current.screen === s.screen
                    ? 'bg-shell-100 text-shell-900'
                    : 'text-shell-600 hover:bg-shell-100',
                )}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <button
        onClick={() => navigate('profile')}
        className="flex items-center gap-3 border-t border-shell-200 px-5 py-4 text-left hover:bg-shell-50"
      >
        <Avatar initials={session?.initials ?? '–'} size={36} />
        <div className="min-w-0">
          <div className="truncate text-meta font-bold text-shell-900">{session?.name}</div>
          <div className="text-micro text-shell-500">Ver perfil</div>
        </div>
      </button>
    </aside>
  );
}

/* --------------------------------------- Painel de contexto (desktop) */

/* No desktop sobra largura: em vez de esticar as telas, o espaço extra
   mostra a operação ao vivo — mapa maior e indicadores, sem duplicar
   nenhuma regra de negócio. */
function ContextPanel() {
  const { vehicles, routes, orders, customers, position, activeRoute } = useApp();
  const { navigate } = useNav();

  const todayOrders = ordersOfDay(orders, new Date());
  const sales = todayOrders.reduce((s, o) => s + orderTotal(o), 0);
  const onRoute = vehicles.filter((v) => v.status === 'em_rota');

  const stops = activeRoute
    ? activeRoute.stops.map((s) => ({
        id: s.id,
        customer: customers.find((c) => c.id === s.customerId)!,
        status: s.status,
        sequence: s.sequence,
      }))
    : [];

  return (
    <section className="hidden min-w-0 flex-1 flex-col gap-4 p-6 xl:flex">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-meta text-shell-600">Vendas hoje</div>
          <div className="mt-1 text-title font-bold tnum text-brand-800">{moneyShort(sales)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-meta text-shell-600">Pedidos</div>
          <div className="mt-1 text-title font-bold tnum text-shell-900">{num(todayOrders.length)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-meta text-shell-600">Em rota</div>
          <div className="mt-1 text-title font-bold tnum text-shell-900">{num(onRoute.length)}</div>
        </Card>
      </div>

      <Card className="min-h-0 flex-1 overflow-hidden">
        <MapCanvas
          stops={stops}
          position={position}
          vehicles={vehicles.filter((v) => v.status !== 'manutencao')}
          className="size-full"
          showLabels
          onStopClick={(id) => {
            const s = activeRoute?.stops.find((x) => x.id === id);
            if (s) navigate('customer', { customerId: s.customerId });
          }}
        />
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {routes
          .filter((r) => r.status === 'em_andamento')
          .map((r) => {
            const p = routeProgress(r);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-shell-900">Rota #{r.number}</span>
                  <span className="text-meta tnum text-shell-600">
                    {p.done}/{p.total}
                  </span>
                </div>
                <div className="mt-2">
                  <Progress value={p.ratio} tone="ok" />
                </div>
              </Card>
            );
          })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Shell */

/* Telas de retaguarda com layout próprio de desktop. O que não está aqui
   continua sendo a tela mobile dentro da coluna — de propósito. */
const DESKTOP: Partial<Record<ScreenName, ComponentType>> = {
  customers: ClientesDesktop,
  orders: PedidosDesktop,
  stock: EstoqueDesktop,
  purchases: ComprasDesktop,
  finance: FinanceiroDesktop,
  reports: RelatoriosDesktop,
};

function Shell() {
  const { current } = useNav();
  const { session } = useApp();
  const desktop = useDesktop();
  const fullscreen = FULLSCREEN.includes(current.screen);

  /* A Home é a exceção: só o gestor ganha dashboard em tela cheia. Vendedor
     e motorista abrem na rota do dia, que é uma tela de campo mesmo quando
     aberta num computador. */
  const TelaDesktop = desktop
    ? current.screen === 'home' && session?.role === 'gestor'
      ? DashboardDesktop
      : DESKTOP[current.screen]
    : undefined;

  if (fullscreen) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-md bg-white">
        <ScreenStack />
      </div>
    );
  }

  /* Telas de retaguarda ganham a janela inteira no desktop. As de campo
     (check-in, entrega, ocorrência) continuam na coluna do aparelho, mesmo
     num monitor: são fluxos de quem está em pé, na porta do cliente, e
     esticá-los não os tornaria melhores — só maiores. */
  if (TelaDesktop) {
    return (
      <div
        className="flex min-h-screen bg-shell-100"
        /* Sheets e toasts se posicionam por estas variáveis; aqui não há
           coluna de aparelho, então eles passam a se centralizar na janela. */
        style={
          {
            '--rail': 'calc(50vw - 14rem)',
            '--col-w': '28rem',
          } as CSSProperties
        }
      >
        <Sidebar />
        <main className="ml-64 min-w-0 flex-1">
          <TelaDesktop />
        </main>
        <Toasts />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-shell-200/60">
      <Sidebar />
      {/* A coluna do app tem exatamente a largura de referência do aparelho;
          no celular ela ocupa a tela inteira. */}
      <main className="w-full shrink-0 bg-shell-100 lg:ml-64 lg:h-screen lg:w-[26.25rem] lg:overflow-y-auto lg:border-r lg:border-shell-200">
        <ScreenStack />
      </main>
      <ContextPanel />
      <BottomNav />
      <Toasts />
    </div>
  );
}

/* ------------------------------------------------------------- Boot */

/* Nada é renderizado antes da carga inicial do Supabase. Sem isso as telas
   apareceriam por um instante com listas vazias — que é indistinguível, para
   quem olha, de "não tem nada cadastrado". */
function Boot() {
  const { autenticado, adminPlataforma, carregando, erroCarga, recarregar } = useApp();
  /* Admin que escolheu entrar na operação de uma distribuidora. */
  const [operando, setOperando] = useState(false);

  if (!supabaseConfigurado) {
    return (
      <BootAviso
        titulo="Banco não configurado"
        mensagem="Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env. Copie o .env.example e preencha com os dados do seu projeto."
      />
    );
  }

  /* Verificando se há sessão salva no aparelho. Dura milissegundos, mas sem
     este estado a tela de login pisca antes de o app perceber que a pessoa
     já estava conectada. */
  if (autenticado === null) return <SplashScreen />;

  /* Sem sessão, o login é a única tela: não há dado carregado para mostrar,
     e com o RLS fechado também não haveria. */
  if (!autenticado) return <LoginScreen />;

  if (erroCarga) {
    return (
      <BootAviso
        titulo="Não foi possível carregar"
        mensagem={erroCarga}
        acao={{ rotulo: 'Tentar novamente', ao: recarregar }}
      />
    );
  }

  if (carregando) return <SplashScreen legenda="Carregando a operação…" />;

  /* Quem administra o produto abre na área da plataforma, não na operação.
     Se também tiver cadastro numa distribuidora, entra nela por ali. */
  if (adminPlataforma && !operando) {
    return <PlataformaScreen onEntrarNaOperacao={() => setOperando(true)} />;
  }

  return (
    <NavigationProvider>
      <Shell />
    </NavigationProvider>
  );
}

function BootAviso({
  titulo,
  mensagem,
  acao,
}: {
  titulo: string;
  mensagem: string;
  acao?: { rotulo: string; ao: () => void };
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-shell-100 px-8">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-bad-50 text-bad-700">
          <TriangleAlert size={28} />
        </span>
        <h1 className="text-title font-bold text-shell-900">{titulo}</h1>
        <p className="mt-2 text-body text-shell-600">{mensagem}</p>
        {acao && (
          <button
            onClick={acao.ao}
            className="mt-6 h-12 w-full rounded-xl bg-brand-700 px-5 font-semibold text-white active:bg-brand-800"
          >
            {acao.rotulo}
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Boot />
    </AppProvider>
  );
}
