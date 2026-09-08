import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Eye,
  Package,
  Percent,
  Repeat,
  Share2,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { AppBar, Screen, StickyAction, TabHeader } from '../components/layout/chrome';
import {
  Badge,
  Button,
  Card,
  Divider,
  KeyValue,
  ListRow,
  SectionTitle,
} from '../components/ui/primitives';
import {
  ChipRow,
  Field,
  Input,
  OptionCard,
  SearchField,
  Stepper,
} from '../components/ui/forms';
import { ConfirmSheet, Sheet } from '../components/ui/overlays';
import { SwipeCard } from '../components/ui/swipe';
import { EmptyState } from '../components/ui/states';
import {
  ORDER_STATUS,
  OrderCard,
  PAYMENT_ICON,
  PAYMENT_LABEL,
  ProductPickRow,
} from '../components/domain';
import { useApp, useCustomer, useOrder } from '../store/app';
import { useNav, useParams } from '../store/navigation';
import { products } from '../data/catalog';
import { available, orderBoxes, orderSubtotal, orderTotal } from '../lib/domain';
import { dateTime, fullDate, money, num, shortDate } from '../lib/format';
import type { PaymentMethod, ProductKind } from '../types';

/* O caminho cliente → produtos → carrinho → pagamento → confirmação é o
   fluxo mais percorrido do app. Cada etapa cabe numa tela, com uma única
   ação principal fixa embaixo (§10, REGRA 1). */

/* --------------------------------------------------------- Novo pedido */

export function OrderNewScreen() {
  const { cart, customers, orders, setCartQty, stock } = useApp();
  const { navigate } = useNav();
  const customer = customers.find((c) => c.id === cart.customerId);

  // Recorrência: o último pedido do cliente vira ponto de partida (REGRA 8).
  const lastOrder = useMemo(
    () =>
      orders
        .filter((o) => o.customerId === cart.customerId && o.status !== 'rascunho')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [orders, cart.customerId],
  );

  const frequent = useMemo(() => {
    const tally = new Map<string, number>();
    orders
      .filter((o) => o.customerId === cart.customerId)
      .forEach((o) => o.items.forEach((i) => tally.set(i.productId, (tally.get(i.productId) ?? 0) + i.quantity)));
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const ids = ranked.length > 0 ? ranked : products.slice(0, 3).map((p) => p.id);
    return ids.slice(0, 4).map((id) => products.find((p) => p.id === id)!);
  }, [orders, cart.customerId]);

  const count = cart.lines.reduce((s, l) => s + l.quantity, 0);

  if (!customer) {
    return (
      <>
        <AppBar title="Novo pedido" />
        <Screen>
          <EmptyState
            title="Escolha um cliente"
            message="Selecione para quem é este pedido."
            actionLabel="Selecionar cliente"
            onAction={() => navigate('customer-search', { intent: 'order' })}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <AppBar title="Novo pedido" subtitle={customer.tradeName} />
      <Screen action="single">
        <div className="border-b border-shell-200 bg-white p-4">
          <ListRow
            leading={
              <span className="grid size-10 place-items-center rounded-xl bg-brand-100 text-brand-800">
                <ShoppingCart size={18} />
              </span>
            }
            title={customer.tradeName}
            subtitle={`${customer.district} • ${customer.paymentTerms}`}
            onClick={() => navigate('customer-search', { intent: 'order' })}
            className="rounded-xl border border-shell-200 px-3"
          />
        </div>

        {lastOrder && (
          <div className="p-4 pb-0">
            <button
              onClick={() => lastOrder.items.forEach((i) => setCartQty(i.productId, i.quantity))}
              className="flex w-full items-center gap-3 rounded-card border border-brand-200 bg-brand-50 p-4 text-left active:bg-brand-100"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                <Repeat size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-shell-900">Repetir último pedido</span>
                <span className="block truncate text-meta text-shell-600">
                  {shortDate(lastOrder.createdAt)} • {num(orderBoxes(lastOrder))} cx •{' '}
                  {money(orderTotal(lastOrder))}
                </span>
              </span>
            </button>
          </div>
        )}

        <div className="p-4">
          <SectionTitle
            action={
              <button
                onClick={() => navigate('order-products')}
                className="text-meta font-bold text-brand-800"
              >
                Ver catálogo
              </button>
            }
          >
            Compra com frequência
          </SectionTitle>
          <Card className="overflow-hidden">
            {frequent.map((p) => {
              const item = stock.find((s) => s.productId === p.id);
              return (
                <ProductPickRow
                  key={p.id}
                  product={p}
                  quantity={cart.lines.find((l) => l.productId === p.id)?.quantity ?? 0}
                  onChange={(q) => setCartQty(p.id, q)}
                  availableBoxes={item ? available(item) : undefined}
                />
              );
            })}
          </Card>
        </div>
      </Screen>

      <StickyAction>
        <Button size="lg" block disabled={count === 0} onClick={() => navigate('cart')}>
          Continuar{count > 0 && ` • ${num(count)} cx`}
        </Button>
      </StickyAction>
    </>
  );
}

/* --------------------------------------------------- Seleção de produtos */

const KIND_LABEL: Record<ProductKind | 'todos', string> = {
  todos: 'Todos',
  branco: 'Branco',
  vermelho: 'Vermelho',
  caipira: 'Caipira',
  codorna: 'Codorna',
  organico: 'Orgânico',
};

export function OrderProductsScreen() {
  const { cart, setCartQty, stock, customers } = useApp();
  const { navigate } = useNav();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ProductKind | 'todos'>('todos');
  const customer = customers.find((c) => c.id === cart.customerId);

  const list = products.filter(
    (p) =>
      (kind === 'todos' || p.kind === kind) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );

  const count = cart.lines.reduce((s, l) => s + l.quantity, 0);
  const total = cart.lines.reduce(
    (s, l) => s + l.quantity * (products.find((p) => p.id === l.productId)?.price ?? 0),
    0,
  );

  return (
    <>
      <AppBar title="Produtos" subtitle={customer?.tradeName} />
      <div className="border-b border-shell-200 bg-white px-4 pb-3 pt-3">
        <SearchField value={query} onChange={setQuery} placeholder="Buscar produto" />
        <ChipRow
          className="mt-3"
          value={kind}
          onChange={setKind}
          options={(['todos', 'branco', 'vermelho', 'caipira', 'codorna', 'organico'] as const).map(
            (k) => ({ value: k, label: KIND_LABEL[k] }),
          )}
        />
      </div>

      <Screen action="single">
        {list.length === 0 ? (
          <EmptyState
            title="Nenhum produto"
            message="Nenhum item corresponde a esta busca."
            actionLabel="Limpar busca"
            onAction={() => {
              setQuery('');
              setKind('todos');
            }}
          />
        ) : (
          <div className="bg-white">
            {list.map((p) => {
              const item = stock.find((s) => s.productId === p.id);
              return (
                <ProductPickRow
                  key={p.id}
                  product={p}
                  quantity={cart.lines.find((l) => l.productId === p.id)?.quantity ?? 0}
                  onChange={(q) => setCartQty(p.id, q)}
                  availableBoxes={item ? available(item) : undefined}
                />
              );
            })}
          </div>
        )}
      </Screen>

      <StickyAction>
        <Button size="lg" block disabled={count === 0} onClick={() => navigate('cart')}>
          <span className="flex w-full items-center justify-between">
            <span>Continuar • {num(count)} cx</span>
            <span className="tnum">{money(total)}</span>
          </span>
        </Button>
      </StickyAction>
    </>
  );
}

/* ------------------------------------------------------------- Carrinho */

export function CartScreen() {
  const { cart, setCartQty, setDiscount, customers } = useApp();
  const { navigate } = useNav();
  const [discountOpen, setDiscountOpen] = useState(false);
  const [draftDiscount, setDraftDiscount] = useState(String(cart.discount));
  const customer = customers.find((c) => c.id === cart.customerId);

  const lines = cart.lines
    .map((l) => ({ ...l, product: products.find((p) => p.id === l.productId)! }))
    .filter((l) => l.product);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.product.price, 0);
  const total = Math.max(0, subtotal - cart.discount);

  return (
    <>
      <AppBar title="Resumo do pedido" subtitle={customer?.tradeName} />
      <Screen action="single">
        {lines.length === 0 ? (
          <EmptyState
            title="Carrinho vazio"
            message="Adicione produtos para continuar."
            actionLabel="Escolher produtos"
            onAction={() => navigate('order-products')}
          />
        ) : (
          <>
            <div className="mt-3 bg-white">
              {lines.map((l) => (
                <div
                  key={l.productId}
                  className="flex items-center gap-3 border-b border-shell-200 px-4 py-3 last:border-0"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-shell-100 text-xl">
                    {l.product.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-shell-900">{l.product.name}</div>
                    <div className="mt-0.5 text-meta tnum text-shell-600">
                      {num(l.quantity)} × {money(l.product.price)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tnum text-shell-900">
                      {money(l.quantity * l.product.price)}
                    </div>
                    <button
                      onClick={() => setCartQty(l.productId, 0)}
                      className="mt-0.5 text-meta font-semibold text-bad-700"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4">
              <Card className="px-4 py-1">
                <KeyValue label="Subtotal" value={money(subtotal)} />
                <Divider />
                <div className="flex items-center justify-between py-2">
                  <span className="text-body text-shell-600">Desconto</span>
                  <button
                    onClick={() => {
                      setDraftDiscount(String(cart.discount));
                      setDiscountOpen(true);
                    }}
                    className="flex items-center gap-1.5 font-semibold tnum text-brand-800"
                  >
                    <Percent size={14} />
                    {cart.discount > 0 ? `− ${money(cart.discount)}` : 'Aplicar'}
                  </button>
                </div>
                <Divider />
                <KeyValue label="Total" value={money(total)} strong />
              </Card>

              <Button
                variant="ghost"
                size="md"
                block
                className="mt-3"
                onClick={() => navigate('order-products')}
              >
                Adicionar mais produtos
              </Button>
            </div>
          </>
        )}
      </Screen>

      <StickyAction>
        <Button size="lg" block disabled={lines.length === 0} onClick={() => navigate('payment')}>
          <span className="flex w-full items-center justify-between">
            <span>Continuar para pagamento</span>
            <span className="tnum">{money(total)}</span>
          </span>
        </Button>
      </StickyAction>

      <Sheet
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        title="Aplicar desconto"
        subtitle="Valor em reais sobre o total do pedido."
        footer={
          <Button
            size="lg"
            block
            onClick={() => {
              setDiscount(Number(draftDiscount) || 0);
              setDiscountOpen(false);
            }}
          >
            Aplicar
          </Button>
        }
      >
        <div className="px-4 pb-2">
          <Field label="Desconto (R$)">
            <Input
              value={draftDiscount}
              onChange={(e) => setDraftDiscount(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoFocus
            />
          </Field>
          <div className="mt-3 flex gap-2">
            {[0, 50, 100, 200].map((v) => (
              <button
                key={v}
                onClick={() => setDraftDiscount(String(v))}
                className="h-10 flex-1 rounded-xl border border-shell-300 text-meta font-semibold text-shell-700 active:bg-shell-100"
              >
                {v === 0 ? 'Sem' : `R$ ${v}`}
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------ Pagamento */

const METHODS: PaymentMethod[] = ['pix', 'dinheiro', 'cartao', 'prazo'];
const TERM_DAYS = [7, 14, 21, 28];

export function PaymentScreen() {
  const { cart, setPayment, submitOrder, customers } = useApp();
  const { navigate, replace } = useNav();
  const customer = customers.find((c) => c.id === cart.customerId);
  const [days, setDays] = useState(21);
  const [installments, setInstallments] = useState(1);

  const subtotal = cart.lines.reduce(
    (s, l) => s + l.quantity * (products.find((p) => p.id === l.productId)?.price ?? 0),
    0,
  );
  const total = Math.max(0, subtotal - cart.discount);

  const dueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }, [days]);

  function confirm() {
    // As condições vão direto para o pedido: gravá-las no carrinho aqui só
    // teria efeito no próximo render, depois de o pedido já ter sido criado.
    const id = submitOrder(cart.payment === 'prazo' ? { dueDate, installments } : undefined);
    replace('order-done', { orderId: id });
  }

  return (
    <>
      <AppBar title="Pagamento" subtitle={customer?.tradeName} />
      <Screen action="single">
        <div className="p-4">
          <Card className="px-4 py-1">
            <KeyValue label="Total do pedido" value={money(total)} strong />
          </Card>
        </div>

        <div className="space-y-2.5 px-4">
          <SectionTitle>Forma de pagamento</SectionTitle>
          {METHODS.map((m) => (
            <OptionCard
              key={m}
              selected={cart.payment === m}
              onClick={() => setPayment(m)}
              icon={PAYMENT_ICON[m]}
              title={PAYMENT_LABEL[m]}
              subtitle={
                m === 'pix'
                  ? 'Recebimento imediato via QR Code'
                  : m === 'prazo'
                    ? `Condição do cliente: ${customer?.paymentTerms ?? '—'}`
                    : undefined
              }
            />
          ))}
        </div>

        {cart.payment === 'prazo' && (
          <div className="mt-5 px-4">
            <SectionTitle>Condições do prazo</SectionTitle>
            <Card className="p-4">
              <span className="mb-2 block text-meta font-semibold text-shell-700">Vencimento</span>
              <div className="flex gap-2">
                {TERM_DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`h-11 flex-1 rounded-xl text-meta font-bold transition-colors ${
                      days === d ? 'bg-brand-700 text-white' : 'border border-shell-300 text-shell-700'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <p className="mt-2 text-meta text-shell-600">
                Vence em <strong className="text-shell-900">{fullDate(dueDate)}</strong>
              </p>

              <span className="mb-2 mt-4 block text-meta font-semibold text-shell-700">Parcelas</span>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setInstallments(n)}
                    className={`h-11 flex-1 rounded-xl text-meta font-bold transition-colors ${
                      installments === n
                        ? 'bg-brand-700 text-white'
                        : 'border border-shell-300 text-shell-700'
                    }`}
                  >
                    {n}×
                  </button>
                ))}
              </div>
              {installments > 1 && (
                <p className="mt-2 text-meta tnum text-shell-600">
                  {installments}× de {money(total / installments)}
                </p>
              )}
            </Card>
          </div>
        )}

        {cart.payment === 'pix' && (
          <div className="mt-5 px-4">
            <SectionTitle>Cobrança PIX</SectionTitle>
            <Card className="flex flex-col items-center p-5">
              <QrPlaceholder />
              <p className="mt-3 text-center text-meta text-shell-600">
                Mostre o código ao cliente ou registre o pagamento manualmente após a
                transferência.
              </p>
            </Card>
          </div>
        )}
      </Screen>

      <StickyAction>
        <Button size="lg" block disabled={!cart.payment} onClick={confirm}>
          Confirmar pedido
        </Button>
      </StickyAction>
    </>
  );
}

/* QR desenhado — o protótipo não emite cobrança real. */
function QrPlaceholder() {
  const cells = 21;
  const filled = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7)
      ? (r % 6 === 0 || c % 6 === 0 || (r > 1 && r < 5 && c > 1 && c < 5))
      : (r * 7 + c * 13 + ((r * c) % 5)) % 3 === 0;

  return (
    <svg viewBox={`0 0 ${cells} ${cells}`} className="size-40" role="img" aria-label="QR Code PIX">
      <rect width={cells} height={cells} fill="#FFFFFF" />
      {Array.from({ length: cells }, (_, r) =>
        Array.from({ length: cells }, (_, c) =>
          filled(r, c) ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#1C1917" /> : null,
        ),
      )}
    </svg>
  );
}

/* ------------------------------------------------------ Pedido confirmado */

export function OrderDoneScreen() {
  const { orderId } = useParams();
  const order = useOrder(String(orderId));
  const customer = useCustomer(order?.customerId);
  const { clearCart, activeRoute } = useApp();
  const { reset, navigate } = useNav();

  if (!order) return <EmptyState title="Pedido não encontrado" />;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex flex-1 flex-col items-center px-6" style={{ paddingTop: 'calc(var(--safe-top) + 4rem)' }}>
        <span className="grid size-20 place-items-center rounded-full bg-ok-50 text-ok-700">
          <CheckCircle2 size={40} />
        </span>
        <h1 className="mt-5 text-title font-bold text-shell-900">Pedido confirmado</h1>
        <p className="mt-1 text-body text-shell-600">
          #{order.number} • {customer?.tradeName}
        </p>

        <Card className="mt-6 w-full px-4 py-1">
          <KeyValue label="Itens" value={`${num(orderBoxes(order))} caixas`} />
          <Divider />
          <KeyValue label="Pagamento" value={PAYMENT_LABEL[order.payment]} />
          {order.dueDate && (
            <>
              <Divider />
              <KeyValue label="Vencimento" value={fullDate(order.dueDate)} />
            </>
          )}
          <Divider />
          <KeyValue label="Total" value={money(orderTotal(order))} strong />
        </Card>
      </div>

      <div className="space-y-2 p-4" style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}>
        {activeRoute?.status === 'em_andamento' && (
          <Button
            size="lg"
            block
            onClick={() => {
              clearCart();
              navigate('visit');
            }}
          >
            Voltar ao atendimento
          </Button>
        )}
        <Button
          variant="secondary"
          size="lg"
          block
          onClick={() => {
            clearCart();
            navigate('order', { orderId: order.id });
          }}
        >
          Ver pedido
        </Button>
        <Button
          variant="ghost"
          size="lg"
          block
          onClick={() => {
            clearCart();
            reset('home');
          }}
        >
          Voltar ao início
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- Lista de pedidos */

type OrderFilter = 'todos' | 'hoje' | 'pendentes' | 'entregues';

export function OrdersScreen() {
  const { orders, customers } = useApp();
  const { navigate } = useNav();
  const [filter, setFilter] = useState<OrderFilter>('hoje');
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod | 'todos'>('todos');
  const [cancelId, setCancelId] = useState<string | null>(null);

  const today = new Date().toDateString();

  const list = useMemo(() => {
    return orders
      .filter((o) => {
        const c = customers.find((x) => x.id === o.customerId);
        if (query && !`${o.number} ${c?.tradeName ?? ''}`.toLowerCase().includes(query.toLowerCase()))
          return false;
        if (payment !== 'todos' && o.payment !== payment) return false;
        if (filter === 'hoje') return new Date(o.createdAt).toDateString() === today;
        if (filter === 'pendentes') return o.status === 'confirmado' || o.status === 'em_rota';
        if (filter === 'entregues') return o.status === 'entregue';
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60);
  }, [orders, customers, filter, query, payment, today]);

  const countOf = (f: OrderFilter) =>
    orders.filter((o) =>
      f === 'hoje'
        ? new Date(o.createdAt).toDateString() === today
        : f === 'pendentes'
          ? o.status === 'confirmado' || o.status === 'em_rota'
          : f === 'entregues'
            ? o.status === 'entregue'
            : true,
    ).length;

  return (
    <>
      <TabHeader
        title="Pedidos"
        right={
          <button
            onClick={() => setFiltersOpen(true)}
            aria-label="Filtros"
            className="relative grid size-11 place-items-center rounded-full text-shell-700 active:bg-shell-200"
          >
            <SlidersHorizontal size={20} />
            {payment !== 'todos' && (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-600" />
            )}
          </button>
        }
      >
        <SearchField value={query} onChange={setQuery} placeholder="Número do pedido ou cliente" />
        <ChipRow
          className="mt-3"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todos', label: 'Todos', count: countOf('todos') },
            { value: 'hoje', label: 'Hoje', count: countOf('hoje') },
            { value: 'pendentes', label: 'Pendentes', count: countOf('pendentes') },
            { value: 'entregues', label: 'Entregues', count: countOf('entregues') },
          ]}
        />
      </TabHeader>

      <Screen className="space-y-3 px-4 pt-3" action="single">
        {list.length === 0 ? (
          <EmptyState
            title="Nenhum pedido encontrado"
            message="Você ainda não possui pedidos para este período."
            actionLabel="Limpar filtros"
            onAction={() => {
              setFilter('todos');
              setQuery('');
              setPayment('todos');
            }}
          />
        ) : (
          list.map((o) => (
            <SwipeCard
              key={o.id}
              actions={[
                { label: 'Ver', icon: <Eye size={18} />, tone: 'info', onClick: () => navigate('order', { orderId: o.id }) },
                { label: 'Cancelar', icon: <X size={18} />, tone: 'bad', onClick: () => setCancelId(o.id) },
              ]}
            >
              <OrderCard
                order={o}
                customer={customers.find((c) => c.id === o.customerId)}
                onClick={() => navigate('order', { orderId: o.id })}
              />
            </SwipeCard>
          ))
        )}
      </Screen>

      <StickyAction>
        <Button size="lg" block onClick={() => navigate('customer-search', { intent: 'order' })}>
          Novo pedido
        </Button>
      </StickyAction>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrar pedidos"
        footer={
          <Button size="lg" block onClick={() => setFiltersOpen(false)}>
            Aplicar filtros
          </Button>
        }
      >
        <div className="space-y-2 px-4 pb-2">
          <span className="block text-meta font-semibold text-shell-700">Forma de pagamento</span>
          <OptionCard selected={payment === 'todos'} onClick={() => setPayment('todos')} title="Todas" />
          {METHODS.map((m) => (
            <OptionCard
              key={m}
              selected={payment === m}
              onClick={() => setPayment(m)}
              icon={PAYMENT_ICON[m]}
              title={PAYMENT_LABEL[m]}
            />
          ))}
        </div>
      </Sheet>

      <ConfirmSheet
        open={cancelId !== null}
        onClose={() => setCancelId(null)}
        onConfirm={() => setCancelId(null)}
        title="Cancelar pedido?"
        message="O pedido sai da rota e o estoque reservado é liberado. Esta ação precisa de justificativa no fechamento."
        confirmLabel="Cancelar pedido"
        cancelLabel="Manter pedido"
        tone="danger"
      />
    </>
  );
}

/* ----------------------------------------------------- Detalhes do pedido */

export function OrderScreen() {
  const { orderId } = useParams();
  const order = useOrder(String(orderId));
  const customer = useCustomer(order?.customerId);
  const { navigate } = useNav();

  if (!order) return <EmptyState title="Pedido não encontrado" />;

  const status = ORDER_STATUS[order.status];
  const lines = order.items.map((i) => ({
    ...i,
    product: products.find((p) => p.id === i.productId)!,
  }));

  return (
    <>
      <AppBar
        title={`Pedido #${order.number}`}
        subtitle={customer?.tradeName}
        right={
          <button aria-label="Compartilhar" className="grid size-11 place-items-center rounded-full text-shell-700 active:bg-shell-200">
            <Share2 size={20} />
          </button>
        }
      />
      <Screen action={order.status === 'em_rota' ? 'single' : 'none'}>
        <div className="flex items-center justify-between border-b border-shell-200 bg-white px-4 py-3">
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="text-meta text-shell-600">{dateTime(order.createdAt)}</span>
        </div>

        <div className="space-y-3 p-4">
          <Card className="overflow-hidden">
            {lines.map((l) => (
              <div
                key={l.productId}
                className="flex items-center gap-3 border-b border-shell-200 px-4 py-3 last:border-0"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-shell-100 text-lg">
                  {l.product.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-shell-900">{l.product.name}</div>
                  <div className="text-meta tnum text-shell-600">
                    {num(l.quantity)} × {money(l.unitPrice)}
                  </div>
                </div>
                <span className="font-bold tnum text-shell-900">
                  {money(l.quantity * l.unitPrice)}
                </span>
              </div>
            ))}
          </Card>

          <Card className="px-4 py-1">
            <KeyValue label="Subtotal" value={money(orderSubtotal(order))} />
            {order.discount > 0 && (
              <>
                <Divider />
                <KeyValue label="Desconto" value={`− ${money(order.discount)}`} tone="ok" />
              </>
            )}
            <Divider />
            <KeyValue label="Total" value={money(orderTotal(order))} strong />
          </Card>

          <Card className="px-4 py-1">
            <KeyValue label="Pagamento" value={PAYMENT_LABEL[order.payment]} />
            {order.dueDate && (
              <>
                <Divider />
                <KeyValue label="Vencimento" value={fullDate(order.dueDate)} />
              </>
            )}
            {order.installments && order.installments > 1 && (
              <>
                <Divider />
                <KeyValue label="Parcelas" value={`${order.installments}×`} />
              </>
            )}
            <Divider />
            <KeyValue label="Caixas" value={`${num(orderBoxes(order))} cx`} />
          </Card>

          <Card>
            <ListRow
              leading={
                <span className="grid size-10 place-items-center rounded-xl bg-shell-100 text-shell-600">
                  <Package size={18} />
                </span>
              }
              title={customer?.tradeName ?? 'Cliente'}
              subtitle={`${customer?.district ?? ''} • ${customer?.address ?? ''}`}
              onClick={() => navigate('customer', { customerId: order.customerId })}
            />
          </Card>

          <Button variant="ghost" size="md" block icon={<Copy size={16} />}>
            Duplicar pedido
          </Button>
        </div>
      </Screen>

      {order.status === 'em_rota' && (
        <StickyAction>
          <Button size="lg" block onClick={() => navigate('delivery', { orderId: order.id })}>
            Registrar entrega
          </Button>
        </StickyAction>
      )}
    </>
  );
}
