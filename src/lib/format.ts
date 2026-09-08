/* Formatação pt-BR. Centralizada para que valores nunca divirjam entre telas. */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** R$ 2.700,00 */
export const money = (v: number) => BRL.format(v);

/** R$ 2.700 — para cards e gráficos, onde os centavos são ruído. */
export const moneyShort = (v: number) => BRL_COMPACT.format(v);

/** R$ 12,8 mil — para eixos de gráfico em telas estreitas. */
export function moneyAxis(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString('pt-BR');
}

export const num = (v: number) => v.toLocaleString('pt-BR');

/** 1,2 km — abaixo de 1 km cai para metros, como um app de navegação. */
export function km(v: number | undefined) {
  if (v === undefined) return '—';
  if (v < 1) return `${Math.round(v * 1000)} m`;
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

/** 4h20 / 45 min */
export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

const WEEKDAYS = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** terça-feira, 8 de setembro */
export function longDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** 08/09 */
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

/** 08/09/2026 */
export const fullDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** 09:35 */
export const time = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 08/09 • 09:35 */
export const dateTime = (iso: string) => `${shortDate(iso)} • ${time(iso)}`;

/** "Hoje" / "Ontem" / "há 3 dias" / "12/08" — para "última compra". */
export function relativeDay(iso: string | null, now = new Date()) {
  if (!iso) return 'Nunca';
  const then = new Date(iso);
  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(then).getTime()) / 86_400_000,
  );
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `há ${days} dias`;
  return shortDate(iso);
}

/** Dias até o vencimento — negativo quando já venceu. */
export function daysUntil(iso: string, now = new Date()) {
  return Math.round(
    (startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
}

/** "Bom dia" / "Boa tarde" / "Boa noite" */
export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** JS (11) 98765-4321 */
export function phone(v: string) {
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return v;
}

/** 12.345.678/0001-90 */
export function cnpj(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export const pct = (v: number, digits = 0) =>
  `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
