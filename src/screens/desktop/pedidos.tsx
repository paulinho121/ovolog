import { useMemo, useState } from 'react';
import { Package, Plus, ShoppingCart, X } from 'lucide-react';
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
import { ORDER_STATUS, PAYMENT_LABEL } from '../../components/domain';
import { useApp } from '../../store/app';
import { useNav } from '../../store/navigation';
import { products } from '../../data/catalog';
import { orderBoxes, orderSubtotal, orderTotal } from '../../lib/domain';
import { dateTime, fullDate, money, num } from '../../lib/format';
import type { Order } from '../../types';

/* Pedidos em desktop. A tabela mostra o que a lista do celular só consegue
   entregar em duas linhas por card: cliente, caixas, forma, status e valor
   comparáveis coluna a coluna, e ordenáveis por qualquer um deles. */

type Filtro = 'todos' | 'hoje' | 'pendentes' | 'entregues';

export function PedidosDesktop() {
  const { orders, customers } = useApp();
  const { navigate } = useNav();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('hoje');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const hoje = new Date().toDateString();

  const passa = (o: Order, f: Filtro) =>
    f === 'hoje'
      ? new Date(o.createdAt).toDateString() === hoje
      : f === 'pendentes'
        ? o.status === 'confirmado' || o.status === 'em_rota'
        : f === 'entregues'
          ? o.status === 'entregue'
          : true;

  const lista = useMemo(() => {
    return orders.filter((o) => {
      if (!passa(o, filtro)) return false;
      if (!busca) return true;
      const cliente = customers.find((c) => c.id === o.customerId);
      return `${o.number} ${cliente?.tradeName ?? ''}`.toLowerCase().includes(busca.toLowerCase());
    });
  }, [orders, customers, filtro, busca, hoje]);

  const selecionado = orders.find((o) => o.id === selecionadoId);
  const total = lista.reduce((s, o) => s + orderTotal(o), 0);
  const contar = (f: Filtro) => orders.filter((o) => passa(o, f)).length;

  const nomeCliente = (o: Order) =>
    customers.find((c) => c.id === o.customerId)?.tradeName ?? 'Cliente';

  const colunas: Coluna<Order>[] = [
    {
      chave: 'numero',
      titulo: 'Pedido',
      largura: '7rem',
      ordenar: (o) => Number(o.number),
      render: (o) => <span className="font-semibold tnum text-shell-900">#{o.number}</span>,
    },
    {
      chave: 'cliente',
      titulo: 'Cliente',
      ordenar: nomeCliente,
      render: (o) => <span className="truncate font-medium text-shell-900">{nomeCliente(o)}</span>,
    },
    {
      chave: 'data',
      titulo: 'Data',
      ordenar: (o) => o.createdAt,
      render: (o) => <span className="text-shell-600">{dateTime(o.createdAt)}</span>,
    },
    {
      chave: 'caixas',
      titulo: 'Caixas',
      numerico: true,
      largura: '6rem',
      ordenar: orderBoxes,
      render: (o) => num(orderBoxes(o)),
    },
    {
      chave: 'pagamento',
      titulo: 'Pagamento',
      largura: '9rem',
      ordenar: (o) => o.payment,
      render: (o) => <span className="text-shell-600">{PAYMENT_LABEL[o.payment]}</span>,
    },
    {
      chave: 'status',
      titulo: 'Status',
      largura: '9rem',
      ordenar: (o) => o.status,
      render: (o) => <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>,
    },
    {
      chave: 'total',
      titulo: 'Total',
      numerico: true,
      largura: '9rem',
      ordenar: orderTotal,
      render: (o) => <span className="font-semibold text-shell-900">{money(orderTotal(o))}</span>,
    },
  ];

  return (
    <Pagina
      titulo="Pedidos"
      subtitulo={`${lista.length} pedidos • ${money(total)}`}
      acoes={
        <BotaoD
          variante="primario"
          icone={<Plus size={15} />}
          onClick={() => navigate('customer-search', { intent: 'order' })}
        >
          Novo pedido
        </BotaoD>
      }
      barra={
        <>
          <BuscaD
            value={busca}
            onChange={setBusca}
            placeholder="Número do pedido ou cliente"
            className="w-96"
          />
          <FiltroD
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: 'todos', label: 'Todos', count: contar('todos') },
              { value: 'hoje', label: 'Hoje', count: contar('hoje') },
              { value: 'pendentes', label: 'Pendentes', count: contar('pendentes') },
              { value: 'entregues', label: 'Entregues', count: contar('entregues') },
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
            chaveDe={(o) => o.id}
            selecionadoId={selecionadoId ?? undefined}
            aoClicar={(o) => setSelecionadoId(o.id)}
            ordemInicial={{ chave: 'data', asc: false }}
            vazio={
              <DetalheVazio
                icone={<ShoppingCart size={26} />}
                mensagem="Nenhum pedido encontrado para este período ou busca."
              />
            }
          />
        </div>

        {selecionado && (
          <PainelPedido
            pedido={selecionado}
            cliente={nomeCliente(selecionado)}
            aoFechar={() => setSelecionadoId(null)}
            aoAbrirCliente={() => navigate('customer', { customerId: selecionado.customerId })}
          />
        )}
      </div>
    </Pagina>
  );
}

function PainelPedido({
  pedido,
  cliente,
  aoFechar,
  aoAbrirCliente,
}: {
  pedido: Order;
  cliente: string;
  aoFechar: () => void;
  aoAbrirCliente: () => void;
}) {
  const status = ORDER_STATUS[pedido.status];
  const linhas = pedido.items.map((i) => ({
    ...i,
    produto: products.find((p) => p.id === i.productId),
  }));

  return (
    <aside className="flex w-[26rem] shrink-0 flex-col overflow-y-auto border-l border-shell-200 bg-white">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-shell-200 bg-white px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-subtitle font-bold text-shell-900">Pedido #{pedido.number}</h2>
          <button
            onClick={aoAbrirCliente}
            className="truncate text-meta text-brand-800 hover:underline"
          >
            {cliente}
          </button>
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
        <div className="flex items-center justify-between">
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="text-meta text-shell-600">{dateTime(pedido.createdAt)}</span>
        </div>

        <div>
          <h3 className="mb-2 text-meta font-bold uppercase tracking-wide text-shell-500">Itens</h3>
          <ul className="divide-y divide-shell-200 rounded-lg border border-shell-200">
            {linhas.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-shell-100">
                  {l.produto?.emoji ?? <Package size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-meta font-semibold text-shell-900">
                    {l.produto?.name ?? l.productId}
                  </span>
                  <span className="block text-micro tnum text-shell-500">
                    {num(l.quantity)} × {money(l.unitPrice)}
                  </span>
                </span>
                <span className="shrink-0 text-meta font-bold tnum text-shell-900">
                  {money(l.quantity * l.unitPrice)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="space-y-2 border-t border-shell-200 pt-4">
          <div className="flex justify-between text-meta">
            <dt className="text-shell-600">Subtotal</dt>
            <dd className="tnum text-shell-900">{money(orderSubtotal(pedido))}</dd>
          </div>
          {pedido.discount > 0 && (
            <div className="flex justify-between text-meta">
              <dt className="text-shell-600">Desconto</dt>
              <dd className="tnum text-ok-700">− {money(pedido.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-shell-200 pt-2">
            <dt className="text-body font-bold text-shell-900">Total</dt>
            <dd className="text-subtitle font-bold tnum text-shell-900">
              {money(orderTotal(pedido))}
            </dd>
          </div>
        </dl>

        <dl className="grid grid-cols-2 gap-4 border-t border-shell-200 pt-4">
          <Campo rotulo="Pagamento" valor={PAYMENT_LABEL[pedido.payment]} />
          <Campo rotulo="Caixas" valor={`${num(orderBoxes(pedido))} cx`} />
          {pedido.dueDate && <Campo rotulo="Vencimento" valor={fullDate(pedido.dueDate)} />}
          {pedido.installments && pedido.installments > 1 && (
            <Campo rotulo="Parcelas" valor={`${pedido.installments}×`} />
          )}
        </dl>
      </div>
    </aside>
  );
}
