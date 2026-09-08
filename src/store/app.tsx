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
import { carregarEstado } from '../data/repositorio';
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

export interface Position {
  x: number;
  y: number;
}

interface AppState {
  /* Carga inicial vinda do banco */
  carregando: boolean;
  erroCarga: string | null;
  recarregar: () => void;

  /* Sessão */
  session: User | null;
  signIn: (userId: string) => void;
  signOut: () => void;

  /* Conectividade */
  connection: ConnectionState;
  pendingSync: number;
  setConnection: (c: ConnectionState) => void;
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

  /* GPS simulado */
  position: Position;
  /** Distância em km até a próxima parada da rota ativa. */
  distanceToNextStop: number;
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
  createCustomer: (input: Omit<Customer, 'id' | 'balance' | 'lastPurchaseAt' | 'totalPurchased' | 'x' | 'y'>) => string;
  markNotificationsRead: () => void;

  /* Toast */
  toasts: Toast[];
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

/** Raio de chegada do check-in por GPS, em km. */
const ARRIVAL_RADIUS_KM = 0.25;
/** Escala do mapa estilizado: 1 unidade do plano 0–100 ≈ 0,4 km. */
const UNITS_TO_KM = 0.4;

let idSeq = 1000;
const nextId = (prefix: string) => `${prefix}${++idSeq}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<User | null>(null);

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
  const [position, setPosition] = useState<Position>({ x: 46, y: 52 });

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

  /* ---------------------------------------------------- Carga inicial */

  useEffect(() => {
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
        setCarregando(false);
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setErroCarga(e instanceof Error ? e.message : 'Falha ao carregar os dados.');
        setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  /* --------------------------------------------------------- Offline */

  /* Toda mutação passa por aqui: `apply` altera o estado local na hora, e
     `sincronizar` leva a alteração ao banco.

     O estado local é sempre aplicado primeiro — no campo o app não pode
     esperar a rede para responder. Se a gravação falhar (ou o aparelho estiver
     offline), a operação entra na fila e é reenviada em ordem quando a conexão
     volta. */
  const fila = useRef<{ descricao: string; executar: () => Promise<void> }[]>([]);

  const enfileirar = useCallback((descricao: string, executar: () => Promise<void>) => {
    fila.current.push({ descricao, executar });
    setPendingSync(fila.current.length);
  }, []);

  const commit = useCallback(
    (apply: () => void, sincronizar?: () => Promise<void>) => {
      apply();
      if (!sincronizar) return;
      if (connection !== 'online') {
        enfileirar('alteração', sincronizar);
        return;
      }
      sincronizar().catch((e: unknown) => {
        // Falhou online: guarda para tentar de novo em vez de perder.
        enfileirar('alteração', sincronizar);
        toast(
          `Sem gravar no servidor: ${e instanceof Error ? e.message : 'erro'}`,
          'warn',
        );
      });
    },
    [connection, enfileirar, toast],
  );

  const syncNow = useCallback(async () => {
    if (fila.current.length === 0) {
      setConnectionState('online');
      setPendingSync(0);
      return;
    }
    setConnectionState('sincronizando');
    // Em ordem, e parando no primeiro erro: as operações dependem umas das
    // outras (o item do pedido não existe antes do pedido).
    while (fila.current.length > 0) {
      const proxima = fila.current[0];
      try {
        await proxima.executar();
        fila.current.shift();
        setPendingSync(fila.current.length);
      } catch (e: unknown) {
        setConnectionState('offline');
        toast(
          `Falha ao sincronizar: ${e instanceof Error ? e.message : 'erro'}`,
          'bad',
        );
        return;
      }
    }
    setConnectionState('online');
    toast('Alterações sincronizadas', 'ok');
  }, [toast]);

  const setConnection = useCallback(
    (c: ConnectionState) => {
      if (c === 'online' && fila.current.length > 0) {
        void syncNow();
        return;
      }
      setConnectionState(c);
    },
    [syncNow],
  );

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

  /* GPS simulado: o veículo desliza em direção à próxima parada enquanto a
     rota está em andamento. Sem provedor externo — a experiência visual é a
     mesma, e trocar isso por geolocation real é substituir este efeito. */
  useEffect(() => {
    if (!activeRoute || activeRoute.status !== 'em_andamento' || !target) return;
    const timer = window.setInterval(() => {
      setPosition((p) => {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.4) return { x: target.x, y: target.y };
        // Passo comprimido de propósito: o trajeto real levaria minutos e a
        // tela ficaria parada. Assim a chegada acontece em ~10s.
        const step = Math.min(1.6, dist);
        return { x: p.x + (dx / dist) * step, y: p.y + (dy / dist) * step };
      });
    }, 800);
    return () => window.clearInterval(timer);
  }, [activeRoute, target]);

  /* O marcador do veículo no mapa segue a posição simulada. */
  useEffect(() => {
    if (!activeRoute) return;
    setVehicles((vs) =>
      vs.map((v) => (v.id === activeRoute.vehicleId ? { ...v, x: position.x, y: position.y } : v)),
    );
  }, [position, activeRoute]);

  const distanceToNextStop = useMemo(() => {
    if (!target) return 0;
    return Math.hypot(target.x - position.x, target.y - position.y) * UNITS_TO_KM;
  }, [target, position]);

  /* -------------------------------------------------------- Carrinho */

  const startCart = useCallback((customerId: string) => {
    setCart({ customerId, lines: [], discount: 0, payment: null, installments: 1 });
  }, []);

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
    }, async () => {
      // Ordem importa: o pedido precisa existir antes da conta que o referencia.
      await repo.inserirPedido(order);
      for (const item of estoqueAtualizado) await repo.salvarEstoque(item);
      if (clienteAtualizado) await repo.salvarCliente(clienteAtualizado);
      if (conta) await repo.inserirConta(conta);
      if (lancamento) await repo.inserirLancamento(lancamento);
    });
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
      }, async () => {
        const route = routes.find((r) => r.id === routeId);
        if (!route) return;
        await repo.atualizarRota({ ...route, status: 'em_andamento', startedAt: iniciadaEm });
        const primeira = route.stops[0];
        if (primeira) await repo.atualizarParada({ ...primeira, status: 'a_caminho' });
        const veiculo = vehicles.find((v) => v.id === route.vehicleId);
        if (veiculo) await repo.atualizarVeiculo({ ...veiculo, status: 'em_rota', routeId });
        await repo.atualizarPedidosDaRota(routeId, 'confirmado', 'em_rota');
      });
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
        parada
          ? () => repo.atualizarParada({ ...parada, status: 'chegou', arrivedAt: chegouEm })
          : undefined,
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
      }, async () => {
        if (parada) {
          await repo.atualizarParada({ ...parada, status: 'concluida', completedAt: concluidaEm });
        }
        if (seguinte && seguinte.status === 'pendente') {
          await repo.atualizarParada({ ...seguinte, status: 'a_caminho' });
        }
      });
    },
    [commit, patchStop, patchRoute, routes],
  );

  const markStopNotServed = useCallback(
    (routeId: string, stopId: string) => {
      const parada = routes.find((r) => r.id === routeId)?.stops.find((s) => s.id === stopId);
      commit(
        () => patchStop(routeId, stopId, (s) => ({ ...s, status: 'nao_atendida' })),
        parada ? () => repo.atualizarParada({ ...parada, status: 'nao_atendida' }) : undefined,
      );
    },
    [commit, patchStop, routes],
  );

  const finishRoute = useCallback(
    (routeId: string) => {
      const finalizadaEm = new Date().toISOString();
      commit(() => {
        patchRoute(routeId, (r) => ({ ...r, status: 'finalizada', finishedAt: finalizadaEm }));
        const route = routes.find((r) => r.id === routeId);
        if (route) {
          setVehicles((vs) =>
            vs.map((v) => (v.id === route.vehicleId ? { ...v, status: 'disponivel', routeId: undefined } : v)),
          );
        }
      }, async () => {
        const route = routes.find((r) => r.id === routeId);
        if (!route) return;
        await repo.atualizarRota({ ...route, status: 'finalizada', finishedAt: finalizadaEm });
        const veiculo = vehicles.find((v) => v.id === route.vehicleId);
        if (veiculo) {
          await repo.atualizarVeiculo({ ...veiculo, status: 'disponivel', routeId: undefined });
        }
      });
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
      }, async () => {
        await repo.atualizarPedido(orderId, { status: 'entregue' });
        for (const item of estoqueBaixado) await repo.salvarEstoque(item);
        if (movimentacao) await repo.inserirMovimentacao(movimentacao);
      });
      toast(`Entrega confirmada para ${receiver}`, 'ok');
    },
    [commit, orders, session, stock, toast],
  );

  const registerIncident = useCallback(
    (input: { kind: IncidentKind; customerId: string; routeId: string; note: string }) => {
      const ocorrencia: Incident = { id: nextId('i'), at: new Date().toISOString(), ...input };
      commit(
        () => setIncidents((i) => [ocorrencia, ...i]),
        () => repo.inserirOcorrencia(ocorrencia),
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
      }, async () => {
        await repo.inserirDevolucao(devolucao);
        if (itemAtualizado) await repo.salvarEstoque(itemAtualizado);
        await repo.inserirMovimentacao(movimentacao);
      });
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
      }, async () => {
        await repo.atualizarConta(contaAtualizada);
        await repo.inserirLancamento(lancamento);
        if (clienteAtualizado) await repo.salvarCliente(clienteAtualizado);
      });
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
      }, async () => {
        await repo.inserirMovimentacao(movimentacao);
        if (atualizado) await repo.salvarEstoque(atualizado);
      });
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
      }, async () => {
        await repo.atualizarCompraStatus(purchaseId, 'recebida');
        for (const lote of lotes) await repo.inserirLote(lote);
        for (const item of estoqueAtualizado) await repo.salvarEstoque(item);
        for (const m of movimentacoes) await repo.inserirMovimentacao(m);
      });
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
        () => repo.inserirCompra(compra),
      );
      toast('Compra registrada', 'ok');
      return id;
    },
    [commit, purchases.length, toast],
  );

  const createCustomer = useCallback<AppState['createCustomer']>(
    (input) => {
      const id = nextId('c');
      const cliente: Customer = {
        ...input,
        id,
        balance: 0,
        lastPurchaseAt: null,
        totalPurchased: 0,
        // Posição aproximada no mapa — na versão real viria do GPS/CEP.
        x: 20 + Math.round(Math.random() * 60),
        y: 20 + Math.round(Math.random() * 60),
      };
      commit(
        () => setCustomers((cs) => [cliente, ...cs]),
        () => repo.salvarCliente(cliente),
      );
      toast('Cliente cadastrado', 'ok');
      return id;
    },
    [commit, toast],
  );

  const markNotificationsRead = useCallback(() => {
    commit(
      () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))),
      () => repo.marcarNotificacoesLidas(),
    );
  }, [commit]);

  /* ---------------------------------------------------------- Sessão */

  const signIn = useCallback((userId: string) => {
    const user = users.find((u) => u.id === userId) ?? users[0];
    setSession(user);
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    clearCart();
  }, [clearCart]);

  const value = useMemo<AppState>(
    () => ({
      carregando, erroCarga, recarregar,
      session, signIn, signOut,
      connection, pendingSync, setConnection, syncNow,
      customers, orders, routes, vehicles, stock, stockMoves, purchases,
      accounts, cashEntries, incidents, returns, notifications,
      position,
      distanceToNextStop,
      isAtNextStop: distanceToNextStop <= ARRIVAL_RADIUS_KM,
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
      session, signIn, signOut, connection, pendingSync, setConnection, syncNow,
      customers, orders, routes, vehicles, stock, stockMoves, purchases,
      accounts, cashEntries, incidents, returns, notifications,
      position, distanceToNextStop, activeRoute,
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
