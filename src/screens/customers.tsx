import { useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  SlidersHorizontal,
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
  StepIndicator,
  Tabs,
} from '../components/ui/forms';
import { Sheet } from '../components/ui/overlays';
import { BuscaEndereco } from '../components/map/BuscaEndereco';
import { EmptyState } from '../components/ui/states';
import {
  CUSTOMER_STATUS,
  CustomerCard,
  OrderCard,
  AccountCard,
  INCIDENT_LABEL,
} from '../components/domain';
import { useApp, useCustomer } from '../store/app';
import { useNav, useParams } from '../store/navigation';
import { cnpj, dateTime, money, phone as fmtPhone, relativeDay } from '../lib/format';
import { orderTotal, ultimaCompraRotulo } from '../lib/domain';
import type { Customer, CustomerStatus } from '../types';

/* Busca em memória por nome, documento, telefone e bairro — o vendedor
   digita o que lembra, não o campo certo (§38). */
function matches(c: Customer, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase().replace(/\D/g, '') || q.toLowerCase();
  return (
    c.tradeName.toLowerCase().includes(q.toLowerCase()) ||
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.district.toLowerCase().includes(q.toLowerCase()) ||
    c.document.includes(needle) ||
    c.phone.includes(needle)
  );
}

/* ------------------------------------------------------- Lista de clientes */

type CustomerFilter = 'todos' | 'ativo' | 'inadimplente' | 'novo';

export function CustomersScreen() {
  const { customers } = useApp();
  const { navigate } = useNav();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CustomerFilter>('todos');
  const [district, setDistrict] = useState<string>('todos');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const districts = useMemo(
    () => ['todos', ...Array.from(new Set(customers.map((c) => c.district))).sort()],
    [customers],
  );

  const list = useMemo(
    () =>
      customers.filter(
        (c) =>
          matches(c, query) &&
          (filter === 'todos' || c.status === filter) &&
          (district === 'todos' || c.district === district),
      ),
    [customers, query, filter, district],
  );

  const counts = (s: CustomerStatus) => customers.filter((c) => c.status === s).length;

  return (
    <>
      <TabHeader
        title="Clientes"
        right={
          <button
            onClick={() => setFiltersOpen(true)}
            aria-label="Filtros"
            className="relative grid size-11 place-items-center rounded-full text-shell-700 active:bg-shell-200"
          >
            <SlidersHorizontal size={20} />
            {district !== 'todos' && (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-600" />
            )}
          </button>
        }
      >
        <SearchField value={query} onChange={setQuery} placeholder="Buscar cliente, CNPJ, telefone" />
        <ChipRow
          className="mt-3"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todos', label: 'Todos', count: customers.length },
            { value: 'ativo', label: 'Ativos', count: counts('ativo') },
            { value: 'inadimplente', label: 'Inadimplentes', count: counts('inadimplente') },
            { value: 'novo', label: 'Novos', count: counts('novo') },
          ]}
        />
      </TabHeader>

      <Screen className="space-y-3 px-4 pt-3" action="single">
        {list.length === 0 ? (
          <EmptyState
            title="Nenhum cliente encontrado"
            message="Ajuste a busca ou limpe os filtros para ver todos os clientes."
            actionLabel="Limpar filtros"
            onAction={() => {
              setQuery('');
              setFilter('todos');
              setDistrict('todos');
            }}
          />
        ) : (
          list.map((c) => (
            <CustomerCard
              key={c.id}
              customer={c}
              onClick={() => navigate('customer', { customerId: c.id })}
            />
          ))
        )}
      </Screen>

      <StickyAction>
        <Button size="lg" block icon={<Plus size={18} />} onClick={() => navigate('customer-new')}>
          Novo cliente
        </Button>
      </StickyAction>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrar clientes"
        footer={
          <Button size="lg" block onClick={() => setFiltersOpen(false)}>
            Aplicar filtros
          </Button>
        }
      >
        <div className="px-4 pb-2">
          <span className="mb-2 block text-meta font-semibold text-shell-700">Bairro</span>
          <div className="space-y-2">
            {districts.map((d) => (
              <OptionCard
                key={d}
                selected={district === d}
                onClick={() => setDistrict(d)}
                title={d === 'todos' ? 'Todos os bairros' : d}
              />
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}

/* -------------------------------------------------------------- Busca */

/* Tela de busca dedicada: usada quando a intenção já é "escolher um cliente"
   (fazer pedido), evitando passar pela lista com filtros. */
export function CustomerSearchScreen() {
  const { customers, startCart } = useApp();
  const { navigate, back } = useNav();
  const { intent } = useParams();
  const [query, setQuery] = useState('');

  const list = customers.filter((c) => matches(c, query)).slice(0, 20);
  const recent = customers
    .filter((c) => c.lastPurchaseAt)
    .sort((a, b) => (b.lastPurchaseAt ?? '').localeCompare(a.lastPurchaseAt ?? ''))
    .slice(0, 5);

  function pick(customerId: string) {
    if (intent === 'order') {
      startCart(customerId);
      navigate('order-products', { customerId });
    } else {
      navigate('customer', { customerId });
    }
  }

  return (
    <>
      <AppBar title="Selecionar cliente" onBack={back} />
      <div className="border-b border-shell-200 bg-white px-4 pb-3">
        <SearchField value={query} onChange={setQuery} placeholder="Nome, CNPJ ou telefone" autoFocus />
      </div>
      <Screen>
        {query === '' && (
          <>
            {/* Histórico acelera pedidos recorrentes (REGRA 8). */}
            <SectionTitle className="px-4 pt-4">Comprou recentemente</SectionTitle>
            <div className="divide-y divide-shell-200 bg-white">
              {recent.map((c) => (
                <ListRow
                  key={c.id}
                  title={c.tradeName}
                  subtitle={`${c.district} • ${relativeDay(c.lastPurchaseAt)}`}
                  onClick={() => pick(c.id)}
                />
              ))}
            </div>
          </>
        )}
        {query !== '' && (
          <div className="divide-y divide-shell-200 bg-white">
            {list.length === 0 ? (
              <EmptyState
                title="Nada encontrado"
                message={`Nenhum cliente corresponde a "${query}".`}
                actionLabel="Cadastrar novo cliente"
                onAction={() => navigate('customer-new')}
              />
            ) : (
              list.map((c) => (
                <ListRow
                  key={c.id}
                  title={c.tradeName}
                  subtitle={`${c.district} • ${cnpj(c.document)}`}
                  trailing={
                    <Badge tone={CUSTOMER_STATUS[c.status].tone}>
                      {CUSTOMER_STATUS[c.status].label}
                    </Badge>
                  }
                  onClick={() => pick(c.id)}
                />
              ))
            )}
          </div>
        )}
      </Screen>
    </>
  );
}

/* ------------------------------------------------------ Detalhes do cliente */

type CustomerTab = 'resumo' | 'pedidos' | 'financeiro' | 'visitas';

export function CustomerScreen() {
  const { customerId } = useParams();
  const customer = useCustomer(String(customerId));
  const { orders, accounts, incidents, startCart } = useApp();
  const { navigate } = useNav();
  const [tab, setTab] = useState<CustomerTab>('resumo');

  if (!customer) return <EmptyState title="Cliente não encontrado" />;

  const customerOrders = orders
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const customerAccounts = accounts.filter((a) => a.partyId === customer.id);
  const visits = incidents.filter((i) => i.customerId === customer.id);
  const status = CUSTOMER_STATUS[customer.status];

  return (
    <>
      <AppBar title="Cliente" />

      <Screen action="single">
        <div className="bg-white px-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-title font-bold leading-tight text-shell-900">
                {customer.tradeName}
              </h1>
              <p className="mt-1 text-meta text-shell-600">{customer.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-meta text-shell-600">
                <MapPin size={13} /> {customer.address} • {customer.district}
              </p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>

          {/* Ações rápidas: as três coisas que se faz na porta do cliente. */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <QuickLink href={`tel:${customer.phone}`} icon={<Phone size={18} />} label="Ligar" />
            <QuickLink
              href={`https://wa.me/55${customer.phone}`}
              icon={<MessageCircle size={18} />}
              label="WhatsApp"
            />
            <button
              onClick={() => navigate('route-map')}
              className="flex h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border border-shell-200 bg-white active:bg-shell-100"
            >
              <span className="text-brand-800">
                <MapPin size={18} />
              </span>
              <span className="text-meta font-semibold text-shell-800">Navegar</span>
            </button>
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'resumo', label: 'Resumo' },
            { value: 'pedidos', label: 'Pedidos' },
            { value: 'financeiro', label: 'Financeiro' },
            { value: 'visitas', label: 'Visitas' },
          ]}
        />

        <div className="p-4">
          {tab === 'resumo' && (
            <div className="space-y-3">
              <Card className="px-4 py-1">
                <KeyValue label="Última compra" value={ultimaCompraRotulo(customer, relativeDay)} />
                <Divider />
                <KeyValue label="Total comprado" value={money(customer.totalPurchased)} />
                <Divider />
                <KeyValue
                  label="Saldo pendente"
                  value={money(customer.balance)}
                  tone={customer.balance > 0 ? 'bad' : 'ok'}
                  strong
                />
              </Card>

              <Card className="px-4 py-1">
                <KeyValue label="CNPJ" value={customer.document ? cnpj(customer.document) : '—'} />
                <Divider />
                <KeyValue label="Telefone" value={fmtPhone(customer.phone)} />
                <Divider />
                <KeyValue label="Condição de pagamento" value={customer.paymentTerms} />
                <Divider />
                <KeyValue label="Limite de crédito" value={money(customer.creditLimit)} />
              </Card>

              <Button
                variant="secondary"
                size="md"
                block
                onClick={() => navigate('customer-history', { customerId: customer.id })}
              >
                Ver histórico completo
              </Button>
            </div>
          )}

          {tab === 'pedidos' && (
            <div className="space-y-3">
              {customerOrders.length === 0 ? (
                <EmptyState
                  title="Nenhum pedido"
                  message="Este cliente ainda não comprou."
                  actionLabel="Fazer pedido"
                  onAction={() => {
                    startCart(customer.id);
                    navigate('order-products', { customerId: customer.id });
                  }}
                />
              ) : (
                customerOrders
                  .slice(0, 12)
                  .map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      customer={customer}
                      onClick={() => navigate('order', { orderId: o.id })}
                    />
                  ))
              )}
            </div>
          )}

          {tab === 'financeiro' && (
            <div className="space-y-3">
              {customerAccounts.length === 0 ? (
                <EmptyState title="Nada em aberto" message="Não há contas registradas para este cliente." />
              ) : (
                customerAccounts.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    onClick={() => navigate('receivable', { accountId: a.id })}
                  />
                ))
              )}
            </div>
          )}

          {tab === 'visitas' && (
            <div className="space-y-3">
              {visits.length === 0 ? (
                <EmptyState title="Sem ocorrências" message="Nenhuma visita com ocorrência registrada." />
              ) : (
                visits.map((v) => (
                  <Card key={v.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-shell-900">{INCIDENT_LABEL[v.kind]}</span>
                      <span className="text-meta text-shell-500">{dateTime(v.at)}</span>
                    </div>
                    {v.note && <p className="mt-1.5 text-meta text-shell-600">{v.note}</p>}
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </Screen>

      <StickyAction>
        <Button
          size="lg"
          block
          onClick={() => {
            startCart(customer.id);
            navigate('order-products', { customerId: customer.id });
          }}
        >
          Fazer pedido
        </Button>
      </StickyAction>
    </>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      className="flex h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border border-shell-200 bg-white active:bg-shell-100"
    >
      <span className="text-brand-800">{icon}</span>
      <span className="text-meta font-semibold text-shell-800">{label}</span>
    </a>
  );
}

/* ------------------------------------------------------ Histórico do cliente */

export function CustomerHistoryScreen() {
  const { customerId } = useParams();
  const customer = useCustomer(String(customerId));
  const { orders } = useApp();
  const { navigate } = useNav();

  const list = orders
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = list.reduce((s, o) => s + orderTotal(o), 0);

  return (
    <>
      <AppBar title="Histórico" subtitle={customer?.tradeName} />
      <Screen>
        <div className="border-b border-shell-200 bg-white px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-meta text-shell-600">Pedidos</div>
              <div className="text-title font-bold tnum text-shell-900">{list.length}</div>
            </div>
            <div>
              <div className="text-meta text-shell-600">Total comprado</div>
              <div className="text-title font-bold tnum text-shell-900">{money(total)}</div>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4">
          {list.length === 0 ? (
            <EmptyState title="Sem histórico" message="Este cliente ainda não tem pedidos." />
          ) : (
            list.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                customer={customer}
                onClick={() => navigate('order', { orderId: o.id })}
              />
            ))
          )}
        </div>
      </Screen>
    </>
  );
}

/* ---------------------------------------------------------- Novo cliente */

const TERMS = ['À vista', '7 dias', '14 dias', '21 dias', '28 dias'];

export function CustomerNewScreen() {
  const { createCustomer } = useApp();
  const { back, replace } = useNav();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    tradeName: '',
    name: '',
    document: '',
    phone: '',
    address: '',
    district: '',
    paymentTerms: 'À vista',
    creditLimit: 3000,
    status: 'novo' as CustomerStatus,
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canAdvance =
    step === 1
      ? form.tradeName.trim().length > 2 && form.phone.replace(/\D/g, '').length >= 10
      : step === 2
        ? form.address.trim().length > 3 && form.district.trim().length > 1
        : true;

  function finish() {
    const id = createCustomer(form);
    replace('customer', { customerId: id });
  }

  const LABELS = ['Informações básicas', 'Endereço', 'Condições comerciais', 'Confirmar'];

  return (
    <>
      <AppBar title="Novo cliente" onBack={() => (step === 1 ? back() : setStep(step - 1))} />
      <Screen action="single">
        <div className="bg-white pb-4 pt-4">
          <StepIndicator step={step} total={4} label={LABELS[step - 1]} />
        </div>

        <div className="space-y-4 p-4">
          {step === 1 && (
            <>
              <Field label="Nome fantasia" hint="Como o cliente é conhecido na rua.">
                <Input
                  value={form.tradeName}
                  onChange={(e) => set('tradeName', e.target.value)}
                  placeholder="Mercadinho São José"
                  autoFocus
                />
              </Field>
              <Field label="Razão social">
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Mercadinho São José Ltda"
                />
              </Field>
              <Field label="CNPJ">
                <Input
                  value={form.document}
                  onChange={(e) => set('document', e.target.value.replace(/\D/g, '').slice(0, 14))}
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  inputMode="tel"
                  placeholder="(11) 90000-0000"
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Endereço">
                <Input
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="Rua, número"
                />
              </Field>
              <Field label="Bairro">
                <Input
                  value={form.district}
                  onChange={(e) => set('district', e.target.value)}
                  placeholder="Centro"
                />
              </Field>

              <BuscaEndereco
                endereco={form.address}
                bairro={form.district}
                coordenada={
                  form.lat !== undefined && form.lng !== undefined
                    ? { lat: form.lat, lng: form.lng }
                    : undefined
                }
                onEscolher={(c) => setForm((f) => ({ ...f, lat: c?.lat, lng: c?.lng }))}
                onPreencherEndereco={(rua, bairro) =>
                  setForm((f) => ({
                    ...f,
                    address: rua || f.address,
                    district: bairro || f.district,
                  }))
                }
              />
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <span className="mb-2 block text-meta font-semibold text-shell-700">
                  Condição de pagamento
                </span>
                <div className="space-y-2">
                  {TERMS.map((t) => (
                    <OptionCard
                      key={t}
                      selected={form.paymentTerms === t}
                      onClick={() => set('paymentTerms', t)}
                      title={t}
                    />
                  ))}
                </div>
              </div>
              <Field label="Limite de crédito">
                <Input
                  value={String(form.creditLimit)}
                  onChange={(e) => set('creditLimit', Number(e.target.value.replace(/\D/g, '')) || 0)}
                  inputMode="numeric"
                />
              </Field>
            </>
          )}

          {step === 4 && (
            <Card className="px-4 py-1">
              <KeyValue label="Nome fantasia" value={form.tradeName || '—'} />
              <Divider />
              <KeyValue label="Razão social" value={form.name || '—'} />
              <Divider />
              <KeyValue label="CNPJ" value={form.document ? cnpj(form.document) : '—'} />
              <Divider />
              <KeyValue label="Telefone" value={form.phone ? fmtPhone(form.phone) : '—'} />
              <Divider />
              <KeyValue label="Endereço" value={`${form.address}, ${form.district}`} />
              <Divider />
              <KeyValue label="Pagamento" value={form.paymentTerms} />
              <Divider />
              <KeyValue label="Limite" value={money(form.creditLimit)} strong />
            </Card>
          )}
        </div>
      </Screen>

      <StickyAction>
        {step < 4 ? (
          <Button size="lg" block disabled={!canAdvance} onClick={() => setStep(step + 1)}>
            Continuar
          </Button>
        ) : (
          <Button size="lg" block icon={<Building2 size={18} />} onClick={finish}>
            Cadastrar cliente
          </Button>
        )}
      </StickyAction>
    </>
  );
}
