/* Gera `supabase/migrations/0002_seed.sql` a partir dos dados do próprio app.
 *
 * O seed sai do mesmo módulo que abastecia a versão em memória, então o banco
 * nasce idêntico ao que o produto já mostrava — sem uma segunda fonte de
 * verdade escrita à mão para sair de sincronia.
 *
 *   npx tsx scripts/gerar-seed.ts
 *
 * As datas são relativas ao dia em que o script roda ("hoje" vira a data da
 * geração). Rode de novo quando quiser reancorar a demonstração.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { customers, products, suppliers, users, vehicles } from '../src/data/catalog';
import * as seed from '../src/data/seed';

/* ------------------------------------------------------------ helpers */

const q = (v: string | null | undefined) =>
  v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`;

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? 'null' : String(v);

const b = (v: boolean) => (v ? 'true' : 'false');

/** timestamptz */
const ts = (v: string | null | undefined) => (v ? `'${v}'::timestamptz` : 'null');

/** date — aceita ISO completo ou 'YYYY-MM-DD' */
const d = (v: string | null | undefined) =>
  v ? `'${v.slice(0, 10)}'::date` : 'null';

const rows: string[] = [];

function insert(table: string, columns: string[], values: string[][]) {
  if (values.length === 0) return;
  rows.push(
    `insert into ${table} (${columns.join(', ')}) values\n` +
      values.map((v) => `  (${v.join(', ')})`).join(',\n') +
      ';\n',
  );
}

/* ------------------------------------------------------------ cadastros */

insert(
  'usuarios',
  ['id', 'nome', 'papel', 'telefone', 'email', 'iniciais'],
  users.map((u) => [q(u.id), q(u.name), q(u.role), q(u.phone), q(u.email), q(u.initials)]),
);

insert(
  'produtos',
  ['id', 'nome', 'tipo', 'preco', 'custo', 'unidade', 'duzias_por_caixa', 'emoji'],
  products.map((p) => [
    q(p.id), q(p.name), q(p.kind), n(p.price), n(p.cost), q(p.unit), n(p.dozensPerBox), q(p.emoji),
  ]),
);

insert(
  'fornecedores',
  ['id', 'nome', 'documento', 'telefone', 'cidade'],
  suppliers.map((s) => [q(s.id), q(s.name), q(s.document), q(s.phone), q(s.city)]),
);

insert(
  'clientes',
  ['id', 'nome', 'nome_fantasia', 'documento', 'telefone', 'bairro', 'endereco',
   'status', 'saldo', 'limite_credito', 'total_comprado', 'condicao_pagamento', 'x', 'y'],
  customers.map((c) => [
    q(c.id), q(c.name), q(c.tradeName), q(c.document), q(c.phone), q(c.district), q(c.address),
    q(c.status), n(c.balance), n(c.creditLimit), n(c.totalPurchased), q(c.paymentTerms),
    n(c.x), n(c.y),
  ]),
);

/* Veículos antes de rotas; a ligação veiculo.rota_id entra depois, quando as
   rotas já existem (as duas tabelas se referenciam). */
insert(
  'veiculos',
  ['id', 'nome', 'placa', 'modelo', 'motorista_id', 'status', 'capacidade_caixas',
   'odometro', 'km_hoje', 'x', 'y', 'ultima_manutencao', 'nivel_combustivel'],
  vehicles.map((v) => [
    q(v.id), q(v.name), q(v.plate), q(v.model), q(v.driverId), q(v.status),
    n(v.capacityBoxes), n(v.odometer), n(v.kmToday), n(v.x), n(v.y),
    d(v.lastMaintenance), n(v.fuelLevel),
  ]),
);

rows.push(
  users
    .filter((u) => u.vehicleId)
    .map((u) => `update usuarios set veiculo_id = ${q(u.vehicleId)} where id = ${q(u.id)};`)
    .join('\n') + '\n',
);

/* ------------------------------------------------------------- estoque */

insert(
  'estoque',
  ['produto_id', 'em_maos', 'reservado', 'minimo'],
  seed.stock.map((s) => [q(s.productId), n(s.onHand), n(s.reserved), n(s.minimum)]),
);

insert(
  'lotes',
  ['id', 'produto_id', 'codigo', 'validade', 'caixas', 'fornecedor_id'],
  seed.stock.flatMap((s) =>
    s.batches.map((l) => [
      q(l.id), q(l.productId), q(l.code), d(l.expiresAt), n(l.boxes), q(l.supplierId),
    ]),
  ),
);

insert(
  'movimentacoes_estoque',
  ['id', 'tipo', 'produto_id', 'caixas', 'observacao', 'usuario', 'em'],
  seed.stockMoves.map((m) => [
    q(m.id), q(m.kind), q(m.productId), n(m.boxes), q(m.note), q(m.user), ts(m.at),
  ]),
);

/* --------------------------------------------------------------- rotas */

insert(
  'rotas',
  ['id', 'numero', 'motorista_id', 'veiculo_id', 'status', 'data',
   'distancia_km', 'minutos_estimados', 'iniciada_em'],
  seed.routes.map((r) => [
    q(r.id), q(r.number), q(r.driverId), q(r.vehicleId), q(r.status), d(r.date),
    n(r.distanceKm), n(r.estimatedMinutes), ts(r.startedAt),
  ]),
);

insert(
  'rota_carga',
  ['rota_id', 'produto_id', 'caixas'],
  seed.routes.flatMap((r) => r.load.map((l) => [q(r.id), q(l.productId), n(l.boxes)])),
);

insert(
  'rota_paradas',
  ['id', 'rota_id', 'cliente_id', 'sequencia', 'status', 'distancia_km',
   'eta_minutos', 'chegou_em', 'concluida_em'],
  seed.routes.flatMap((r) =>
    r.stops.map((s) => [
      q(s.id), q(r.id), q(s.customerId), n(s.sequence), q(s.status),
      n(s.distanceKm), n(s.etaMinutes), ts(s.arrivedAt), ts(s.completedAt),
    ]),
  ),
);

rows.push(
  seed.routes
    .filter((r) => r.status === 'em_andamento')
    .map((r) => `update veiculos set rota_id = ${q(r.id)} where id = ${q(r.vehicleId)};`)
    .join('\n') + '\n',
);

/* ------------------------------------------------------------- pedidos */

insert(
  'pedidos',
  ['id', 'numero', 'cliente_id', 'desconto', 'status', 'pagamento',
   'vencimento', 'parcelas', 'vendedor_id', 'rota_id', 'criado_em'],
  seed.orders.map((o) => [
    q(o.id), q(o.number), q(o.customerId), n(o.discount), q(o.status), q(o.payment),
    // O banco exige vencimento quando o pagamento é a prazo.
    o.payment === 'prazo' ? d(o.dueDate ?? o.createdAt) : 'null',
    n(o.installments), q(o.sellerId), q(o.routeId), ts(o.createdAt),
  ]),
);

insert(
  'pedido_itens',
  ['pedido_id', 'produto_id', 'quantidade', 'preco_unitario'],
  seed.orders.flatMap((o) =>
    // O schema tem unique (pedido_id, produto_id): itens repetidos do mesmo
    // produto viram uma linha só.
    Object.entries(
      o.items.reduce<Record<string, { qtd: number; preco: number }>>((acc, i) => {
        const cur = acc[i.productId] ?? { qtd: 0, preco: i.unitPrice };
        acc[i.productId] = { qtd: cur.qtd + i.quantity, preco: i.unitPrice };
        return acc;
      }, {}),
    ).map(([produtoId, v]) => [q(o.id), q(produtoId), n(v.qtd), n(v.preco)]),
  ),
);

insert(
  'rota_parada_pedidos',
  ['parada_id', 'pedido_id'],
  seed.routes.flatMap((r) =>
    r.stops.flatMap((s) => s.orderIds.map((oid) => [q(s.id), q(oid)])),
  ),
);

/* --------------------------------------------------------------- campo */

insert(
  'ocorrencias',
  ['id', 'tipo', 'cliente_id', 'rota_id', 'observacao', 'em'],
  seed.incidents.map((i) => [q(i.id), q(i.kind), q(i.customerId), q(i.routeId), q(i.note), ts(i.at)]),
);

insert(
  'devolucoes',
  ['id', 'cliente_id', 'rota_id', 'produto_id', 'caixas', 'motivo', 'em'],
  seed.returns.map((r) => [
    q(r.id), q(r.customerId), q(r.routeId), q(r.productId), n(r.boxes), q(r.reason), ts(r.at),
  ]),
);

/* ---------------------------------------------------------- financeiro */

insert(
  'contas',
  ['id', 'tipo', 'parte_id', 'parte_nome', 'valor', 'valor_pago', 'vencimento', 'status', 'pedido_id', 'metodo'],
  seed.accounts.map((a) => [
    q(a.id), q(a.kind), q(a.partyId), q(a.partyName), n(a.amount), n(a.paidAmount),
    d(a.dueDate), q(a.status), q(a.orderId), q(a.method),
  ]),
);

insert(
  'caixa_lancamentos',
  ['id', 'descricao', 'valor', 'direcao', 'metodo', 'em'],
  seed.cashEntries.map((c) => [
    q(c.id), q(c.description), n(c.amount), q(c.direction), q(c.method), ts(c.at),
  ]),
);

/* ------------------------------------------------------------- compras */

insert(
  'compras',
  ['id', 'numero', 'fornecedor_id', 'status', 'criado_em', 'previsto_para'],
  seed.purchases.map((p) => [
    q(p.id), q(p.number), q(p.supplierId), q(p.status), ts(p.createdAt), d(p.expectedAt),
  ]),
);

insert(
  'compra_itens',
  ['compra_id', 'produto_id', 'caixas', 'custo_unitario', 'codigo_lote', 'validade'],
  seed.purchases.flatMap((p) =>
    p.items.map((i) => [
      q(p.id), q(i.productId), n(i.boxes), n(i.unitCost), q(i.batchCode), d(i.expiresAt),
    ]),
  ),
);

/* -------------------------------------------------------- notificações */

insert(
  'notificacoes',
  ['id', 'tipo', 'titulo', 'corpo', 'lida', 'em'],
  seed.notifications.map((x) => [q(x.id), q(x.kind), q(x.title), q(x.body), b(x.read), ts(x.at)]),
);

/* -------------------------------------------------------------- saída */

const header = `-- OVOLOG — carga inicial.
--
-- GERADO por scripts/gerar-seed.ts. Não edite à mão: rode
--   npx tsx scripts/gerar-seed.ts
--
-- Gerado em ${new Date().toISOString()}
-- As datas são relativas a essa geração ("hoje" = ${new Date().toISOString().slice(0, 10)}).

begin;

-- Limpa antes de recarregar, para o script ser reexecutável.
truncate
  notificacoes, compra_itens, compras, caixa_lancamentos, contas,
  devolucoes, ocorrencias, rota_parada_pedidos, pedido_itens, pedidos,
  rota_paradas, rota_carga, rotas, movimentacoes_estoque, lotes, estoque,
  veiculos, clientes, fornecedores, produtos, usuarios
restart identity cascade;

`;

const out = resolve(import.meta.dirname, '../supabase/migrations/0002_seed.sql');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, header + rows.join('\n') + '\ncommit;\n', 'utf-8');

const total = rows.join('').match(/^\s{2}\(/gm)?.length ?? 0;
console.log(`Seed gerado: ${out}`);
console.log(`${total} linhas em ${rows.length} blocos.`);
