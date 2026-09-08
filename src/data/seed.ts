import type {
  Account,
  AppNotification,
  CashEntry,
  Incident,
  Order,
  Purchase,
  Route,
  StockItem,
  StockMove,
  StockReturn,
} from '../types';
import { customers, products } from './catalog';

/* Movimento do dia. Tudo é ancorado em `today` para que a demonstração
   sempre pareça a operação de hoje, qualquer que seja o dia em que rode. */

const now = new Date();

export const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

/** ISO de hoje em determinado horário. */
export function at(hour: number, minute = 0) {
  const d = new Date(today);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function daysAgo(n: number, hour = 10) {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function daysAhead(n: number, hour = 10) {
  return daysAgo(-n, hour);
}

/* ------------------------------------------------------------------ Rotas */

/* Rota do dia do João: 12 clientes. As três primeiras paradas já foram
   concluídas — o app abre no meio da operação, que é o estado real de uso. */
const routeStopPlan: Array<{
  customerId: string;
  distanceKm: number;
  etaMinutes: number;
  orders: string[];
}> = [
  { customerId: 'c10', distanceKm: 6.4, etaMinutes: 14, orders: ['o1'] },
  { customerId: 'c2', distanceKm: 3.1, etaMinutes: 8, orders: ['o2', 'o3'] },
  { customerId: 'c1', distanceKm: 1.2, etaMinutes: 5, orders: ['o4'] },
  { customerId: 'c7', distanceKm: 2.0, etaMinutes: 6, orders: ['o5'] },
  { customerId: 'c3', distanceKm: 4.8, etaMinutes: 11, orders: ['o6', 'o7'] },
  { customerId: 'c5', distanceKm: 3.6, etaMinutes: 9, orders: ['o8'] },
  { customerId: 'c4', distanceKm: 5.2, etaMinutes: 12, orders: ['o9'] },
  { customerId: 'c11', distanceKm: 4.1, etaMinutes: 10, orders: ['o10'] },
  { customerId: 'c6', distanceKm: 3.9, etaMinutes: 9, orders: ['o11'] },
  { customerId: 'c16', distanceKm: 2.7, etaMinutes: 7, orders: ['o12'] },
  { customerId: 'c8', distanceKm: 8.3, etaMinutes: 18, orders: ['o13', 'o14'] },
  { customerId: 'c9', distanceKm: 3.4, etaMinutes: 8, orders: ['o15'] },
];

export const routes: Route[] = [
  {
    id: 'r1',
    number: '1042',
    driverId: 'u1',
    vehicleId: 'v1',
    status: 'planejada',
    date: today.toISOString(),
    distanceKm: 86,
    estimatedMinutes: 260,
    load: [
      { productId: 'p1', boxes: 78 },
      { productId: 'p2', boxes: 46 },
      { productId: 'p3', boxes: 24 },
      { productId: 'p4', boxes: 18 },
      { productId: 'p6', boxes: 14 },
    ],
    stops: routeStopPlan.map((s, i) => ({
      id: `r1s${i + 1}`,
      customerId: s.customerId,
      sequence: i + 1,
      status: 'pendente' as const,
      distanceKm: s.distanceKm,
      etaMinutes: s.etaMinutes,
      orderIds: s.orders,
    })),
  },
  {
    id: 'r2',
    number: '1043',
    driverId: 'u2',
    vehicleId: 'v2',
    status: 'em_andamento',
    date: today.toISOString(),
    distanceKm: 52,
    estimatedMinutes: 180,
    startedAt: at(7, 40),
    load: [
      { productId: 'p1', boxes: 34 },
      { productId: 'p4', boxes: 22 },
    ],
    stops: [
      { id: 'r2s1', customerId: 'c13', sequence: 1, status: 'concluida', distanceKm: 12.4, etaMinutes: 22, orderIds: ['o16'], completedAt: at(8, 30) },
      { id: 'r2s2', customerId: 'c14', sequence: 2, status: 'concluida', distanceKm: 9.1, etaMinutes: 17, orderIds: [], completedAt: at(9, 15) },
      { id: 'r2s3', customerId: 'c15', sequence: 3, status: 'a_caminho', distanceKm: 5.5, etaMinutes: 12, orderIds: ['o17'] },
      { id: 'r2s4', customerId: 'c12', sequence: 4, status: 'pendente', distanceKm: 7.2, etaMinutes: 15, orderIds: ['o18'] },
    ],
  },
];

/* ---------------------------------------------------------------- Pedidos */

type OrderSpec = [
  id: string,
  customerId: string,
  items: Array<[productId: string, qty: number]>,
  payment: Order['payment'],
  discount: number,
];

const orderSpecs: OrderSpec[] = [
  ['o1', 'c10', [['p1', 14], ['p3', 6]], 'prazo', 0],
  ['o2', 'c2', [['p1', 10], ['p2', 5]], 'prazo', 100],
  ['o3', 'c2', [['p4', 4]], 'pix', 0],
  ['o4', 'c1', [['p1', 8], ['p2', 3], ['p4', 2]], 'pix', 0],
  ['o5', 'c7', [['p1', 4], ['p4', 3]], 'dinheiro', 0],
  ['o6', 'c3', [['p1', 12], ['p2', 8]], 'prazo', 150],
  ['o7', 'c3', [['p5', 3]], 'cartao', 0],
  ['o8', 'c5', [['p1', 20], ['p2', 12], ['p3', 5]], 'prazo', 300],
  ['o9', 'c4', [['p2', 6], ['p3', 4]], 'pix', 0],
  ['o10', 'c11', [['p1', 5], ['p4', 4]], 'dinheiro', 0],
  ['o11', 'c6', [['p1', 6]], 'prazo', 0],
  ['o12', 'c16', [['p6', 5], ['p4', 2]], 'pix', 0],
  ['o13', 'c8', [['p1', 7], ['p5', 2]], 'prazo', 0],
  ['o14', 'c8', [['p3', 3]], 'cartao', 0],
  ['o15', 'c9', [['p1', 9], ['p6', 4]], 'dinheiro', 50],
  ['o16', 'c13', [['p1', 24], ['p2', 10]], 'prazo', 400],
  ['o17', 'c15', [['p6', 3]], 'pix', 0],
  ['o18', 'c12', [['p1', 4], ['p3', 2]], 'pix', 0],
];

function buildOrder(spec: OrderSpec, index: number): Order {
  const [id, customerId, items, payment, discount] = spec;
  const routeId = index < 15 ? 'r1' : 'r2';
  return {
    id,
    number: String(1200 + index),
    customerId,
    items: items.map(([productId, quantity]) => ({
      productId,
      quantity,
      unitPrice: products.find((p) => p.id === productId)!.price,
    })),
    discount,
    status: routeId === 'r2' && index === 15 ? 'entregue' : 'confirmado',
    payment,
    dueDate: payment === 'prazo' ? daysAhead(21) : undefined,
    installments: payment === 'prazo' ? 1 : undefined,
    // Pedidos da operação de hoje — foram lançados nas primeiras horas.
    createdAt: at(7 + (index % 3), (index * 7) % 60),
    sellerId: routeId === 'r1' ? 'u1' : 'u2',
    routeId,
  };
}

/* Histórico dos últimos 30 dias — alimenta relatórios e o extrato do cliente. */
function buildHistory(): Order[] {
  const out: Order[] = [];
  const pool = customers.filter((c) => c.status === 'ativo' || c.status === 'inadimplente');
  const payments: Order['payment'][] = ['pix', 'dinheiro', 'prazo', 'cartao', 'prazo'];
  let n = 0;
  for (let day = 1; day <= 30; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() - day);
    if (date.getDay() === 0) continue; // sem operação aos domingos
    // 3 a 6 pedidos por dia útil, variando de forma determinística.
    const count = 3 + ((day * 7) % 4);
    for (let i = 0; i < count; i++) {
      const customer = pool[(day * 5 + i * 3) % pool.length];
      const product = products[(day + i) % products.length];
      const second = products[(day + i + 2) % products.length];
      const qty = 3 + ((day * 3 + i * 5) % 14);
      out.push({
        id: `h${n}`,
        number: String(900 + n),
        customerId: customer.id,
        items: [
          { productId: product.id, quantity: qty, unitPrice: product.price },
          ...(i % 2 === 0
            ? [{ productId: second.id, quantity: 2 + (i % 5), unitPrice: second.price }]
            : []),
        ],
        discount: i % 4 === 0 ? 50 : 0,
        status: 'entregue',
        payment: payments[(day + i) % payments.length],
        createdAt: daysAgo(day, 8 + (i % 9)),
        sellerId: ['u1', 'u2', 'u3'][(day + i) % 3],
        routeId: undefined,
      });
      n++;
    }
  }
  return out;
}

export const orders: Order[] = [...orderSpecs.map(buildOrder), ...buildHistory()];

/* ---------------------------------------------------------------- Estoque */

export const stock: StockItem[] = [
  {
    productId: 'p1', onHand: 450, reserved: 120, minimum: 200,
    batches: [
      { id: 'b1', productId: 'p1', code: '#0826', expiresAt: daysAhead(5), boxes: 60, supplierId: 's1' },
      { id: 'b2', productId: 'p1', code: '#0902', expiresAt: daysAhead(19), boxes: 210, supplierId: 's1' },
      { id: 'b3', productId: 'p1', code: '#0907', expiresAt: daysAhead(26), boxes: 180, supplierId: 's2' },
    ],
  },
  {
    productId: 'p2', onHand: 180, reserved: 46, minimum: 120,
    batches: [
      { id: 'b4', productId: 'p2', code: '#0828', expiresAt: daysAhead(11), boxes: 80, supplierId: 's2' },
      { id: 'b5', productId: 'p2', code: '#0905', expiresAt: daysAhead(23), boxes: 100, supplierId: 's2' },
    ],
  },
  {
    productId: 'p3', onHand: 64, reserved: 24, minimum: 80,
    batches: [
      { id: 'b6', productId: 'p3', code: '#0901', expiresAt: daysAhead(9), boxes: 24, supplierId: 's4' },
      { id: 'b7', productId: 'p3', code: '#0908', expiresAt: daysAhead(21), boxes: 40, supplierId: 's4' },
    ],
  },
  {
    productId: 'p4', onHand: 210, reserved: 18, minimum: 90,
    batches: [
      { id: 'b8', productId: 'p4', code: '#0824', expiresAt: daysAhead(3), boxes: 35, supplierId: 's3' },
      { id: 'b9', productId: 'p4', code: '#0904', expiresAt: daysAhead(28), boxes: 175, supplierId: 's3' },
    ],
  },
  {
    productId: 'p5', onHand: 38, reserved: 5, minimum: 40,
    batches: [
      { id: 'b10', productId: 'p5', code: '#0903', expiresAt: daysAhead(14), boxes: 38, supplierId: 's4' },
    ],
  },
  {
    productId: 'p6', onHand: 290, reserved: 14, minimum: 150,
    batches: [
      { id: 'b11', productId: 'p6', code: '#0906', expiresAt: daysAhead(17), boxes: 290, supplierId: 's1' },
    ],
  },
];

export const stockMoves: StockMove[] = [
  { id: 'm1', kind: 'entrada', productId: 'p1', boxes: 180, note: 'NF 44821 — Granja Santa Rita', at: daysAgo(1, 7), user: 'Rita Alves' },
  { id: 'm2', kind: 'saida', productId: 'p1', boxes: 78, note: 'Carga rota #1042', at: at(6, 40), user: 'Rita Alves' },
  { id: 'm3', kind: 'saida', productId: 'p2', boxes: 46, note: 'Carga rota #1042', at: at(6, 45), user: 'Rita Alves' },
  { id: 'm4', kind: 'perda', productId: 'p4', boxes: 3, note: 'Caixas avariadas na descarga', at: daysAgo(2, 15), user: 'Rita Alves' },
  { id: 'm5', kind: 'inventario', productId: 'p6', boxes: 290, note: 'Contagem mensal', at: daysAgo(3, 18), user: 'Rita Alves' },
  { id: 'm6', kind: 'transferencia', productId: 'p3', boxes: 12, note: 'Câmara fria 1 → 2', at: daysAgo(4, 11), user: 'Rita Alves' },
];

/* ---------------------------------------------------------------- Compras */

export const purchases: Purchase[] = [
  {
    id: 'pc1', number: '3310', supplierId: 's1', status: 'aberta',
    createdAt: daysAgo(1, 9), expectedAt: daysAhead(1),
    items: [
      { productId: 'p1', boxes: 200, unitCost: 141, batchCode: '#0910', expiresAt: daysAhead(28) },
      { productId: 'p6', boxes: 80, unitCost: 122, batchCode: '#0910', expiresAt: daysAhead(28) },
    ],
  },
  {
    id: 'pc2', number: '3309', supplierId: 's4', status: 'aberta',
    createdAt: daysAgo(2, 14), expectedAt: daysAhead(3),
    items: [
      { productId: 'p3', boxes: 60, unitCost: 203, batchCode: '#0911', expiresAt: daysAhead(24) },
    ],
  },
  {
    id: 'pc3', number: '3308', supplierId: 's2', status: 'recebida',
    createdAt: daysAgo(5, 8), expectedAt: daysAgo(3),
    items: [
      { productId: 'p2', boxes: 100, unitCost: 160, batchCode: '#0905', expiresAt: daysAhead(23) },
    ],
  },
  {
    id: 'pc4', number: '3307', supplierId: 's3', status: 'recebida',
    createdAt: daysAgo(8, 10), expectedAt: daysAgo(6),
    items: [
      { productId: 'p4', boxes: 175, unitCost: 70, batchCode: '#0904', expiresAt: daysAhead(28) },
    ],
  },
];

/* ------------------------------------------------------------- Financeiro */

export const accounts: Account[] = [
  { id: 'a1', kind: 'receber', partyId: 'c2', partyName: 'Padaria Central', amount: 1520, paidAmount: 0, dueDate: daysAhead(2), status: 'a_vencer', orderId: 'o2', method: 'prazo' },
  { id: 'a2', kind: 'receber', partyId: 'c6', partyName: 'Empório do Bairro', amount: 2740, paidAmount: 0, dueDate: daysAgo(9), status: 'vencido', method: 'prazo' },
  { id: 'a3', kind: 'receber', partyId: 'c13', partyName: 'Atacadão do Ovo', amount: 8900, paidAmount: 0, dueDate: daysAhead(11), status: 'a_vencer', orderId: 'o16', method: 'prazo' },
  { id: 'a4', kind: 'receber', partyId: 'c10', partyName: 'Hotel Primavera', amount: 4100, paidAmount: 0, dueDate: daysAhead(6), status: 'a_vencer', orderId: 'o1', method: 'prazo' },
  { id: 'a5', kind: 'receber', partyId: 'c5', partyName: 'Super Estrela', amount: 3200, paidAmount: 0, dueDate: daysAhead(16), status: 'a_vencer', orderId: 'o8', method: 'prazo' },
  { id: 'a6', kind: 'receber', partyId: 'c1', partyName: 'Mercadinho São José', amount: 450, paidAmount: 0, dueDate: daysAgo(3), status: 'vencido', method: 'prazo' },
  { id: 'a7', kind: 'receber', partyId: 'c8', partyName: 'Doce Mel', amount: 1180, paidAmount: 0, dueDate: daysAhead(9), status: 'a_vencer', orderId: 'o13', method: 'prazo' },
  { id: 'a8', kind: 'receber', partyId: 'c4', partyName: 'Sabor Caseiro', amount: 890, paidAmount: 890, dueDate: daysAgo(1), status: 'pago', method: 'pix' },
  { id: 'a9', kind: 'pagar', partyId: 's1', partyName: 'Granja Santa Rita', amount: 38020, paidAmount: 0, dueDate: daysAhead(4), status: 'a_vencer' },
  { id: 'a10', kind: 'pagar', partyId: 's2', partyName: 'Avícola Vale Verde', amount: 16000, paidAmount: 0, dueDate: daysAhead(1), status: 'a_vencer' },
  { id: 'a11', kind: 'pagar', partyId: 's3', partyName: 'Granja Ouro Amarelo', amount: 12250, paidAmount: 0, dueDate: daysAgo(2), status: 'vencido' },
  { id: 'a12', kind: 'pagar', partyId: 's4', partyName: 'Sítio Caipira Feliz', amount: 12180, paidAmount: 12180, dueDate: daysAgo(4), status: 'pago' },
];

export const cashEntries: CashEntry[] = [
  { id: 'ce1', description: 'Recebimento Sabor Caseiro', amount: 890, direction: 'in', method: 'pix', at: at(9, 12) },
  { id: 'ce2', description: 'Recebimento Bom Preço', amount: 1620, direction: 'in', method: 'dinheiro', at: at(10, 4) },
  { id: 'ce3', description: 'Combustível Van 03', amount: 320, direction: 'out', method: 'cartao', at: at(7, 20) },
  { id: 'ce4', description: 'Recebimento Lanchonete do Zé', amount: 740, direction: 'in', method: 'pix', at: at(11, 38) },
  { id: 'ce5', description: 'Pedágio rota #1042', amount: 46, direction: 'out', method: 'dinheiro', at: at(8, 5) },
  { id: 'ce6', description: 'Recebimento Cantina da Nona', amount: 540, direction: 'in', method: 'pix', at: daysAgo(1, 16) },
];

/* ------------------------------------------------- Ocorrências e devoluções */

export const incidents: Incident[] = [
  { id: 'i1', kind: 'cliente_fechado', customerId: 'c14', routeId: 'r2', note: 'Estabelecimento fechado para reforma.', at: at(9, 15) },
];

export const returns: StockReturn[] = [
  { id: 'd1', customerId: 'c13', routeId: 'r2', productId: 'p1', boxes: 4, reason: 'avaria', at: at(8, 28) },
];

/* ----------------------------------------------------------- Notificações */

export const notifications: AppNotification[] = [
  { id: 'n1', kind: 'critico', title: 'Conta vencida', body: 'Empório do Bairro está com R$ 2.740,00 em atraso há 9 dias.', at: at(7, 5), read: false },
  { id: 'n2', kind: 'atencao', title: 'Estoque baixo', body: 'Ovo Caipira está com 64 caixas — abaixo do mínimo de 80.', at: at(6, 50), read: false },
  { id: 'n3', kind: 'atencao', title: 'Validade curta', body: 'Lote #0826 de Ovo Branco vence em 5 dias. Priorizar na rota.', at: at(6, 48), read: false },
  { id: 'n4', kind: 'sucesso', title: 'Rota iniciada', body: 'Carro 02 iniciou a rota #1043 com 4 paradas.', at: at(7, 40), read: true },
  { id: 'n5', kind: 'info', title: 'Compra a caminho', body: 'Pedido #3310 da Granja Santa Rita chega amanhã.', at: daysAgo(1, 9), read: true },
  { id: 'n6', kind: 'critico', title: 'Rota atrasada', body: 'Rota #1043 está 25 min acima do tempo previsto.', at: at(10, 30), read: false },
];
