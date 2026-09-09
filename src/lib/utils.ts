import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/* `cn` junta classes e resolve conflitos: a última vence.
 *
 * O tailwind-merge só sabe resolver o que ele conhece, e o design system daqui
 * inventa nomes (`text-meta`, `rounded-card`, `shadow-raised`). Sem a extensão
 * abaixo ele erra o palpite — e erra em silêncio:
 *
 *   cn('text-micro font-semibold', 'text-ok-700')  →  'font-semibold text-ok-700'
 *
 * `text-micro` some. O tailwind-merge assume que todo `text-*` desconhecido é
 * COR, vê duas cores e descarta a primeira. Era isso que fazia os badges
 * renderizarem no tamanho herdado (15px) em vez dos 12px do token — e o mesmo
 * acontecia em toda combinação de tamanho com cor no app.
 *
 * `rounded-card` e `shadow-card` tinham o problema espelhado: não eram
 * reconhecidos como raio e sombra, então NÃO conflitavam com `rounded-full` e
 * `shadow-none`, e as duas classes chegavam juntas ao CSS.
 *
 * Declarar as escalas resolve os três casos de uma vez. Ao acrescentar um
 * degrau novo em `index.css`, acrescente aqui também. */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'title', 'subtitle', 'body', 'meta', 'micro'] }],
      rounded: [{ rounded: ['card', 'sheet'] }],
      'shadow': [{ shadow: ['card', 'raised', 'sheet', 'nav'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
