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

/* ------------------------------------------------- Condição de pagamento */

/* A condição do cliente é texto no cadastro ("À vista", "28 dias") porque é
   isso que a distribuidora negocia e escreve. Para a tela de pagamento ela
   precisa virar número de dias.

   Sem esta conversão o app fazia uma coisa estranha: mostrava "Condição do
   cliente: 28 dias" na tela e usava 21 dias fixos no vencimento — o dado certo
   à vista e o errado no banco. Vencimento errado vira conta a receber errada e
   cobrança na data errada. */

/** Dias de prazo da condição cadastrada. `null` quando é à vista. */
export function diasDaCondicao(condicao: string | undefined): number | null {
  if (!condicao) return null;
  const achado = condicao.match(/(\d+)/);
  return achado ? Number(achado[1]) : null;
}

/** A forma de pagamento que o cadastro do cliente sugere. */
export function formaDaCondicao(
  condicao: string | undefined,
): 'prazo' | 'pix' {
  return diasDaCondicao(condicao) === null ? 'pix' : 'prazo';
}

/* --------------------------------------------------------- Atraso de rota */

/* "Rota atrasada" era `routes.find(r => r.status === 'em_andamento')`: QUALQUER
   rota em andamento aparecia como atrasada, inclusive uma que acabou de sair.
   Um painel que alerta sem motivo ensina quem olha a ignorar o alerta — e aí
   ele também não funciona no dia em que a rota atrasa de verdade. */

export interface AtrasoRota {
  minutos: number;
  paradasRestantes: number;
}

/** Minutos além do previsto, ou `null` se a rota está dentro do tempo. */
export function atrasoDaRota(rota: Route, agora = new Date()): AtrasoRota | null {
  if (rota.status !== 'em_andamento' || !rota.startedAt) return null;

  const restantes = rota.stops.filter(
    (s) => s.status !== 'concluida' && s.status !== 'nao_atendida',
  ).length;
  // Sem parada pendente não há o que atrasar: falta só encerrar a rota.
  if (restantes === 0) return null;

  const decorrido = (agora.getTime() - new Date(rota.startedAt).getTime()) / 60000;

  /* O previsto é para a rota inteira, então comparar o tempo decorrido com ele
     só acusa atraso no fim do dia. Comparar com o previsto ATÉ AQUI — a fatia
     proporcional às paradas já cumpridas — acusa no meio da manhã, que é
     quando ainda dá para remanejar. */
  const total = rota.stops.length;
  const cumpridas = total - restantes;
  const previstoAteAqui = total > 0 ? (rota.estimatedMinutes * cumpridas) / total : 0;

  const atraso = Math.round(decorrido - previstoAteAqui);
  // Margem de 15 min: trânsito e um café não são atraso operacional.
  return atraso > 15 ? { minutos: atraso, paradasRestantes: restantes } : null;
}
