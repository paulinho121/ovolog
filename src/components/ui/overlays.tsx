import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { useApp, type Toast } from '../../store/app';
import { Button } from './primitives';

/* Bottom sheets são o mecanismo padrão de escolha e confirmação do app:
   mantêm o contexto atrás, custam um toque e ficam ao alcance do polegar. */

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  // Trava o scroll do fundo enquanto o sheet está aberto.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc fecha — teclado físico é raro no campo, mas custa duas linhas.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="app-fixed fixed inset-y-0 z-50 flex flex-col justify-end">
          <motion.button
            aria-label="Fechar"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-shell-900/40"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 620) onClose();
            }}
            className={cn(
              'relative max-h-[88vh] w-full overflow-hidden rounded-t-sheet bg-white shadow-sheet',
              'pb-[calc(1rem+var(--safe-bottom))]',
            )}
          >
            {/* Alça de arraste — sinaliza que dá para puxar para baixo. */}
            <div className="flex justify-center pb-1 pt-2.5">
              <span className="h-1 w-10 rounded-full bg-shell-300" />
            </div>
            {title && (
              <div className="px-5 pb-3 pt-1">
                <h2 className="text-subtitle font-bold text-shell-900">{title}</h2>
                {subtitle && <p className="mt-0.5 text-meta text-shell-600">{subtitle}</p>}
              </div>
            )}
            <div className="max-h-[64vh] overflow-y-auto overscroll-contain">{children}</div>
            {footer && <div className="border-t border-shell-200 p-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* Confirmação destrutiva ou de impacto. Nunca um modal centralizado: o mesmo
   sheet, com a ação de recuo primeiro (mais perto do polegar em repouso). */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Voltar',
  tone = 'primary',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-5 pb-2">
        {message && <div className="text-body text-shell-600">{message}</div>}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="lg" block onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" size="lg" block onClick={onClose}>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  );
}

/* --------------------------------------------------------------- Toasts */

const TOAST_STYLE: Record<Toast['tone'], { cls: string; icon: ReactNode }> = {
  ok: { cls: 'bg-ok-700', icon: <CheckCircle2 size={18} /> },
  info: { cls: 'bg-info-700', icon: <Info size={18} /> },
  warn: { cls: 'bg-warn-700', icon: <AlertTriangle size={18} /> },
  bad: { cls: 'bg-bad-700', icon: <XCircle size={18} /> },
};

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    /* No topo, e não embaixo: a metade inferior da tela é onde vivem a barra
       de ação, a navegação e os bottom sheets — um toast ali cobre justamente
       o botão que o usuário precisa tocar em seguida. */
    <div className="app-fixed pointer-events-none fixed top-[calc(var(--safe-top)+4.5rem)] z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            onClick={() => dismissToast(t.id)}
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl px-4 py-3',
              'text-body font-semibold text-white shadow-raised',
              TOAST_STYLE[t.tone].cls,
            )}
          >
            {TOAST_STYLE[t.tone].icon}
            <span className="text-left">{t.message}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
