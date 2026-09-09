import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CornerUpLeft,
  DoorClosed,
  Flag,
  MapPin,
  PackageX,
  ShoppingBag,
  Share2,
  UserX,
  Wallet,
  XCircle,
} from 'lucide-react';
import { AppBar, Screen, StickyAction } from '../components/layout/chrome';
import {
  Badge,
  Button,
  Card,
  Divider,
  KeyValue,
  SectionTitle,
} from '../components/ui/primitives';
import { CheckItem, Field, OptionCard, Stepper, TextArea } from '../components/ui/forms';
import { ConfirmSheet, Sheet } from '../components/ui/overlays';
import { EmptyState } from '../components/ui/states';
import { PAYMENT_ICON, PAYMENT_LABEL, RETURN_REASON_LABEL } from '../components/domain';
import { MapCanvas } from '../components/map/MapCanvas';
import { useApp, useCustomer, useOrder, useRoute } from '../store/app';
import { SheetPagamentoConta } from '../components/pagamento';
import { useNav, useParams } from '../store/navigation';
import { products, userById, vehicleById } from '../data/catalog';
import { temCoordenada } from '../lib/mapa';
import { nextStop, orderBoxes, orderTotal, routeSummary } from '../lib/domain';
import { dateTime, km, money, num, shortDate, time } from '../lib/format';
import type { IncidentKind, PaymentMethod, ReturnReason } from '../types';

/* Sequência de campo: chegar → atender → entregar → comprovar → seguir.
   Cada tela resolve uma coisa só e devolve o usuário ao mapa. */

/* ------------------------------------------------------------- Check-in */

export function CheckInScreen() {
  const { routeId, stopId } = useParams();
  const route = useRoute(String(routeId));
  const { customers, arriveAtStop, isAtNextStop, distanceToNextStop, position, gpsIndisponivel } =
    useApp();
  const { navigate, replace } = useNav();
  const [manualOpen, setManualOpen] = useState(false);

  const stop = route?.stops.find((s) => s.id === stopId) ?? (route ? nextStop(route) : undefined);
  const customer = customers.find((c) => c.id === stop?.customerId);

  if (!route || !stop || !customer) return <EmptyState title="Parada não encontrada" />;

  function confirm() {
    arriveAtStop(route!.id, stop!.id);
    replace('visit', { routeId: route!.id, stopId: stop!.id });
  }

  return (
    <>
      <AppBar title="Check-in" subtitle={`Parada ${stop.sequence} • Rota #${route.number}`} />
      <Screen action="double">
        <div className="p-4">
          <Card className="overflow-hidden">
            <MapCanvas
              stops={[{ id: stop.id, customer, status: stop.status, sequence: stop.sequence }]}
              position={position}
              focus={
                temCoordenada(customer)
                  ? { lat: customer.lat, lng: customer.lng, zoom: 17 }
                  : undefined
              }
              className="h-48 w-full"
              interactive={false}
            />
          </Card>
        </div>

        <div className="px-4 text-center">
          <h1 className="text-title font-bold text-shell-900">Você chegou?</h1>
          <p className="mt-1 text-subtitle font-semibold text-shell-900">{customer.tradeName}</p>
          <p className="mt-0.5 flex items-center justify-center gap-1 text-meta text-shell-600">
            <MapPin size={13} /> {customer.address} • {customer.district}
          </p>

          {/* A confirmação é baseada em localização: dentro do raio, o botão
              libera sozinho; fora dele, exige confirmação manual justificada. */}
          <div
            className={`mt-5 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-meta font-bold ${
              isAtNextStop ? 'bg-ok-50 text-ok-700' : 'bg-warn-50 text-warn-700'
            }`}
          >
            <span className="relative flex size-2.5">
              {isAtNextStop && <span className="gps-ping absolute inset-0 rounded-full bg-ok-500" />}
              <span className={`relative size-2.5 rounded-full ${isAtNextStop ? 'bg-ok-500' : 'bg-warn-500'}`} />
            </span>
            {isAtNextStop
              ? 'Você está no local do cliente'
              : distanceToNextStop === undefined
                ? (gpsIndisponivel ?? 'Localizando…')
                : `A ${km(distanceToNextStop)} do local`}
          </div>
        </div>
      </Screen>

      <StickyAction>
        <div className="space-y-2">
          <Button
          size="lg"
          block
          disabled={!isAtNextStop && distanceToNextStop !== undefined}
          onClick={confirm}
        >
            Confirmar chegada
          </Button>
          {!isAtNextStop && (
            <Button variant="ghost" size="md" block onClick={() => setManualOpen(true)}>
              Confirmar manualmente
            </Button>
          )}
        </div>
      </StickyAction>

      <ConfirmSheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onConfirm={() => {
          setManualOpen(false);
          confirm();
        }}
        title="Confirmar sem GPS?"
        message="O sistema registra que a chegada foi confirmada fora do raio do cliente. Use apenas quando o GPS estiver impreciso."
        confirmLabel="Confirmar mesmo assim"
      />
    </>
  );
}

/* ---------------------------------------------- Atendimento do cliente */

export function VisitScreen() {
  const { routeId, stopId } = useParams();
  const route = useRoute(String(routeId));
  const { customers, orders, accounts, completeStop, startCart } = useApp();
  const { navigate, replace } = useNav();
  const [finishOpen, setFinishOpen] = useState(false);
  /* null = fechado; '' = escolhendo a conta; id = recebendo naquela conta. */
  const [receberEm, setReceberEm] = useState<string | null>(null);

  const stop =
    route?.stops.find((s) => s.id === stopId) ??
    route?.stops.find((s) => s.status === 'chegou') ??
    (route ? nextStop(route) : undefined);
  const customer = customers.find((c) => c.id === stop?.customerId);

  if (!route || !stop || !customer) return <EmptyState title="Atendimento não encontrado" />;

  const stopOrders = orders.filter((o) => stop.orderIds.includes(o.id));
  const pending = stopOrders.filter((o) => o.status !== 'entregue');

  /* Contas em aberto DESTE cliente. Antes, receber em campo jogava o
     motorista na aba financeira global, sem filtro e sem valor — com o
     cliente esperando na porta. */
  const emAberto = accounts
    .filter((a) => a.kind === 'receber' && a.partyId === customer.id && a.status !== 'pago')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totalAberto = emAberto.reduce((t, a) => t + (a.amount - a.paidAmount), 0);
  const contaSelecionada = emAberto.find((a) => a.id === receberEm);

  const actions = [
    {
      icon: <ShoppingBag size={20} />,
      label: 'Fazer pedido',
      hint: 'Novo pedido para este cliente',
      onClick: () => {
        startCart(customer.id);
        navigate('order-new');
      },
    },
    {
      icon: <ClipboardList size={20} />,
      label: 'Ver pedidos',
      hint: `${stopOrders.length} nesta parada`,
      onClick: () =>
        pending[0]
          ? navigate('delivery', { orderId: pending[0].id, routeId: route.id, stopId: stop.id })
          : navigate('customer', { customerId: customer.id }),
    },
    {
      icon: <Wallet size={20} />,
      label: 'Registrar pagamento',
      hint:
        emAberto.length === 0
          ? 'Sem contas em aberto'
          : emAberto.length === 1
            ? `${money(totalAberto)} em aberto`
            : `${money(totalAberto)} em ${emAberto.length} contas`,
      /* Uma conta é o caso comum: vai direto para o recebimento. Mais de uma
         abre a escolha — quitar por conta é como o financeiro já funciona, e
         ratear valor entre contas seria inventar regra que não existe. */
      onClick: () =>
        emAberto.length === 0
          ? undefined
          : setReceberEm(emAberto.length === 1 ? emAberto[0].id : ''),
      desabilitado: emAberto.length === 0,
    },
    {
      icon: <AlertTriangle size={20} />,
      label: 'Registrar ocorrência',
      hint: 'Cliente fechado, recusa, avaria…',
      onClick: () => navigate('incident', { customerId: customer.id, routeId: route.id }),
    },
  ];

  return (
    <>
      <AppBar title="Atendimento" subtitle={`Parada ${stop.sequence} de ${route.stops.length}`} />
      <Screen action="single">
        <div className="border-b border-shell-200 bg-white px-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-title font-bold text-shell-900">{customer.tradeName}</h1>
              <p className="mt-0.5 truncate text-meta text-shell-600">{customer.address}</p>
            </div>
            <Badge tone="info">No local</Badge>
          </div>
          {stop.arrivedAt && (
            <p className="mt-2 text-meta text-shell-500">Chegada às {time(stop.arrivedAt)}</p>
          )}
        </div>

        <div className="space-y-2.5 p-4">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.desabilitado}
              className="flex min-h-[4.25rem] w-full items-center gap-3 rounded-card border border-shell-200 bg-white p-4 text-left shadow-card active:bg-shell-50 disabled:opacity-45 disabled:shadow-none"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800">
                {a.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-shell-900">{a.label}</span>
                <span className="block truncate text-meta text-shell-600">{a.hint}</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-shell-400" />
            </button>
          ))}
        </div>

        {stopOrders.length > 0 && (
          <div className="px-4">
            <SectionTitle>Pedidos desta parada</SectionTitle>
            <Card className="divide-y divide-shell-200 overflow-hidden">
              {stopOrders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate('delivery', { orderId: o.id, routeId: route.id, stopId: stop.id })}
                  className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-shell-50"
                >
                  <div>
                    <div className="font-semibold text-shell-900">#{o.number}</div>
                    <div className="text-meta text-shell-600">{num(orderBoxes(o))} caixas</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tnum text-shell-900">{money(orderTotal(o))}</div>
                    <div className="text-meta text-shell-600">
                      {o.status === 'entregue' ? 'Entregue' : 'A entregar'}
                    </div>
                  </div>
                </button>
              ))}
            </Card>
          </div>
        )}
      </Screen>

      <StickyAction>
        <Button size="lg" block onClick={() => setFinishOpen(true)}>
          Finalizar visita
        </Button>
      </StickyAction>

      <ConfirmSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        onConfirm={() => {
          completeStop(route.id, stop.id);
          setFinishOpen(false);
          replace('route-map', { routeId: route.id });
        }}
        title="Finalizar visita?"
        message={
          pending.length > 0
            ? `Ainda há ${pending.length} pedido${pending.length > 1 ? 's' : ''} sem entrega confirmada nesta parada.`
            : 'A parada será marcada como concluída e você segue para a próxima.'
        }
        confirmLabel={pending.length > 0 ? 'Finalizar mesmo assim' : 'Finalizar visita'}
        tone={pending.length > 0 ? 'danger' : 'primary'}
      />

      {/* Mais de uma conta em aberto: o motorista escolhe qual está quitando. */}
      <Sheet
        open={receberEm === ''}
        onClose={() => setReceberEm(null)}
        title="Qual conta o cliente está pagando?"
        subtitle={`${money(totalAberto)} em aberto`}
      >
        <div className="px-4 pb-2">
          <Card className="divide-y divide-shell-200 overflow-hidden">
            {emAberto.map((conta) => (
              <button
                key={conta.id}
                onClick={() => setReceberEm(conta.id)}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-shell-50"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-shell-900">
                    Vence {shortDate(conta.dueDate)}
                  </span>
                  <span className="block text-meta text-shell-600">
                    {conta.orderId ? 'Pedido vinculado' : 'Avulsa'}
                    {conta.status === 'vencido' ? ' • vencida' : ''}
                  </span>
                </span>
                <span className="shrink-0 font-bold tnum text-shell-900">
                  {money(conta.amount - conta.paidAmount)}
                </span>
              </button>
            ))}
          </Card>
        </div>
      </Sheet>

      <SheetPagamentoConta
        accountId={contaSelecionada?.id ?? null}
        onClose={() => setReceberEm(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------- Entrega */

export function DeliveryScreen() {
  const { orderId, routeId, stopId } = useParams();
  const order = useOrder(String(orderId));
  const customer = useCustomer(order?.customerId);
  const { confirmDelivery } = useApp();
  const { navigate, replace } = useNav();
  const [checks, setChecks] = useState({ conferida: true, recebida: false, pagamento: false });
  const [receiver, setReceiver] = useState('');

  if (!order || !customer) return <EmptyState title="Pedido não encontrado" />;

  const ready = checks.conferida && checks.recebida;
  const lines = order.items.map((i) => ({ ...i, product: products.find((p) => p.id === i.productId)! }));

  return (
    <>
      <AppBar title="Entrega" subtitle={`#${order.number} • ${customer.tradeName}`} />
      <Screen action="single">
        <div className="p-4">
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
                </div>
                <span className="text-subtitle font-bold tnum text-shell-900">
                  {num(l.quantity)} cx
                </span>
              </div>
            ))}
          </Card>
        </div>

        <div className="px-4">
          <SectionTitle>Conferência</SectionTitle>
          <Card className="divide-y divide-shell-200 overflow-hidden py-1">
            <CheckItem
              checked={checks.conferida}
              onChange={(v) => setChecks((prev) => ({ ...prev, conferida: v }))}
              label="Mercadoria conferida"
            />
            <CheckItem
              checked={checks.recebida}
              onChange={(v) => setChecks((prev) => ({ ...prev, recebida: v }))}
              label="Cliente recebeu"
            />
            <CheckItem
              checked={checks.pagamento}
              onChange={(v) => setChecks((prev) => ({ ...prev, pagamento: v }))}
              label={`Pagamento registrado (${PAYMENT_LABEL[order.payment]})`}
            />
          </Card>
        </div>

        <div className="p-4">
          <Field label="Quem recebeu" hint="Nome de quem assinou pela mercadoria.">
            <input
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              placeholder="Ex.: José, gerente"
              className="h-12 w-full rounded-xl border border-shell-300 bg-white px-3.5 text-[16px] text-shell-900 placeholder:text-shell-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </Field>

          <Card className="mt-4 px-4 py-1">
            <KeyValue label="Total do pedido" value={money(orderTotal(order))} strong />
          </Card>

          <Button
            variant="ghost"
            size="md"
            block
            className="mt-3"
            icon={<CornerUpLeft size={16} />}
            onClick={() => navigate('return', { customerId: customer.id, routeId: String(routeId ?? '') })}
          >
            Registrar devolução
          </Button>
        </div>
      </Screen>

      <StickyAction>
        <Button
          size="lg"
          block
          disabled={!ready}
          onClick={() => {
            confirmDelivery(order.id, receiver || 'Não informado');
            replace('receipt', { orderId: order.id, receiver, routeId: String(routeId ?? ''), stopId: String(stopId ?? '') });
          }}
        >
          Confirmar entrega
        </Button>
      </StickyAction>
    </>
  );
}

/* ---------------------------------------------------------- Comprovante */

export function ReceiptScreen() {
  const { orderId, receiver, routeId, stopId } = useParams();
  const order = useOrder(String(orderId));
  const customer = useCustomer(order?.customerId);
  const { completeStop, routes } = useApp();
  const { navigate, reset } = useNav();
  const route = routes.find((r) => r.id === routeId);

  if (!order || !customer) return <EmptyState title="Comprovante indisponível" />;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex flex-1 flex-col items-center px-6" style={{ paddingTop: 'calc(var(--safe-top) + 3rem)' }}>
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          className="grid size-20 place-items-center rounded-full bg-ok-50 text-ok-700"
        >
          <CheckCircle2 size={40} />
        </motion.span>
        <h1 className="mt-5 text-title font-bold text-shell-900">Entrega realizada</h1>

        <Card className="mt-6 w-full px-4 py-1">
          <KeyValue label="Cliente" value={customer.tradeName} />
          <Divider />
          <KeyValue label="Pedido" value={`#${order.number}`} />
          <Divider />
          <KeyValue label="Caixas" value={`${num(orderBoxes(order))} cx`} />
          <Divider />
          <KeyValue label="Pagamento" value={PAYMENT_LABEL[order.payment]} />
          {receiver && (
            <>
              <Divider />
              <KeyValue label="Recebido por" value={String(receiver)} />
            </>
          )}
          <Divider />
          <KeyValue label="Data" value={dateTime(new Date().toISOString())} />
          <Divider />
          <KeyValue label="Valor" value={money(orderTotal(order))} strong />
        </Card>
      </div>

      <div className="space-y-2 p-4" style={{ paddingBottom: 'calc(1rem + var(--safe-bottom))' }}>
        <Button variant="secondary" size="lg" block icon={<Share2 size={18} />}>
          Compartilhar comprovante
        </Button>
        <Button
          size="lg"
          block
          onClick={() => {
            if (route && stopId) completeStop(route.id, String(stopId));
            if (route) navigate('route-map', { routeId: route.id });
            else reset('home');
          }}
        >
          Finalizar visita
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Ocorrência */

const INCIDENT_OPTIONS: { kind: IncidentKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'cliente_fechado', label: 'Cliente fechado', icon: <DoorClosed size={20} /> },
  { kind: 'cliente_ausente', label: 'Cliente ausente', icon: <UserX size={20} /> },
  { kind: 'pedido_recusado', label: 'Pedido recusado', icon: <XCircle size={20} /> },
  { kind: 'produto_faltando', label: 'Produto faltando', icon: <PackageX size={20} /> },
  { kind: 'produto_avariado', label: 'Produto avariado', icon: <AlertTriangle size={20} /> },
  { kind: 'devolucao', label: 'Devolução', icon: <CornerUpLeft size={20} /> },
  { kind: 'problema_pagamento', label: 'Problema de pagamento', icon: <Wallet size={20} /> },
  { kind: 'outro', label: 'Outro', icon: <ClipboardList size={20} /> },
];

export function IncidentScreen() {
  const { customerId, routeId } = useParams();
  const customer = useCustomer(String(customerId));
  const { registerIncident, activeRoute } = useApp();
  const { back, navigate } = useNav();
  const [kind, setKind] = useState<IncidentKind | null>(null);
  const [note, setNote] = useState('');

  return (
    <>
      <AppBar title="Registrar ocorrência" subtitle={customer?.tradeName} />
      <Screen action="single">
        <div className="space-y-2.5 p-4">
          {INCIDENT_OPTIONS.map((o) => (
            <OptionCard
              key={o.kind}
              selected={kind === o.kind}
              onClick={() => setKind(o.kind)}
              icon={o.icon}
              title={o.label}
            />
          ))}

          <div className="pt-2">
            <Field label="Observação" hint="Descreva o que aconteceu — vira histórico do cliente.">
              <TextArea
                rows={4}
                value={note}
                onChange={(e) => setNote((e.target as HTMLTextAreaElement).value)}
                placeholder="Ex.: estabelecimento fechado para reforma até sexta."
              />
            </Field>
          </div>

          {kind === 'devolucao' && (
            <Button
              variant="secondary"
              size="md"
              block
              onClick={() => navigate('return', { customerId: String(customerId), routeId: String(routeId ?? '') })}
            >
              Abrir fluxo de devolução
            </Button>
          )}
        </div>
      </Screen>

      <StickyAction>
        <Button
          size="lg"
          block
          disabled={!kind}
          onClick={() => {
            registerIncident({
              kind: kind!,
              customerId: String(customerId),
              routeId: String(routeId ?? activeRoute?.id ?? ''),
              note,
            });
            back();
          }}
        >
          Registrar ocorrência
        </Button>
      </StickyAction>
    </>
  );
}

/* ------------------------------------------------------------ Devolução */

const REASONS: ReturnReason[] = ['avaria', 'recusa', 'excesso', 'erro_pedido', 'outro'];

export function ReturnScreen() {
  const { customerId, routeId } = useParams();
  const customer = useCustomer(String(customerId));
  const { registerReturn, activeRoute } = useApp();
  const { back } = useNav();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [productId, setProductId] = useState<string | null>(null);
  const [boxes, setBoxes] = useState(1);
  const [reason, setReason] = useState<ReturnReason | null>(null);

  const product = products.find((p) => p.id === productId);

  return (
    <>
      <AppBar
        title="Devolução"
        subtitle={customer?.tradeName}
        onBack={() => (step === 1 ? back() : setStep((step - 1) as 1 | 2))}
      />
      <Screen action="single">
        <div className="p-4">
          {step === 1 && (
            <>
              <SectionTitle>Qual produto?</SectionTitle>
              <div className="space-y-2.5">
                {products.map((p) => (
                  <OptionCard
                    key={p.id}
                    selected={productId === p.id}
                    onClick={() => setProductId(p.id)}
                    icon={<span className="text-lg">{p.emoji}</span>}
                    title={p.name}
                    subtitle={`${money(p.price)} / ${p.unit}`}
                  />
                ))}
              </div>
            </>
          )}

          {step === 2 && product && (
            <>
              <SectionTitle>Quantas caixas?</SectionTitle>
              <Card className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-shell-100 text-xl">
                    {product.emoji}
                  </span>
                  <span className="font-semibold text-shell-900">{product.name}</span>
                </div>
                <Stepper value={boxes} onChange={setBoxes} min={1} />
              </Card>
            </>
          )}

          {step === 3 && (
            <>
              <SectionTitle>Motivo da devolução</SectionTitle>
              <div className="space-y-2.5">
                {REASONS.map((r) => (
                  <OptionCard
                    key={r}
                    selected={reason === r}
                    onClick={() => setReason(r)}
                    title={RETURN_REASON_LABEL[r]}
                    subtitle={
                      r === 'avaria'
                        ? 'Não retorna ao estoque — registra perda'
                        : 'Retorna ao estoque disponível'
                    }
                  />
                ))}
              </div>

              {product && reason && (
                <Card className="mt-4 px-4 py-1">
                  <KeyValue label="Produto" value={product.name} />
                  <Divider />
                  <KeyValue label="Quantidade" value={`${num(boxes)} cx`} />
                  <Divider />
                  <KeyValue label="Motivo" value={RETURN_REASON_LABEL[reason]} />
                  <Divider />
                  <KeyValue label="Valor" value={money(boxes * product.price)} strong />
                </Card>
              )}
            </>
          )}
        </div>
      </Screen>

      <StickyAction>
        {step < 3 ? (
          <Button
            size="lg"
            block
            disabled={step === 1 && !productId}
            onClick={() => setStep((step + 1) as 2 | 3)}
          >
            Continuar
          </Button>
        ) : (
          <Button
            size="lg"
            block
            disabled={!reason}
            onClick={() => {
              registerReturn({
                customerId: String(customerId),
                routeId: String(routeId ?? activeRoute?.id ?? ''),
                productId: productId!,
                boxes,
                reason: reason!,
              });
              back();
            }}
          >
            Confirmar devolução
          </Button>
        )}
      </StickyAction>
    </>
  );
}

/* ------------------------------------------------------ Fechamento da rota */

export function RouteCloseScreen() {
  const { routeId } = useParams();
  const route = useRoute(String(routeId));
  const { orders, returns, finishRoute } = useApp();
  const { reset } = useNav();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const returnedBoxes = useMemo(
    () => returns.filter((r) => r.routeId === routeId).reduce((s, r) => s + r.boxes, 0),
    [returns, routeId],
  );

  if (!route) return <EmptyState title="Rota não encontrada" />;

  const s = routeSummary(route, orders, returnedBoxes);
  const pending = route.stops.filter(
    (x) => x.status !== 'concluida' && x.status !== 'nao_atendida',
  ).length;
  const closed = route.status === 'finalizada';

  return (
    <>
      <AppBar title="Fechamento da rota" subtitle={`#${route.number}`} />
      <Screen action="single">
        <div className="px-4 pt-4">
          <Card className="p-5 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-100 text-brand-800">
              <Flag size={26} />
            </span>
            <h1 className="mt-3 text-title font-bold text-shell-900">
              {closed ? 'Rota finalizada' : 'Resumo do dia'}
            </h1>
            <p className="mt-1 text-meta text-shell-600">
              {userById(route.driverId).name} • {vehicleById(route.vehicleId).name}
            </p>
          </Card>
        </div>

        <div className="p-4">
          <SectionTitle>Atendimento</SectionTitle>
          <Card className="px-4 py-1">
            <KeyValue label="Clientes na rota" value={num(s.clients)} />
            <Divider />
            <KeyValue label="Visitados" value={num(s.visited)} tone="ok" />
            <Divider />
            <KeyValue label="Não atendidos" value={num(s.notServed)} tone={s.notServed ? 'bad' : 'neutral'} />
            <Divider />
            <KeyValue label="Pedidos" value={num(s.orders)} />
            <Divider />
            <KeyValue label="Entregas" value={num(s.deliveries)} />
          </Card>

          <SectionTitle className="pt-5">Mercadoria</SectionTitle>
          <Card className="px-4 py-1">
            <KeyValue label="Vendido" value={`${num(s.soldBoxes)} cx`} />
            <Divider />
            <KeyValue label="Retornado" value={`${num(s.returnedBoxes)} cx`} tone={s.returnedBoxes ? 'warn' : 'neutral'} />
            <Divider />
            <KeyValue label="Distância" value={km(s.distanceKm)} />
          </Card>

          <SectionTitle className="pt-5">Financeiro</SectionTitle>
          <Card className="px-4 py-1">
            <KeyValue label="Vendas" value={money(s.sales)} />
            <Divider />
            <KeyValue label="Recebido" value={money(s.received)} tone="ok" />
            <Divider />
            <KeyValue label="A receber" value={money(s.toReceive)} tone={s.toReceive ? 'warn' : 'neutral'} strong />
          </Card>
        </div>
      </Screen>

      <StickyAction>
        <Button size="lg" block disabled={closed} onClick={() => setConfirmOpen(true)}>
          {closed ? 'Rota já finalizada' : 'Finalizar rota'}
        </Button>
      </StickyAction>

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          finishRoute(route.id);
          setConfirmOpen(false);
          reset('home');
        }}
        title="Finalizar rota?"
        message={
          pending > 0
            ? `Você ainda possui ${pending} cliente${pending > 1 ? 's' : ''} pendente${pending > 1 ? 's' : ''}.`
            : 'O veículo volta a ficar disponível e o resumo é enviado à gestão.'
        }
        confirmLabel={pending > 0 ? 'Finalizar mesmo assim' : 'Finalizar rota'}
        tone={pending > 0 ? 'danger' : 'primary'}
      />
    </>
  );
}

/* ------------------------------------------------------ Histórico de rota */

export function RouteHistoryScreen() {
  const { routes, orders, returns } = useApp();
  const { navigate } = useNav();
  const finished = routes.filter((r) => r.status === 'finalizada');

  return (
    <>
      <AppBar title="Histórico de rotas" />
      <Screen className="space-y-3 p-4">
        {finished.length === 0 ? (
          <EmptyState
            title="Nenhuma rota finalizada"
            message="As rotas encerradas aparecem aqui com o resumo do dia."
          />
        ) : (
          finished.map((r) => {
            const returned = returns.filter((x) => x.routeId === r.id).reduce((s, x) => s + x.boxes, 0);
            const s = routeSummary(r, orders, returned);
            return (
              <Card key={r.id} onClick={() => navigate('route-close', { routeId: r.id })} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-subtitle font-bold text-shell-900">Rota #{r.number}</div>
                    <div className="text-meta text-shell-600">
                      {userById(r.driverId).name} • {r.finishedAt ? dateTime(r.finishedAt) : '—'}
                    </div>
                  </div>
                  <Badge tone="neutral">Finalizada</Badge>
                </div>
                <div className="mt-3 flex gap-4 text-meta text-shell-600">
                  <span>
                    <strong className="tnum text-shell-900">{s.visited}</strong>/{s.clients} visitados
                  </span>
                  <span>
                    <strong className="tnum text-shell-900">{money(s.sales)}</strong>
                  </span>
                  <span>
                    <strong className="tnum text-shell-900">{km(s.distanceKm)}</strong>
                  </span>
                </div>
              </Card>
            );
          })
        )}
      </Screen>
    </>
  );
}

/* Sheet reutilizada para registrar recebimento durante a visita. */
