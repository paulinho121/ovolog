/* Marca do OVOLOG.
 *
 * Substitui o emoji 🥚 que aparecia no acesso, no splash e na barra lateral.
 * Emoji é desenhado pelo sistema operacional, não pelo produto: o mesmo
 * caractere vira um ovo achatado no Windows, um oval branco no Android e um
 * ovo com sombra no iPhone — três marcas diferentes para o mesmo app, e
 * nenhuma delas escolhida por ninguém.
 *
 * Um SVG resolve isso e ainda herda a cor do texto, então serve sobre o âmbar
 * da marca e sobre fundo claro sem duas versões. */
export function MarcaOvolog({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label="OVOLOG"
    >
      {/* A forma do ovo: mais estreita em cima que embaixo, que é o que
          distingue um ovo de uma elipse. */}
      <path
        d="M12 2.5c3.6 0 6.8 5.2 6.8 10.1 0 4.6-3 7.9-6.8 7.9s-6.8-3.3-6.8-7.9C5.2 7.7 8.4 2.5 12 2.5Z"
        fill="currentColor"
      />
      {/* Brilho: dá volume sem precisar de gradiente, e some quando o ícone é
          pequeno demais para ele importar. */}
      <ellipse cx="9.6" cy="9.2" rx="1.7" ry="2.5" fill="#fff" opacity="0.28" />
    </svg>
  );
}
