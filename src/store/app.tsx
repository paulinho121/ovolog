import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Account,
  Distribuidora,
  AppNotification,
  CartLine,
  CashEntry,
  ConnectionState,
  Customer,
  Incident,
  IncidentKind,
  Order,
  PaymentMethod,
  Purchase,
  ReturnReason,
  Route,
  StockItem,
  StockMove,
  StockMoveKind,
  StockReturn,
  User,
  Vehicle,
} from '../types';
import { hidratarCatalogo, products, users } from '../data/catalog';
import {
  descreverOperacao,
  executarOperacao,
  op,
  type Operacao,
} from '../data/operacoes';
import {
  enfileirarNoDisco,
  filaPersistente,
  lerFila,
  removerDoDisco,
  type ItemFila,
} from '../lib/fila';
import { distanciaKm, temCoordenada, type Coord } from '../lib/mapa';
import { formaDaCondicao } from '../lib/domain';
import { carregarEstado } from '../data/repositorio';
import { supabase, supabaseConfigurado } from '../lib/supabase';
import * as repo from '../data/repositorio';
import { available, nextStop, orderTotal, resolveAccountStatus } from '../lib/domain';

/* Estado da operação. Um único provider guarda os dados e as ações; as telas
   só leem e disparam. Mutações passam por `commit`, que é onde vive a fila
   offline — assim nenhuma tela precisa saber se há conexão. */

export interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'info' | 'warn' | 'bad';
}

/* A posição do motorista agora é latitude/longitude de verdade, vinda do
   GPS do aparelho. `undefined` enquanto o navegador não respondeu — ou
   porque a permissão foi negada, ou porque o sinal ainda não fixou. */
export type Position = Coord;

interface AppState {
  /* Carga inicial vinda do banco */
  carregando: boolean;
  erroCarga: string | null;
  recarregar: () => void;

  /* Sessão */
  /* Acesso */
  /** null enquanto o app verifica se já existe sessão salva no aparelho. */
  autenticado: boolean | null;
  /** A pessoa da equipe correspondente à conta autenticada. */
  session: User | null;
  /** Autenticado, mas sem vínculo com ninguém em `usuarios`: a conta existe
   *  e não foi ligada a uma pessoa da operação. */
  semVinculo: boolean;
  /** Quem administra o produto, não a distribuição: cria distribuidoras e o
   *  primeiro gestor de cada uma. Não pertence a nenhuma delas. */
  adminPlataforma: boolean;
  /** A distribuidora de quem entrou. Ausente para admin de plataforma. */
  distribuidora: Distribuidora | undefined;
  /** Todas as distribuidoras — só o admin de plataforma recebe mais de uma,
   *  porque é o RLS que decide o que volta, não o app. */
  distribuidoras: Distribuidora[];
  criarDistribuidora: (dados: {
    nome: string;
    documento: string;
    telefone: string;
    cidade: string;
  }) => Promise<Distribuidora>;
  /** Devolve a mensagem de erro, ou null se entrou. */
  signIn: (email: string, senha: string) => Promise<string | null>;
  signOut: () => Promise<void>;

  /* Conectividade */
  connection: ConnectionState;
  pendingSync: number;
  /** Falso quando o IndexedDB não está disponível: a fila não sobrevive a um
   *  recarregamento, e a interface precisa dizer isso. */
  filaPersistente: boolean;
  syncNow: () => void;

  /* Dados */
  customers: Customer[];
  orders: Order[];
  routes: Route[];
  vehicles: Vehicle[];
  stock: StockItem[];
  stockMoves: StockMove[];
  purchases: Purchase[];
  accounts: Account[];
  cashEntries: CashEntry[];
  incidents: Incident[];
  returns: StockReturn[];
  notifications: AppNotification[];

  /* GPS do aparelho */
  /** Ausente até o navegador entregar a primeira leitura. */
  position: Position | undefined;
  /** Motivo pelo qual não há posição, para a tela poder explicar. */
  gpsIndisponivel: string | null;
  /** Distância em km até a próxima parada, ou undefined sem GPS/coordenada. */
  distanceToNextStop: number | undefined;
  /** O check-in por localização só libera dentro do raio de chegada. */
  isAtNextStop: boolean;

  /* Rota ativa do usuário logado */
  activeRoute: Route | undefined;

  /* Carrinho */
  cart: {
    customerId: string | null;
    lines: CartLine[];
    discount: number;
    payment: PaymentMethod | null;
    dueDate?: string;
    installments: number;
  };
  startCart: (customerId: string) => void;
  setCartQty: (productId: string, quantity: number) => void;
  setDiscount: (v: number) => void;
  setPayment: (p: PaymentMethod, opts?: { dueDate?: string; installments?: number }) => void;
  clearCart: () => void;
  /**
   * Confirma o pedido e devolve o id gerado.
   *
   * As condições do prazo entram por parâmetro porque a tela de pagamento as
   * escolhe e confirma no mesmo toque: um `setPayment` seguido de
   * `submitOrder` ainda leria o carrinho do render anterior, e o pedido sairia
   * sem vencimento.
   */
  submitOrder: (terms?: { dueDate?: string; installments?: number }) => string;

  /* Ações de campo */
  startRoute: (routeId: string) => void;
  arriveAtStop: (routeId: string, stopId: string) => void;
  completeStop: (routeId: string, stopId: string) => void;
  markStopNotServed: (routeId: string, stopId: string) => void;
  finishRoute: (routeId: string) => void;
  confirmDelivery: (orderId: string, receiver: string) => void;
  registerIncident: (input: { kind: IncidentKind; customerId: string; routeId: string; note: string }) => void;
  registerReturn: (input: { customerId: string; routeId: string; productId: string; boxes: number; reason: ReturnReason }) => void;

  /* Retaguarda */
  registerAccountPayment: (accountId: string, amount: number, method: PaymentMethod) => void;
  addStockMove: (input: { kind: StockMoveKind; productId: string; boxes: number; note: string }) => void;
  receivePurchase: (purchaseId: string) => void;
  createPurchase: (input: Omit<Purchase, 'id' | 'number' | 'status' | 'createdAt'>) => string;
  createCustomer: (
    input: Omit<Customer, 'id' | 'balance' | 'lastPurchaseAt' | 'totalPurchased'>,
  ) => string;
  markNotificationsRead: () => void;

  /* Toast */
  toasts: Toast[];
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

/** Raio de chegada do check-in por GPS, em km. */
const ARRIVAL_RADIUS_KM = 0.25;

/* Identificador de registro novo, criado no aparelho.
 *
 * Era um contador em memória: `c1001`, `c1002`… reiniciando em 1000 a cada
 * carregamento da página. Dois vendedores cadastrando um cliente na mesma
 * manhã geravam o MESMO id, e como a gravação é upsert, o segundo apagava o
 * primeiro sem erro nenhum. Com várias distribuidoras no mesmo banco, a
 * colisão passaria de uma empresa para outra.
 *
 * O id precisa nascer único no aparelho porque a interface responde antes de
 * falar com o servidor — não dá para esperar o banco atribuir. O prefixo fica
 * só para leitura humana em log e no painel do Supabase. */
function nextId(prefix: string) {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : // Contexto sem crypto (http em rede local, navegador antigo): ainda
        // precisa ser único entre aparelhos, então entra o relógio junto.
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${aleatorio}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<User | null>(null);
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [semVinculo, setSemVinculo] = useState(false);
  const [adminPlataforma, setAdminPlataforma] = useState(false);
  const [distribuidoras, setDistribuidoras] = useState<Distribuidora[]>([]);

  /* Tudo começa vazio: a fonte de verdade é o Supabase, e o app só renderiza
     depois que a carga inicial chega (ver `carregando`). */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockMoves, setStockMoves] = useState<StockMove[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [returns, setReturns] = useState<StockReturn[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const [connection, setConnectionState] = useState<ConnectionState>('online');
  const [pendingSync, setPendingSync] = useState(0);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [position, setPosition] = useState<Position | undefined>(undefined);
  const [gpsIndisponivel, setGpsIndisponivel] = useState<string | null>(null);

  const [cart, setCart] = useState<AppState['cart']>({
    customerId: null,
    lines: [],
    discount: 0,
    payment: null,
    installments: 1,
  });

  /* ------------------------------------------------------------- Toast */

  const toastSeq = useRef(0);
  const toast = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  /* ------------------------------------------------------------ Acesso */

  /* Uma sessão salva no aparelho é a diferença entre abrir o app e começar a
     trabalhar, ou abrir o app e procurar a senha no meio da rua. O Supabase
     guarda e renova o token; aqui só se observa o resultado. */
  useEffect(() => {
    if (!supabaseConfigurado) {
      setAutenticado(false);
      return;
    }
    let vivo = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (vivo) setAutenticado(Boolean(data.session));
    });

    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (!vivo) return;
      setAutenticado(Boolean(sessao));
      if (!sessao) {
        setSession(null);
        setSemVinculo(false);
      }
    });

    return () => {
      vivo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  /* ---------------------------------------------------- Carga inicial */

  /* A carga só acontece depois do login. Com o RLS fechado, buscar dados sem
     sessão não dá erro — devolve listas vazias, e o app pareceria um banco
     recém-criado em vez de uma tela de acesso. */
  useEffect(() => {
    if (!autenticado) {
      setCarregando(autenticado === null);
      return;
    }
    let cancelado = false;
    setCarregando(true);
    setErroCarga(null);

    carregarEstado()
      .then((d) => {
        if (cancelado) return;
        // Catálogo (produtos, fornecedores, usuários) é dado de referência:
        // hidrata os módulos antes de qualquer tela renderizar.
        hidratarCatalogo({
          produtos: d.produtos,
          fornecedores: d.fornecedores,
          usuarios: d.usuarios,
          veiculos: d.veiculos,
          clientes: d.clientes,
        });
        setCustomers(d.clientes);
        setOrders(d.pedidos);
        setRoutes(d.rotas);
        setVehicles(d.veiculos);
        setStock(d.estoque);
        setStockMoves(d.movimentacoes);
        setPurchases(d.compras);
        // O status vem recalculado da data: uma conta "a vencer" gravada
        // semana passada pode já estar vencida hoje.
        setAccounts(d.contas.map((a) => ({ ...a, status: resolveAccountStatus(a) })));
        setCashEntries(d.caixa);
        setIncidents(d.ocorrencias);
        setReturns(d.devolucoes);
        setNotifications(d.notificacoes);

        /* Quem é a pessoa por trás da conta autenticada. Sem esse vínculo o
           app não sabe o papel, e sem papel não há Home nem permissão. */
        void (async () => {
          const { data } = await supabase.auth.getUser();
          if (cancelado) return;
          const eu = d.usuarios.find((u) => u.authId && u.authId === data.user?.id);
          setSession(eu ?? null);

          /* Sem vínculo com a equipe, a conta ainda pode ser de quem
             administra o produto. É a diferença entre "avisar que falta
             configurar" e abrir a área da plataforma. */
          const ehAdmin = eu ? false : await repo.souAdminPlataforma();
          if (cancelado) return;
          setAdminPlataforma(ehAdmin);
          setSemVinculo(!eu && !ehAdmin);

          /* Uma linha para a equipe (a própria distribuidora), várias para o
             admin de plataforma. Quem decide é o RLS. */
          try {
            const lista = await repo.carregarDistribuidoras();
            if (!cancelado) setDistribuidoras(lista);
          } catch {
            /* Banco ainda sem a migração 0007: o app continua funcionando
               como empresa única em vez de quebrar na carga. */
          }

          /* Só agora a tela pode aparecer. Liberar antes fazia o admin de
             plataforma ver a interface de operação piscar — com nome vazio e
             rota de outra pessoa — até a identidade chegar. */
          if (!cancelado) setCarregando(false);
        })();
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setErroCarga(e instanceof Error ? e.message : 'Falha ao carregar os dados.');
        setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [tentativa, autenticado]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  /* --------------------------------------------------------- Offline */

  /* Toda mutação passa por aqui: `apply` altera o estado local na hora, e
     `sincronizar` leva a alteração ao banco.

     O estado local é sempre aplicado primeiro — no campo o app não pode
     esperar a rede para responder. Se a gravação falhar (ou o aparelho estiver
     offline), a operação entra na fila e é reenviada em ordem quando a conexão
     volta. */
  const fila = useRef<ItemFila[]>([]);
  /* Impede duas drenagens simultâneas — o boot, o evento `online` e o toque
     em "sincronizar" podem disparar juntos, e a fila é ordenada. */
  const drenando = useRef(false);

  const enfileirar = useCallback(async (operacao: Operacao) => {
    const id = await enfileirarNoDisco(operacao);
    /* id nulo = IndexedDB indisponível. A operação ainda entra na fila em
       memória para a sessão atual funcionar; o que se perde é sobreviver a um
       recarregamento, e a interface avisa isso. */
    fila.current.push({ id: id ?? -Date.now(), operacao, em: new Date().toISOString() });
    setPendingSync(fila.current.length);
  }, []);

  const drenar = useCallback(async () => {
    if (drenando.current) return;
    if (fila.current.length === 0) {
      setConnectionState(navigator.onLine ? 'online' : 'offline');
      setPendingSync(0);
      return;
    }
    if (!navigator.onLine) {
      setConnectionState('offline');
      return;
    }

    drenando.current = true;
    setConnectionState('sincronizando');
    try {
      // Em ordem, e parando no primeiro erro: as operações dependem umas das
      // outras (o item do pedido não existe antes do pedido).
      while (fila.current.length > 0) {
        const proxima = fila.current[0];
        try {
          await executarOperacao(proxima.operacao);
        } catch (e: unknown) {
          setConnectionState('offline');
          toast(
            `Não foi possível enviar ${descreverOperacao(proxima.operacao)}. Continua salvo no aparelho.`,
            'warn',
          );
          console.warn('[sync] falha ao enviar', proxima.operacao, e);
          return;
        }
        /* Só sai do disco depois de o servidor confirmar. Remover antes abriria
           uma janela em que a operação sumiu daqui e não chegou lá. */
        if (proxima.id >= 0) await removerDoDisco(proxima.id);
        fila.current.shift();
        setPendingSync(fila.current.length);
      }
      setConnectionState('online');
      toast('Tudo sincronizado', 'ok');
    } finally {
      drenando.current = false;
    }
  }, [toast]);

  const commit = useCallback(
    (apply: () => void, ...operacoes: Operacao[]) => {
      apply();
      if (operacoes.length === 0) return;

      /* Com fila pendente, tudo entra na fila — mesmo online. Enviar a operação
         nova por fora furaria a ordem, e a que está esperando pode ser
         pré-requisito desta. */
      if (!navigator.onLine || fila.current.length > 0) {
        void (async () => {
          for (const operacao of operacoes) await enfileirar(operacao);
          void drenar();
        })();
        return;
      }

      void (async () => {
        for (let i = 0; i < operacoes.length; i++) {
          try {
            await executarOperacao(operacoes[i]);
          } catch {
            /* Falhou no meio: esta e as seguintes vão para a fila, na ordem,
               para não deixar metade da alteração aplicada no banco. */
            for (const restante of operacoes.slice(i)) await enfileirar(restante);
            setConnectionState('offline');
            return;
          }
        }
      })();
    },
    [enfileirar, drenar],
  );

  const syncNow = useCallback(() => void drenar(), [drenar]);

  /* Carrega o que ficou pendente da sessão anterior e tenta enviar. É o que
     transforma a fila em garantia: sem isto, persistir não serviria de nada. */
  useEffect(() => {
    void (async () => {
      const pendentes = await lerFila();
      if (pendentes.length > 0) {
        fila.current = pendentes;
        setPendingSync(pendentes.length);
      }
      void drenar();
    })();
  }, [drenar]);

  /* O estado da conexão passa a ser leitura do aparelho, não um botão.
     `navigator.onLine` só sabe se existe interface de rede — por isso ele
     dispara a tentativa, e quem decide se está mesmo online é o resultado da
     sincronização. */
  useEffect(() => {
    const voltou = () => {
      setConnectionState('online');
      void drenar();
    };
    const caiu = () => setConnectionState('offline');
    window.addEventListener('online', voltou);
    window.addEventListener('offline', caiu);
    if (!navigator.onLine) setConnectionState('offline');
    return () => {
      window.removeEventListener('online', voltou);
      window.removeEventListener('offline', caiu);
    };
  }, [drenar]);

  /* ------------------------------------------------------------ Rota */

  const activeRoute = useMemo(
    () => routes.find((r) => r.driverId === session?.id) ?? routes[0],
    [routes, session],
  );

  const target = useMemo(() => {
    if (!activeRoute) return undefined;
    const stop = nextStop(activeRoute);
    if (!stop) return undefined;
    return customers.find((c) => c.id === stop.customerId);
  }, [activeRoute, customers]);

  /* GPS do aparelho.
   *
   * `watchPosition` mantém o rastreamento ligado enquanto a rota corre, em vez
   * de perguntar de tempos em tempos: o navegador entrega cada leitura nova e
   * gasta menos bateria que um `getCurrentPosition` em laço.
   *
   * Só liga durante rota em andamento. Rastrear o motorista fora do expediente
   * seria vigiar, não operar — e queimaria bateria à toa. */
  useEffect(() => {
    if (!activeRoute || activeRoute.status !== 'em_andamento') return;

    if (!('geolocation' in navigator)) {
      setGpsIndisponivel('Este aparelho não tem GPS disponível no navegador.');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (leitura) => {
        setGpsIndisponivel(null);
        setPosition({ lat: leitura.coords.latitude, lng: leitura.coords.longitude });
      },
      (erro) => {
        /* Falhar aqui é comum e não é excepcional: túnel, galpão, prédio alto.
           A tela avisa e segue funcionando — a conferência de chegada passa a
           ser manual, que é como era antes de existir GPS. */
        setGpsIndisponivel(
          erro.code === erro.PERMISSION_DENIED
            ? 'Permissão de localização negada. Libere no navegador para o check-in automático.'
            : 'Sem sinal de GPS agora. A chegada precisa ser confirmada manualmente.',
        );
      },
      {
        enableHighAccuracy: true,
        // Numa entrega, posição de um minuto atrás já não diz onde o veículo
        // está. Melhor esperar leitura nova do que desenhar a antiga.
        maximumAge: 10_000,
        timeout: 20_000,
      },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [activeRoute]);

  /* O marcador do veículo no mapa segue a posição do motorista. */
  useEffect(() => {
    if (!activeRoute || !position) return;
    setVehicles((vs) =>
      vs.map((v) =>
        v.id === activeRoute.vehicleId ? { ...v, lat: position.lat, lng: position.lng } : v,
      ),
    );
  }, [position, activeRoute]);

  /* Distância em linha reta — sempre menor que o caminho pela rua. Serve para
     liberar o check-in, não para prometer horário de chegada. */
  const distanceToNextStop = useMemo(() => {
    if (!target || !position || !temCoordenada(target)) return undefined;
    return distanciaKm(position, target);
  }, [target, position]);

  /* -------------------------------------------------------- Carrinho */

  const startCart = useCallback(
    (customerId: string) => {
      /* A forma de pagamento nasce da condição negociada com o cliente, não
         em branco. Quem vende no balcão do cliente já sabe como aquele
         cliente paga — o app não deveria perguntar de novo a cada pedido. */
      const cliente = customers.find((c) => c.id === customerId);
      setCart({
        customerId,
        lines: [],
        discount: 0,
        payment: formaDaCondicao(cliente?.paymentTerms),
        installments: 1,
      });
    },
    [customers],
  );

  const setCartQty = useCallback((productId: string, quantity: number) => {
    setCart((c) => {
      const lines = c.lines.filter((l) => l.productId !== productId);
      if (quantity > 0) lines.push({ productId, quantity });
      return { ...c, lines };
    });
  }, []);

  const setDiscount = useCallback((v: number) => setCart((c) => ({ ...c, discount: Math.max(0, v) })), []);

  const setPayment = useCallback(
    (p: PaymentMethod, opts?: { dueDate?: string; installments?: number }) =>
      setCart((c) => ({
        ...c,
        payment: p,
        dueDate: opts?.dueDate ?? c.dueDate,
        installments: opts?.installments ?? c.installments,
      })),
    [],
  );

  const clearCart = useCallback(() => {
    setCart({ customerId: null, lines: [], discount: 0, payment: null, installments: 1 });
  }, []);

  const submitOrder = useCallback<AppState['submitOrder']>((terms) => {
    const id = nextId('o');
    const customerId = cart.customerId!;
    const payment = cart.payment ?? 'pix';
    const onTerms = payment === 'prazo';
    const order: Order = {
      id,
      number: String(1300 + orders.length),
      customerId,
      items: cart.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: products.find((p) => p.id === l.productId)!.price,
      })),
      discount: cart.discount,
      status: 'confirmado',
      payment,
      dueDate: onTerms ? (terms?.dueDate ?? cart.dueDate) : undefined,
      installments: onTerms ? (terms?.installments ?? cart.installments) : undefined,
      createdAt: new Date().toISOString(),
      sellerId: session?.id ?? 'u1',
      routeId: activeRoute?.id,
    };
    const total = orderTotal(order);
    const cliente = customers.find((c) => c.id === customerId);

    /* Objetos calculados fora do `commit` para a gravação no banco enxergar
       exatamente os mesmos valores que foram para a tela. */
    const clienteAtualizado: Customer | undefined = cliente && {
      ...cliente,
      lastPurchaseAt: order.createdAt,
      totalPurchased: cliente.totalPurchased + total,
      balance: order.payment === 'prazo' ? cliente.balance + total : cliente.balance,
      status: cliente.status === 'novo' ? 'ativo' : cliente.status,
    };
    const conta: Account | undefined =
      order.payment === 'prazo'
        ? {
            id: nextId('a'),
            kind: 'receber',
            partyId: customerId,
            partyName: cliente?.tradeName ?? 'Cliente',
            amount: total,
            paidAmount: 0,
            dueDate: order.dueDate ?? new Date().toISOString(),
            status: 'a_vencer',
            orderId: id,
            method: 'prazo',
          }
        : undefined;
    const lancamento: CashEntry | undefined =
      order.payment === 'prazo'
        ? undefined
        : {
            id: nextId('ce'),
            description: `Recebimento ${cliente?.tradeName ?? ''}`.trim(),
            amount: total,
            direction: 'in',
            method: order.payment,
            at: order.createdAt,
          };
    const estoqueAtualizado = stock
      .filter((item) => order.items.some((i) => i.productId === item.productId))
      .map((item) => ({
        ...item,
        reserved:
          item.reserved + order.items.find((i) => i.productId === item.productId)!.quantity,
      }));

    commit(() => {
      setOrders((o) => [order, ...o]);
      // Reserva o estoque vendido — o disponível para venda cai na hora.
      setStock((s) =>
        s.map((item) => {
          const line = order.items.find((i) => i.productId === item.productId);
          return line ? { ...item, reserved: item.reserved + line.quantity } : item;
        }),
      );
      setCustomers((cs) =>
        cs.map((c) =>
          c.id === customerId
            ? {
                ...c,
                lastPurchaseAt: order.createdAt,
                totalPurchased: c.totalPurchased + total,
                balance: order.payment === 'prazo' ? c.balance + total : c.balance,
                status: c.status === 'novo' ? 'ativo' : c.status,
              }
            : c,
        ),
      );
      if (conta) setAccounts((a) => [conta, ...a]);
      if (lancamento) setCashEntries((c) => [lancamento, ...c]);
    },
      // Ordem importa: o pedido precisa existir antes da conta que o referencia.
      op('inserirPedido', order),
      ...estoqueAtualizado.map((item) => op('salvarEstoque', item)),
      ...(clienteAtualizado ? [op('salvarCliente', clienteAtualizado)] : []),
      ...(conta ? [op('inserirConta', conta)] : []),
      ...(lancamento ? [op('inserirLancamento', lancamento)] : []),
    );
    return id;
  }, [cart, orders.length, session, activeRoute, commit, customers, stock]);

  /* ---------------------------------------------------- Ações de campo */

  const patchRoute = useCallback((routeId: string, patch: (r: Route) => Route) => {
    setRoutes((rs) => rs.map((r) => (r.id === routeId ? patch(r) : r)));
  }, []);

  const patchStop = useCallback(
    (routeId: string, stopId: string, patch: (s: Route['stops'][number]) => Route['stops'][number]) => {
      patchRoute(routeId, (r) => ({
        ...r,
        stops: r.stops.map((s) => (s.id === stopId ? patch(s) : s)),
      }));
    },
    [patchRoute],
  );

  const startRoute = useCallback(
    (routeId: string) => {
      const iniciadaEm = new Date().toISOString();
      const rotaAtual = routes.find((r) => r.id === routeId);
      const veiculoAtual = vehicles.find((v) => v.id === rotaAtual?.vehicleId);
      commit(() => {
        patchRoute(routeId, (r) => ({
          ...r,
          status: 'em_andamento',
          startedAt: iniciadaEm,
          stops: r.stops.map((s, i) => (i === 0 ? { ...s, status: 'a_caminho' } : s)),
        }));
        const route = routes.find((r) => r.id === routeId);
        if (route) {
          setVehicles((vs) =>
            vs.map((v) => (v.id === route.vehicleId ? { ...v, status: 'em_rota', routeId } : v)),
          );
          setOrders((os) =>
            os.map((o) => (o.routeId === routeId && o.status === 'confirmado' ? { ...o, status: 'em_rota' } : o)),
          );
        }
      },
        ...(rotaAtual
          ? [op('atualizarRota', { ...rotaAtual, status: 'em_andamento', startedAt: iniciadaEm })]
          : []),
        ...(rotaAtual?.stops[0]
          ? [op('atualizarParada', { ...rotaAtual.stops[0], status: 'a_caminho' })]
          : []),
        ...(veiculoAtual
          ? [op('atualizarVeiculo', { ...veiculoAtual, status: 'em_rota', routeId })]
          : []),
        op('atualizarPedidosDaRota', routeId, 'confirmado', 'em_rota'),
      );
      toast('Rota iniciada — rastreamento ativo', 'ok');
    },
    [commit, patchRoute, routes, vehicles, toast],
  );

  const arriveAtStop = useCallback(
    (routeId: string, stopId: string) => {
      const chegouEm = new Date().toISOString();
      const parada = routes.find((r) => r.id === routeId)?.stops.find((s) => s.id === stopId);
      commit(
        () => patchStop(routeId, stopId, (s) => ({ ...s, status: 'chegou', arrivedAt: chegouEm })),
        ...(parada
          ? [op('atualizarParada', { ...parada, status: 'chegou', arrivedAt: chegouEm })]
          : []),
      );
      toast('Chegada confirmada', 'ok');
    },
    [commit, patchStop, routes, toast],
  );

  const completeStop = useCallback(
    (routeId: string, stopId: string) => {
      const concluidaEm = new Date().toISOString();
      const rota = routes.find((r) => r.id === routeId);
      const parada = rota?.stops.find((s) => s.id === stopId);
      const seguinte = rota?.stops[(parada?.sequence ?? 0)];
      commit(() => {
        patchStop(routeId, stopId, (s) => ({ ...s, status: 'concluida', completedAt: concluidaEm }));
        patchRoute(routeId, (r) => {
          const idx = r.stops.findIndex((s) => s.id === stopId);
          return {
            ...r,
            stops: r.stops.map((s, i) =>
              i === idx + 1 && s.status === 'pendente' ? { ...s, status: 'a_caminho' } : s,
            ),
          };
        });
      },
        ...(parada
          ? [op('atualizarParada', { ...parada, status: 'concluida', completedAt: concluidaEm })]
          : []),
        ...(seguinte && seguinte.status === 'pendente'
          ? [op('atualizarParada', { ...seguinte, status: 'a_caminho' })]
          : []),
      );
    },
    [commit, patchStop, patchRoute, routes],
  );

  const markStopNotServed = useCallback(
    (routeId: string, stopId: string) => {
      const parada = routes.find((r) => r.id === routeId)?.stops.find((s) => s.id === stopId);
      commit(
        () => patchStop(routeId, stopId, (s) => ({ ...s, status: 'nao_atendida' })),
        ...(parada ? [op('atualizarParada', { ...parada, status: 'nao_atendida' })] : []),
      );
    },
    [commit, patchStop, routes],
  );

  const finishRoute = useCallback(
    (routeId: string) => {
      const finalizadaEm = new Date().toISOString();
      const rotaAtual = routes.find((r) => r.id === routeId);
      const veiculoAtual = vehicles.find((v) => v.id === rotaAtual?.vehicleId);
      commit(() => {
        patchRoute(routeId, (r) => ({ ...r, status: 'finalizada', finishedAt: finalizadaEm }));
        const route = routes.find((r) => r.id === routeId);
        if (route) {
          setVehicles((vs) =>
            vs.map((v) => (v.id === route.vehicleId ? { ...v, status: 'disponivel', routeId: undefined } : v)),
          );
        }
      },
        ...(rotaAtual
          ? [op('atualizarRota', { ...rotaAtual, status: 'finalizada', finishedAt: finalizadaEm })]
          : []),
        ...(veiculoAtual
          ? [op('atualizarVeiculo', { ...veiculoAtual, status: 'disponivel', routeId: undefined })]
          : []),
      );
      toast('Rota finalizada', 'ok');
    },
    [commit, patchRoute, routes, vehicles, toast],
  );

  const confirmDelivery = useCallback(
    (orderId: string, receiver: string) => {
      const pedido = orders.find((o) => o.id === orderId);
      const agora = new Date().toISOString();
      const movimentacao: StockMove | undefined = pedido && {
        id: nextId('m'),
        kind: 'saida',
        productId: pedido.items[0]?.productId ?? 'p1',
        boxes: pedido.items.reduce((t, i) => t + i.quantity, 0),
        note: `Entrega pedido #${pedido.number}`,
        at: agora,
        user: session?.name ?? 'Sistema',
      };
      const estoqueBaixado = pedido
        ? stock
            .filter((item) => pedido.items.some((i) => i.productId === item.productId))
            .map((item) => {
              const linha = pedido.items.find((i) => i.productId === item.productId)!;
              return {
                ...item,
                onHand: Math.max(0, item.onHand - linha.quantity),
                reserved: Math.max(0, item.reserved - linha.quantity),
              };
            })
        : [];
      commit(() => {
        setOrders((os) => os.map((o) => (o.id === orderId ? { ...o, status: 'entregue' } : o)));
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          // Entrega consome a reserva: sai do estoque de verdade.
          setStock((s) =>
            s.map((item) => {
              const line = order.items.find((i) => i.productId === item.productId);
              if (!line) return item;
              return {
                ...item,
                onHand: Math.max(0, item.onHand - line.quantity),
                reserved: Math.max(0, item.reserved - line.quantity),
              };
            }),
          );
          if (movimentacao) setStockMoves((m) => [movimentacao, ...m]);
        }
      },
        op('atualizarPedido', orderId, { status: 'entregue' }),
        ...estoqueBaixado.map((item) => op('salvarEstoque', item)),
        ...(movimentacao ? [op('inserirMovimentacao', movimentacao)] : []),
      );
      toast(`Entrega confirmada para ${receiver}`, 'ok');
    },
    [commit, orders, session, stock, toast],
  );

  const registerIncident = useCallback(
    (input: { kind: IncidentKind; customerId: string; routeId: string; note: string }) => {
      const ocorrencia: Incident = { id: nextId('i'), at: new Date().toISOString(), ...input };
      commit(
        () => setIncidents((i) => [ocorrencia, ...i]),
        op('inserirOcorrencia', ocorrencia),
      );
      toast('Ocorrência registrada', 'warn');
    },
    [commit, toast],
  );

  const registerReturn = useCallback(
    (input: { customerId: string; routeId: string; productId: string; boxes: number; reason: ReturnReason }) => {
      const agora = new Date().toISOString();
      const devolucao: StockReturn = { id: nextId('d'), at: agora, ...input };
      // Devolução volta para o estoque, exceto avaria (vira perda).
      const voltaAoEstoque = input.reason !== 'avaria';
      const movimentacao: StockMove = {
        id: nextId('m'),
        kind: voltaAoEstoque ? 'entrada' : 'perda',
        productId: input.productId,
        boxes: input.boxes,
        note: `Devolução — ${input.reason}`,
        at: agora,
        user: session?.name ?? 'Sistema',
      };
      const itemAtual = stock.find((i) => i.productId === input.productId);
      const itemAtualizado =
        itemAtual && voltaAoEstoque
          ? { ...itemAtual, onHand: itemAtual.onHand + input.boxes }
          : undefined;

      commit(() => {
        setReturns((r) => [devolucao, ...r]);
        if (itemAtualizado) {
          setStock((s) => s.map((i) => (i.productId === input.productId ? itemAtualizado : i)));
        }
        setStockMoves((m) => [movimentacao, ...m]);
      },
        op('inserirDevolucao', devolucao),
        ...(itemAtualizado ? [op('salvarEstoque', itemAtualizado)] : []),
        op('inserirMovimentacao', movimentacao),
      );
      toast(`${input.boxes} cx devolvidas`, 'warn');
    },
    [commit, session, stock, toast],
  );

  /* -------------------------------------------------------- Retaguarda */

  const registerAccountPayment = useCallback(
    (accountId: string, amount: number, method: PaymentMethod) => {
      const conta = accounts.find((a) => a.id === accountId);
      if (!conta) return;
      const paga = { ...conta, paidAmount: conta.paidAmount + amount };
      const contaAtualizada: Account = { ...paga, status: resolveAccountStatus(paga) };
      const lancamento: CashEntry = {
        id: nextId('ce'),
        description: `${conta.kind === 'receber' ? 'Recebimento' : 'Pagamento'} ${conta.partyName}`,
        amount,
        direction: conta.kind === 'receber' ? 'in' : 'out',
        method,
        at: new Date().toISOString(),
      };
      const cliente =
        conta.kind === 'receber' ? customers.find((c) => c.id === conta.partyId) : undefined;
      const clienteAtualizado: Customer | undefined = cliente && {
        ...cliente,
        balance: Math.max(0, cliente.balance - amount),
        status:
          cliente.status === 'inadimplente' && cliente.balance - amount <= 0
            ? 'ativo'
            : cliente.status,
      };

      commit(() => {
        setAccounts((as) => as.map((a) => (a.id === accountId ? contaAtualizada : a)));
        setCashEntries((c) => [lancamento, ...c]);
        if (clienteAtualizado) {
          setCustomers((cs) =>
            cs.map((c) => (c.id === clienteAtualizado.id ? clienteAtualizado : c)),
          );
        }
      },
        op('atualizarConta', contaAtualizada),
        op('inserirLancamento', lancamento),
        ...(clienteAtualizado ? [op('salvarCliente', clienteAtualizado)] : []),
      );
      toast('Pagamento registrado', 'ok');
    },
    [commit, accounts, customers, toast],
  );

  const addStockMove = useCallback(
    (input: { kind: StockMoveKind; productId: string; boxes: number; note: string }) => {
      const movimentacao: StockMove = {
        id: nextId('m'),
        at: new Date().toISOString(),
        user: session?.name ?? 'Sistema',
        ...input,
      };
      const atual = stock.find((i) => i.productId === input.productId);
      const novoSaldo = (item: StockItem) => {
        switch (input.kind) {
          case 'entrada':
            return item.onHand + input.boxes;
          case 'saida':
          case 'perda':
            return Math.max(0, item.onHand - input.boxes);
          case 'inventario':
            return input.boxes;
          default:
            return item.onHand;
        }
      };
      const atualizado = atual ? { ...atual, onHand: novoSaldo(atual) } : undefined;

      commit(() => {
        setStockMoves((m) => [movimentacao, ...m]);
        if (atualizado) {
          setStock((s) => s.map((i) => (i.productId === input.productId ? atualizado : i)));
        }
      },
        op('inserirMovimentacao', movimentacao),
        ...(atualizado ? [op('salvarEstoque', atualizado)] : []),
      );
      toast('Movimentação registrada', 'ok');
    },
    [commit, session, stock, toast],
  );

  const receivePurchase = useCallback(
    (purchaseId: string) => {
      const purchase = purchases.find((p) => p.id === purchaseId);
      if (!purchase) return;
      const agora = new Date().toISOString();
      // Um lote novo por item da compra — é o que dá rastreio FEFO à entrada.
      const lotes = purchase.items.map((line) => ({
        id: nextId('b'),
        productId: line.productId,
        code: line.batchCode,
        expiresAt: line.expiresAt,
        boxes: line.boxes,
        supplierId: purchase.supplierId,
      }));
      const estoqueAtualizado = stock
        .filter((item) => purchase.items.some((i) => i.productId === item.productId))
        .map((item) => {
          const line = purchase.items.find((i) => i.productId === item.productId)!;
          return {
            ...item,
            onHand: item.onHand + line.boxes,
            batches: [...item.batches, lotes.find((l) => l.productId === item.productId)!],
          };
        });
      const movimentacoes: StockMove[] = purchase.items.map((line) => ({
        id: nextId('m'),
        kind: 'entrada' as const,
        productId: line.productId,
        boxes: line.boxes,
        note: `Compra #${purchase.number}`,
        at: agora,
        user: session?.name ?? 'Sistema',
      }));

      commit(() => {
        setPurchases((ps) => ps.map((p) => (p.id === purchaseId ? { ...p, status: 'recebida' } : p)));
        setStock((s) =>
          s.map((item) => {
            const atualizado = estoqueAtualizado.find((x) => x.productId === item.productId);
            return atualizado ?? item;
          }),
        );
        setStockMoves((m) => [
          ...movimentacoes,
          ...m,
        ]);
      },
        op('atualizarCompraStatus', purchaseId, 'recebida'),
        ...lotes.map((lote) => op('inserirLote', lote)),
        ...estoqueAtualizado.map((item) => op('salvarEstoque', item)),
        ...movimentacoes.map((m) => op('inserirMovimentacao', m)),
      );
      toast('Entrada registrada no estoque', 'ok');
    },
    [purchases, commit, session, stock, toast],
  );

  const createPurchase = useCallback<AppState['createPurchase']>(
    (input) => {
      const id = nextId('pc');
      const compra: Purchase = {
        id,
        number: String(3311 + purchases.length),
        status: 'aberta',
        createdAt: new Date().toISOString(),
        ...input,
      };
      commit(
        () => setPurchases((ps) => [compra, ...ps]),
        op('inserirCompra', compra),
      );
      toast('Compra registrada', 'ok');
      return id;
    },
    [commit, purchases.length, toast],
  );

  const createCustomer = useCallback<AppState['createCustomer']>(
    (input) => {
      const id = nextId('c');
      /* Sem coordenada inventada: `input` traz lat/lng quando o cadastro
         localizou o endereço, e não traz quando não localizou. Cliente sem
         coordenada fica fora do mapa e continua na lista — a versão anterior
         sorteava uma posição, o que colocava cliente real em rua errada. */
      const cliente: Customer = {
        ...input,
        id,
        balance: 0,
        lastPurchaseAt: null,
        totalPurchased: 0,
      };
      commit(
        () => setCustomers((cs) => [cliente, ...cs]),
        op('salvarCliente', cliente),
      );
      toast('Cliente cadastrado', 'ok');
      return id;
    },
    [commit, toast],
  );

  const markNotificationsRead = useCallback(() => {
    commit(
      () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))),
      op('marcarNotificacoesLidas'),
    );
  }, [commit]);

  /* ---------------------------------------------------------- Sessão */

  const criarDistribuidora = useCallback<AppState['criarDistribuidora']>(
    async (dados) => {
      const nova = await repo.criarDistribuidora(dados);
      setDistribuidoras((ds) => [...ds, nova].sort((a, b) => a.nome.localeCompare(b.nome)));
      toast(`${nova.nome} criada`, 'ok');
      return nova;
    },
    [toast],
  );

  const signIn = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (!error) return null;

    /* O Supabase devolve a mesma mensagem para e-mail inexistente e senha
       errada, de propósito: dizer qual dos dois falhou entrega a quem tenta
       adivinhar a informação de que aquele e-mail existe. A tradução aqui
       mantém isso e troca o texto técnico por um que orienta. */
    if (error.message.includes('Invalid login credentials')) {
      return 'E-mail ou senha incorretos.';
    }
    if (error.message.includes('Email not confirmed')) {
      return 'Este acesso ainda não foi confirmado. Fale com o gestor da operação.';
    }
    if (error.message.toLowerCase().includes('failed to fetch')) {
      return 'Sem conexão para entrar. O login precisa de internet uma vez.';
    }
    return 'Não foi possível entrar agora. Tente de novo em instantes.';
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setSemVinculo(false);
    setAdminPlataforma(false);
    setDistribuidoras([]);
    clearCart();
  }, [clearCart]);

  const value = useMemo<AppState>(
    () => ({
      carregando, erroCarga, recarregar,
      autenticado, session, semVinculo, signIn, signOut,
      adminPlataforma,
      distribuidoras,
      distribuidora: session
        ? distribuidoras.find((d) => d.id === session.distribuidoraId) ?? distribuidoras[0]
        : undefined,
      criarDistribuidora,
      connection, pendingSync, syncNow, filaPersistente: filaPersistente(),
      customers, orders, routes, vehicles, stock, stockMoves, purchases,
      accounts, cashEntries, incidents, returns, notifications,
      position, gpsIndisponivel,
      distanceToNextStop,
      isAtNextStop: distanceToNextStop !== undefined && distanceToNextStop <= ARRIVAL_RADIUS_KM,
      activeRoute,
      cart, startCart, setCartQty, setDiscount, setPayment, clearCart, submitOrder,
      startRoute, arriveAtStop, completeStop, markStopNotServed, finishRoute,
      confirmDelivery, registerIncident, registerReturn,
      registerAccountPayment, addStockMove, receivePurchase, createPurchase,
      createCustomer, markNotificationsRead,
      toasts, toast, dismissToast,
    }),
    [
      carregando, erroCarga, recarregar,
      autenticado, session, semVinculo, signIn, signOut,
      adminPlataforma, distribuidoras, criarDistribuidora,
      connection, pendingSync, syncNow,
      customers, orders, routes, vehicles, stock, stockMoves, purchases,
      accounts, cashEntries, incidents, returns, notifications,
      position, gpsIndisponivel, distanceToNextStop, activeRoute,
      cart, startCart, setCartQty, setDiscount, setPayment, clearCart, submitOrder,
      startRoute, arriveAtStop, completeStop, markStopNotServed, finishRoute,
      confirmDelivery, registerIncident, registerReturn,
      registerAccountPayment, addStockMove, receivePurchase, createPurchase,
      createCustomer, markNotificationsRead, toasts, toast, dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp precisa estar dentro de AppProvider');
  return ctx;
}

/* Atalhos de leitura usados em várias telas. */

export function useCustomer(id: string | undefined) {
  const { customers } = useApp();
  return customers.find((c) => c.id === id);
}

export function useOrder(id: string | undefined) {
  const { orders } = useApp();
  return orders.find((o) => o.id === id);
}

export function useRoute(id: string | undefined) {
  const { routes, activeRoute } = useApp();
  return routes.find((r) => r.id === id) ?? activeRoute;
}

export function useStockItem(productId: string | undefined) {
  const { stock } = useApp();
  return stock.find((s) => s.productId === productId);
}

export { available };
