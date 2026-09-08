import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import {
  BotaoD,
  BuscaD,
  Coluna,
  DetalheVazio,
  FiltroD,
  Indicador,
  Pagina,
  Tabela,
} from '../../components/desktop/ui';
import { Badge, Button } from '../../components/ui/primitives';
import { Field, OptionCard } from '../../components/ui/forms';
import { Sheet } from '../../components/ui/overlays';
import { StackedBar } from '../../components/charts';
import { PAYMENT_ICON, PAYMENT_LABEL } from '../../components/domain';
import { useApp } from '../../store/app';
import { accountOpen, accountsTotal } from '../../lib/domain';
import { dateTime, daysUntil, fullDate, money, moneyShort } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { Account, CashEntry, PaymentMethod } from '../../types';

/* Financeiro em desktop: contas em tabela, ordenáveis por vencimento e valor,
   com a baixa a um clique na própria linha. É a tela em que a densidade
   realmente importa — quem cobra precisa varrer a carteira inteira. */

type Aba = 'receber' | 'pagar' | 'caixa';
type FiltroStatus = 'todos' | 'vencido' | 'a_vencer' | 'pago';

export function FinanceiroDesktop() {
  const { accounts, cashEntries, registerAccountPayment } = useApp();
  const [aba, setAba] = useState<Aba>('receber');
  const [status, setStatus] = useState<FiltroStatus>('todos');
  const [busca, setBusca] = useState('');
  const [baixaId, setBaixaId] = useState<string | null>(null);

  const hoje = new Date().toDateString();
  const recebidoHoje = cashEntries
    .filter((c) => c.direction === 'in' && new Date(c.at).toDateString() === hoje)
    .reduce((s, c) => s + c.amount, 0);
  const pagoHoje = cashEntries
    .filter((c) => c.direction === 'out' && new Date(c.at).toDateString() === hoje)
    .reduce((s, c) => s + c.amount, 0);

  const lista = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.kind === (aba === 'pagar' ? 'pagar' : 'receber') &&
          (status === 'todos' || a.status === status) &&
          (!busca || a.partyName.toLowerCase().includes(busca.toLowerCase())),
      ),
    [accounts, aba, status, busca],
  );

  const composicao = useMemo(() => {
    const porForma = new Map<PaymentMethod, number>();
    cashEntries
      .filter((c) => c.direction === 'in' && new Date(c.at).toDateString() === hoje)
      .forEach((c) => porForma.set(c.method, (porForma.get(c.method) ?? 0) + c.amount));
    return [...porForma.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([m, v]) => ({ label: PAYMENT_LABEL[m], value: v }));
  }, [cashEntries, hoje]);

  const contarStatus = (s: FiltroStatus) =>
    accounts.filter(
      (a) => a.kind === (aba === 'pagar' ? 'pagar' : 'receber') && (s === 'todos' || a.status === s),
    ).length;

  const colunas: Coluna<Account>[] = [
    {
      chave: 'parte',
      titulo: aba === 'pagar' ? 'Fornecedor' : 'Cliente',
      ordenar: (a) => a.partyName,
      render: (a) => <span className="font-semibold text-shell-900">{a.partyName}</span>,
    },
    {
      chave: 'vencimento',
      titulo: 'Vencimento',
      largura: '11rem',
      ordenar: (a) => a.dueDate,
      render: (a) => {
        const d = daysUntil(a.dueDate);
        return (
          <span>
            <span className="text-shell-800">{fullDate(a.dueDate)}</span>
            {a.status !== 'pago' && (
              <span className={cn('ml-2 text-micro', d < 0 ? 'text-bad-700' : 'text-shell-500')}>
                {d < 0 ? `${Math.abs(d)}d atrás` : d === 0 ? 'hoje' : `em ${d}d`}
              </span>
            )}
          </span>
        );
      },
    },
    {
      chave: 'status',
      titulo: 'Status',
      largura: '8rem',
      ordenar: (a) => a.status,
      render: (a) => (
        <Badge tone={a.status === 'pago' ? 'ok' : a.status === 'vencido' ? 'bad' : 'warn'}>
          {a.status === 'pago' ? 'Pago' : a.status === 'vencido' ? 'Vencido' : 'A vencer'}
        </Badge>
      ),
    },
    {
      chave: 'valor',
      titulo: 'Valor',
      numerico: true,
      largura: '8rem',
      ordenar: (a) => a.amount,
      render: (a) => <span className="text-shell-600">{money(a.amount)}</span>,
    },
    {
      chave: 'aberto',
      titulo: 'Em aberto',
      numerico: true,
      largura: '9rem',
      ordenar: accountOpen,
      render: (a) => (
        <span className={cn('font-bold', accountOpen(a) > 0 ? 'text-shell-900' : 'text-ok-700')}>
          {money(accountOpen(a))}
        </span>
      ),
    },
    {
      chave: 'acao',
      titulo: '',
      largura: '11rem',
      render: (a) =>
        a.status === 'pago' ? (
          <span className="text-micro text-shell-400">quitada</span>
        ) : (
          <BotaoD
            onClick={() => setBaixaId(a.id)}
            className="h-8"
          >
            Registrar pagamento
          </BotaoD>
        ),
    },
  ];

  const colunasCaixa: Coluna<CashEntry>[] = [
    {
      chave: 'descricao',
      titulo: 'Lançamento',
      ordenar: (c) => c.description,
      render: (c) => (
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-lg',
              c.direction === 'in' ? 'bg-ok-50 text-ok-700' : 'bg-bad-50 text-bad-700',
            )}
          >
            {c.direction === 'in' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
          </span>
          <span className="font-medium text-shell-900">{c.description}</span>
        </span>
      ),
    },
    {
      chave: 'forma',
      titulo: 'Forma',
      largura: '9rem',
      ordenar: (c) => c.method,
      render: (c) => <span className="text-shell-600">{PAYMENT_LABEL[c.method]}</span>,
    },
    {
      chave: 'quando',
      titulo: 'Data',
      largura: '12rem',
      ordenar: (c) => c.at,
      render: (c) => <span className="text-shell-600">{dateTime(c.at)}</span>,
    },
    {
      chave: 'valor',
      titulo: 'Valor',
      numerico: true,
      largura: '10rem',
      ordenar: (c) => (c.direction === 'in' ? c.amount : -c.amount),
      render: (c) => (
        <span className={cn('font-bold', c.direction === 'in' ? 'text-ok-700' : 'text-bad-700')}>
          {c.direction === 'in' ? '+' : '−'} {money(c.amount)}
        </span>
      ),
    },
  ];

  return (
    <Pagina
      titulo="Financeiro"
      subtitulo={`${moneyShort(accountsTotal(accounts, 'receber'))} a receber • ${moneyShort(accountsTotal(accounts, 'pagar'))} a pagar`}
      barra={
        <>
          <FiltroD
            value={aba}
            onChange={setAba}
            options={[
              { value: 'receber', label: 'Receber' },
              { value: 'pagar', label: 'Pagar' },
              { value: 'caixa', label: 'Caixa' },
            ]}
          />
          {aba !== 'caixa' && (
            <>
              <BuscaD
                value={busca}
                onChange={setBusca}
                placeholder={aba === 'pagar' ? 'Fornecedor' : 'Cliente'}
                className="w-72"
              />
              <FiltroD
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'todos', label: 'Todas', count: contarStatus('todos') },
                  { value: 'vencido', label: 'Vencidas', count: contarStatus('vencido') },
                  { value: 'a_vencer', label: 'A vencer', count: contarStatus('a_vencer') },
                  { value: 'pago', label: 'Pagas', count: contarStatus('pago') },
                ]}
              />
            </>
          )}
        </>
      }
    >
      <div className="space-y-5 p-8 pt-5">
        <div className="grid grid-cols-4 gap-4">
          <Indicador
            rotulo="A receber"
            valor={moneyShort(accountsTotal(accounts, 'receber'))}
            tom="marca"
          />
          <Indicador
            rotulo="Vencido"
            valor={moneyShort(accountsTotal(accounts, 'receber', 'vencido'))}
            detalhe={`${accounts.filter((a) => a.kind === 'receber' && a.status === 'vencido').length} contas`}
            tom="ruim"
          />
          <Indicador rotulo="Recebido hoje" valor={moneyShort(recebidoHoje)} tom="ok" />
          <Indicador rotulo="Pago hoje" valor={moneyShort(pagoHoje)} />
        </div>

        {aba === 'caixa' && composicao.length > 0 && (
          <div className="rounded-card border border-shell-200 bg-white p-4 shadow-card">
            <h2 className="mb-3 text-subtitle font-bold text-shell-900">
              Entradas de hoje por forma de pagamento
            </h2>
            <div className="max-w-2xl">
              <StackedBar
                data={composicao}
                formatValue={money}
                label="Entradas de hoje por forma de pagamento"
              />
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-card border border-shell-200 bg-white shadow-card">
          {aba === 'caixa' ? (
            <Tabela
              itens={cashEntries}
              colunas={colunasCaixa}
              chaveDe={(c) => c.id}
              ordemInicial={{ chave: 'quando', asc: false }}
              vazio={<DetalheVazio icone={<Wallet size={26} />} mensagem="Nenhum lançamento no caixa." />}
            />
          ) : (
            <Tabela
              itens={lista}
              colunas={colunas}
              chaveDe={(a) => a.id}
              ordemInicial={{ chave: 'vencimento', asc: true }}
              vazio={
                <DetalheVazio
                  icone={<Wallet size={26} />}
                  mensagem="Nenhuma conta para este filtro."
                />
              }
            />
          )}
        </div>
      </div>

      <SheetBaixa
        conta={accounts.find((a) => a.id === baixaId)}
        aoFechar={() => setBaixaId(null)}
        aoConfirmar={(valor, forma) => {
          if (baixaId) registerAccountPayment(baixaId, valor, forma);
          setBaixaId(null);
        }}
      />
    </Pagina>
  );
}

/* A baixa reaproveita o mesmo bottom sheet do celular — é uma ação curta e
   pontual, e ter dois componentes para ela só criaria divergência. */
function SheetBaixa({
  conta,
  aoFechar,
  aoConfirmar,
}: {
  conta?: Account;
  aoFechar: () => void;
  aoConfirmar: (valor: number, forma: PaymentMethod) => void;
}) {
  const [forma, setForma] = useState<PaymentMethod>('pix');
  const [valor, setValor] = useState('');
  const aberto = conta ? accountOpen(conta) : 0;
  const montante = valor === '' ? aberto : Number(valor) || 0;

  return (
    <Sheet
      open={Boolean(conta)}
      onClose={aoFechar}
      title="Registrar pagamento"
      subtitle={conta ? `${conta.partyName} • ${money(aberto)} em aberto` : undefined}
      footer={
        <Button
          size="lg"
          block
          disabled={montante <= 0}
          onClick={() => {
            aoConfirmar(Math.min(montante, aberto), forma);
            setValor('');
          }}
        >
          Registrar {money(montante)}
        </Button>
      }
    >
      <div className="space-y-2.5 px-4 pb-2">
        <Field label="Valor recebido (R$)" hint="Deixe em branco para quitar o total.">
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder={String(Math.round(aberto))}
            className="h-12 w-full rounded-xl border border-shell-300 bg-white px-3.5 text-[16px] tnum text-shell-900 placeholder:text-shell-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </Field>
        {(['pix', 'dinheiro', 'cartao'] as PaymentMethod[]).map((m) => (
          <OptionCard
            key={m}
            selected={forma === m}
            onClick={() => setForma(m)}
            icon={PAYMENT_ICON[m]}
            title={PAYMENT_LABEL[m]}
          />
        ))}
      </div>
    </Sheet>
  );
}
