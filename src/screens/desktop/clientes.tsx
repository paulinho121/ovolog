import { useMemo, useState } from 'react';
import { MessageCircle, Phone, Plus, Users, X } from 'lucide-react';
import {
  BotaoD,
  BuscaD,
  Campo,
  Coluna,
  DetalheVazio,
  FiltroD,
  Pagina,
  Tabela,
} from '../../components/desktop/ui';
import { Badge } from '../../components/ui/primitives';
import { CUSTOMER_STATUS, ORDER_STATUS } from '../../components/domain';
import { useApp } from '../../store/app';
import { useNav } from '../../store/navigation';
import { orderBoxes, orderTotal, ultimaCompraRotulo } from '../../lib/domain';
import { cnpj, money, phone as fmtPhone, relativeDay, shortDate } from '../../lib/format';
import type { Customer, CustomerStatus } from '../../types';

/* Clientes em desktop: a lista inteira visível e o detalhe abrindo ao lado.
   O ganho não é caber mais linha — é conseguir percorrer a carteira sem
   perder de vista onde se estava, o que a navegação em pilha do celular
   necessariamente custa. */

type Filtro = 'todos' | CustomerStatus;

export function ClientesDesktop() {
  const { customers, orders } = useApp();
  const { navigate } = useNav();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const lista = useMemo(
    () =>
      customers.filter((c) => {
        if (filtro !== 'todos' && c.status !== filtro) return false;
        if (!busca) return true;
        const alvo = busca.toLowerCase();
        return (
          c.tradeName.toLowerCase().includes(alvo) ||
          c.name.toLowerCase().includes(alvo) ||
          c.district.toLowerCase().includes(alvo) ||
          c.document.includes(busca.replace(/\D/g, '')) ||
          c.phone.includes(busca.replace(/\D/g, ''))
        );
      }),
    [customers, busca, filtro],
  );

  const selecionado = customers.find((c) => c.id === selecionadoId);
  const contar = (s: CustomerStatus) => customers.filter((c) => c.status === s).length;

  const colunas: Coluna<Customer>[] = [
    {
      chave: 'nome',
      titulo: 'Cliente',
      ordenar: (c) => c.tradeName,
      render: (c) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-shell-900">{c.tradeName}</div>
          <div className="truncate text-micro text-shell-500">{cnpj(c.document) || '—'}</div>
        </div>
      ),
    },
    { chave: 'bairro', titulo: 'Bairro', ordenar: (c) => c.district, render: (c) => c.district },
    {
      chave: 'status',
      titulo: 'Status',
      ordenar: (c) => c.status,
      largura: '9rem',
      render: (c) => (
        <Badge tone={CUSTOMER_STATUS[c.status].tone}>{CUSTOMER_STATUS[c.status].label}</Badge>
      ),
    },
    {
      chave: 'ultima',
      titulo: 'Última compra',
      ordenar: (c) => c.lastPurchaseAt ?? '',
      render: (c) => ultimaCompraRotulo(c, relativeDay),
    },
    {
      chave: 'total',
      titulo: 'Total comprado',
      numerico: true,
      ordenar: (c) => c.totalPurchased,
      render: (c) => money(c.totalPurchased),
    },
    {
      chave: 'saldo',
      titulo: 'Saldo',
      numerico: true,
      ordenar: (c) => c.balance,
      render: (c) => (
        <span className={c.balance > 0 ? 'font-semibold text-bad-700' : 'text-shell-600'}>
          {money(c.balance)}
        </span>
      ),
    },
  ];

  return (
    <Pagina
      titulo="Clientes"
      subtitulo={`${lista.length} de ${customers.length} clientes`}
      acoes={
        <BotaoD variante="primario" icone={<Plus size={15} />} onClick={() => navigate('customer-new')}>
          Novo cliente
        </BotaoD>
      }
      barra={
        <>
          <BuscaD
            value={busca}
            onChange={setBusca}
            placeholder="Nome, CNPJ, telefone ou bairro"
            className="w-96"
          />
          <FiltroD
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: 'todos', label: 'Todos', count: customers.length },
              { value: 'ativo', label: 'Ativos', count: contar('ativo') },
              { value: 'inadimplente', label: 'Inadimplentes', count: contar('inadimplente') },
              { value: 'novo', label: 'Novos', count: contar('novo') },
              { value: 'inativo', label: 'Inativos', count: contar('inativo') },
            ]}
          />
        </>
      }
    >
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <Tabela
            itens={lista}
            colunas={colunas}
            chaveDe={(c) => c.id}
            selecionadoId={selecionadoId ?? undefined}
            aoClicar={(c) => setSelecionadoId(c.id)}
            ordemInicial={{ chave: 'nome', asc: true }}
            vazio={
              <DetalheVazio
                icone={<Users size={26} />}
                mensagem="Nenhum cliente corresponde à busca ou ao filtro."
              />
            }
          />
        </div>

        {selecionado && (
          <PainelCliente
            cliente={selecionado}
            pedidos={orders.filter((o) => o.customerId === selecionado.id)}
            aoFechar={() => setSelecionadoId(null)}
            aoAbrirPedido={(id) => navigate('order', { orderId: id })}
          />
        )}
      </div>
    </Pagina>
  );
}

function PainelCliente({
  cliente,
  pedidos,
  aoFechar,
  aoAbrirPedido,
}: {
  cliente: Customer;
  pedidos: ReturnType<typeof useApp>['orders'];
  aoFechar: () => void;
  aoAbrirPedido: (id: string) => void;
}) {
  const recentes = [...pedidos]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const status = CUSTOMER_STATUS[cliente.status];

  return (
    <aside className="flex w-[26rem] shrink-0 flex-col overflow-y-auto border-l border-shell-200 bg-white">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-shell-200 bg-white px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-subtitle font-bold text-shell-900">{cliente.tradeName}</h2>
          <p className="truncate text-meta text-shell-600">{cliente.name}</p>
        </div>
        <button
          onClick={aoFechar}
          aria-label="Fechar detalhe"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-shell-500 hover:bg-shell-100"
        >
          <X size={16} />
        </button>
      </header>

      <div className="space-y-5 p-5">
        <div className="flex items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="text-meta text-shell-600">{cliente.paymentTerms}</span>
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <Campo rotulo="Total comprado" valor={money(cliente.totalPurchased)} />
          <Campo
            rotulo="Saldo pendente"
            valor={money(cliente.balance)}
            tom={cliente.balance > 0 ? 'ruim' : 'ok'}
          />
          <Campo rotulo="Limite de crédito" valor={money(cliente.creditLimit)} />
          <Campo rotulo="Última compra" valor={ultimaCompraRotulo(cliente, relativeDay)} />
        </dl>

        <dl className="space-y-3 border-t border-shell-200 pt-4">
          <Campo rotulo="CNPJ" valor={cnpj(cliente.document) || '—'} />
          <Campo rotulo="Telefone" valor={fmtPhone(cliente.phone)} />
          <Campo rotulo="Endereço" valor={`${cliente.address} • ${cliente.district}`} />
        </dl>

        <div className="flex gap-2">
          <a
            href={`tel:${cliente.phone}`}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-shell-300 text-meta font-semibold text-shell-800 hover:bg-shell-100"
          >
            <Phone size={15} /> Ligar
          </a>
          <a
            href={`https://wa.me/55${cliente.phone}`}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-shell-300 text-meta font-semibold text-shell-800 hover:bg-shell-100"
          >
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>

        <div className="border-t border-shell-200 pt-4">
          <h3 className="mb-2 text-meta font-bold uppercase tracking-wide text-shell-500">
            Últimos pedidos
          </h3>
          {recentes.length === 0 ? (
            <p className="text-meta text-shell-500">Nenhum pedido registrado.</p>
          ) : (
            <ul className="divide-y divide-shell-200">
              {recentes.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => aoAbrirPedido(o.id)}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-shell-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-meta font-semibold text-shell-900">
                        #{o.number}
                      </span>
                      <span className="block text-micro text-shell-500">
                        {shortDate(o.createdAt)} • {orderBoxes(o)} cx
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                      <span className="w-24 text-right text-meta font-bold tnum text-shell-900">
                        {money(orderTotal(o))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
