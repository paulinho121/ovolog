import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Package,
  Plus,
  ShieldAlert,
  ArrowLeftRight,
  Truck,
} from 'lucide-react';
import { AppBar, Screen, StickyAction, TabHeader } from '../components/layout/chrome';
import {
  Badge,
  Button,
  Card,
  Divider,
  KeyValue,
  ListRow,
  Progress,
  SectionTitle,
  Stat,
} from '../components/ui/primitives';
import { Field, Input, OptionCard, SearchField, Stepper, Tabs } from '../components/ui/forms';
import { Sheet } from '../components/ui/overlays';
import { EmptyState } from '../components/ui/states';
import { STOCK_MOVE_LABEL, StockRow } from '../components/domain';
import { useApp } from '../store/app';
import { useNav, useParams } from '../store/navigation';
import { products, suppliers } from '../data/catalog';
import { available, expiringBatches, stockLevel } from '../lib/domain';
import { dateTime, daysUntil, fullDate, money, num, shortDate } from '../lib/format';
import { cn } from '../lib/utils';
import type { PurchaseItem, StockMoveKind } from '../types';

/* Estoque e compras fecham o ciclo: o que entra pela compra é o que sai na
   carga da rota. As duas telas usam o mesmo vocabulário de caixas. */

/* -------------------------------------------------------------- Estoque */

export function StockScreen() {
  const { stock } = useApp();
  const { navigate } = useNav();
  const [query, setQuery] = useState('');

  const totalBoxes = stock.reduce((s, i) => s + i.onHand, 0);
  const reserved = stock.reduce((s, i) => s + i.reserved, 0);
  const low = stock.filter((s) => stockLevel(s) !== 'normal');
  const expiring = expiringBatches(stock, 7);

  const list = stock.filter((item) => {
    const p = products.find((x) => x.id === item.productId);
    return p?.name.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <>
      <TabHeader title="Estoque">
        <SearchField value={query} onChange={setQuery} placeholder="Buscar produto" />
      </TabHeader>

      <Screen className="space-y-4 px-4 pt-3" action="single">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Estoque total" value={`${num(totalBoxes)} cx`} tone="brand" />
          <Stat label="Reservado" value={`${num(reserved)} cx`} hint="em pedidos" />
          <Stat
            label="Estoque baixo"
            value={num(low.length)}
            tone={low.length ? 'warn' : 'ok'}
            hint="produtos"
          />
          <Stat
            label="Perto da validade"
            value={num(expiring.length)}
            tone={expiring.length ? 'warn' : 'ok'}
            hint="lotes em 7 dias"
          />
        </div>

        {expiring.length > 0 && (
          <Card className="border-warn-500/30 bg-warn-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert size={20} className="mt-0.5 shrink-0 text-warn-700" />
              <div>
                <div className="font-bold text-warn-700">Prioridade FEFO</div>
                <p className="mt-0.5 text-meta text-warn-700">
                  {expiring.length} lote{expiring.length > 1 ? 's' : ''} vence
                  {expiring.length > 1 ? 'm' : ''} em até 7 dias. Direcione para as próximas
                  entregas.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div>
          <SectionTitle>Produtos</SectionTitle>
          <div className="space-y-3">
            {list.length === 0 ? (
              <EmptyState title="Nenhum produto" message="Nada corresponde a esta busca." />
            ) : (
              list.map((item) => (
                <StockRow
                  key={item.productId}
                  item={item}
                  product={products.find((p) => p.id === item.productId)!}
                  onClick={() => navigate('product', { productId: item.productId })}
                />
              ))
            )}
          </div>
        </div>
      </Screen>

      <StickyAction>
        <Button size="lg" block onClick={() => navigate('stock-move')}>
          Movimentar estoque
        </Button>
      </StickyAction>
    </>
  );
}

/* ------------------------------------------------------- Produto (detalhe) */

export function ProductScreen() {
  const { productId } = useParams();
  const { stock, stockMoves } = useApp();
  const { navigate } = useNav();
  const [tab, setTab] = useState<'lotes' | 'movimentacoes'>('lotes');

  const product = products.find((p) => p.id === productId);
  const item = stock.find((s) => s.productId === productId);

  if (!product || !item) return <EmptyState title="Produto não encontrado" />;

  const level = stockLevel(item);
  const tone = level === 'critico' ? 'bad' : level === 'baixo' ? 'warn' : 'ok';
  const free = available(item);
  const moves = stockMoves.filter((m) => m.productId === product.id);
  const margin = (product.price - product.cost) / product.price;

  return (
    <>
      <AppBar title={product.name} subtitle={`${money(product.price)} / ${product.unit}`} />
      <Screen action="single">
        <div className="bg-white px-4 pb-4">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-shell-100 text-3xl">
              {product.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-display font-bold tnum text-shell-900">{num(free)}</span>
                <span className="text-body text-shell-600">cx disponíveis</span>
              </div>
              <div className="mt-2">
                <Progress value={free / Math.max(item.minimum * 2.5, 1)} tone={tone} />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge tone={tone}>
              {level === 'critico' ? 'Crítico' : level === 'baixo' ? 'Baixo' : 'Normal'}
            </Badge>
            <span className="text-meta text-shell-600">Mínimo {num(item.minimum)} cx</span>
          </div>
        </div>

        <div className="p-4">
          <Card className="px-4 py-1">
            <KeyValue label="Em estoque" value={`${num(item.onHand)} cx`} />
            <Divider />
            <KeyValue label="Reservado" value={`${num(item.reserved)} cx`} />
            <Divider />
            <KeyValue label="Disponível para venda" value={`${num(free)} cx`} strong />
          </Card>

          <Card className="mt-3 px-4 py-1">
            <KeyValue label="Preço de venda" value={money(product.price)} />
            <Divider />
            <KeyValue label="Custo médio" value={money(product.cost)} />
            <Divider />
            <KeyValue
              label="Margem"
              value={`${Math.round(margin * 100)}%`}
              tone={margin > 0.2 ? 'ok' : 'warn'}
            />
            <Divider />
            <KeyValue label="Dúzias por caixa" value={num(product.dozensPerBox)} />
          </Card>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'lotes', label: `Lotes (${item.batches.length})` },
            { value: 'movimentacoes', label: 'Movimentações' },
          ]}
        />

        <div className="space-y-3 p-4">
          {tab === 'lotes' &&
            item.batches
              .slice()
              .sort((a, b) => daysUntil(a.expiresAt) - daysUntil(b.expiresAt))
              .map((b) => {
                const days = daysUntil(b.expiresAt);
                const urgent = days <= 7;
                return (
                  <Card key={b.id} className={cn('p-4', urgent && 'border-warn-500/40 bg-warn-50')}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-shell-900">Lote {b.code}</div>
                        <div className="mt-0.5 text-meta text-shell-600">
                          {suppliers.find((s) => s.id === b.supplierId)?.name}
                        </div>
                      </div>
                      <Badge tone={urgent ? 'warn' : 'neutral'}>
                        {days < 0 ? 'Vencido' : `${days} dias`}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-meta text-shell-600">
                        Vence em {fullDate(b.expiresAt)}
                      </span>
                      <span className="font-bold tnum text-shell-900">{num(b.boxes)} cx</span>
                    </div>
                  </Card>
                );
              })}

          {tab === 'movimentacoes' &&
            (moves.length === 0 ? (
              <EmptyState title="Sem movimentações" message="Nada registrado para este produto." />
            ) : (
              <Card className="divide-y divide-shell-200 overflow-hidden">
                {moves.map((m) => (
                  <ListRow
                    key={m.id}
                    chevron={false}
                    leading={
                      <span
                        className={cn(
                          'grid size-9 place-items-center rounded-xl',
                          m.kind === 'entrada' ? 'bg-ok-50 text-ok-700' : m.kind === 'perda' ? 'bg-bad-50 text-bad-700' : 'bg-shell-100 text-shell-600',
                        )}
                      >
                        {m.kind === 'entrada' ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                      </span>
                    }
                    title={`${STOCK_MOVE_LABEL[m.kind]} • ${num(m.boxes)} cx`}
                    subtitle={`${m.note} — ${dateTime(m.at)}`}
                  />
                ))}
              </Card>
            ))}
        </div>
      </Screen>

      <StickyAction>
        <Button size="lg" block onClick={() => navigate('stock-move', { productId: product.id })}>
          Movimentar este produto
        </Button>
      </StickyAction>
    </>
  );
}

/* ------------------------------------------------------- Movimentação */

const MOVE_KINDS: { kind: StockMoveKind; label: string; icon: React.ReactNode; hint: string }[] = [
  { kind: 'entrada', label: 'Entrada', icon: <ArrowDownToLine size={20} />, hint: 'Recebimento de mercadoria' },
  { kind: 'saida', label: 'Saída', icon: <ArrowUpFromLine size={20} />, hint: 'Carga, consumo ou ajuste' },
  { kind: 'transferencia', label: 'Transferência', icon: <ArrowLeftRight size={20} />, hint: 'Entre câmaras ou filiais' },
  { kind: 'perda', label: 'Perda', icon: <ShieldAlert size={20} />, hint: 'Quebra, avaria ou vencimento' },
  { kind: 'inventario', label: 'Inventário', icon: <ClipboardList size={20} />, hint: 'Contagem física — substitui o saldo' },
];

export function StockMoveScreen() {
  const params = useParams();
  const { addStockMove, stock } = useApp();
  const { back } = useNav();
  const [kind, setKind] = useState<StockMoveKind | null>((params.kind as StockMoveKind) ?? null);
  const [productId, setProductId] = useState<string | null>(
    params.productId ? String(params.productId) : null,
  );
  const [boxes, setBoxes] = useState(10);
  const [note, setNote] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const product = products.find((p) => p.id === productId);
  const item = stock.find((s) => s.productId === productId);

  return (
    <>
      <AppBar title="Movimentar estoque" />
      <Screen action="single">
        <div className="space-y-2.5 p-4">
          <SectionTitle>Tipo de movimentação</SectionTitle>
          {MOVE_KINDS.map((m) => (
            <OptionCard
              key={m.kind}
              selected={kind === m.kind}
              onClick={() => setKind(m.kind)}
              icon={m.icon}
              title={m.label}
              subtitle={m.hint}
            />
          ))}

          {kind && (
            <>
              <SectionTitle className="pt-3">Produto</SectionTitle>
              <Card>
                <ListRow
                  leading={
                    <span className="grid size-10 place-items-center rounded-xl bg-shell-100 text-lg">
                      {product?.emoji ?? <Package size={18} />}
                    </span>
                  }
                  title={product?.name ?? 'Selecionar produto'}
                  subtitle={item ? `${num(available(item))} cx disponíveis` : 'Toque para escolher'}
                  onClick={() => setPickerOpen(true)}
                />
              </Card>

              {product && (
                <>
                  <Card className="mt-2.5 flex items-center justify-between p-4">
                    <span className="font-semibold text-shell-900">
                      {kind === 'inventario' ? 'Saldo contado' : 'Quantidade'}
                    </span>
                    <Stepper value={boxes} onChange={setBoxes} min={kind === 'inventario' ? 0 : 1} />
                  </Card>

                  <div className="pt-1">
                    <Field label="Observação">
                      <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ex.: NF 44821 — Granja Santa Rita"
                      />
                    </Field>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Screen>

      <StickyAction>
        <Button
          size="lg"
          block
          disabled={!kind || !productId}
          onClick={() => {
            addStockMove({ kind: kind!, productId: productId!, boxes, note: note || STOCK_MOVE_LABEL[kind!] });
            back();
          }}
        >
          Registrar movimentação
        </Button>
      </StickyAction>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Escolher produto">
        <div className="divide-y divide-shell-200">
          {products.map((p) => {
            const s = stock.find((x) => x.productId === p.id);
            return (
              <ListRow
                key={p.id}
                leading={
                  <span className="grid size-10 place-items-center rounded-xl bg-shell-100 text-lg">
                    {p.emoji}
                  </span>
                }
                title={p.name}
                subtitle={s ? `${num(available(s))} cx disponíveis` : undefined}
                onClick={() => {
                  setProductId(p.id);
                  setPickerOpen(false);
                }}
              />
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

/* -------------------------------------------------------------- Compras */

export function PurchasesScreen() {
  const { purchases, receivePurchase } = useApp();
  const { navigate } = useNav();

  const open = purchases.filter((p) => p.status === 'aberta');
  const openBoxes = open.reduce((s, p) => s + p.items.reduce((x, i) => x + i.boxes, 0), 0);
  const openValue = open.reduce(
    (s, p) => s + p.items.reduce((x, i) => x + i.boxes * i.unitCost, 0),
    0,
  );
  const todayValue = purchases
    .filter((p) => new Date(p.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, p) => s + p.items.reduce((x, i) => x + i.boxes * i.unitCost, 0), 0);

  return (
    <>
      <AppBar title="Compras" />
      <Screen className="space-y-4 px-4 pt-4" action="single">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Compras hoje" value={money(todayValue)} tone="brand" />
          <Stat label="A receber" value={`${num(openBoxes)} cx`} hint={`${open.length} pedidos`} />
          <Stat label="Pedidos abertos" value={num(open.length)} />
          <Stat label="Valor em aberto" value={money(openValue)} />
        </div>

        <div>
          <SectionTitle>Pedidos de compra</SectionTitle>
          <div className="space-y-3">
            {purchases.length === 0 ? (
              <EmptyState
                title="Nenhuma compra"
                message="Registre uma compra para abastecer o estoque."
                actionLabel="Nova compra"
                onAction={() => navigate('purchase-new')}
              />
            ) : (
              purchases.map((p) => {
                const supplier = suppliers.find((s) => s.id === p.supplierId);
                const value = p.items.reduce((x, i) => x + i.boxes * i.unitCost, 0);
                const boxes = p.items.reduce((x, i) => x + i.boxes, 0);
                return (
                  <Card key={p.id} className="overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-meta font-bold tnum text-shell-500">#{p.number}</span>
                            <span className="truncate font-bold text-shell-900">{supplier?.name}</span>
                          </div>
                          <div className="mt-0.5 text-meta text-shell-600">
                            {num(boxes)} cx • previsto {shortDate(p.expectedAt)}
                          </div>
                        </div>
                        <Badge tone={p.status === 'recebida' ? 'ok' : p.status === 'aberta' ? 'info' : 'neutral'}>
                          {p.status === 'recebida' ? 'Recebida' : p.status === 'aberta' ? 'Aberta' : 'Cancelada'}
                        </Badge>
                      </div>
                      <div className="mt-2 text-subtitle font-bold tnum text-shell-900">
                        {money(value)}
                      </div>
                    </div>
                    {p.status === 'aberta' && (
                      <button
                        onClick={() => receivePurchase(p.id)}
                        className="w-full border-t border-shell-200 py-3 text-body font-bold text-brand-800 active:bg-brand-50"
                      >
                        Registrar entrada no estoque
                      </button>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </Screen>

      <StickyAction>
        <Button size="lg" block icon={<Plus size={18} />} onClick={() => navigate('purchase-new')}>
          Nova compra
        </Button>
      </StickyAction>
    </>
  );
}

/* ----------------------------------------------------------- Nova compra */

export function PurchaseNewScreen() {
  const { createPurchase } = useApp();
  const { back, replace } = useNav();
  const [step, setStep] = useState(1);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, number>>({});
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [batchCode, setBatchCode] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(28);
  const [supplierOpen, setSupplierOpen] = useState(false);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const chosen = Object.entries(lines).filter(([, q]) => q > 0);
  const total = chosen.reduce(
    (s, [id, q]) => s + q * (costs[id] ?? products.find((p) => p.id === id)!.cost),
    0,
  );

  const LABELS = ['Fornecedor', 'Produtos', 'Custos', 'Lote e validade', 'Confirmar'];
  const canAdvance =
    step === 1 ? !!supplierId : step === 2 ? chosen.length > 0 : step === 4 ? batchCode.length > 0 : true;

  const expiresAt = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + expiresInDays);
    return d.toISOString();
  }, [expiresInDays]);

  function finish() {
    const items: PurchaseItem[] = chosen.map(([id, boxes]) => ({
      productId: id,
      boxes,
      unitCost: costs[id] ?? products.find((p) => p.id === id)!.cost,
      batchCode,
      expiresAt,
    }));
    createPurchase({ supplierId: supplierId!, items, expectedAt: expiresAt });
    replace('purchases');
  }

  return (
    <>
      <AppBar title="Nova compra" onBack={() => (step === 1 ? back() : setStep(step - 1))} />
      <Screen action="single">
        <div className="bg-white py-4">
          <div className="px-4 pb-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-subtitle font-bold text-shell-900">{LABELS[step - 1]}</span>
              <span className="text-meta font-semibold tnum text-shell-500">{step} de 5</span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={cn('h-1.5 flex-1 rounded-full', i < step ? 'bg-brand-600' : 'bg-shell-200')}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {step === 1 && (
            <>
              <Card>
                <ListRow
                  leading={
                    <span className="grid size-10 place-items-center rounded-xl bg-shell-100 text-shell-600">
                      <Truck size={18} />
                    </span>
                  }
                  title={supplier?.name ?? 'Selecionar fornecedor'}
                  subtitle={supplier?.city ?? 'Toque para escolher'}
                  onClick={() => setSupplierOpen(true)}
                />
              </Card>
            </>
          )}

          {step === 2 && (
            <Card className="overflow-hidden">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 border-b border-shell-200 px-4 py-3 last:border-0',
                    (lines[p.id] ?? 0) > 0 && 'bg-brand-50',
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-shell-100 text-xl">
                    {p.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-shell-900">{p.name}</div>
                    <div className="text-meta tnum text-shell-600">custo {money(p.cost)}</div>
                  </div>
                  <Stepper
                    value={lines[p.id] ?? 0}
                    onChange={(q) => setLines((prev) => ({ ...prev, [p.id]: q }))}
                    step={10}
                  />
                </div>
              ))}
            </Card>
          )}

          {step === 3 && (
            <>
              {chosen.map(([id, q]) => {
                const p = products.find((x) => x.id === id)!;
                return (
                  <Card key={id} className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-shell-900">{p.name}</span>
                      <span className="text-meta tnum text-shell-600">{num(q)} cx</span>
                    </div>
                    <div className="mt-3">
                      <Field label="Custo por caixa (R$)">
                        <Input
                          value={String(costs[id] ?? p.cost)}
                          onChange={(e) =>
                            setCosts((prev) => ({
                              ...prev,
                              [id]: Number(e.target.value.replace(/\D/g, '')) || 0,
                            }))
                          }
                          inputMode="numeric"
                        />
                      </Field>
                    </div>
                  </Card>
                );
              })}
            </>
          )}

          {step === 4 && (
            <>
              <Field label="Código do lote" hint="Identificação do produtor — usada no rastreio FEFO.">
                <Input
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  placeholder="#0910"
                  autoFocus
                />
              </Field>
              <div>
                <span className="mb-2 block text-meta font-semibold text-shell-700">Validade</span>
                <div className="flex gap-2">
                  {[14, 21, 28, 35].map((d) => (
                    <button
                      key={d}
                      onClick={() => setExpiresInDays(d)}
                      className={cn(
                        'h-11 flex-1 rounded-xl text-meta font-bold transition-colors',
                        expiresInDays === d
                          ? 'bg-brand-700 text-white'
                          : 'border border-shell-300 text-shell-700',
                      )}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-meta text-shell-600">
                  Vence em <strong className="text-shell-900">{fullDate(expiresAt)}</strong>
                </p>
              </div>
            </>
          )}

          {step === 5 && (
            <Card className="px-4 py-1">
              <KeyValue label="Fornecedor" value={supplier?.name ?? '—'} />
              <Divider />
              {chosen.map(([id, q]) => {
                const p = products.find((x) => x.id === id)!;
                return (
                  <div key={id}>
                    <KeyValue
                      label={`${p.emoji} ${p.name}`}
                      value={`${num(q)} cx × ${money(costs[id] ?? p.cost)}`}
                    />
                    <Divider />
                  </div>
                );
              })}
              <KeyValue label="Lote" value={batchCode || '—'} />
              <Divider />
              <KeyValue label="Validade" value={fullDate(expiresAt)} />
              <Divider />
              <KeyValue label="Total" value={money(total)} strong />
            </Card>
          )}
        </div>
      </Screen>

      <StickyAction>
        {step < 5 ? (
          <Button size="lg" block disabled={!canAdvance} onClick={() => setStep(step + 1)}>
            Continuar
          </Button>
        ) : (
          <Button size="lg" block onClick={finish}>
            Registrar compra
          </Button>
        )}
      </StickyAction>

      <Sheet open={supplierOpen} onClose={() => setSupplierOpen(false)} title="Escolher fornecedor">
        <div className="divide-y divide-shell-200">
          {suppliers.map((s) => (
            <ListRow
              key={s.id}
              title={s.name}
              subtitle={s.city}
              onClick={() => {
                setSupplierId(s.id);
                setSupplierOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>
    </>
  );
}
