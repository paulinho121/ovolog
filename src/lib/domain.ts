import type {
  Account,
  Order,
  Product,
  Route,
  RouteStop,
  StockItem,
} from '../types';
import { daysUntil } from './format';

/* Regras de cálculo do domínio. Ficam fora do store para que qualquer tela
   chegue ao mesmo número — nenhum total é recalculado à mão em componente. */

export const lineTotal = (quantity: number, unitPrice: number) => quantity * unitPrice;

export function orderSubtotal(order: Pick<Order, 'items'>) {
  return order.items.reduce((sum, i) => sum + lineTotal(i.quantity, i.unitPrice), 0);
}

export function orderTotal(order: Pick<Order, 'items' | 'discount'>) {
  return Math.max(0, orderSubtotal(order) - order.discount);
}

export function orderBoxes(order: Pick<Order, 'items'>) {
  return order.items.reduce((sum, i) => sum + i.quantity, 0);
}

export function orderCost(order: Pick<Order, 'items'>, products: Product[]) {
  return order.items.reduce((sum, i) => {
    const p = products.find((x) => x.id === i.productId);
    return sum + (p ? p.cost * i.quantity : 0);
  }, 0);
}

/** Margem bruta em fração (0–1). Retorna 0 quando não há receita. */
export function orderMargin(order: Pick<Order, 'items' | 'discount'>, products: Product[]) {
  const revenue = orderTotal(order);
  if (revenue <= 0) return 0;
  return (revenue - orderCost(order, products)) / revenue;
}

/* -------------------------------------------------------------------- Rota */

export const isStopDone = (s: RouteStop) =>
  s.status === 'concluida' || s.status === 'nao_atendida';

/** Próxima parada a atender — a primeira que não foi concluída. */
export function nextStop(route: Route): RouteStop | undefined {
  return route.stops.find((s) => !isStopDone(s));
}

export function routeProgress(route: Route) {
  const done = route.stops.filter(isStopDone).length;
  return { done, total: route.stops.length, ratio: route.stops.length ? done / route.stops.length : 0 };
}

export function routeOrders(route: Route, orders: Order[]) {
  const ids = new Set(route.stops.flatMap((s) => s.orderIds));
  return orders.filter((o) => ids.has(o.id));
}

export function routeLoadBoxes(route: Route) {
  return route.load.reduce((sum, l) => sum + l.boxes, 0);
}

/** Distância restante a partir da próxima parada, somando o trecho seguinte. */
export function remainingDistance(route: Route) {
  return route.stops.filter((s) => !isStopDone(s)).reduce((sum, s) => sum + s.distanceKm, 0);
}

export function remainingMinutes(route: Route) {
  return route.stops.filter((s) => !isStopDone(s)).reduce((sum, s) => sum + s.etaMinutes, 0);
}

export interface RouteSummary {
  clients: number;
  visited: number;
  notServed: number;
  orders: number;
  deliveries: number;
  soldBoxes: number;
  returnedBoxes: number;
  sales: number;
  received: number;
  toReceive: number;
  distanceKm: number;
}

export function routeSummary(
  route: Route,
  orders: Order[],
  returnedBoxes: number,
): RouteSummary {
  const list = routeOrders(route, orders);
  const delivered = list.filter((o) => o.status === 'entregue');
  const sales = delivered.reduce((s, o) => s + orderTotal(o), 0);
  const received = delivered
    .filter((o) => o.payment !== 'prazo')
    .reduce((s, o) => s + orderTotal(o), 0);
  return {
    clients: route.stops.length,
    visited: route.stops.filter((s) => s.status === 'concluida').length,
    notServed: route.stops.filter((s) => s.status === 'nao_atendida').length,
    orders: list.length,
    deliveries: delivered.length,
    soldBoxes: delivered.reduce((s, o) => s + orderBoxes(o), 0),
    returnedBoxes,
    sales,
    received,
    toReceive: sales - received,
    distanceKm: route.distanceKm,
  };
}

/* ----------------------------------------------------------------- Estoque */

export const available = (item: StockItem) => Math.max(0, item.onHand - item.reserved);

export type StockLevel = 'critico' | 'baixo' | 'normal';

export function stockLevel(item: StockItem): StockLevel {
  const free = available(item);
  if (free <= item.minimum * 0.5) return 'critico';
  if (free < item.minimum) return 'baixo';
  return 'normal';
}

/** Lotes que vencem dentro de `days` dias, do mais urgente ao menos. */
export function expiringBatches(stock: StockItem[], days = 7) {
  return stock
    .flatMap((item) => item.batches)
    .filter((b) => daysUntil(b.expiresAt) <= days)
    .sort((a, b) => daysUntil(a.expiresAt) - daysUntil(b.expiresAt));
}

/* -------------------------------------------------------------- Financeiro */

export function accountOpen(a: Account) {
  return Math.max(0, a.amount - a.paidAmount);
}

export function accountsTotal(accounts: Account[], kind: Account['kind'], status?: Account['status']) {
  return accounts
    .filter((a) => a.kind === kind && (!status || a.status === status))
    .reduce((s, a) => s + accountOpen(a), 0);
}

/** Recalcula o status a partir da data — evita "a vencer" que já venceu. */
export function resolveAccountStatus(a: Account): Account['status'] {
  if (accountOpen(a) <= 0) return 'pago';
  return daysUntil(a.dueDate) < 0 ? 'vencido' : 'a_vencer';
}

/* ------------------------------------------------------------------ Datas */

export function sameDay(iso: string, day: Date) {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

export function ordersOfDay(orders: Order[], day: Date) {
  return orders.filter((o) => sameDay(o.createdAt, day));
}

/* Um cliente com histórico de compra não pode aparecer como "Nunca comprou".
   O app carrega os pedidos recentes, não a vida inteira do cliente: quando
   não há pedido no período mas existe total acumulado, a resposta certa é
   "não sabemos", não "nunca". */
export function ultimaCompraRotulo(
  cliente: { lastPurchaseAt: string | null; totalPurchased: number },
  formatar: (iso: string | null) => string,
) {
  if (cliente.lastPurchaseAt) return formatar(cliente.lastPurchaseAt);
  return cliente.totalPurchased > 0 ? 'Sem registro recente' : 'Nunca';
}
