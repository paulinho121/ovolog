/* Modelos de domínio do OVOLOG.
   Compras → Estoque → Clientes → Pedidos → Cargas → Rotas → Entregas →
   Recebimentos → Financeiro → Frota → Relatórios. */

export type Role =
  | 'vendedor'
  | 'motorista'
  | 'estoque'
  | 'compras'
  | 'financeiro'
  | 'gestor';

export interface User {
  id: string;
  /** Conta de acesso (auth.users) ligada a esta pessoa. Ausente = pessoa
   *  cadastrada na operação que ainda não pode entrar no app. */
  authId?: string;
  /** Distribuidora a que a pessoa pertence. Uma pessoa opera uma empresa. */
  distribuidoraId?: string;
  name: string;
  role: Role;
  phone: string;
  email: string;
  vehicleId?: string;
  initials: string;
}

/* ---------------------------------------------------------------- Produtos */

export type ProductKind = 'branco' | 'vermelho' | 'caipira' | 'codorna' | 'organico';

export interface Product {
  id: string;
  name: string;
  kind: ProductKind;
  /** Preço de venda por caixa. */
  price: number;
  /** Custo médio por caixa — base da margem. */
  cost: number;
  unit: string;
  /** Dúzias por caixa — usado na conferência de carga. */
  dozensPerBox: number;
  emoji: string;
}

export interface StockBatch {
  id: string;
  productId: string;
  /** Lote do produtor. */
  code: string;
  /** ISO date. */
  expiresAt: string;
  boxes: number;
  supplierId: string;
}

export interface StockItem {
  productId: string;
  onHand: number;
  reserved: number;
  minimum: number;
  batches: StockBatch[];
}

export type StockMoveKind = 'entrada' | 'saida' | 'transferencia' | 'perda' | 'inventario';

export interface StockMove {
  id: string;
  kind: StockMoveKind;
  productId: string;
  boxes: number;
  note: string;
  at: string;
  user: string;
}

/* ---------------------------------------------------------------- Clientes */

export type CustomerStatus = 'ativo' | 'inativo' | 'inadimplente' | 'novo';

export interface Customer {
  id: string;
  name: string;
  tradeName: string;
  document: string;
  phone: string;
  district: string;
  address: string;
  status: CustomerStatus;
  /** Saldo devedor em aberto. */
  balance: number;
  creditLimit: number;
  lastPurchaseAt: string | null;
  totalPurchased: number;
  paymentTerms: string;
  /** Latitude/longitude do endereço.
   *
   *  Ausentes enquanto ninguém geocodificou o endereço. O cliente fica fora
   *  do mapa e continua na lista — melhor do que plotar num ponto inventado. */
  lat?: number;
  lng?: number;
}

/* ----------------------------------------------------------------- Pedidos */

export type OrderStatus = 'rascunho' | 'confirmado' | 'em_rota' | 'entregue' | 'cancelado';
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'prazo';

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  number: string;
  customerId: string;
  items: OrderItem[];
  discount: number;
  status: OrderStatus;
  payment: PaymentMethod;
  /** Preenchido quando payment === 'prazo'. */
  dueDate?: string;
  installments?: number;
  createdAt: string;
  sellerId: string;
  routeId?: string;
}

/* ------------------------------------------------------------------- Rotas */

export type StopStatus = 'pendente' | 'a_caminho' | 'chegou' | 'concluida' | 'nao_atendida';
export type RouteStatus = 'planejada' | 'em_andamento' | 'finalizada';

export interface RouteStop {
  id: string;
  customerId: string;
  status: StopStatus;
  sequence: number;
  /** Distância até a parada, em km, a partir da parada anterior. */
  distanceKm: number;
  etaMinutes: number;
  orderIds: string[];
  arrivedAt?: string;
  completedAt?: string;
}

export interface Route {
  id: string;
  number: string;
  driverId: string;
  vehicleId: string;
  status: RouteStatus;
  date: string;
  stops: RouteStop[];
  /** Carga embarcada por produto. */
  load: { productId: string; boxes: number }[];
  distanceKm: number;
  estimatedMinutes: number;
  startedAt?: string;
  finishedAt?: string;
}

export type IncidentKind =
  | 'cliente_fechado'
  | 'cliente_ausente'
  | 'pedido_recusado'
  | 'produto_faltando'
  | 'produto_avariado'
  | 'devolucao'
  | 'problema_pagamento'
  | 'outro';

export interface Incident {
  id: string;
  kind: IncidentKind;
  customerId: string;
  routeId: string;
  note: string;
  at: string;
}

export type ReturnReason = 'avaria' | 'recusa' | 'excesso' | 'erro_pedido' | 'outro';

export interface StockReturn {
  id: string;
  customerId: string;
  routeId: string;
  productId: string;
  boxes: number;
  reason: ReturnReason;
  at: string;
}

/* ---------------------------------------------------------------- Entregas */

export interface Delivery {
  id: string;
  orderId: string;
  routeId: string;
  checklist: { conferida: boolean; recebida: boolean; pagamento: boolean };
  deliveredAt: string;
  receiver: string;
}

/* -------------------------------------------------------------- Financeiro */

export type AccountStatus = 'a_vencer' | 'vencido' | 'pago';
export type AccountKind = 'receber' | 'pagar';

export interface Account {
  id: string;
  kind: AccountKind;
  /** Cliente (receber) ou fornecedor (pagar). */
  partyId: string;
  partyName: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: AccountStatus;
  orderId?: string;
  method?: PaymentMethod;
}

export interface CashEntry {
  id: string;
  description: string;
  amount: number;
  direction: 'in' | 'out';
  method: PaymentMethod;
  at: string;
}

/* ----------------------------------------------------------------- Compras */

export interface Supplier {
  id: string;
  name: string;
  document: string;
  phone: string;
  city: string;
}

export type PurchaseStatus = 'aberta' | 'recebida' | 'cancelada';

export interface PurchaseItem {
  productId: string;
  boxes: number;
  unitCost: number;
  batchCode: string;
  expiresAt: string;
}

export interface Purchase {
  id: string;
  number: string;
  supplierId: string;
  items: PurchaseItem[];
  status: PurchaseStatus;
  createdAt: string;
  expectedAt: string;
}

/* ------------------------------------------------------------------- Frota */

export type VehicleStatus = 'em_rota' | 'disponivel' | 'manutencao';

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  model: string;
  driverId: string;
  status: VehicleStatus;
  capacityBoxes: number;
  odometer: number;
  kmToday: number;
  /** Última posição conhecida. Ausente até o veículo reportar GPS. */
  lat?: number;
  lng?: number;
  routeId?: string;
  lastMaintenance: string;
  fuelLevel: number;
}

/* ----------------------------------------------------------- Notificações */

export type NotificationKind = 'critico' | 'atencao' | 'info' | 'sucesso';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
}

/* --------------------------------------------------------- Estado auxiliar */

export type ConnectionState = 'online' | 'sincronizando' | 'offline';

export interface CartLine {
  productId: string;
  quantity: number;
}

/* ------------------------------------------------------------ Plataforma */

/* Cada distribuidora é um tenant: opera isolada das outras dentro do mesmo
   banco, separada por RLS. */
export interface Distribuidora {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  cidade: string;
  ativa: boolean;
  criadaEm: string;
}
