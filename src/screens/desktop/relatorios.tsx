import { useMemo, useState } from 'react';
import { FiltroD, Indicador, Pagina, Painel } from '../../components/desktop/ui';
import { BarChart, LineChart, RankBars, Sparkline } from '../../components/charts';
import { useApp } from '../../store/app';
import { products, users } from '../../data/catalog';
import { orderBoxes, orderCost, orderTotal, routeSummary } from '../../lib/domain';
import { km, money, moneyAxis, moneyShort, num, pct } from '../../lib/format';

/* Relatórios em desktop: os mesmos números do celular, mas lado a lado.
   No aparelho é preciso rolar entre um gráfico e outro; aqui a comparação
   acontece de uma olhada, que é o que torna a tela útil para decidir. */

type Periodo = 7 | 15 | 30;

export function RelatoriosDesktop() {
  const { orders, customers, routes, returns } = useApp();
  const [periodo, setPeriodo] = useState<Periodo>(30);

  const hoje = new Date();
  const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diario = useMemo(() => {
    const dias: { label: string; value: number; caixas: number; margem: number }[] = [];
    for (let i = periodo - 1; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      const chave = inicioDoDia(d).getTime();
      const doDia = orders.filter((o) => inicioDoDia(new Date(o.createdAt)).getTime() === chave);
      const receita = doDia.reduce((s, o) => s + orderTotal(o), 0);
      const custo = doDia.reduce((s, o) => s + orderCost(o, products), 0);
      dias.push({
        label: periodo === 7 ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()] : String(d.getDate()),
        value: receita,
        caixas: doDia.reduce((s, o) => s + orderBoxes(o), 0),
        margem: receita > 0 ? (receita - custo) / receita : 0,
      });
    }
    return dias;
  }, [orders, periodo]);

  const doPeriodo = useMemo(() => {
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - periodo);
    return orders.filter((o) => new Date(o.createdAt) >= limite);
  }, [orders, periodo]);

  const receita = doPeriodo.reduce((s, o) => s + orderTotal(o), 0);
  const custo = doPeriodo.reduce((s, o) => s + orderCost(o, products), 0);
  const margem = receita > 0 ? (receita - custo) / receita : 0;
  const caixas = doPeriodo.reduce((s, o) => s + orderBoxes(o), 0);

  const porVendedor = useMemo(() => {
    const t = new Map<string, number>();
    doPeriodo.forEach((o) => t.set(o.sellerId, (t.get(o.sellerId) ?? 0) + orderTotal(o)));
    return [...t.entries()]
      .map(([id, value]) => ({
        label: users.find((u) => u.id === id)?.name.split(' ')[0] ?? id,
        value,
        hint: `${doPeriodo.filter((o) => o.sellerId === id).length} pedidos`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [doPeriodo]);

  const porProduto = useMemo(() => {
    const t = new Map<string, number>();
    doPeriodo.forEach((o) =>
      o.items.forEach((i) => t.set(i.productId, (t.get(i.productId) ?? 0) + i.quantity)),
    );
    return [...t.entries()]
      .map(([id, value]) => {
        const p = products.find((x) => x.id === id)!;
        return { label: p.name, value, hint: `${money(value * p.price)} em vendas` };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [doPeriodo]);

  const porCliente = useMemo(() => {
    const t = new Map<string, number>();
    doPeriodo.forEach((o) => t.set(o.customerId, (t.get(o.customerId) ?? 0) + orderTotal(o)));
    return [...t.entries()]
      .map(([id, value]) => ({
        label: customers.find((c) => c.id === id)?.tradeName ?? id,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [doPeriodo, customers]);

  const rotas = useMemo(() => {
    const feitas = routes.filter((r) => r.status !== 'planejada');
    const distancia = feitas.reduce((s, r) => s + r.distanceKm, 0);
    const vendas = feitas.reduce((s, r) => {
      const dev = returns.filter((x) => x.routeId === r.id).reduce((a, b) => a + b.boxes, 0);
      return s + routeSummary(r, orders, dev).sales;
    }, 0);
    return {
      rotas: feitas.length,
      paradas: feitas.reduce((s, r) => s + r.stops.length, 0),
      distancia,
      custoPorKm: 2.35,
      vendaPorKm: distancia > 0 ? vendas / distancia : 0,
    };
  }, [routes, orders, returns]);

  return (
    <Pagina
      titulo="Relatórios"
      subtitulo={`Últimos ${periodo} dias • ${num(doPeriodo.length)} pedidos`}
      barra={
        <FiltroD
          value={periodo}
          onChange={setPeriodo}
          options={[
            { value: 7, label: '7 dias' },
            { value: 15, label: '15 dias' },
            { value: 30, label: '30 dias' },
          ]}
        />
      }
    >
      <div className="space-y-5 p-8 pt-5">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <Indicador
            rotulo="Faturamento"
            valor={moneyShort(receita)}
            detalhe={`${num(doPeriodo.length)} pedidos`}
            tom="marca"
          />
          <Indicador
            rotulo="Margem bruta"
            valor={pct(margem)}
            detalhe={moneyShort(receita - custo)}
            tom={margem > 0.2 ? 'ok' : 'atencao'}
            grafico={<Sparkline values={diario.map((d) => d.margem)} tone="ok" />}
          />
          <Indicador rotulo="Caixas vendidas" valor={num(caixas)} detalhe={`em ${periodo} dias`} />
          <Indicador
            rotulo="Ticket médio"
            valor={moneyShort(doPeriodo.length ? receita / doPeriodo.length : 0)}
            detalhe="por pedido"
          />
          <Indicador
            rotulo="Venda por km"
            valor={money(rotas.vendaPorKm)}
            detalhe={`custo estimado ${money(rotas.custoPorKm)}`}
            tom={rotas.vendaPorKm > rotas.custoPorKm ? 'ok' : 'atencao'}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Painel titulo="Faturamento por dia">
            <BarChart
              data={diario.map((d) => ({ label: d.label, value: d.value }))}
              formatValue={moneyAxis}
              height={240}
              label={`Faturamento diário nos últimos ${periodo} dias`}
            />
          </Painel>
          <Painel titulo="Caixas por dia">
            <LineChart
              data={diario.map((d) => ({ label: d.label, value: d.caixas }))}
              formatValue={(v) => `${num(v)} cx`}
              height={240}
              label={`Caixas vendidas por dia nos últimos ${periodo} dias`}
            />
          </Painel>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Painel titulo="Ranking de vendedores">
            <RankBars data={porVendedor} formatValue={moneyShort} label="Faturamento por vendedor" />
          </Painel>
          <Painel titulo="Produtos mais vendidos">
            <RankBars
              data={porProduto}
              formatValue={(v) => `${num(v)} cx`}
              label="Caixas vendidas por produto"
            />
          </Painel>
          <Painel titulo="Clientes que mais compram">
            <RankBars data={porCliente} formatValue={moneyShort} label="Faturamento por cliente" />
          </Painel>
        </div>

        <Painel titulo="Rotas">
          <div className="grid grid-cols-2 gap-6 xl:grid-cols-5">
            <div>
              <div className="text-micro font-semibold uppercase tracking-wide text-shell-500">
                Rotas executadas
              </div>
              <div className="mt-1 text-title font-bold tnum text-shell-900">{num(rotas.rotas)}</div>
            </div>
            <div>
              <div className="text-micro font-semibold uppercase tracking-wide text-shell-500">
                Paradas planejadas
              </div>
              <div className="mt-1 text-title font-bold tnum text-shell-900">{num(rotas.paradas)}</div>
            </div>
            <div>
              <div className="text-micro font-semibold uppercase tracking-wide text-shell-500">
                Distância total
              </div>
              <div className="mt-1 text-title font-bold tnum text-shell-900">{km(rotas.distancia)}</div>
            </div>
            <div>
              <div className="text-micro font-semibold uppercase tracking-wide text-shell-500">
                Custo por km
              </div>
              <div className="mt-1 text-title font-bold tnum text-shell-900">
                {money(rotas.custoPorKm)}
              </div>
            </div>
            <div>
              <div className="text-micro font-semibold uppercase tracking-wide text-shell-500">
                Venda por km
              </div>
              <div
                className={`mt-1 text-title font-bold tnum ${
                  rotas.vendaPorKm > rotas.custoPorKm ? 'text-ok-700' : 'text-warn-700'
                }`}
              >
                {money(rotas.vendaPorKm)}
              </div>
            </div>
          </div>
          <p className="mt-4 text-meta text-shell-500">
            Custo por km é uma estimativa fixa de combustível e manutenção rateados.
          </p>
        </Painel>
      </div>
    </Pagina>
  );
}
