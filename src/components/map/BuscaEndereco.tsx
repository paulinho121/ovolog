import { useEffect, useRef, useState } from 'react';
import { Check, Crosshair, LoaderCircle, MapPin, Search, TriangleAlert } from 'lucide-react';
import {
  buscarEndereco,
  buscarPorCoordenada,
  separarEndereco,
  type Coord,
  type EnderecoEncontrado,
} from '../../lib/mapa';

/* Localiza o endereço de um cliente e devolve a coordenada.
 *
 * Por que escolher em vez de aceitar o primeiro resultado: o Nominatim erra
 * bastante fora das capitais — devolve a cidade certa e a rua errada, ou um
 * homônimo em outro estado. Numa distribuidora isso vira o motorista rodando
 * 40 km à toa. Quem cadastra é quem sabe onde o cliente fica, então quem
 * escolhe é essa pessoa.
 *
 * Salvar sem coordenada é permitido de propósito: um cliente sem localização
 * ainda vende, ainda compra e ainda paga. Ele só não aparece no mapa. Travar
 * o cadastro por causa disso pararia a operação por um detalhe de mapa. */

export function BuscaEndereco({
  endereco,
  bairro,
  coordenada,
  onEscolher,
  onPreencherEndereco,
}: {
  endereco: string;
  bairro: string;
  coordenada: Coord | undefined;
  onEscolher: (c: Coord | undefined) => void;
  onPreencherEndereco: (rua: string, bairro: string) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<EnderecoEncontrado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const aborto = useRef<AbortController | null>(null);

  /* Uma busca em andamento vira lixo assim que outra começa. Sem cancelar, a
     resposta lenta da primeira pode chegar depois e sobrescrever a segunda. */
  useEffect(() => () => aborto.current?.abort(), []);

  async function procurar() {
    const consulta = [endereco, bairro].filter(Boolean).join(', ').trim();
    if (consulta.length < 4) {
      setErro('Preencha o endereço antes de localizar.');
      return;
    }

    aborto.current?.abort();
    const ctrl = new AbortController();
    aborto.current = ctrl;

    setBuscando(true);
    setErro(null);
    setResultados(null);
    try {
      const achados = await buscarEndereco(consulta, ctrl.signal);
      setResultados(achados);
      if (achados.length === 0) {
        setErro('Nada encontrado. Tente sem o número, ou acrescente a cidade.');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setErro('Não foi possível consultar o mapa agora. Dá para salvar sem localizar.');
    } finally {
      setBuscando(false);
    }
  }

  function usarMinhaLocalizacao() {
    if (!('geolocation' in navigator)) {
      setErro('Este aparelho não oferece localização no navegador.');
      return;
    }
    setBuscando(true);
    setErro(null);
    navigator.geolocation.getCurrentPosition(
      async (leitura) => {
        const ponto = { lat: leitura.coords.latitude, lng: leitura.coords.longitude };
        onEscolher(ponto);
        setEscolhido('aqui');
        setResultados(null);
        /* A coordenada já está garantida; o endereço por extenso é um extra.
           Se o Nominatim não responder, a localização continua valendo. */
        try {
          const achado = await buscarPorCoordenada(ponto);
          if (achado) {
            const { rua, bairro: b } = separarEndereco(achado.descricao);
            onPreencherEndereco(rua, b);
          }
        } catch {
          /* silêncio proposital: ver acima */
        } finally {
          setBuscando(false);
        }
      },
      (e) => {
        setBuscando(false);
        setErro(
          e.code === e.PERMISSION_DENIED
            ? 'Permissão de localização negada pelo navegador.'
            : 'Não foi possível obter a localização agora.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={procurar}
          disabled={buscando}
          className="flex flex-1 items-center justify-center gap-2 rounded-card border border-brand-200 bg-brand-50 px-3 py-3 text-meta font-semibold text-brand-800 active:bg-brand-100 disabled:opacity-60"
        >
          {buscando ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          Localizar endereço
        </button>
        <button
          type="button"
          onClick={usarMinhaLocalizacao}
          disabled={buscando}
          aria-label="Usar minha localização"
          className="grid size-12 shrink-0 place-items-center rounded-card border border-shell-200 bg-white text-shell-700 active:bg-shell-100 disabled:opacity-60"
        >
          <Crosshair size={18} />
        </button>
      </div>

      {erro && (
        <p className="flex items-start gap-2 text-meta text-warn-700">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

      {resultados && resultados.length > 0 && (
        <ul className="space-y-2">
          {resultados.map((r) => {
            const chave = `${r.lat},${r.lng}`;
            const ativo = escolhido === chave;
            return (
              <li key={chave}>
                <button
                  type="button"
                  onClick={() => {
                    onEscolher({ lat: r.lat, lng: r.lng });
                    setEscolhido(chave);
                  }}
                  aria-pressed={ativo}
                  className={`flex w-full items-start gap-2.5 rounded-card border-2 p-3 text-left transition-colors ${
                    ativo
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-shell-200 bg-white active:bg-shell-50'
                  }`}
                >
                  <MapPin size={16} className="mt-0.5 shrink-0 text-shell-500" />
                  <span className="min-w-0 flex-1 text-meta text-shell-800">{r.descricao}</span>
                  {ativo && <Check size={16} className="mt-0.5 shrink-0 text-brand-700" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2 rounded-card bg-shell-100 px-3 py-2.5">
        {coordenada ? (
          <>
            <Check size={15} className="shrink-0 text-ok-600" />
            <span className="text-meta text-shell-700">
              Localizado — o cliente vai aparecer no mapa da rota.
            </span>
          </>
        ) : (
          <>
            <MapPin size={15} className="shrink-0 text-shell-500" />
            <span className="text-meta text-shell-600">
              Sem localização. Dá para salvar assim: o cliente entra na lista, mas fica fora do
              mapa até alguém localizar.
            </span>
          </>
        )}
      </div>

      {coordenada && (
        <button
          type="button"
          onClick={() => {
            onEscolher(undefined);
            setEscolhido(null);
          }}
          className="text-meta font-semibold text-shell-600 underline"
        >
          Limpar localização
        </button>
      )}
    </div>
  );
}
