import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* Navegação em pilha, no estilo de um app nativo — não há URL.
   Isso mantém o contexto do usuário (REGRA 9) e permite voltar uma única vez
   de qualquer profundidade (REGRA 10). */

export type ScreenName =
  // Acesso
  | 'splash' | 'login' | 'forgot'
  // Início
  | 'home' | 'notifications'
  // Clientes
  | 'customers' | 'customer-search' | 'customer-new' | 'customer' | 'customer-history'
  // Pedidos
  | 'order-new' | 'order-products' | 'cart' | 'payment' | 'order-done' | 'orders' | 'order'
  // Rotas e campo
  | 'routes' | 'route' | 'route-start' | 'route-map' | 'next-stop' | 'checkin'
  | 'visit' | 'delivery' | 'receipt' | 'incident' | 'return' | 'route-close' | 'route-history'
  // Estoque e compras
  | 'stock' | 'product' | 'stock-move' | 'purchases' | 'purchase-new'
  // Gestão
  | 'finance' | 'receivable' | 'payable' | 'fleet' | 'vehicle' | 'tracking' | 'reports'
  // Sistema
  | 'more' | 'profile' | 'settings';

export type TabName = 'home' | 'customers' | 'orders' | 'routes' | 'more';

export const TAB_ROOTS: Record<TabName, ScreenName> = {
  home: 'home',
  customers: 'customers',
  orders: 'orders',
  routes: 'routes',
  more: 'more',
};

export interface Frame {
  screen: ScreenName;
  params: Record<string, string | number | undefined>;
  /** Chave estável para a animação de transição. */
  key: number;
}

interface NavState {
  stack: Frame[];
  current: Frame;
  tab: TabName;
  /** Direção da última transição — a animação usa isso. */
  direction: 1 | -1;
  /** A navegação inferior só aparece na raiz de cada aba. */
  showTabBar: boolean;
  navigate: (screen: ScreenName, params?: Frame['params']) => void;
  replace: (screen: ScreenName, params?: Frame['params']) => void;
  back: () => void;
  /** Volta até a raiz da aba atual. */
  backToRoot: () => void;
  switchTab: (tab: TabName) => void;
  /** Troca a pilha inteira — usado no login/logout. */
  reset: (screen: ScreenName) => void;
}

const NavContext = createContext<NavState | undefined>(undefined);

let keySeq = 0;
const frame = (screen: ScreenName, params: Frame['params'] = {}): Frame => ({
  screen,
  params,
  key: ++keySeq,
});

export function NavigationProvider({ children }: { children: ReactNode }) {
  /* Começa no login: a tela de splash agora é a própria espera da carga
     inicial, exibida pelo `Boot` antes deste provider existir. */
  const [stack, setStack] = useState<Frame[]>(() => [frame('login')]);
  const [tab, setTab] = useState<TabName>('home');
  const [direction, setDirection] = useState<1 | -1>(1);

  const navigate = useCallback((screen: ScreenName, params: Frame['params'] = {}) => {
    setDirection(1);
    setStack((s) => [...s, frame(screen, params)]);
  }, []);

  const replace = useCallback((screen: ScreenName, params: Frame['params'] = {}) => {
    setDirection(1);
    setStack((s) => [...s.slice(0, -1), frame(screen, params)]);
  }, []);

  const back = useCallback(() => {
    setDirection(-1);
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const backToRoot = useCallback(() => {
    setDirection(-1);
    setStack((s) => s.slice(0, 1));
  }, []);

  const switchTab = useCallback((next: TabName) => {
    setDirection(1);
    setTab(next);
    setStack([frame(TAB_ROOTS[next])]);
  }, []);

  const reset = useCallback((screen: ScreenName) => {
    setDirection(1);
    setStack([frame(screen)]);
  }, []);

  const current = stack[stack.length - 1];

  const value = useMemo<NavState>(
    () => ({
      stack,
      current,
      tab,
      direction,
      showTabBar: stack.length === 1 && current.screen === TAB_ROOTS[tab],
      navigate,
      replace,
      back,
      backToRoot,
      switchTab,
      reset,
    }),
    [stack, current, tab, direction, navigate, replace, back, backToRoot, switchTab, reset],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav precisa estar dentro de NavigationProvider');
  return ctx;
}

/** Parâmetros da tela atual, já tipados como string. */
export function useParams() {
  return useNav().current.params;
}
