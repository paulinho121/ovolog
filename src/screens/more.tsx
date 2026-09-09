import { useState } from 'react';
import {
  Bell,
  ChevronRight,
  CloudOff,
  FileBarChart,
  LogOut,
  Mail,
  Package,
  Phone,
  Settings as SettingsIcon,
  ShoppingBag,
  Truck,
  User,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { AppBar, ConnectionPill, Screen, SyncBanner, TabHeader } from '../components/layout/chrome';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  KeyValue,
  ListRow,
  SectionTitle,
} from '../components/ui/primitives';
import { Segmented } from '../components/ui/forms';
import { ConfirmSheet } from '../components/ui/overlays';
import { EmptyState } from '../components/ui/states';
import { NotificationRow } from '../components/domain';
import { useApp } from '../store/app';
import { useNav, type ScreenName } from '../store/navigation';
import { phone as fmtPhone } from '../lib/format';
import type { Role } from '../types';

const ROLE_LABEL: Record<string, string> = {
  vendedor: 'Vendedor',
  motorista: 'Motorista',
  estoque: 'Estoque',
  compras: 'Compras',
  financeiro: 'Financeiro',
  gestor: 'Gestor',
};

/* O menu "Mais" agrupa o que não cabe nas quatro abas principais, em três
   blocos que espelham a estrutura da empresa (§35).

   Cada item declara quem o usa. Antes o menu mostrava tudo para todos, e o
   motorista via "Relatórios" e "Compras" — coisas que ele nunca abre e que só
   ocupam espaço na lista que ele precisa percorrer com uma mão, dentro do
   veículo.

   Isto é ORGANIZAÇÃO, não segurança: esconder um item do menu não impede o
   acesso aos dados. Quem protege é o RLS, e no momento ele libera a operação
   inteira para qualquer pessoa da equipe. Separar dados por papel no banco é
   um passo à parte. */

const TODOS: Role[] = ['vendedor', 'motorista', 'estoque', 'compras', 'financeiro', 'gestor'];

const GROUPS: {
  title: string;
  items: {
    screen: ScreenName;
    label: string;
    icon: React.ReactNode;
    hint?: string;
    /** Quem enxerga o item. Gestor enxerga tudo, sempre. */
    papeis: Role[];
  }[];
}[] = [
  {
    title: 'Operação',
    items: [
      {
        screen: 'route-history',
        label: 'Entregas',
        icon: <Package size={20} />,
        hint: 'Histórico de rotas e entregas',
        papeis: ['vendedor', 'motorista', 'gestor'],
      },
      {
        screen: 'stock',
        label: 'Estoque',
        icon: <Warehouse size={20} />,
        hint: 'Saldos, lotes e movimentações',
        papeis: ['estoque', 'compras', 'gestor'],
      },
      {
        screen: 'purchases',
        label: 'Compras',
        icon: <ShoppingBag size={20} />,
        hint: 'Fornecedores e entradas',
        papeis: ['compras', 'estoque', 'gestor'],
      },
    ],
  },
  {
    title: 'Gestão',
    items: [
      {
        screen: 'finance',
        label: 'Financeiro',
        icon: <Wallet size={20} />,
        hint: 'Receber, pagar e caixa',
        papeis: ['financeiro', 'gestor'],
      },
      {
        screen: 'fleet',
        label: 'Frota',
        icon: <Truck size={20} />,
        hint: 'Veículos e rastreamento',
        papeis: ['motorista', 'gestor'],
      },
      {
        screen: 'reports',
        label: 'Relatórios',
        icon: <FileBarChart size={20} />,
        hint: 'Vendas, margem e rotas',
        papeis: ['gestor'],
      },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { screen: 'notifications', label: 'Notificações', icon: <Bell size={20} />, papeis: TODOS },
      { screen: 'profile', label: 'Perfil', icon: <User size={20} />, papeis: TODOS },
      { screen: 'settings', label: 'Configurações', icon: <SettingsIcon size={20} />, papeis: TODOS },
    ],
  },
];

export function MoreScreen() {
  const { session, notifications } = useApp();
  const { navigate } = useNav();
  const unread = notifications.filter((n) => !n.read).length;

  /* Grupo que ficou sem nenhum item some junto com o título — um cabeçalho
     de seção sozinho é pior que a ausência dele. */
  const grupos = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !session || i.papeis.includes(session.role)),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <TabHeader title="Mais" />
      <Screen className="space-y-5 px-4 pt-2">
        <Card>
          <button
            onClick={() => navigate('profile')}
            className="flex w-full items-center gap-3 p-4 text-left active:bg-shell-50"
          >
            <Avatar initials={session?.initials ?? '–'} size={48} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-shell-900">{session?.name}</div>
              <div className="text-meta text-shell-600">
                {ROLE_LABEL[session?.role ?? ''] ?? '—'}
              </div>
            </div>
            <ChevronRight size={18} className="text-shell-400" />
          </button>
        </Card>

        {grupos.map((group) => (
          <div key={group.title}>
            <SectionTitle>{group.title}</SectionTitle>
            <Card className="divide-y divide-shell-200 overflow-hidden">
              {group.items.map((item) => (
                <ListRow
                  key={item.screen + item.label}
                  leading={
                    <span className="grid size-10 place-items-center rounded-xl bg-shell-100 text-shell-600">
                      {item.icon}
                    </span>
                  }
                  title={item.label}
                  subtitle={item.hint}
                  trailing={
                    item.screen === 'notifications' && unread > 0 ? (
                      <Badge tone="bad">{unread}</Badge>
                    ) : undefined
                  }
                  onClick={() => navigate(item.screen)}
                />
              ))}
            </Card>
          </div>
        ))}

        <div className="pb-2 text-center text-meta text-shell-400">
          OVOLOG • versão 1.0.0
        </div>
      </Screen>
    </>
  );
}

/* --------------------------------------------------------- Notificações */

export function NotificationsScreen() {
  const { notifications, markNotificationsRead } = useApp();
  const [filter, setFilter] = useState<'todas' | 'nao_lidas'>('todas');

  const list = notifications.filter((n) => filter === 'todas' || !n.read);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <AppBar
        title="Notificações"
        right={
          unread > 0 ? (
            <button
              onClick={markNotificationsRead}
              className="px-3 py-2 text-meta font-bold text-brand-800"
            >
              Marcar lidas
            </button>
          ) : undefined
        }
      />
      <Screen>
        <div className="border-b border-shell-200 bg-white p-4">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'todas', label: `Todas (${notifications.length})` },
              { value: 'nao_lidas', label: `Não lidas (${unread})` },
            ]}
          />
        </div>

        {list.length === 0 ? (
          <EmptyState
            title="Tudo em dia"
            message="Você não tem notificações não lidas."
            icon={<Bell size={28} />}
          />
        ) : (
          <div className="divide-y divide-shell-200 bg-white">
            {list.map((n) => (
              <NotificationRow key={n.id} item={n} />
            ))}
          </div>
        )}
      </Screen>
    </>
  );
}

/* ---------------------------------------------------------------- Perfil */

export function ProfileScreen() {
  const { session, signOut, orders, routes } = useApp();
  const { navigate, reset } = useNav();
  const [exitOpen, setExitOpen] = useState(false);

  if (!session) return <EmptyState title="Sem sessão" />;

  const myOrders = orders.filter((o) => o.sellerId === session.id);
  const myRoutes = routes.filter((r) => r.driverId === session.id);

  return (
    <>
      <AppBar title="Perfil" />
      <Screen>
        <div className="flex flex-col items-center bg-white px-4 pb-6 pt-2">
          <Avatar initials={session.initials} size={80} />
          <h1 className="mt-3 text-title font-bold text-shell-900">{session.name}</h1>
          <Badge tone="brand" className="mt-1.5">
            {ROLE_LABEL[session.role]}
          </Badge>
        </div>

        <div className="space-y-3 p-4">
          <Card className="px-4 py-1">
            <KeyValue
              label={<span className="flex items-center gap-2"><Phone size={15} /> Telefone</span>}
              value={fmtPhone(session.phone)}
            />
            <Divider />
            <KeyValue
              label={<span className="flex items-center gap-2"><Mail size={15} /> E-mail</span>}
              value={session.email}
            />
          </Card>

          <SectionTitle className="pt-2">Sua atividade</SectionTitle>
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-title font-bold tnum text-shell-900">{myOrders.length}</div>
                <div className="text-meta text-shell-600">pedidos</div>
              </div>
              <div className="border-l border-shell-200">
                <div className="text-title font-bold tnum text-shell-900">{myRoutes.length}</div>
                <div className="text-meta text-shell-600">rotas</div>
              </div>
            </div>
          </Card>

          <Card className="divide-y divide-shell-200 overflow-hidden">
            <ListRow
              leading={
                <span className="grid size-10 place-items-center rounded-xl bg-shell-100 text-shell-600">
                  <Bell size={18} />
                </span>
              }
              title="Notificações"
              onClick={() => navigate('notifications')}
            />
            <ListRow
              leading={
                <span className="grid size-10 place-items-center rounded-xl bg-shell-100 text-shell-600">
                  <SettingsIcon size={18} />
                </span>
              }
              title="Preferências"
              onClick={() => navigate('settings')}
            />
            <ListRow
              leading={
                <span className="grid size-10 place-items-center rounded-xl bg-shell-100 text-shell-600">
                  <Users size={18} />
                </span>
              }
              title="Trocar de perfil"
              subtitle="Voltar à tela de acesso"
              onClick={() => setExitOpen(true)}
            />
          </Card>

          <Button
            variant="secondary"
            size="lg"
            block
            icon={<LogOut size={18} />}
            className="mt-2 text-bad-700"
            onClick={() => setExitOpen(true)}
          >
            Sair
          </Button>
        </div>
      </Screen>

      <ConfirmSheet
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        onConfirm={() => {
          void signOut();
          reset('login');
        }}
        title="Sair do aplicativo?"
        message="Alterações não sincronizadas permanecem salvas neste aparelho."
        confirmLabel="Sair"
        tone="danger"
      />
    </>
  );
}

/* --------------------------------------------------------- Configurações */

export function SettingsScreen() {
  const { connection, pendingSync, syncNow, filaPersistente } = useApp();
  const [notifyOrders, setNotifyOrders] = useState(true);
  const [notifyStock, setNotifyStock] = useState(true);
  const [notifyFinance, setNotifyFinance] = useState(false);

  return (
    <>
      <AppBar title="Configurações" />
      <Screen>
        <SyncBanner />
        <div className="space-y-3 p-4">
          <SectionTitle>Conexão</SectionTitle>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-shell-900">Estado atual</div>
                <p className="mt-0.5 text-meta text-shell-600">
                  {pendingSync > 0
                    ? `${pendingSync} alterações aguardando envio`
                    : 'Tudo sincronizado'}
                </p>
              </div>
              <ConnectionPill />
            </div>

            {/* O estado da conexão é lido do aparelho, não escolhido aqui.
                O que esta tela precisa responder é outra pergunta: "o que eu
                registrei está seguro?". */}
            <div className="mt-4 flex items-start gap-2.5 rounded-card bg-shell-100 p-3">
              <CloudOff size={18} className="mt-0.5 shrink-0 text-shell-500" />
              <p className="text-meta text-shell-700">
                {filaPersistente
                  ? 'Sem sinal, o app continua funcionando: pedidos, visitas e entregas ficam gravados no aparelho e sobem sozinhos quando a conexão voltar — mesmo que você feche o app.'
                  : 'Este navegador não permite gravar no aparelho. Sem sinal o app continua funcionando, mas o que ficar pendente se perde se o app for fechado antes de sincronizar.'}
              </p>
            </div>

            {pendingSync > 0 && (
              <Button size="md" block className="mt-3" onClick={syncNow}>
                Sincronizar agora
              </Button>
            )}
          </Card>

          <SectionTitle className="pt-2">Notificações</SectionTitle>
          <Card className="divide-y divide-shell-200 overflow-hidden">
            <Toggle label="Pedidos e entregas" checked={notifyOrders} onChange={setNotifyOrders} />
            <Toggle label="Estoque e validade" checked={notifyStock} onChange={setNotifyStock} />
            <Toggle label="Financeiro" checked={notifyFinance} onChange={setNotifyFinance} />
          </Card>

          <SectionTitle className="pt-2">Sobre</SectionTitle>
          <Card className="px-4 py-1">
            <KeyValue label="Versão" value="1.0.0" />
            <Divider />
            <KeyValue label="Ambiente" value="Demonstração" />
          </Card>

          <p className="px-1 pt-2 text-meta text-shell-500">
            Os dados desta demonstração são fictícios e vivem apenas na memória do navegador.
            Recarregar a página devolve tudo ao estado inicial.
          </p>
        </div>
      </Screen>
    </>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="flex min-h-[3.5rem] w-full items-center justify-between px-4 py-3 text-left active:bg-shell-100"
    >
      <span className="font-medium text-shell-900">{label}</span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-ok-500' : 'bg-shell-300'
        }`}
      >
        <span
          className={`absolute top-0.5 size-6 rounded-full bg-white shadow-card transition-[left] ${
            checked ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}
