import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { AppBar, Screen, StickyAction } from '../components/layout/chrome';
import {
  Badge,
  Button,
  Card,
  Divider,
  KeyValue,
  SectionTitle,
  Stat,
} from '../components/ui/primitives';
import { Field, OptionCard, Segmented } from '../components/ui/forms';
import { Sheet } from '../components/ui/overlays';
import { EmptyState } from '../components/ui/states';
import { StackedBar } from '../components/charts';
import { AccountCard, PAYMENT_ICON, PAYMENT_LABEL } from '../components/domain';
import { useApp } from '../store/app';
import { useNav, useParams } from '../store/navigation';
import { accountOpen, accountsTotal } from '../lib/domain';
import { dateTime, daysUntil, fullDate, money, moneyShort } from '../lib/format';
import { cn } from '../lib/utils';
import type { PaymentMethod } from '../types';

/* Financeiro em cards, com uma ação clara por conta: registrar o pagamento.
   Nada de tabela — quem cobra está em pé, na porta do cliente. */

type FinanceTab = 'receber' | 'pagar' | 'caixa';

export function FinanceScreen() {
  const { accounts, cashEntries } = useApp();
  const { navigate } = useNav();
  const [tab, setTab] = useState<FinanceTab>('receber');
  const [payFor, setPayFor] = useState<string | null>(null);

  const today = new Date().toDateString();
  const receivedToday = cashEntries
    .filter((c) => c.direction === 'in' && new Date(c.at).toDateString() === today)
    .reduce((s, c) => s + c.amount, 0);
  const paidToday = cashEntries
    .filter((c) => c.direction === 'out' && new Date(c.at).toDateString() === today)
    .reduce((s, c) => s + c.amount, 0);

  const receivables = accounts
    .filter((a) => a.kind === 'receber')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const payables = accounts
    .filter((a) => a.kind === 'pagar')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  /* Composição do que entrou hoje, por forma de pagamento. Três séries no
     máximo — a paleta validada cobre exatamente esse limite. */
  const mix = useMemo(() => {
    const byMethod = new Map<PaymentMethod, number>();
    cashEntries
      .filter((c) => c.direction === 'in' && new Date(c.at).toDateString() === today)
      .forEach((c) => byMethod.set(c.method, (byMethod.get(c.method) ?? 0) + c.amount));
    return [...byMethod.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, v]) => ({ label: PAYMENT_LABEL[m], value: v }));
  }, [cashEntries, today]);

  return (
    <>
      <AppBar title="Financeiro" />
      <Screen>
        <div className="grid grid-cols-2 gap-3 p-4">
          <Stat label="A receber" value={moneyShort(accountsTotal(accounts, 'receber'))} tone="brand" />
          <Stat label="A pagar" value={moneyShort(accountsTotal(accounts, 'pagar'))} tone="bad" />
          <Stat label="Recebido hoje" value={moneyShort(receivedToday)} tone="ok" />
          <Stat label="Pago hoje" value={moneyShort(paidToday)} />
        </div>

        <div className="px-4 pb-4">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'receber', label: 'Receber' },
              { value: 'pagar', label: 'Pagar' },
              { value: 'caixa', label: 'Caixa' },
            ]}
          />
        </div>

        <div className="space-y-3 px-4">
          {tab === 'receber' && (
            <>
              <Card className="border-bad-500/25 bg-bad-50 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-bad-700">Vencido</span>
                  <span className="text-subtitle font-bold tnum text-bad-700">
                    {money(accountsTotal(accounts, 'receber', 'vencido'))}
                  </span>
                </div>
              </Card>
              {receivables.length === 0 ? (
                <EmptyState title="Nada a receber" message="Nenhuma conta em aberto." />
              ) : (
                receivables.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    onClick={() => navigate('receivable', { accountId: a.id })}
                    onRegister={() => setPayFor(a.id)}
                  />
                ))
              )}
            </>
          )}

          {tab === 'pagar' &&
            (payables.length === 0 ? (
              <EmptyState title="Nada a pagar" message="Nenhum compromisso em aberto." />
            ) : (
              payables.map((a) => (
                <AccountCard
                  key={a.id}
                  account={a}
                  onClick={() => navigate('payable', { accountId: a.id })}
                  onRegister={() => setPayFor(a.id)}
                />
              ))
            ))}

          {tab === 'caixa' && (
            <>
              {mix.length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-3 font-bold text-shell-900">Entradas de hoje por forma</h3>
                  <StackedBar
                    data={mix}
                    formatValue={money}
                    label="Entradas de hoje por forma de pagamento"
                  />
                </Card>
              )}
              <Card className="divide-y divide-shell-200 overflow-hidden">
                {cashEntries.slice(0, 20).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-xl',
                        c.direction === 'in' ? 'bg-ok-50 text-ok-700' : 'bg-bad-50 text-bad-700',
                      )}
                    >
                      {c.direction === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-shell-900">{c.description}</div>
                      <div className="text-meta text-shell-600">
                        {PAYMENT_LABEL[c.method]} • {dateTime(c.at)}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 font-bold tnum',
                        c.direction === 'in' ? 'text-ok-700' : 'text-bad-700',
                      )}
                    >
                      {c.direction === 'in' ? '+' : '−'} {money(c.amount)}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>
      </Screen>

      <RegisterPaymentSheet accountId={payFor} onClose={() => setPayFor(null)} />
    </>
  );
}

/* ------------------------------------------------------- Conta (detalhe) */

function AccountDetail({ kind }: { kind: 'receber' | 'pagar' }) {
  const { accountId } = useParams();
  const { accounts, orders, customers } = useApp();
  const { navigate } = useNav();
  const [payOpen, setPayOpen] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  if (!account) return <EmptyState title="Conta não encontrada" />;

  const open = accountOpen(account);
  const days = daysUntil(account.dueDate);
  const order = orders.find((o) => o.id === account.orderId);
  const customer = customers.find((c) => c.id === account.partyId);

  const tone = account.status === 'pago' ? 'ok' : account.status === 'vencido' ? 'bad' : 'warn';
  const label =
    account.status === 'pago' ? 'Pago' : account.status === 'vencido' ? 'Vencido' : 'A vencer';

  return (
    <>
      <AppBar
        title={kind === 'receber' ? 'Conta a receber' : 'Conta a pagar'}
        subtitle={account.partyName}
      />
      <Screen action={account.status === 'pago' ? 'none' : 'single'}>
        <div className="bg-white px-4 pb-5 pt-2 text-center">
          <div className="text-display font-bold tnum text-shell-900">{money(open)}</div>
          <div className="mt-2 flex justify-center">
            <Badge tone={tone}>{label}</Badge>
          </div>
          <p className="mt-2 text-meta text-shell-600">
            {account.status === 'pago'
              ? `Quitado em ${fullDate(account.dueDate)}`
              : days < 0
                ? `Venceu há ${Math.abs(days)} dias`
                : days === 0
                  ? 'Vence hoje'
                  : `Vence em ${days} dias`}
          </p>
        </div>

        <div className="space-y-3 p-4">
          <Card className="px-4 py-1">
            <KeyValue label={kind === 'receber' ? 'Cliente' : 'Fornecedor'} value={account.partyName} />
            <Divider />
            <KeyValue label="Vencimento" value={fullDate(account.dueDate)} />
            <Divider />
            <KeyValue label="Valor original" value={money(account.amount)} />
            {account.paidAmount > 0 && (
              <>
                <Divider />
                <KeyValue label="Já pago" value={money(account.paidAmount)} tone="ok" />
              </>
            )}
            <Divider />
            <KeyValue label="Em aberto" value={money(open)} strong tone={open > 0 ? 'bad' : 'ok'} />
          </Card>

          {order && (
            <Card>
              <button
                onClick={() => navigate('order', { orderId: order.id })}
                className="w-full p-4 text-left active:bg-shell-50"
              >
                <div className="text-meta text-shell-600">Pedido de origem</div>
                <div className="mt-0.5 font-bold text-shell-900">#{order.number}</div>
              </button>
            </Card>
          )}

          {customer && kind === 'receber' && (
            <Button
              variant="secondary"
              size="md"
              block
              onClick={() => navigate('customer', { customerId: customer.id })}
            >
              Abrir cliente
            </Button>
          )}
        </div>
      </Screen>

      {account.status !== 'pago' && (
        <StickyAction>
          <Button size="lg" block onClick={() => setPayOpen(true)}>
            Registrar pagamento
          </Button>
        </StickyAction>
      )}

      <RegisterPaymentSheet accountId={payOpen ? account.id : null} onClose={() => setPayOpen(false)} />
    </>
  );
}

export function ReceivableScreen() {
  return <AccountDetail kind="receber" />;
}

export function PayableScreen() {
  return <AccountDetail kind="pagar" />;
}

/* --------------------------------------------------- Registrar pagamento */

const METHODS: PaymentMethod[] = ['pix', 'dinheiro', 'cartao'];

function RegisterPaymentSheet({
  accountId,
  onClose,
}: {
  accountId: string | null;
  onClose: () => void;
}) {
  const { accounts, registerAccountPayment } = useApp();
  const account = accounts.find((a) => a.id === accountId);
  const open = account ? accountOpen(account) : 0;

  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [value, setValue] = useState('');

  // O valor padrão é o total em aberto: o caso comum é quitar de uma vez.
  const amount = value === '' ? open : Number(value) || 0;

  return (
    <Sheet
      open={accountId !== null}
      onClose={onClose}
      title="Registrar pagamento"
      subtitle={account ? `${account.partyName} • ${money(open)} em aberto` : undefined}
      footer={
        <Button
          size="lg"
          block
          disabled={amount <= 0}
          onClick={() => {
            if (account) registerAccountPayment(account.id, Math.min(amount, open), method);
            setValue('');
            onClose();
          }}
        >
          Registrar {money(amount)}
        </Button>
      }
    >
      <div className="space-y-2.5 px-4 pb-2">
        <Field label="Valor recebido (R$)" hint="Deixe em branco para quitar o total.">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder={String(Math.round(open))}
            className="h-12 w-full rounded-xl border border-shell-300 bg-white px-3.5 text-[16px] tnum text-shell-900 placeholder:text-shell-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </Field>
        <SectionTitle className="pt-1">Forma</SectionTitle>
        {METHODS.map((m) => (
          <OptionCard
            key={m}
            selected={method === m}
            onClick={() => setMethod(m)}
            icon={PAYMENT_ICON[m]}
            title={PAYMENT_LABEL[m]}
          />
        ))}
      </div>
    </Sheet>
  );
}
