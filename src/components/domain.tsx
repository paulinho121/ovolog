import {
  AlertTriangle,
  Bell,
  Banknote,
  CheckCircle2,
  CreditCard,
  Info,
  MapPin,
  QrCode,
  CalendarClock,
  Truck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { money, relativeDay, shortDate, dateTime, num } from '../lib/format';
import { orderBoxes, orderTotal, stockLevel, available, ultimaCompraRotulo } from '../lib/domain';
import type {
  Account,
  AppNotification,
  Customer,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  RouteStop,
  StockItem,
  Vehicle,
  VehicleStatus,
} from '../types';
import { Badge, Card, Dot, Progress, type Tone } from './ui/primitives';
import { Stepper } from './ui/forms';

/* Componentes que carregam significado de negócio. Ficam juntos para que
   "status entregue" tenha exatamente a mesma cor e palavra em toda tela. */

/* --------------------------------------------------------------- Rótulos */

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  confirmado: { label: 'Confirmado', tone: 'info' },
  em_rota: { label: 'Em rota', tone: 'brand' },
  entregue: { label: 'Entregue', tone: 'ok' },
  cancelado: { label: 'Cancelado', tone: 'bad' },
};

export const CUSTOMER_STATUS: Record<Customer['status'], { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'ok' },
  inativo: { label: 'Inativo', tone: 'neutral' },
  inadimplente: { label: 'Inadimplente', tone: 'bad' },
  novo: { label: 'Novo', tone: 'info' },
};

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: Tone }> = {
  em_rota: { label: 'Em rota', tone: 'ok' },
  disponivel: { label: 'Disponível', tone: 'info' },
  manutencao: { label: 'Manutenção', tone: 'warn' },
};

export const STOP_STATUS: Record<RouteStop['status'], { label: string; tone: Tone }> = {
  pendente: { label: 'Pendente', tone: 'neutral' },
  a_caminho: { label: 'A caminho', tone: 'brand' },
  chegou: { label: 'No local', tone: 'info' },
  concluida: { label: 'Concluída', tone: 'ok' },
  nao_atendida: { label: 'Não atendida', tone: 'bad' },
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  prazo: 'A prazo',
};

export const PAYMENT_ICON: Record<PaymentMethod, ReactNode> = {
  pix: <QrCode size={20} />,
  dinheiro: <Banknote size={20} />,
  cartao: <CreditCard size={20} />,
  prazo: <CalendarClock size={20} />,
};

export const INCIDENT_LABEL: Record<string, string> = {
  cliente_fechado: 'Cliente fechado',
  cliente_ausente: 'Cliente ausente',
  pedido_recusado: 'Pedido recusado',
  produto_faltando: 'Produto faltando',
  produto_avariado: 'Produto avariado',
  devolucao: 'Devolução',
  problema_pagamento: 'Problema de pagamento',
  outro: 'Outro',
};

export const RETURN_REASON_LABEL: Record<string, string> = {
  avaria: 'Avaria',
  recusa: 'Recusa',
  excesso: 'Excesso',
  erro_pedido: 'Erro de pedido',
  outro: 'Outro',
};

export const STOCK_MOVE_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  transferencia: 'Transferência',
  perda: 'Perda',
  inventario: 'Inventário',
};

/* ------------------------------------------------------------- Clientes */

export function CustomerCard({
  customer,
  onClick,
  trailing,
}: {
  customer: Customer;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const status = CUSTOMER_STATUS[customer.status];
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-subtitle font-bold text-shell-900">{customer.tradeName}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-meta text-shell-600">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{customer.district}</span>
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-micro font-semibold uppercase tracking-wide text-shell-500">
            Última compra
          </div>
          <div className="text-body font-semibold text-shell-900">
            {ultimaCompraRotulo(customer, relativeDay)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-micro font-semibold uppercase tracking-wide text-shell-500">Saldo</div>
          <div
            className={cn(
              'text-body font-bold tnum',
              customer.balance > 0 ? 'text-bad-700' : 'text-shell-900',
            )}
          >
            {money(customer.balance)}
          </div>
        </div>
        {trailing}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- Pedidos */

export function OrderCard({
  order,
  customer,
  onClick,
}: {
  order: Order;
  customer?: Customer;
  onClick?: () => void;
}) {
  const status = ORDER_STATUS[order.status];
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-meta font-bold tnum text-shell-500">#{order.number}</span>
            <span className="truncate font-bold text-shell-900">
              {customer?.tradeName ?? 'Cliente'}
            </span>
          </div>
          <div className="mt-1 text-meta text-shell-600">
            {num(orderBoxes(order))} caixas • {PAYMENT_LABEL[order.payment]}
          </div>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-meta text-shell-500">{dateTime(order.createdAt)}</span>
        <span className="text-subtitle font-bold tnum text-shell-900">{money(orderTotal(order))}</span>
      </div>
    </Card>
  );
}

/* Linha de produto com stepper — o coração da tela de novo pedido. */
export function ProductPickRow({
  product,
  quantity,
  onChange,
  availableBoxes,
}: {
  product: Product;
  quantity: number;
  onChange: (q: number) => void;
  availableBoxes?: number;
}) {
  const low = availableBoxes !== undefined && availableBoxes < 20;
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-shell-200 px-4 py-3 last:border-0',
        quantity > 0 && 'bg-brand-50',
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-shell-100 text-xl">
        {product.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-shell-900">{product.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-meta">
          <span className="font-semibold tnum text-shell-700">
            {money(product.price)} <span className="font-normal text-shell-500">/ {product.unit}</span>
          </span>
          {availableBoxes !== undefined && (
            <span className={cn('tnum', low ? 'font-semibold text-warn-700' : 'text-shell-500')}>
              • {num(availableBoxes)} disp.
            </span>
          )}
        </div>
      </div>
      <Stepper value={quantity} onChange={onChange} max={availableBoxes ?? 999} />
    </div>
  );
}

/* ---------------------------------------------------------------- Rotas */

export function StopRow({
  stop,
  customer,
  onClick,
  showDistance = true,
}: {
  stop: RouteStop;
  customer?: Customer;
  onClick?: () => void;
  showDistance?: boolean;
}) {
  const status = STOP_STATUS[stop.status];
  const done = stop.status === 'concluida';
  const failed = stop.status === 'nao_atendida';
  const current = stop.status === 'a_caminho' || stop.status === 'chegou';
  const Tag = (onClick ? 'button' : 'div') as 'button';

  return (
    <Tag
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left',
        onClick && 'active:bg-shell-100',
        current && 'bg-brand-50',
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-meta font-bold',
          done && 'bg-ok-500 text-white',
          failed && 'bg-bad-500 text-white',
          current && 'bg-brand-700 text-white',
          !done && !failed && !current && 'border-2 border-shell-300 bg-white text-shell-600',
        )}
      >
        {done ? <CheckCircle2 size={18} /> : stop.sequence}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate font-semibold',
            done || failed ? 'text-shell-500' : 'text-shell-900',
            done && 'line-through decoration-shell-400',
          )}
        >
          {customer?.tradeName ?? 'Cliente'}
        </div>
        <div className="mt-0.5 truncate text-meta text-shell-600">
          {customer?.district}
          {showDistance && ` • ${stop.distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`}
          {stop.orderIds.length > 0 && ` • ${stop.orderIds.length} pedido${stop.orderIds.length > 1 ? 's' : ''}`}
        </div>
      </div>
      {(current || failed) && <Badge tone={status.tone}>{status.label}</Badge>}
    </Tag>
  );
}

/* ---------------------------------------------------------------- Frota */

export function VehicleCard({
  vehicle,
  driverName,
  onClick,
  progress,
}: {
  vehicle: Vehicle;
  driverName?: string;
  onClick?: () => void;
  progress?: { done: number; total: number };
}) {
  const status = VEHICLE_STATUS[vehicle.status];
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-shell-100 text-shell-600">
          <Truck size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-shell-900">{vehicle.name}</span>
            <span className="text-meta tnum text-shell-500">{vehicle.plate}</span>
          </div>
          <div className="mt-0.5 truncate text-meta text-shell-600">{driverName}</div>
        </div>
        <Badge tone={status.tone} icon={<Dot tone={status.tone} />}>
          {status.label}
        </Badge>
      </div>
      {progress && progress.total > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex justify-between text-meta text-shell-600">
            <span>Paradas</span>
            <span className="font-semibold tnum text-shell-900">
              {progress.done} de {progress.total}
            </span>
          </div>
          <Progress value={progress.done / progress.total} tone="ok" />
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------- Financeiro */

export function AccountCard({
  account,
  onClick,
  onRegister,
}: {
  account: Account;
  onClick?: () => void;
  onRegister?: () => void;
}) {
  const tone: Tone =
    account.status === 'pago' ? 'ok' : account.status === 'vencido' ? 'bad' : 'warn';
  const label =
    account.status === 'pago' ? 'Pago' : account.status === 'vencido' ? 'Vencido' : 'A vencer';
  const open = account.amount - account.paidAmount;
  return (
    <Card className="overflow-hidden">
      <button onClick={onClick} className="w-full p-4 text-left active:bg-shell-50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold text-shell-900">{account.partyName}</div>
            <div className="mt-0.5 text-meta text-shell-600">
              Vencimento {shortDate(account.dueDate)}
            </div>
          </div>
          <Badge tone={tone}>{label}</Badge>
        </div>
        <div className="mt-2 text-title font-bold tnum text-shell-900">{money(open)}</div>
      </button>
      {onRegister && account.status !== 'pago' && (
        <button
          onClick={onRegister}
          className="w-full border-t border-shell-200 py-3 text-body font-bold text-brand-800 active:bg-brand-50"
        >
          Registrar pagamento
        </button>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- Estoque */

export function StockRow({
  item,
  product,
  onClick,
}: {
  item: StockItem;
  product: Product;
  onClick?: () => void;
}) {
  const level = stockLevel(item);
  const tone: Tone = level === 'critico' ? 'bad' : level === 'baixo' ? 'warn' : 'ok';
  const label = level === 'critico' ? 'Crítico' : level === 'baixo' ? 'Baixo' : 'Normal';
  const free = available(item);
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-shell-100 text-xl">
          {product.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-shell-900">{product.name}</div>
          <div className="mt-0.5 text-meta text-shell-600">
            <span className="tnum">{num(item.onHand)}</span> em estoque •{' '}
            <span className="tnum">{num(item.reserved)}</span> reservado
          </div>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between text-meta">
          <span className="text-shell-600">Disponível para venda</span>
          <span className="font-bold tnum text-shell-900">{num(free)} cx</span>
        </div>
        <Progress value={free / Math.max(item.minimum * 2.5, 1)} tone={tone} />
      </div>
    </Card>
  );
}

/* --------------------------------------------------------- Notificações */

const NOTIFICATION_STYLE = {
  critico: { tone: 'bad' as Tone, icon: <AlertTriangle size={18} /> },
  atencao: { tone: 'warn' as Tone, icon: <AlertTriangle size={18} /> },
  info: { tone: 'info' as Tone, icon: <Info size={18} /> },
  sucesso: { tone: 'ok' as Tone, icon: <CheckCircle2 size={18} /> },
};

export function NotificationRow({ item }: { item: AppNotification }) {
  const style = NOTIFICATION_STYLE[item.kind];
  const toneClass = {
    bad: 'bg-bad-50 text-bad-700',
    warn: 'bg-warn-50 text-warn-700',
    info: 'bg-info-50 text-info-700',
    ok: 'bg-ok-50 text-ok-700',
    neutral: 'bg-shell-200 text-shell-700',
    brand: 'bg-brand-100 text-brand-800',
  }[style.tone];

  return (
    <div className={cn('flex gap-3 px-4 py-3.5', !item.read && 'bg-brand-50/40')}>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', toneClass)}>
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-bold text-shell-900">{item.title}</span>
          {!item.read && <Dot tone="bad" className="shrink-0" />}
        </div>
        <p className="mt-0.5 text-meta text-shell-600">{item.body}</p>
        <span className="mt-1 block text-meta text-shell-400">{dateTime(item.at)}</span>
      </div>
    </div>
  );
}

/* Card de alerta operacional — usado na Home do gestor. */
export function AlertCard({
  tone,
  title,
  body,
  onClick,
}: {
  tone: Tone;
  title: string;
  body: string;
  onClick?: () => void;
}) {
  const style = {
    bad: 'bg-bad-50 text-bad-700',
    warn: 'bg-warn-50 text-warn-700',
    info: 'bg-info-50 text-info-700',
    ok: 'bg-ok-50 text-ok-700',
    neutral: 'bg-shell-200 text-shell-700',
    brand: 'bg-brand-100 text-brand-800',
  }[tone];
  const Tag = (onClick ? 'button' : 'div') as 'button';
  return (
    <Tag
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-card border border-shell-200 bg-white p-3.5 text-left shadow-card active:bg-shell-50"
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', style)}>
        <Bell size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-shell-900">{title}</span>
        <span className="mt-0.5 block text-meta text-shell-600">{body}</span>
      </span>
    </Tag>
  );
}
