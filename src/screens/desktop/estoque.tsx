import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, ShieldAlert, X } from 'lucide-react';
import {
  BotaoD,
  BuscaD,
  Campo,
  Coluna,
  DetalheVazio,
  Indicador,
  Pagina,
  Tabela,
} from '../../components/desktop/ui';
import { Badge, Progress } from '../../components/ui/primitives';
import { STOCK_MOVE_LABEL } from '../../components/domain';
import { useApp } from '../../store/app';
import { useNav } from '../../store/navigation';
import { products, suppliers } from '../../data/catalog';
import { available, expiringBatches, stockLevel } from '../../lib/domain';
import { dateTime, daysUntil, fullDate, money, num, pct } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { StockItem } from '../../types';

/* Estoque em desktop: saldo, reserva, disponível, mínimo e margem na mesma
   linha. No celular esses números moram em cards separados porque não cabem
   juntos; aqui cabem, e comparar produto a produto passa a ser possível. */

export function EstoqueDesktop() {
  const { stock, stockMoves } = useApp();
  const { navigate } = useNav();
  const [busca, setBusca] = useState('');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const nome = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  const lista = useMemo(
    () => stock.filter((s) => nome(s.productId).toLowerCase().includes(busca.toLowerCase())),
    [stock, busca],
  );

  const totalCaixas = stock.reduce((s, i) => s + i.onHand, 0);
  const reservado = stock.reduce((s, i) => s + i.reserved, 0);
  const baixo = stock.filter((s) => stockLevel(s) !== 'normal');
  const vencendo = expiringBatches(stock, 7);
  const valorEstoque = stock.reduce((s, i) => {
    const p = products.find((x) => x.id === i.productId);
    return s + (p ? p.cost * i.onHand : 0);
  }, 0);

  const selecionado = stock.find((s) => s.productId === selecionadoId);

  const todasColunas: Coluna<StockItem>[] = [
    {
      chave: 'produto',
      titulo: 'Produto',
      largura: '15rem',
      ordenar: (s) => nome(s.productId),
      render: (s) => {
        const p = products.find((x) => x.id === s.productId);
        return (
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-shell-100">
              {p?.emoji}
            </span>
            <span className="truncate whitespace-nowrap font-semibold text-shell-900">
              {p?.name}
            </span>
          </div>
        );
      },
    },
    {
      chave: 'onHand',
      titulo: 'Em estoque',
      numerico: true,
      ordenar: (s) => s.onHand,
      render: (s) => num(s.onHand),
    },
    {
      chave: 'reservado',
      titulo: 'Reservado',
      numerico: true,
      ordenar: (s) => s.reserved,
      render: (s) => <span className="text-shell-600">{num(s.reserved)}</span>,
    },
    {
      chave: 'disponivel',
      titulo: 'Disponível',
      numerico: true,
      ordenar: available,
      render: (s) => <span className="font-semibold text-shell-900">{num(available(s))}</span>,
    },
    {
      chave: 'minimo',
      titulo: 'Mínimo',
      numerico: true,
      ordenar: (s) => s.minimum,
      render: (s) => <span className="text-shell-500">{num(s.minimum)}</span>,
    },
    {
      chave: 'nivel',
      titulo: 'Nível',
      largura: '11rem',
      ordenar: (s) => available(s) / Math.max(s.minimum, 1),
      render: (s) => {
        const n = stockLevel(s);
        const tom = n === 'critico' ? 'bad' : n === 'baixo' ? 'warn' : 'ok';
        return (
          <div className="flex items-center gap-2">
            <Progress value={available(s) / Math.max(s.minimum * 2.5, 1)} tone={tom} className="w-16" />
            <Badge tone={tom}>{n === 'critico' ? 'Crítico' : n === 'baixo' ? 'Baixo' : 'Normal'}</Badge>
          </div>
        );
      },
    },
    {
      chave: 'lotes',
      titulo: 'Lotes',
      numerico: true,
      largura: '6rem',
      ordenar: (s) => s.batches.length,
      render: (s) => {
        const urgentes = s.batches.filter((b) => daysUntil(b.expiresAt) <= 7).length;
        return (
          <span className={urgentes > 0 ? 'font-semibold text-warn-700' : 'text-shell-600'}>
            {s.batches.length}
            {urgentes > 0 && ` (${urgentes}!)`}
          </span>
        );
      },
    },
    {
      chave: 'margem',
      titulo: 'Margem',
      numerico: true,
      largura: '7rem',
      ordenar: (s) => {
        const p = products.find((x) => x.id === s.productId);
        return p ? (p.price - p.cost) / p.price : 0;
      },
      render: (s) => {
        const p = products.find((x) => x.id === s.productId);
        if (!p) return '—';
        const m = (p.price - p.cost) / p.price;
        return <span className={m > 0.2 ? 'text-ok-700' : 'text-warn-700'}>{pct(m)}</span>;
      },
    },
  ];

  /* Com o painel de detalhe aberto sobra pouca largura para oito colunas.
     Mínimo, lotes e margem saem da tabela porque o painel já os mostra —
     esconder o que está duplicado é melhor que empurrar a tabela para uma
     barra de rolagem horizontal. */
  const colunas = selecionado
    ? todasColunas.filter((c) => !['minimo', 'lotes', 'margem'].includes(c.chave))
    : todasColunas;

  return (
    <Pagina
      titulo="Estoque"
      subtitulo={`${num(totalCaixas)} caixas • ${money(valorEstoque)} a custo`}
      acoes={
        <>
          <BotaoD onClick={() => navigate('purchases')}>Compras</BotaoD>
          <BotaoD variante="primario" icone={<Boxes size={15} />} onClick={() => navigate('stock-move')}>
            Movimentar
          </BotaoD>
        </>
      }
      barra={<BuscaD value={busca} onChange={setBusca} placeholder="Buscar produto" className="w-96" />}
    >
      <div className="space-y-5 p-8 pt-5">
        <div className="grid grid-cols-4 gap-4">
          <Indicador rotulo="Estoque total" valor={`${num(totalCaixas)} cx`} tom="marca" />
          <Indicador rotulo="Reservado" valor={`${num(reservado)} cx`} detalhe="em pedidos" />
          <Indicador
            rotulo="Estoque baixo"
            valor={num(baixo.length)}
            detalhe="produtos abaixo do mínimo"
            tom={baixo.length ? 'atencao' : 'ok'}
          />
          <Indicador
            rotulo="Perto da validade"
            valor={num(vencendo.length)}
            detalhe="lotes em até 7 dias"
            tom={vencendo.length ? 'atencao' : 'ok'}
          />
        </div>

        {vencendo.length > 0 && (
          <div className="flex items-start gap-3 rounded-card border border-warn-500/30 bg-warn-50 p-4">
            <ShieldAlert size={20} className="mt-0.5 shrink-0 text-warn-700" />
            <div>
              <div className="font-bold text-warn-700">Prioridade FEFO</div>
              <p className="mt-0.5 text-meta text-warn-700">
                {vencendo
                  .slice(0, 3)
                  .map((b) => `${b.code} (${products.find((p) => p.id === b.productId)?.name}, ${daysUntil(b.expiresAt)}d)`)
                  .join(' • ')}
                {vencendo.length > 3 && ` e mais ${vencendo.length - 3}`}
              </p>
            </div>
          </div>
        )}

        <div className="flex min-h-0 overflow-hidden rounded-card border border-shell-200 bg-white shadow-card">
          <div className="min-w-0 flex-1">
            <Tabela
              itens={lista}
              colunas={colunas}
              chaveDe={(s) => s.productId}
              selecionadoId={selecionadoId ?? undefined}
              aoClicar={(s) => setSelecionadoId(s.productId)}
              ordemInicial={{ chave: 'disponivel', asc: true }}
              vazio={<DetalheVazio icone={<Boxes size={26} />} mensagem="Nenhum produto encontrado." />}
            />
          </div>

          {selecionado && (
            <PainelProduto
              item={selecionado}
              movimentacoes={stockMoves.filter((m) => m.productId === selecionado.productId)}
              aoFechar={() => setSelecionadoId(null)}
              aoMovimentar={() => navigate('stock-move', { productId: selecionado.productId })}
            />
          )}
        </div>
      </div>
    </Pagina>
  );
}

function PainelProduto({
  item,
  movimentacoes,
  aoFechar,
  aoMovimentar,
}: {
  item: StockItem;
  movimentacoes: ReturnType<typeof useApp>['stockMoves'];
  aoFechar: () => void;
  aoMovimentar: () => void;
}) {
  const produto = products.find((p) => p.id === item.productId);
  const lotes = [...item.batches].sort((a, b) => daysUntil(a.expiresAt) - daysUntil(b.expiresAt));

  return (
    <aside className="flex w-[24rem] shrink-0 flex-col overflow-y-auto border-l border-shell-200">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-shell-200 bg-white px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-subtitle font-bold text-shell-900">{produto?.name}</h2>
          <p className="text-meta text-shell-600">
            {money(produto?.price ?? 0)} / {produto?.unit}
          </p>
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
        <dl className="grid grid-cols-2 gap-4">
          <Campo rotulo="Disponível" valor={`${num(available(item))} cx`} />
          <Campo rotulo="Reservado" valor={`${num(item.reserved)} cx`} />
          <Campo rotulo="Custo médio" valor={money(produto?.cost ?? 0)} />
          <Campo rotulo="Mínimo" valor={`${num(item.minimum)} cx`} />
        </dl>

        <BotaoD variante="secundario" className="w-full justify-center" onClick={aoMovimentar}>
          Movimentar este produto
        </BotaoD>

        <div className="border-t border-shell-200 pt-4">
          <h3 className="mb-2 text-meta font-bold uppercase tracking-wide text-shell-500">
            Lotes ({lotes.length})
          </h3>
          <ul className="space-y-2">
            {lotes.map((b) => {
              const dias = daysUntil(b.expiresAt);
              const urgente = dias <= 7;
              return (
                <li
                  key={b.id}
                  className={cn(
                    'rounded-lg border p-3',
                    urgente ? 'border-warn-500/40 bg-warn-50' : 'border-shell-200',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-shell-900">Lote {b.code}</span>
                    <Badge tone={urgente ? 'warn' : 'neutral'}>
                      {dias < 0 ? 'Vencido' : `${dias} dias`}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between text-micro text-shell-600">
                    <span>
                      {suppliers.find((s) => s.id === b.supplierId)?.name} • {fullDate(b.expiresAt)}
                    </span>
                    <span className="font-bold tnum text-shell-900">{num(b.boxes)} cx</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-shell-200 pt-4">
          <h3 className="mb-2 text-meta font-bold uppercase tracking-wide text-shell-500">
            Movimentações
          </h3>
          {movimentacoes.length === 0 ? (
            <p className="text-meta text-shell-500">Nada registrado.</p>
          ) : (
            <ul className="divide-y divide-shell-200">
              {movimentacoes.slice(0, 10).map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 py-2.5">
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-lg',
                      m.kind === 'entrada'
                        ? 'bg-ok-50 text-ok-700'
                        : m.kind === 'perda'
                          ? 'bg-bad-50 text-bad-700'
                          : 'bg-shell-100 text-shell-600',
                    )}
                  >
                    {m.kind === 'entrada' ? <ArrowDownToLine size={13} /> : <ArrowUpFromLine size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-meta font-semibold text-shell-900">
                      {STOCK_MOVE_LABEL[m.kind]} • {num(m.boxes)} cx
                    </span>
                    <span className="block truncate text-micro text-shell-500">
                      {m.note} — {dateTime(m.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
