import {
  Bell,
  ChevronLeft,
  Cloud,
  CloudOff,
  Home,
  Map,
  Menu,
  RefreshCw,
  ShoppingCart,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { greeting, longDate } from '../../lib/format';
import { useApp } from '../../store/app';
import { useNav, type TabName } from '../../store/navigation';
import { Avatar, Dot } from '../ui/primitives';

/* Estrutura fixa do app: header compacto, conteúdo rolável e navegação
   inferior. O miolo nunca disputa espaço vertical com o cromo. */

/* ------------------------------------------------------------- Conexão */

export function ConnectionPill({ compact }: { compact?: boolean }) {
  const { connection, pendingSync, setConnection, syncNow } = useApp();

  const map = {
    online: { tone: 'ok' as const, label: 'Online', icon: <Cloud size={13} /> },
    sincronizando: { tone: 'warn' as const, label: 'Sincronizando', icon: <RefreshCw size={13} className="animate-spin" /> },
    offline: { tone: 'bad' as const, label: 'Offline', icon: <CloudOff size={13} /> },
  }[connection];

  return (
    <button
      onClick={() => (connection === 'offline' ? syncNow() : setConnection('offline'))}
      aria-label={`Conexão: ${map.label}. Tocar para alternar.`}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5',
        'text-micro font-bold uppercase tracking-wide',
        connection === 'online' && 'bg-ok-50 text-ok-700',
        connection === 'sincronizando' && 'bg-warn-50 text-warn-700',
        connection === 'offline' && 'bg-bad-50 text-bad-700',
      )}
    >
      {map.icon}
      {!compact && map.label}
      {pendingSync > 0 && (
        <span className="ml-0.5 rounded-full bg-white/70 px-1.5 tnum">{pendingSync}</span>
      )}
    </button>
  );
}

/* Aviso de pendências — aparece só quando há algo esperando sincronizar. */
export function SyncBanner() {
  const { pendingSync, connection, syncNow } = useApp();
  if (pendingSync === 0) return null;
  return (
    <button
      onClick={syncNow}
      className="flex w-full items-center gap-2 bg-warn-50 px-4 py-2.5 text-left"
    >
      <RefreshCw size={15} className={cn('shrink-0 text-warn-700', connection === 'sincronizando' && 'animate-spin')} />
      <span className="flex-1 text-meta font-semibold text-warn-700">
        {pendingSync} {pendingSync === 1 ? 'alteração aguardando' : 'alterações aguardando'} sincronização
      </span>
      {connection !== 'sincronizando' && (
        <span className="text-meta font-bold text-warn-700 underline">Sincronizar</span>
      )}
    </button>
  );
}

/* --------------------------------------------------------------- Header */

/* Header da Home: saudação + data à esquerda, status à direita. Duas linhas
   no máximo — espaço vertical no celular é o recurso mais escasso do app. */
export function Header() {
  const { session, notifications } = useApp();
  const { navigate } = useNav();
  const unread = notifications.filter((n) => !n.read).length;
  const firstName = session?.name.split(' ')[0] ?? '';

  return (
    <header
      className="sticky top-0 z-30 bg-shell-100/95 backdrop-blur-sm"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-subtitle font-bold text-shell-900">
            {greeting()}, {firstName} 👋
          </div>
          <div className="truncate text-meta text-shell-600">{longDate(new Date())}</div>
        </div>
        <ConnectionPill compact />
        <button
          onClick={() => navigate('notifications')}
          aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`}
          className="relative grid size-11 place-items-center rounded-full text-shell-700 active:bg-shell-200"
        >
          <Bell size={22} />
          {unread > 0 && (
            <span className="absolute right-2 top-2 grid min-w-4 place-items-center rounded-full bg-bad-500 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
        <button onClick={() => navigate('profile')} aria-label="Perfil">
          <Avatar initials={session?.initials ?? '–'} size={36} />
        </button>
      </div>
      <SyncBanner />
    </header>
  );
}

/* Header de tela interna: voltar + título. Sempre 56px. */
export function AppBar({
  title,
  subtitle,
  onBack,
  right,
  sticky = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  sticky?: boolean;
}) {
  const { back } = useNav();
  return (
    <header
      className={cn(
        'z-30 border-b border-shell-200 bg-white',
        sticky && 'sticky top-0',
      )}
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="flex h-14 items-center gap-1 pl-1 pr-2">
        <button
          onClick={onBack ?? back}
          aria-label="Voltar"
          className="grid size-11 shrink-0 place-items-center rounded-full text-shell-800 active:bg-shell-200"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-subtitle font-bold text-shell-900">{title}</div>
          {subtitle && <div className="-mt-0.5 truncate text-meta text-shell-600">{subtitle}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}

/* Título grande de aba (Clientes, Pedidos…), sem botão voltar. */
export function TabHeader({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-shell-100/95 pb-2 backdrop-blur-sm" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="flex h-14 items-center gap-2 px-4">
        <h1 className="flex-1 text-display font-bold text-shell-900">{title}</h1>
        {right}
      </div>
      {children && <div className="px-4">{children}</div>}
    </header>
  );
}

/* -------------------------------------------------------------- Conteúdo */

/* Reserva o espaço inferior certo para que nada fique atrás da navegação
   nem da barra de ação fixa. */
export function Screen({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  /** Altura reservada quando a tela tem barra de ação fixa. */
  action?: 'none' | 'single' | 'double';
}) {
  const { showTabBar } = useNav();
  const reserve =
    (showTabBar ? 'var(--nav-h)' : '0px') +
    ' + ' +
    (action === 'single' ? '5.5rem' : action === 'double' ? '9rem' : '1rem') +
    ' + var(--safe-bottom)';
  return (
    <div className={cn('min-h-screen', className)} style={{ paddingBottom: `calc(${reserve})` }}>
      {children}
    </div>
  );
}

/* Barra de ação fixa: a ação principal da tela vive aqui, ao alcance do
   polegar e acima da navegação inferior (princípio de uma mão). */
export function StickyAction({ children }: { children: ReactNode }) {
  const { showTabBar } = useNav();
  return (
    <div
      className="app-fixed fixed z-40 border-t border-shell-200 bg-white/95 px-4 pt-3 backdrop-blur"
      style={{
        bottom: showTabBar ? 'var(--nav-h)' : '0px',
        paddingBottom: `calc(0.75rem + ${showTabBar ? '0px' : 'var(--safe-bottom)'})`,
      }}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------- Navegação inferior */

const TABS: { id: TabName; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
  { id: 'routes', label: 'Rotas', icon: Map },
  { id: 'more', label: 'Mais', icon: Menu },
];

export function BottomNav() {
  const { tab, switchTab, showTabBar } = useNav();
  const { activeRoute, notifications } = useApp();
  const unread = notifications.filter((n) => !n.read).length;
  if (!showTabBar) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className="app-fixed fixed bottom-0 z-40 border-t border-shell-200 bg-white lg:hidden"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="flex h-[var(--nav-h)]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          const badge =
            id === 'routes' && activeRoute?.status === 'em_andamento'
              ? 'dot'
              : id === 'more' && unread > 0
                ? 'dot'
                : null;
          return (
            <li key={id} className="flex-1">
              <button
                onClick={() => switchTab(id)}
                aria-current={active ? 'page' : undefined}
                className="relative flex size-full flex-col items-center justify-center gap-1"
              >
                <span className="relative">
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.4 : 1.9}
                    className={active ? 'text-brand-700' : 'text-shell-500'}
                  />
                  {badge && (
                    <Dot tone={id === 'routes' ? 'ok' : 'bad'} className="absolute -right-1 top-0 ring-2 ring-white" />
                  )}
                </span>
                <span
                  className={cn(
                    'text-[11px] leading-none',
                    active ? 'font-bold text-brand-700' : 'font-medium text-shell-500',
                  )}
                >
                  {label}
                </span>
                {active && (
                  <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-brand-700" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
