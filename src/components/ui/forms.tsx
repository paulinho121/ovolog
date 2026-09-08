import { Minus, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/* Entradas de dados pensadas para o polegar: alvos grandes, teclado numérico
   quando cabe, e o mínimo de digitação possível (REGRA 5). */

/* ------------------------------------------------------------------ Campo */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-meta font-semibold text-shell-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-meta text-bad-700">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-meta text-shell-500">{hint}</span>
      )}
    </label>
  );
}

/* 16px é intencional: abaixo disso o iOS aplica zoom ao focar. */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        'h-12 w-full rounded-xl border border-shell-300 bg-white px-3.5',
        'text-[16px] text-shell-900 placeholder:text-shell-400',
        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200',
        className,
      )}
    />
  );
}

export function TextArea({
  className,
  ...rest
}: InputHTMLAttributes<HTMLTextAreaElement> & { rows?: number }) {
  return (
    <textarea
      {...(rest as object)}
      className={cn(
        'w-full rounded-xl border border-shell-300 bg-white p-3.5',
        'text-[16px] text-shell-900 placeholder:text-shell-400',
        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200',
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------------ Busca */

export function SearchField({
  value,
  onChange,
  placeholder = 'Buscar',
  onClear,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-shell-400" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="search"
        className={cn(
          'h-12 w-full rounded-xl border border-shell-300 bg-white pl-11 pr-11',
          'text-[16px] text-shell-900 placeholder:text-shell-400',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200',
        )}
      />
      {value.length > 0 && (
        <button
          onClick={() => (onClear ? onClear() : onChange(''))}
          aria-label="Limpar busca"
          className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-shell-500 active:bg-shell-200"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Stepper */

/* Stepper grande: dá para somar caixas sem olhar, com o celular numa mão. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  /* Toques rápidos precisam somar. Cada clique enxerga o `value` do render
     anterior, então uma sequência rápida de "+" gravaria sempre o mesmo
     número — e somar caixas depressa é o uso normal desta tela. O ref guarda
     o valor já aplicado; o efeito o realinha com o que o dono do estado
     confirmou (inclusive quando ele limita a quantidade). */
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const bump = (delta: number) => {
    latest.current = clamp(latest.current + delta);
    onChange(latest.current);
  };

  const set = (next: number) => {
    latest.current = clamp(next);
    onChange(latest.current);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => bump(-step)}
        disabled={value <= min}
        aria-label="Diminuir"
        className={cn(
          'grid size-11 place-items-center rounded-xl border border-shell-300 bg-white',
          'text-shell-700 active:bg-shell-200 disabled:opacity-30',
        )}
      >
        <Minus size={18} />
      </button>
      <input
        value={value}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 0)}
        inputMode="numeric"
        aria-label="Quantidade"
        className="h-11 w-12 rounded-lg bg-transparent text-center text-subtitle font-bold tnum text-shell-900 focus:bg-shell-100 focus:outline-none"
      />
      <button
        onClick={() => bump(step)}
        disabled={value >= max}
        aria-label="Aumentar"
        className={cn(
          'grid size-11 place-items-center rounded-xl bg-brand-700 text-white',
          'active:bg-brand-800 disabled:opacity-30',
        )}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------ Seleção segmentada */

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: NoInfer<T>;
  onChange: (v: NoInfer<T>) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" className="flex gap-1 rounded-xl bg-shell-200 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-10 flex-1 rounded-lg text-meta font-semibold transition-colors',
            value === o.value ? 'bg-white text-shell-900 shadow-card' : 'text-shell-600',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Faixa de filtros rápidos — rola na horizontal, sem abrir tela. */
export function ChipRow<T extends string | number>({
  value,
  onChange,
  options,
  className,
}: {
  value: NoInfer<T>;
  onChange: (v: NoInfer<T>) => void;
  options: { value: T; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-10 shrink-0 rounded-full px-4 text-meta font-semibold transition-colors',
            value === o.value
              ? 'bg-shell-900 text-white'
              : 'border border-shell-300 bg-white text-shell-700',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('ml-1.5 tnum', value === o.value ? 'text-white/70' : 'text-shell-500')}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* Abas horizontais dentro de uma tela (Resumo / Pedidos / Financeiro…). */
export function Tabs<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: NoInfer<T>;
  onChange: (v: NoInfer<T>) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-5 overflow-x-auto border-b border-shell-200 px-4">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative shrink-0 pb-3 pt-1 text-body font-semibold transition-colors',
            value === o.value ? 'text-brand-800' : 'text-shell-500',
          )}
        >
          {o.label}
          {value === o.value && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-700" />
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- Formulário em etapas */

export function StepIndicator({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="px-4 pb-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-subtitle font-bold text-shell-900">{label}</span>
        <span className="text-meta font-semibold tnum text-shell-500">
          {step} de {total}
        </span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < step ? 'bg-brand-600' : 'bg-shell-200',
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* Opção grande de escolha única — pagamento, motivo de ocorrência, etc. */
export function OptionCard({
  selected,
  onClick,
  icon,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex min-h-[4.5rem] w-full items-center gap-3 rounded-card border-2 p-4 text-left transition-colors',
        selected
          ? 'border-brand-600 bg-brand-50'
          : 'border-shell-200 bg-white active:bg-shell-50',
      )}
    >
      {icon && (
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', selected ? 'bg-brand-600 text-white' : 'bg-shell-100 text-shell-600')}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-shell-900">{title}</span>
        {subtitle && <span className="mt-0.5 block text-meta text-shell-600">{subtitle}</span>}
      </span>
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full border-2',
          selected ? 'border-brand-600 bg-brand-600' : 'border-shell-300',
        )}
      >
        {selected && <span className="size-2 rounded-full bg-white" />}
      </span>
    </button>
  );
}

/* Item de checklist — conferência de entrega. */
export function CheckItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left active:bg-shell-100"
    >
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
          checked ? 'border-ok-500 bg-ok-500 text-white' : 'border-shell-300',
        )}
      >
        {checked && (
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={cn('font-medium', checked ? 'text-shell-900' : 'text-shell-600')}>{label}</span>
    </button>
  );
}
