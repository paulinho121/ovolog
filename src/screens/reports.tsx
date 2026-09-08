import { useMemo, useState } from 'react';
import { AppBar, Screen } from '../components/layout/chrome';
import { Card, Divider, KeyValue, SectionTitle, Stat } from '../components/ui/primitives';
import { Segmented } from '../components/ui/forms';
import { BarChart, LineChart, RankBars, Sparkline } from '../components/charts';
import { useApp } from '../store/app';
import { products, users } from '../data/catalog';
import { orderBoxes, orderCost, orderTotal, routeSummary } from '../lib/domain';
import { money, moneyAxis, moneyShort, num, pct, km } from '../lib/format';

/* Relatórios em cards e gráficos, nunca em tabela: numa tela de 390px uma
   tabela vira rolagem horizontal, que é exatamente o que o app evita.

   Todas as séries aqui são únicas — a cor não carrega identidade, só
   destaque —, e cada barra vem com rótulo e valor escritos. */

type Period = 7 | 15 | 30;

export function ReportsScreen() {
  const { orders, customers, routes, returns } = useApp();
  const [period, setPeriod] = useState<Period>(7);

  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  /* Série diária: um ponto por dia do período, inclusive dias sem venda —
     buracos escondidos distorcem a leitura da tendência. */
  const daily = useMemo(() => {
    const days: { label: string; value: number; boxes: number; margin: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = startOfDay(d).getTime();
      const dayOrders = orders.filter((o) => startOfDay(new Date(o.createdAt)).getTime() === key);
      const revenue = dayOrders.reduce((s, o) => s + orderTotal(o), 0);
      const cost = dayOrders.reduce((s, o) => s + orderCost(o, products), 0);
      days.push({
        label: period === 7 ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()] : String(d.getDate()),
        value: revenue,
        boxes: dayOrders.reduce((s, o) => s + orderBoxes(o), 0),
        margin: revenue > 0 ? (revenue - cost) / revenue : 0,
      });
    }
    return days;
  }, [orders, period]);

  const periodOrders = useMemo(() => {
    const limit = new Date(today);
    limit.setDate(limit.getDate() - period);
    return orders.filter((o) => new Date(o.createdAt) >= limit);
  }, [orders, period]);

  const revenue = periodOrders.reduce((s, o) => s + orderTotal(o), 0);
  const cost = periodOrders.reduce((s, o) => s + orderCost(o, products), 0);
  const margin = revenue > 0 ? (revenue - cost) / revenue : 0;
  const boxes = periodOrders.reduce((s, o) => s + orderBoxes(o), 0);

  const bySeller = useMemo(() => {
    const tally = new Map<string, number>();
    periodOrders.forEach((o) => tally.set(o.sellerId, (tally.get(o.sellerId) ?? 0) + orderTotal(o)));
    return [...tally.entries()]
      .map(([id, value]) => ({
        label: users.find((u) => u.id === id)?.name.split(' ')[0] ?? id,
        value,
        hint: `${periodOrders.filter((o) => o.sellerId === id).length} pedidos`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [periodOrders]);

  const byProduct = useMemo(() => {
    const tally = new Map<string, number>();
    periodOrders.forEach((o) =>
      o.items.forEach((i) => tally.set(i.productId, (tally.get(i.productId) ?? 0) + i.quantity)),
    );
    return [...tally.entries()]
      .map(([id, value]) => {
        const p = products.find((x) => x.id === id)!;
        return { label: p.name, value, hint: `${money(value * p.price)} em vendas` };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [periodOrders]);

  const byCustomer = useMemo(() => {
    const tally = new Map<string, number>();
    periodOrders.forEach((o) =>
      tally.set(o.customerId, (tally.get(o.customerId) ?? 0) + orderTotal(o)),
    );
    return [...tally.entries()]
      .map(([id, value]) => ({
        label: customers.find((c) => c.id === id)?.tradeName ?? id,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [periodOrders, customers]);

  const routeStats = useMemo(() => {
    const done = routes.filter((r) => r.status !== 'planejada');
    const distance = done.reduce((s, r) => s + r.distanceKm, 0);
    const sales = done.reduce((s, r) => {
      const ret = returns.filter((x) => x.routeId === r.id).reduce((a, b) => a + b.boxes, 0);
      return s + routeSummary(r, orders, ret).sales;
    }, 0);
    const stops = done.reduce((s, r) => s + r.stops.length, 0);
    return {
      routes: done.length,
      distance,
      sales,
      stops,
      // Custo estimado por km — combustível + manutenção rateados.
      costPerKm: 2.35,
      salesPerKm: distance > 0 ? sales / distance : 0,
    };
  }, [routes, orders, returns]);

  return (
    <>
      <AppBar title="Relatórios" />
      <Screen>
        <div className="p-4">
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 7, label: '7 dias' },
              { value: 15, label: '15 dias' },
              { value: 30, label: '30 dias' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 px-4">
          <Stat
            label="Faturamento"
            value={moneyShort(revenue)}
            hint={`${num(periodOrders.length)} pedidos`}
            tone="brand"
          />
          <Stat
            label="Margem bruta"
            value={pct(margin)}
            hint={moneyShort(revenue - cost)}
            tone={margin > 0.2 ? 'ok' : 'warn'}
            icon={<Sparkline values={daily.map((d) => d.margin)} tone="ok" />}
          />
          <Stat label="Caixas vendidas" value={num(boxes)} hint={`${period} dias`} />
          <Stat
            label="Ticket médio"
            value={moneyShort(periodOrders.length ? revenue / periodOrders.length : 0)}
            hint="por pedido"
          />
        </div>

        <div className="p-4">
          <SectionTitle>Vendas por dia</SectionTitle>
          <Card className="p-4">
            <BarChart
              data={daily.map((d) => ({ label: d.label, value: d.value }))}
              formatValue={moneyAxis}
              label={`Faturamento diário nos últimos ${period} dias`}
            />
            <p className="mt-2 text-center text-meta text-shell-500">
              Toque numa barra para ver o valor do dia
            </p>
          </Card>
        </div>

        <div className="px-4">
          <SectionTitle>Caixas por dia</SectionTitle>
          <Card className="p-4">
            <LineChart
              data={daily.map((d) => ({ label: d.label, value: d.boxes }))}
              formatValue={(v) => `${num(v)} cx`}
              label={`Caixas vendidas por dia nos últimos ${period} dias`}
            />
          </Card>
        </div>

        <div className="p-4">
          <SectionTitle>Ranking de vendedores</SectionTitle>
          <Card className="p-4">
            <RankBars data={bySeller} formatValue={moneyShort} label="Faturamento por vendedor" />
          </Card>
        </div>

        <div className="px-4">
          <SectionTitle>Produtos mais vendidos</SectionTitle>
          <Card className="p-4">
            <RankBars
              data={byProduct}
              formatValue={(v) => `${num(v)} cx`}
              label="Caixas vendidas por produto"
            />
          </Card>
        </div>

        <div className="p-4">
          <SectionTitle>Clientes que mais compram</SectionTitle>
          <Card className="p-4">
            <RankBars data={byCustomer} formatValue={moneyShort} label="Faturamento por cliente" />
          </Card>
        </div>

        <div className="px-4 pb-4">
          <SectionTitle>Rotas</SectionTitle>
          <Card className="px-4 py-1">
            <KeyValue label="Rotas executadas" value={num(routeStats.routes)} />
            <Divider />
            <KeyValue label="Paradas planejadas" value={num(routeStats.stops)} />
            <Divider />
            <KeyValue label="Distância total" value={km(routeStats.distance)} />
            <Divider />
            <KeyValue label="Custo por km" value={money(routeStats.costPerKm)} />
            <Divider />
            <KeyValue
              label="Venda por km"
              value={money(routeStats.salesPerKm)}
              tone={routeStats.salesPerKm > routeStats.costPerKm ? 'ok' : 'warn'}
              strong
            />
          </Card>
          <p className="mt-2 px-1 text-meta text-shell-500">
            Custo por km é uma estimativa fixa de combustível e manutenção rateados.
          </p>
        </div>
      </Screen>
    </>
  );
}
