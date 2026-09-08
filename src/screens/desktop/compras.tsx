import { useMemo, useState } from 'react';
import { Check, Plus, ShoppingBag, X } from 'lucide-react';
import {
  BotaoD,
  Campo,
  Coluna,
  DetalheVazio,
  Indicador,
  Pagina,
  Painel,
  Tabela,
} from '../../components/desktop/ui';
import { Badge } from '../../components/ui/primitives';
import { useApp } from '../../store/app';
import { products, suppliers } from '../../data/catalog';
import { fullDate, money, num, shortDate } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { Purchase, PurchaseItem } from '../../types';

/* Compras em desktop.
 *
 * A grande diferença para o celular está no cadastro: no aparelho a compra é
 * um assistente de 5 etapas porque só cabe uma pergunta por tela. Aqui tudo
 * aparece de uma vez — fornecedor, itens, custos e lote —, que é como alguém
 * lança nota fiscal sentado, comparando com o papel ao lado. */

export function ComprasDesktop() {
  const { purchases, receivePurchase } = useApp();
  const [modo, setModo] = useState<'lista' | 'nova'>('lista');
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);

  const abertas = purchases.filter((p) => p.status === 'aberta');
  const caixasAbertas = abertas.reduce((s, p) => s + p.items.reduce((x, i) => x + i.boxes, 0), 0);
  const valorAberto = abertas.reduce(
    (s, p) => s + p.items.reduce((x, i) => x + i.boxes * i.unitCost, 0),
    0,
  );
  const hoje = purchases
    .filter((p) => new Date(p.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, p) => s + p.items.reduce((x, i) => x + i.boxes * i.unitCost, 0), 0);

  const selecionada = purchases.find((p) => p.id === selecionadaId);
  const valorDe = (p: Purchase) => p.items.reduce((x, i) => x + i.boxes * i.unitCost, 0);
  const caixasDe = (p: Purchase) => p.items.reduce((x, i) => x + i.boxes, 0);

  const colunas: Coluna<Purchase>[] = [
    {
      chave: 'numero',
      titulo: 'Compra',
      largura: '7rem',
      ordenar: (p) => Number(p.number),
      render: (p) => <span className="font-semibold tnum text-shell-900">#{p.number}</span>,
    },
    {
      chave: 'fornecedor',
      titulo: 'Fornecedor',
      ordenar: (p) => suppliers.find((s) => s.id === p.supplierId)?.name ?? '',
      render: (p) => (
        <span className="font-medium text-shell-900">
          {suppliers.find((s) => s.id === p.supplierId)?.name ?? '—'}
        </span>
      ),
    },
    {
      chave: 'criada',
      titulo: 'Lançada',
      ordenar: (p) => p.createdAt,
      render: (p) => <span className="text-shell-600">{shortDate(p.createdAt)}</span>,
    },
    {
      chave: 'prevista',
      titulo: 'Prevista',
      ordenar: (p) => p.expectedAt,
      render: (p) => <span className="text-shell-600">{shortDate(p.expectedAt)}</span>,
    },
    {
      chave: 'caixas',
      titulo: 'Caixas',
      numerico: true,
      largura: '6rem',
      ordenar: caixasDe,
      render: (p) => num(caixasDe(p)),
    },
    {
      chave: 'status',
      titulo: 'Status',
      largura: '9rem',
      ordenar: (p) => p.status,
      render: (p) => (
        <Badge tone={p.status === 'recebida' ? 'ok' : p.status === 'aberta' ? 'info' : 'neutral'}>
          {p.status === 'recebida' ? 'Recebida' : p.status === 'aberta' ? 'Aberta' : 'Cancelada'}
        </Badge>
      ),
    },
    {
      chave: 'valor',
      titulo: 'Valor',
      numerico: true,
      largura: '9rem',
      ordenar: valorDe,
      render: (p) => <span className="font-semibold text-shell-900">{money(valorDe(p))}</span>,
    },
  ];

  if (modo === 'nova') {
    return <NovaCompraDesktop aoFechar={() => setModo('lista')} />;
  }

  return (
    <Pagina
      titulo="Compras"
      subtitulo={`${abertas.length} pedidos abertos • ${money(valorAberto)} a receber`}
      acoes={
        <BotaoD variante="primario" icone={<Plus size={15} />} onClick={() => setModo('nova')}>
          Nova compra
        </BotaoD>
      }
    >
      <div className="space-y-5 p-8 pt-5">
        <div className="grid grid-cols-4 gap-4">
          <Indicador rotulo="Compras hoje" valor={money(hoje)} tom="marca" />
          <Indicador rotulo="Pedidos abertos" valor={num(abertas.length)} />
          <Indicador rotulo="A receber" valor={`${num(caixasAbertas)} cx`} />
          <Indicador rotulo="Valor em aberto" valor={money(valorAberto)} />
        </div>

        <div className="flex min-h-0 overflow-hidden rounded-card border border-shell-200 bg-white shadow-card">
          <div className="min-w-0 flex-1">
            <Tabela
              itens={purchases}
              colunas={colunas}
              chaveDe={(p) => p.id}
              selecionadoId={selecionadaId ?? undefined}
              aoClicar={(p) => setSelecionadaId(p.id)}
              ordemInicial={{ chave: 'criada', asc: false }}
              vazio={
                <DetalheVazio
                  icone={<ShoppingBag size={26} />}
                  mensagem="Nenhuma compra registrada ainda."
                />
              }
            />
          </div>

          {selecionada && (
            <aside className="flex w-[24rem] shrink-0 flex-col overflow-y-auto border-l border-shell-200">
              <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-shell-200 bg-white px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-subtitle font-bold text-shell-900">
                    Compra #{selecionada.number}
                  </h2>
                  <p className="truncate text-meta text-shell-600">
                    {suppliers.find((s) => s.id === selecionada.supplierId)?.name}
                  </p>
                </div>
                <button
                  onClick={() => setSelecionadaId(null)}
                  aria-label="Fechar detalhe"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-shell-500 hover:bg-shell-100"
                >
                  <X size={16} />
                </button>
              </header>

              <div className="space-y-5 p-5">
                <dl className="grid grid-cols-2 gap-4">
                  <Campo rotulo="Lançada" valor={fullDate(selecionada.createdAt)} />
                  <Campo rotulo="Prevista" valor={fullDate(selecionada.expectedAt)} />
                  <Campo rotulo="Caixas" valor={`${num(caixasDe(selecionada))} cx`} />
                  <Campo rotulo="Valor" valor={money(valorDe(selecionada))} />
                </dl>

                <div className="border-t border-shell-200 pt-4">
                  <h3 className="mb-2 text-meta font-bold uppercase tracking-wide text-shell-500">
                    Itens
                  </h3>
                  <ul className="divide-y divide-shell-200 rounded-lg border border-shell-200">
                    {selecionada.items.map((i) => {
                      const p = products.find((x) => x.id === i.productId);
                      return (
                        <li key={i.productId} className="px-3 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-meta font-semibold text-shell-900">
                              {p?.emoji} {p?.name}
                            </span>
                            <span className="text-meta font-bold tnum text-shell-900">
                              {money(i.boxes * i.unitCost)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-micro tnum text-shell-500">
                            {num(i.boxes)} cx × {money(i.unitCost)} • lote {i.batchCode} • vence{' '}
                            {shortDate(i.expiresAt)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {selecionada.status === 'aberta' && (
                  <BotaoD
                    variante="primario"
                    icone={<Check size={15} />}
                    className="w-full justify-center"
                    onClick={() => receivePurchase(selecionada.id)}
                  >
                    Registrar entrada no estoque
                  </BotaoD>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </Pagina>
  );
}

/* ------------------------------------------------------------ Nova compra */

function NovaCompraDesktop({ aoFechar }: { aoFechar: () => void }) {
  const { createPurchase } = useApp();
  const [fornecedorId, setFornecedorId] = useState('');
  const [lote, setLote] = useState('');
  const [dias, setDias] = useState(28);
  const [linhas, setLinhas] = useState<Record<string, { caixas: number; custo: number }>>({});

  const validade = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString();
  }, [dias]);

  const escolhidos = Object.entries(linhas).filter(([, v]) => v.caixas > 0);
  const total = escolhidos.reduce((s, [, v]) => s + v.caixas * v.custo, 0);
  const caixas = escolhidos.reduce((s, [, v]) => s + v.caixas, 0);
  const podeSalvar = Boolean(fornecedorId) && escolhidos.length > 0 && lote.trim().length > 0;

  function definir(id: string, campo: 'caixas' | 'custo', valor: number) {
    setLinhas((prev) => {
      const atual = prev[id] ?? {
        caixas: 0,
        custo: products.find((p) => p.id === id)?.cost ?? 0,
      };
      return { ...prev, [id]: { ...atual, [campo]: valor } };
    });
  }

  function salvar() {
    const items: PurchaseItem[] = escolhidos.map(([produtoId, v]) => ({
      productId: produtoId,
      boxes: v.caixas,
      unitCost: v.custo,
      batchCode: lote,
      expiresAt: validade,
    }));
    createPurchase({ supplierId: fornecedorId, items, expectedAt: validade });
    aoFechar();
  }

  return (
    <Pagina
      titulo="Nova compra"
      subtitulo="Fornecedor, itens, custos e lote na mesma tela."
      acoes={
        <>
          <BotaoD onClick={aoFechar}>Cancelar</BotaoD>
          <BotaoD variante="primario" disabled={!podeSalvar} onClick={salvar}>
            Registrar compra
          </BotaoD>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 p-8 pt-5 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-5">
          <Painel titulo="Fornecedor">
            <div className="space-y-2">
              {suppliers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setFornecedorId(s.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border-2 px-3 py-2.5 text-left transition-colors',
                    fornecedorId === s.id
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-shell-200 hover:bg-shell-50',
                  )}
                >
                  <span>
                    <span className="block text-meta font-semibold text-shell-900">{s.name}</span>
                    <span className="block text-micro text-shell-500">{s.city}</span>
                  </span>
                  {fornecedorId === s.id && <Check size={16} className="text-brand-700" />}
                </button>
              ))}
            </div>
          </Painel>

          <Painel titulo="Lote e validade">
            <label className="block">
              <span className="mb-1.5 block text-meta font-semibold text-shell-700">
                Código do lote
              </span>
              <input
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="#0910"
                className="h-9 w-full rounded-lg border border-shell-300 px-3 text-meta focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </label>
            <div className="mt-4">
              <span className="mb-1.5 block text-meta font-semibold text-shell-700">Validade</span>
              <div className="flex gap-2">
                {[14, 21, 28, 35].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDias(d)}
                    className={cn(
                      'h-9 flex-1 rounded-lg text-meta font-bold transition-colors',
                      dias === d
                        ? 'bg-brand-700 text-white'
                        : 'border border-shell-300 text-shell-700 hover:bg-shell-100',
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <p className="mt-2 text-meta text-shell-600">
                Vence em <strong className="text-shell-900">{fullDate(validade)}</strong>
              </p>
            </div>
          </Painel>
        </div>

        <Painel titulo="Itens da compra" semPadding>
          <table className="w-full border-collapse text-meta">
            <thead>
              <tr className="bg-shell-100">
                <th className="border-b border-shell-200 px-4 py-2.5 text-left font-semibold text-shell-600">
                  Produto
                </th>
                <th className="w-32 border-b border-shell-200 px-4 py-2.5 text-right font-semibold text-shell-600">
                  Caixas
                </th>
                <th className="w-36 border-b border-shell-200 px-4 py-2.5 text-right font-semibold text-shell-600">
                  Custo / cx
                </th>
                <th className="w-32 border-b border-shell-200 px-4 py-2.5 text-right font-semibold text-shell-600">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const linha = linhas[p.id] ?? { caixas: 0, custo: p.cost };
                const ativo = linha.caixas > 0;
                return (
                  <tr
                    key={p.id}
                    className={cn('border-b border-shell-200/70', ativo && 'bg-brand-50')}
                  >
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-lg bg-shell-100">
                          {p.emoji}
                        </span>
                        <span className="font-semibold text-shell-900">{p.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={linha.caixas || ''}
                        placeholder="0"
                        onChange={(e) => definir(p.id, 'caixas', Number(e.target.value) || 0)}
                        className="h-9 w-24 rounded-lg border border-shell-300 px-2 text-right tnum focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={linha.custo}
                        onChange={(e) => definir(p.id, 'custo', Number(e.target.value) || 0)}
                        className="h-9 w-28 rounded-lg border border-shell-300 px-2 text-right tnum focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tnum text-shell-900">
                      {linha.caixas > 0 ? money(linha.caixas * linha.custo) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-shell-100">
                <td className="px-4 py-3 font-bold text-shell-900">
                  Total {caixas > 0 && <span className="font-normal text-shell-600">({num(caixas)} cx)</span>}
                </td>
                <td colSpan={2} />
                <td className="px-4 py-3 text-right text-subtitle font-bold tnum text-shell-900">
                  {money(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Painel>
      </div>
    </Pagina>
  );
}
