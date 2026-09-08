import { useEffect, useState } from 'react';

/* O app é mobile-first: o celular não pergunta nada, é o caso base. Este hook
   existe só para as telas de retaguarda, que ganham um layout próprio a
   partir de 1024px.

   O valor inicial já sai correto (lido de forma síncrona), evitando o
   piscar de layout mobile antes do desktop assumir. */

const CONSULTA = '(min-width: 1024px)';

export function useDesktop() {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const aoMudar = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener('change', aoMudar);
    // Ressincroniza: a janela pode ter mudado entre o render e o efeito.
    setDesktop(mq.matches);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  return desktop;
}
