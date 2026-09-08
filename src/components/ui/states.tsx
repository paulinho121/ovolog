import { CloudOff, Inbox, Lock, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './primitives';

/* Estados de tela. Toda lista do app usa um destes em vez de ficar em branco —
   uma tela vazia sem explicação parece defeito para quem está na rua. */

function Shell({
  icon,
  title,
  message,
  action,
  tone = 'neutral',
}: {
  icon: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'bad' | 'warn';
}) {
  const ring = {
    neutral: 'bg-shell-200 text-shell-500',
    bad: 'bg-bad-50 text-bad-700',
    warn: 'bg-warn-50 text-warn-700',
  }[tone];
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <span className={cn('mb-4 grid size-16 place-items-center rounded-2xl', ring)}>{icon}</span>
      <h3 className="text-subtitle font-bold text-shell-900">{title}</h3>
      {message && <p className="mt-1.5 max-w-[16rem] text-body text-shell-600">{message}</p>}
      {action && <div className="mt-5 w-full max-w-[15rem]">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <Shell
      icon={icon ?? <Inbox size={28} />}
      title={title}
      message={message}
      action={
        actionLabel && onAction ? (
          <Button variant="secondary" size="md" block onClick={onAction}>
            {actionLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Shell
      tone="bad"
      icon={<TriangleAlert size={28} />}
      title="Algo deu errado"
      message="Não conseguimos carregar estas informações agora."
      action={
        onRetry && (
          <Button variant="secondary" size="md" block icon={<RefreshCw size={16} />} onClick={onRetry}>
            Tentar novamente
          </Button>
        )
      }
    />
  );
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Shell
      tone="warn"
      icon={<CloudOff size={28} />}
      title="Sem conexão"
      message="Esta tela precisa de internet. O que você registrar em campo continua salvo no aparelho."
      action={
        onRetry && (
          <Button variant="secondary" size="md" block onClick={onRetry}>
            Tentar novamente
          </Button>
        )
      }
    />
  );
}

export function DeniedState() {
  return (
    <Shell
      icon={<Lock size={28} />}
      title="Sem permissão"
      message="Seu perfil não tem acesso a esta área. Fale com o gestor da operação."
    />
  );
}

/* ------------------------------------------------------------- Carregando */

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('skeleton h-3 rounded-full', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-card border border-shell-200 bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="skeleton size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-2/3" />
          <SkeletonLine className="w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function LoadingList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
