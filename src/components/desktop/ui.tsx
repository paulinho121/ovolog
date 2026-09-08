import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/* Primitivas da retaguarda em desktop.
 *
 * Mesmos tokens do app mobile — cor, raio, sombra e status são idênticos, o
 * produto continua um só. O que muda é a densidade: aqui há mouse, hover,
 * teclado e espaço horizontal, então a informação pode vir em tabela em vez
 * de card, e o detalhe abre ao lado em vez de empilhar telas. */

/* ---------------------------------------------------------------- Página */

export function Pagina({
  titulo,
  subtitulo,
  acoes,
  barra,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  /** Filtros e busca — uma linha só, acima do conteúdo. */
  barra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen min-w-0 flex-col bg-shell-100">
      <header className="shrink-0 border-b border-shell-200 bg-white px-8 pt-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-display font-bold tracking-tight text-shell-900">{titulo}</h1>
            {subtitulo && <p className="mt-1 text-body text-shell-600">{subtitulo}</p>}
          </div>
          {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
        </div>
        {barra ? <div className="flex items-center gap-3 py-4">{barra}</div> : <div className="h-6" />}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/** Botão de desktop: menor que o do celular e com hover, que aqui existe. */
export function BotaoD({
  children,
  onClick,
  variante = 'secundario',
  icone,
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variante?: 'primario' | 'secundario' | 'texto';
  icone?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const estilo = {
    primario: 'bg-brand-700 text-white hover:bg-brand-800',
    secundario: 'border border-shell-300 bg-white text-shell-800 hover:bg-shell-100',
    texto: 'text-shell-700 hover:bg-shell-200',
  }[variante];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-meta font-semibold',
        'transition-colors disabled:pointer-events-none disabled:opacity-40',
        estilo,
        className,
      )}
    >
      {icone}
      {children}
    </button>
  );
}

export function BuscaD({
  value,
  onChange,
  placeholder = 'Buscar',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-shell-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-9 w-full rounded-lg border border-shell-300 bg-white pl-9 pr-3',
          'text-meta text-shell-900 placeholder:text-shell-400',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200',
        )}
      />
    </div>
  );
}

/** Filtros como segmentos — o equivalente desktop dos chips do celular. */
export function FiltroD<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: NoInfer<T>;
  onChange: (v: NoInfer<T>) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-shell-300 bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 rounded px-3 text-meta font-semibold transition-colors',
            value === o.value
              ? 'bg-shell-900 text-white'
              : 'text-shell-600 hover:bg-shell-100',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('ml-1.5 tnum', value === o.value ? 'text-white/60' : 'text-shell-400')}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Tabela */

export interface Coluna<T> {
  chave: string;
  titulo: string;
  /** Conteúdo da célula. */
  render: (item: T) => ReactNode;
  /** Valor usado para ordenar; sem isso a coluna não é ordenável. */
  ordenar?: (item: T) => string | number;
  /** Números alinham à direita — é o que deixa a coluna comparável a olho. */
  numerico?: boolean;
  largura?: string;
}

export function Tabela<T>({
  itens,
  colunas,
  chaveDe,
  aoClicar,
  selecionadoId,
  vazio,
  ordemInicial,
}: {
  itens: T[];
  colunas: Coluna<T>[];
  chaveDe: (item: T) => string;
  aoClicar?: (item: T) => void;
  selecionadoId?: string;
  vazio?: ReactNode;
  ordemInicial?: { chave: string; asc: boolean };
}) {
  const [ordem, setOrdem] = useState(ordemInicial);

  const ordenados = useMemo(() => {
    if (!ordem) return itens;
    const coluna = colunas.find((c) => c.chave === ordem.chave);
    if (!coluna?.ordenar) return itens;
    const fn = coluna.ordenar;
    return [...itens].sort((a, b) => {
      const va = fn(a);
      const vb = fn(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR');
      return ordem.asc ? cmp : -cmp;
    });
  }, [itens, colunas, ordem]);

  if (itens.length === 0 && vazio) {
    return <div className="p-8">{vazio}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-meta">
        <thead>
          {/* Cabeçalho gruda no topo: rolar 200 linhas sem saber qual coluna
              se está olhando é o defeito clássico de tabela longa. */}
          <tr className="sticky top-0 z-10 bg-shell-100">
            {colunas.map((c) => {
              const ativa = ordem?.chave === c.chave;
              return (
                <th
                  key={c.chave}
                  style={{ width: c.largura }}
                  className={cn(
                    'border-b border-shell-200 px-4 py-2.5 text-left font-semibold text-shell-600',
                    c.numerico && 'text-right',
                  )}
                >
                  {c.ordenar ? (
                    <button
                      onClick={() =>
                        setOrdem({ chave: c.chave, asc: ativa ? !ordem!.asc : true })
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1 -mx-1 hover:text-shell-900',
                        ativa && 'text-shell-900',
                      )}
                    >
                      {c.titulo}
                      {ativa &&
                        (ordem!.asc ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                    </button>
                  ) : (
                    c.titulo
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenados.map((item) => {
            const id = chaveDe(item);
            const selecionado = id === selecionadoId;
            return (
              <tr
                key={id}
                onClick={aoClicar ? () => aoClicar(item) : undefined}
                className={cn(
                  'border-b border-shell-200/70 bg-white transition-colors',
                  aoClicar && 'cursor-pointer hover:bg-shell-50',
                  selecionado && 'bg-brand-50 hover:bg-brand-50',
                )}
              >
                {colunas.map((c) => (
                  <td
                    key={c.chave}
                    className={cn(
                      'px-4 py-2.5 align-middle text-shell-800',
                      c.numerico && 'text-right tnum',
                      selecionado && 'relative',
                    )}
                  >
                    {c.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------- Master-detail */

/* Lista à esquerda, detalhe à direita. O ganho real do desktop não é caber
   mais coisa, é não perder a lista ao abrir um item. */
export function MestreDetalhe({
  lista,
  detalhe,
  larguraLista = '30rem',
}: {
  lista: ReactNode;
  detalhe: ReactNode;
  larguraLista?: string;
}) {
  return (
    <div className="flex h-full min-h-0">
      <div
        className="min-h-0 shrink-0 overflow-y-auto border-r border-shell-200"
        style={{ width: larguraLista }}
      >
        {lista}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{detalhe}</div>
    </div>
  );
}

/** Estado do painel de detalhe quando nada foi selecionado ainda. */
export function DetalheVazio({ mensagem, icone }: { mensagem: string; icone?: ReactNode }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        {icone && (
          <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-shell-200 text-shell-500">
            {icone}
          </span>
        )}
        <p className="text-body text-shell-500">{mensagem}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Indicador */

export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
  grafico,
  aoClicar,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  tom?: 'neutro' | 'marca' | 'ok' | 'ruim' | 'atencao';
  grafico?: ReactNode;
  aoClicar?: () => void;
}) {
  const cor = {
    neutro: 'text-shell-900',
    marca: 'text-brand-800',
    ok: 'text-ok-700',
    ruim: 'text-bad-700',
    atencao: 'text-warn-700',
  }[tom];
  const Tag = (aoClicar ? 'button' : 'div') as 'div';
  return (
    <Tag
      onClick={aoClicar}
      className={cn(
        'rounded-card border border-shell-200 bg-white p-4 text-left shadow-card',
        aoClicar && 'w-full transition-colors hover:border-shell-300 hover:bg-shell-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-meta font-medium text-shell-600">{rotulo}</span>
        {grafico}
      </div>
      <div className={cn('mt-1.5 text-display font-bold tnum leading-none', cor)}>{valor}</div>
      {detalhe && <div className="mt-1.5 text-meta text-shell-500">{detalhe}</div>}
    </Tag>
  );
}

/** Bloco de conteúdo com título — o "card" do desktop. */
export function Painel({
  titulo,
  acao,
  children,
  className,
  semPadding,
}: {
  titulo?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  semPadding?: boolean;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-card border border-shell-200 bg-white shadow-card',
        className,
      )}
    >
      {titulo && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-shell-200 px-4 py-3">
          <h2 className="text-subtitle font-bold text-shell-900">{titulo}</h2>
          {acao}
        </header>
      )}
      <div className={cn('min-h-0 flex-1', !semPadding && 'p-4')}>{children}</div>
    </section>
  );
}

/** Par rótulo/valor em coluna — usado nos painéis de detalhe. */
export function Campo({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: ReactNode;
  tom?: 'ok' | 'ruim' | 'atencao';
}) {
  const cor = tom
    ? { ok: 'text-ok-700', ruim: 'text-bad-700', atencao: 'text-warn-700' }[tom]
    : 'text-shell-900';
  return (
    <div>
      <dt className="text-micro font-semibold uppercase tracking-wide text-shell-500">{rotulo}</dt>
      <dd className={cn('mt-0.5 text-body font-semibold tnum', cor)}>{valor}</dd>
    </div>
  );
}
