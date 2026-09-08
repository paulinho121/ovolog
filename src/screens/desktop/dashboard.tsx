import { useMemo } from 'react';
import { ArrowRight, TrendingUp, Truck } from 'lucide-react';
import { BotaoD, Indicador, Pagina, Painel } from '../../components/desktop/ui';
import { BarChart, RankBars, Sparkline } from '../../components/charts';
import { MapCanvas } from '../../components/map/MapCanvas';
import { AlertCard } from '../../components/domain';
import { Progress } from '../../components/ui/primitives';
import { useApp } from '../../store/app';
import { useNav } from '../../store/navigation';
import { products, users } from '../../data/catalog';
import {
  accountsTotal,
  available,
  expiringBatches,
  orderCost,
  orderTotal,
  ordersOfDay,
  routeProgress,
  stockLevel,
} from '../../lib/domain';
import { daysUntil, money, moneyAxis, moneyShort, num, pct } from '../../lib/format';

/* Dashboard de gestão em tela cheia.
 *
 * Mesmos números da Home do celular — nenhuma regra nova. O que muda é que
 * aqui tudo cabe de uma vez: os indicadores em linha, o gráfico grande o
 * suficiente para ler a tendência e o mapa do tamanho que ele precisa ter
 * para alguém acompanhar a operação sentado. */

export function DashboardDesktop() {
  const { orders, customers, vehicles, cashEntries, accounts, stock, routes, position, notifications } =
    useApp();
  const { navigate } = useNav();

  const hoje = new Date();
  const pedidosHoje = useMemo(() => ordersOfDay(orders, hoje), [orders]);
  const vendas = pedidosHoje.reduce((s, o) => s + orderTotal(o), 0);
  const custo = pedidosHoje.reduce((s, o) => s + orderCost(o, products), 0);
  const margem = vendas > 0 ? (vendas - custo) / vendas : 0;

  const recebido = cashEntries
    .filter((c) => c.direction === 'in' && new Date(c.at).toDateString() === hoje.toDateString())
    .reduce((s, c) => s + c.amount, 0);

  const emRota = vehicles.filter((v) => v.status === 'em_rota');
  const baixo = stock.filter((s) => stockLevel(s) !== 'normal');
  const vencidas = accounts.filter((a) => a.kind === 'receber' && a.status === 'vencido');
  const vencendo = expiringBatches(stock, 7);
  const naoLidas = notifications.filter((n) => !n.read);

  /* Últimos 7 dias, incluindo os dias sem venda — buraco escondido distorce
     a leitura da tendência. */
  const serie = useMemo(() => {
    const dias: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      const chave = d.toDateString();
      dias.push({
        label: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()],
        value: orders
          .filter((o) => new Date(o.createdAt).toDateString() === chave)
          .reduce((s, o) => s + orderTotal(o), 0),
      });
    }
    return dias;
  }, [orders]);

  const porVendedor = useMemo(() => {
    const t = new Map<string, number>();
    pedidosHoje.forEach((o) => t.set(o.sellerId, (t.get(o.sellerId) ?? 0) + orderTotal(o)));
    return [...t.entries()]
      .map(([id, value]) => ({
        label: users.find((u) => u.id === id)?.name.split(' ')[0] ?? id,
        value,
        hint: `${pedidosHoje.filter((o) => o.sellerId === id).length} pedidos hoje`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [pedidosHoje]);

  const paradasEmRota = useMemo(
    () =>
      routes
        .filter((r) => r.status === 'em_andamento')
        .flatMap((r) =>
          r.stops.map((s) => ({
            id: s.id,
            customer: customers.find((c) => c.id === s.customerId)!,
            status: s.status,
            sequence: s.sequence,
          })),
        )
        .filter((s) => s.customer),
    [routes, customers],
  );

  return (
    <Pagina
      titulo="Operação"
      subtitulo={new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(hoje)}
      acoes={
        <>
          <BotaoD onClick={() => navigate('reports')}>Relatórios</BotaoD>
          <BotaoD variante="primario" onClick={() => navigate('tracking')} icone={<Truck size={15} />}>
            Rastrear frota
          </BotaoD>
        </>
      }
    >
      <div className="space-y-5 p-8 pt-5">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <Indicador
            rotulo="Vendas hoje"
            valor={moneyShort(vendas)}
            detalhe={`${num(pedidosHoje.length)} pedidos`}
            tom="marca"
            grafico={<TrendingUp size={16} className="text-brand-600" />}
          />
          <Indicador
            rotulo="Margem bruta"
            valor={pct(margem)}
            detalhe={moneyShort(vendas - custo)}
            tom={margem > 0.2 ? 'ok' : 'atencao'}
            grafico={<Sparkline values={serie.map((d) => d.value)} />}
          />
          <Indicador
            rotulo="Recebido hoje"
            valor={moneyShort(recebido)}
            detalhe={`${moneyShort(accountsTotal(accounts, 'receber'))} a receber`}
            tom="ok"
            aoClicar={() => navigate('finance')}
          />
          <Indicador
            rotulo="Vencido"
            valor={moneyShort(accountsTotal(accounts, 'receber', 'vencido'))}
            detalhe={`${vencidas.length} contas`}
            tom={vencidas.length ? 'ruim' : 'neutro'}
            aoClicar={() => navigate('finance')}
          />
          <Indicador
            rotulo="Veículos em rota"
            valor={num(emRota.length)}
            detalhe={`${vehicles.length} na frota`}
            aoClicar={() => navigate('fleet')}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Painel titulo="Vendas por dia" className="xl:col-span-2">
            <BarChart
              data={serie}
              formatValue={moneyAxis}
              height={230}
              label="Faturamento diário nos últimos 7 dias"
            />
          </Painel>

          <Painel
            titulo="Vendas por vendedor"
            acao={
              <button
                onClick={() => navigate('reports')}
                className="flex items-center gap-1 text-meta font-bold text-brand-800 hover:underline"
              >
                Ver ranking <ArrowRight size={13} />
              </button>
            }
          >
            {porVendedor.length > 0 ? (
              <RankBars data={porVendedor} formatValue={moneyShort} label="Vendas de hoje por vendedor" />
            ) : (
              <p className="text-body text-shell-500">Nenhuma venda registrada hoje.</p>
            )}
          </Painel>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Painel
            titulo="Operação agora"
            semPadding
            className="xl:col-span-2"
            acao={
              <button
                onClick={() => navigate('tracking')}
                className="flex items-center gap-1 text-meta font-bold text-brand-800 hover:underline"
              >
                Rastreamento <ArrowRight size={13} />
              </button>
            }
          >
            <button onClick={() => navigate('tracking')} className="block w-full">
              <MapCanvas
                stops={paradasEmRota}
                vehicles={vehicles}
                position={position}
                showLabels
                interactive={false}
                className="h-[22rem] w-full"
              />
            </button>
            <div className="flex divide-x divide-shell-200 border-t border-shell-200">
              {emRota.map((v) => {
                const rota = routes.find((r) => r.id === v.routeId);
                const p = rota ? routeProgress(rota) : { done: 0, total: 0, ratio: 0 };
                return (
                  <button
                    key={v.id}
                    onClick={() => navigate('vehicle', { vehicleId: v.id })}
                    className="flex-1 px-4 py-3 text-left hover:bg-shell-50"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-shell-900">{v.name}</span>
                      <span className="text-meta tnum text-shell-600">
                        {p.done}/{p.total} paradas
                      </span>
                    </div>
                    <div className="mt-2">
                      <Progress value={p.ratio} tone="ok" />
                    </div>
                  </button>
                );
              })}
              {emRota.length === 0 && (
                <div className="flex-1 px-4 py-4 text-center text-meta text-shell-500">
                  Nenhum veículo em rota
                </div>
              )}
            </div>
          </Painel>

          <Painel
            titulo="Alertas"
            acao={
              naoLidas.length > 0 ? (
                <span className="rounded-full bg-bad-50 px-2 py-0.5 text-micro font-bold text-bad-700">
                  {naoLidas.length} novos
                </span>
              ) : undefined
            }
          >
            <div className="space-y-2.5">
              {baixo.slice(0, 2).map((s) => {
                const p = products.find((x) => x.id === s.productId)!;
                return (
                  <AlertCard
                    key={s.productId}
                    tone={stockLevel(s) === 'critico' ? 'bad' : 'warn'}
                    title="Estoque baixo"
                    body={`${p.name} com ${num(available(s))} cx — mínimo ${num(s.minimum)}.`}
                    onClick={() => navigate('product', { productId: p.id })}
                  />
                );
              })}
              {vencidas.slice(0, 2).map((a) => (
                <AlertCard
                  key={a.id}
                  tone="bad"
                  title="Pagamento vencido"
                  body={`${a.partyName} — ${money(a.amount - a.paidAmount)} em atraso.`}
                  onClick={() => navigate('receivable', { accountId: a.id })}
                />
              ))}
              {vencendo.slice(0, 2).map((b) => {
                const p = products.find((x) => x.id === b.productId)!;
                return (
                  <AlertCard
                    key={b.id}
                    tone="warn"
                    title="Próximo da validade"
                    body={`Lote ${b.code} de ${p.name} vence em ${daysUntil(b.expiresAt)} dias.`}
                    onClick={() => navigate('product', { productId: p.id })}
                  />
                );
              })}
              {baixo.length + vencidas.length + vencendo.length === 0 && (
                <p className="text-body text-shell-500">Nenhum alerta em aberto.</p>
              )}
            </div>
          </Painel>
        </div>
      </div>
    </Pagina>
  );
}
