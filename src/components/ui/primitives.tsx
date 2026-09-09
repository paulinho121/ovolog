import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/* Primitivas do design system. Toda superfície tocável nasce com no mínimo
   44px de altura — abaixo disso o dedo erra dentro de um veículo em movimento. */

/* ------------------------------------------------------------------ Botão */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'lg' | 'md' | 'sm';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white active:bg-brand-800 shadow-raised',
  secondary: 'bg-white text-shell-900 border border-shell-300 active:bg-shell-100',
  ghost: 'bg-transparent text-shell-700 active:bg-shell-200',
  danger: 'bg-bad-700 text-white active:bg-bad-500',
  success: 'bg-ok-700 text-white active:bg-ok-500',
};

const SIZES: Record<Size, string> = {
  lg: 'h-14 text-subtitle px-5 rounded-2xl',
  md: 'h-12 text-body px-4 rounded-xl',
  sm: 'h-11 text-meta px-3.5 rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold',
        'transition-[transform,background-color] duration-100 active:scale-[0.985]',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* Botão de ícone — usado em headers. 44px de alvo, ícone menor dentro. */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full text-shell-700',
        'active:bg-shell-200 transition-colors',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Card */

export function Card({
  className,
  children,
  onClick,
  as,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  as?: 'div' | 'button';
}) {
  const Tag = (as ?? (onClick ? 'button' : 'div')) as 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'rounded-card border border-shell-200 bg-white shadow-card',
        onClick && 'w-full text-left active:bg-shell-50 transition-colors',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* Linha de lista tocável, com afordância de navegação à direita. */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  chevron = true,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
}) {
  const Tag = (onClick ? 'button' : 'div') as 'button';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-4 text-left min-h-[3.5rem]',
        onClick && 'active:bg-shell-100 transition-colors',
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-shell-900">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-meta text-shell-600">{subtitle}</div>}
      </div>
      {trailing}
      {onClick && chevron && <ChevronRight size={18} className="shrink-0 text-shell-400" />}
    </Tag>
  );
}

/* -------------------------------------------------------------------- Tom */

/* Um tom, três formas de aparecer: preenchido (badge, ladrilho), sólido
   (ponto, barra de progresso) e só texto (valor com significado).

   Este mapa existia copiado em cinco lugares deste arquivo — Badge, Dot,
   Stat, KeyValue e Progress cada um com o seu. Cinco cópias é onde nasce a
   inconsistência: mudar o verde de "pago" em quatro delas e esquecer a
   quinta é o tipo de coisa que ninguém revisa e todo mundo vê. */

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'brand';

/** Fundo claro + texto escuro. Badges e ladrilhos de ícone. */
export const TONE_SUAVE: Record<Tone, string> = {
  ok: 'bg-ok-50 text-ok-700',
  warn: 'bg-warn-50 text-warn-700',
  bad: 'bg-bad-50 text-bad-700',
  info: 'bg-info-50 text-info-700',
  neutral: 'bg-shell-200 text-shell-700',
  brand: 'bg-brand-100 text-brand-800',
};

/** Cor cheia. Pontos de status e preenchimento de progresso. */
export const TONE_SOLIDO: Record<Tone, string> = {
  ok: 'bg-ok-500',
  warn: 'bg-warn-500',
  bad: 'bg-bad-500',
  info: 'bg-info-500',
  neutral: 'bg-shell-400',
  brand: 'bg-brand-500',
};

/** Só o texto. Valores em que a cor carrega significado. */
export const TONE_TEXTO: Record<Tone, string> = {
  ok: 'text-ok-700',
  warn: 'text-warn-700',
  bad: 'text-bad-700',
  info: 'text-info-700',
  neutral: 'text-shell-900',
  brand: 'text-brand-800',
};

/* ------------------------------------------------------------------ Badge */

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1',
        /* Sem caixa alta. Numa lista de logística o status é o que o olho
           procura primeiro, e maiúscula apaga a silhueta da palavra — que é
           justamente o que permite reconhecer sem ler. */
        'text-micro font-semibold',
        TONE_SUAVE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* Ponto colorido — status compacto quando não cabe um badge inteiro. */
export function Dot({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  return <span className={cn('inline-block size-2 rounded-full', TONE_SOLIDO[tone], className)} />;
}

/* ----------------------------------------------------------------- Avatar */

export function Avatar({
  initials,
  size = 40,
  tone = 'brand',
}: {
  initials: string;
  size?: number;
  tone?: 'brand' | 'neutral';
}) {
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold',
        tone === 'brand' ? 'bg-brand-500 text-white' : 'bg-shell-200 text-shell-700',
      )}
    >
      {initials}
    </span>
  );
}

/* Quadrado com ícone — usado em menus e cabeçalhos de card. */
export function IconTile({
  children,
  tone = 'brand',
  size = 40,
}: {
  children: ReactNode;
  tone?: Tone;
  size?: number;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn('grid shrink-0 place-items-center rounded-xl', TONE_SUAVE[tone])}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Progresso */

export function Progress({
  value,
  tone = 'brand',
  className,
}: {
  /** 0–1 */
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-shell-200', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', TONE_SOLIDO[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------- Stat / KPI */

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-meta font-medium text-shell-600">{label}</span>
        {icon}
      </div>
      <div className={cn('mt-1.5 text-title font-bold tnum', TONE_TEXTO[tone])}>{value}</div>
      {hint && <div className="mt-0.5 text-meta text-shell-500">{hint}</div>}
    </Card>
  );
}

/* Título de seção — o mesmo em todas as telas, para a leitura virar hábito. */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between px-1 pb-2', className)}>
      <h2 className="text-subtitle font-bold text-shell-900">{children}</h2>
      {action}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-shell-200', className)} />;
}

/* Par rótulo/valor — a unidade de leitura dos resumos. */
export function KeyValue({
  label,
  value,
  tone,
  strong,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-body text-shell-600">{label}</span>
      <span
        className={cn(
          'tnum text-right',
          strong ? 'text-subtitle font-bold' : 'font-semibold',
          tone ? TONE_TEXTO[tone] : 'text-shell-900',
        )}
      >
        {value}
      </span>
    </div>
  );
}
