import { motion, useMotionValue, useTransform } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/* Deslizar revela atalhos, mas nunca é a única forma de chegar a eles —
   toda ação daqui também existe dentro da tela de detalhe (§49). */

export function SwipeCard({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions: { label: string; icon?: ReactNode; tone: 'info' | 'bad'; onClick: () => void }[];
  className?: string;
}) {
  const x = useMotionValue(0);
  const width = actions.length * 84;
  // A faixa de ações só aparece conforme o card sai do lugar.
  const opacity = useTransform(x, [-width, -12, 0], [1, 0.4, 0]);

  return (
    <div className={cn('relative overflow-hidden rounded-card', className)}>
      <motion.div
        style={{ opacity }}
        className="absolute inset-y-0 right-0 flex"
        aria-hidden="true"
      >
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            tabIndex={-1}
            className={cn(
              'flex w-[84px] flex-col items-center justify-center gap-1 text-white',
              a.tone === 'bad' ? 'bg-bad-700' : 'bg-info-700',
            )}
          >
            {a.icon}
            <span className="text-micro font-bold uppercase tracking-wide">{a.label}</span>
          </button>
        ))}
      </motion.div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -width, right: 0 }}
        dragElastic={{ left: 0.02, right: 0 }}
        dragDirectionLock
        onDragEnd={(_, info) => {
          const open = info.offset.x < -width / 2 || info.velocity.x < -450;
          x.set(open ? -width : 0);
        }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}
