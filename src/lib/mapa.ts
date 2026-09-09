/* Configuração do mapa e contas de geografia.
 *
 * TODO provedor de mapa passa por aqui. Trocar OpenStreetMap por Google (ou
 * MapTiler, ou Mapbox) é mexer neste arquivo e em MapCanvas.tsx — nenhuma
 * tela conhece o provedor.
 */

/* ---------------------------------------------------------------- Tiles */

/* Tiles do OpenStreetMap.
 *
 * ATENÇÃO — a política de uso do servidor público do OSM não cobre uso
 * comercial pesado: é infraestrutura doada, mantida por voluntários. Para uma
 * operação pequena o volume passa despercebido, mas conforme a frota crescer
 * o caminho é um provedor com chave (MapTiler e Stadia têm plano gratuito) ou
 * o Google. É trocar as duas linhas abaixo.
 *
 * A atribuição é obrigatória e não pode sair da tela: é a condição da licença
 * ODbL, não enfeite. */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const TILE_MAX_ZOOM = 19;

/* ------------------------------------------------------------ Coordenadas */

export interface Coord {
  lat: number;
  lng: number;
}

/* Onde o mapa abre quando não há nada para enquadrar.
 *
 * Era São Paulo, fixo no código. Uma distribuidora em Fortaleza abria o app e
 * via a Grande São Paulo — o app afirmando, com uma cidade inteira desenhada,
 * algo que ele não sabe.
 *
 * Agora a ordem é: o último lugar onde a pessoa se localizou; se nunca se
 * localizou, o Brasil inteiro. Um país inteiro na tela comunica "ainda não sei
 * onde você opera" — que é a verdade — em vez de apontar a cidade errada. */

const CHAVE_ULTIMO_LOCAL = 'ovolog:ultimo-local';

/** Enquadramento do Brasil. Zoom baixo de propósito: é um "não sei ainda". */
export const CENTRO_BRASIL: Coord = { lat: -14.24, lng: -51.93 };
export const ZOOM_BRASIL = 4;

/** Guarda onde a pessoa está para o próximo mapa já abrir na região certa. */
export function lembrarUltimoLocal(ponto: Coord) {
  try {
    localStorage.setItem(CHAVE_ULTIMO_LOCAL, JSON.stringify(ponto));
  } catch {
    /* Armazenamento bloqueado: o mapa só abre mais longe na próxima vez. */
  }
}

export function ultimoLocalConhecido(): Coord | null {
  try {
    const bruto = localStorage.getItem(CHAVE_ULTIMO_LOCAL);
    if (!bruto) return null;
    const p: unknown = JSON.parse(bruto);
    return temCoordenada(p as { lat?: number; lng?: number })
      ? (p as Coord)
      : null;
  } catch {
    return null;
  }
}

/** Centro e zoom de partida, na melhor informação disponível. */
export function enquadramentoInicial(): { centro: Coord; zoom: number } {
  const ultimo = ultimoLocalConhecido();
  return ultimo ? { centro: ultimo, zoom: 12 } : { centro: CENTRO_BRASIL, zoom: ZOOM_BRASIL };
}

/** Um registro sem coordenada não pode ir para o mapa. Cliente cadastrado
 *  antes da geocodificação cai neste caso — some do mapa, mas continua na
 *  lista, que é melhor do que aparecer num lugar errado. */
export function temCoordenada<T extends { lat?: number | null; lng?: number | null }>(
  v: T,
): v is T & Coord {
  return typeof v.lat === 'number' && typeof v.lng === 'number';
}

/* --------------------------------------------------------------- Distância */

const RAIO_TERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distância em linha reta entre dois pontos (haversine).
 *
 *  É o "voo do pássaro", não a distância pela rua — sempre menor que o
 *  trajeto real. Serve para saber se o motorista chegou e para ordenar
 *  paradas por proximidade; para prometer ETA ao cliente, não serve. */
export function distanciaKm(a: Coord, b: Coord): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(s));
}

/* ------------------------------------------------------------ Geocodificação */

export interface EnderecoEncontrado extends Coord {
  descricao: string;
}

/* Nominatim é o geocodificador do próprio OpenStreetMap: sem chave, sem
   cadastro. Em troca a política pede no máximo 1 busca por segundo e proíbe
   geocodificar listas em massa — o que serve bem aqui, porque a busca só
   roda quando alguém cadastra um cliente, não a cada tela.
   https://operations.osmfoundation.org/policies/nominatim/

   Endereço de cidade pequena e zona rural o Nominatim erra bem mais que o
   Google. Por isso o cadastro deixa escolher entre os resultados em vez de
   assumir o primeiro, e deixa salvar sem coordenada. */
export async function buscarEndereco(
  consulta: string,
  sinal?: AbortSignal,
): Promise<EnderecoEncontrado[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', consulta);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('addressdetails', '1');

  const resp = await fetch(url, {
    signal: sinal,
    headers: { Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`Nominatim respondeu ${resp.status}`);

  const dados: unknown = await resp.json();
  if (!Array.isArray(dados)) return [];

  return dados
    .map((r) => {
      const item = r as { lat?: string; lon?: string; display_name?: string };
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng, descricao: String(item.display_name ?? '') };
    })
    .filter((r): r is EnderecoEncontrado => r !== null);
}

/** Geocodificação reversa: coordenada → endereço. Usada quando o vendedor
 *  está na porta do cliente e deixa o aparelho dizer onde é. */
export async function buscarPorCoordenada(
  ponto: Coord,
  sinal?: AbortSignal,
): Promise<EnderecoEncontrado | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(ponto.lat));
  url.searchParams.set('lon', String(ponto.lng));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');

  const resp = await fetch(url, { signal: sinal, headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Nominatim respondeu ${resp.status}`);

  const dado = (await resp.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };
  if (!dado || !dado.display_name) return null;

  return { ...ponto, descricao: String(dado.display_name) };
}

/** Extrai "Rua, número" e bairro de um resultado do Nominatim, para preencher
 *  os campos do cadastro. O Nominatim varia bastante a chave do bairro entre
 *  cidades — daí a lista de tentativas. */
export function separarEndereco(descricao: string): { rua: string; bairro: string } {
  const partes = descricao.split(',').map((p) => p.trim());
  return {
    rua: partes.slice(0, 2).join(', '),
    bairro: partes[2] ?? '',
  };
}
