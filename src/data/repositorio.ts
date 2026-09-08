import { supabase } from '../lib/supabase';
import type {
  Account,
  Product,
  Supplier,
  AppNotification,
  CashEntry,
  Customer,
  Incident,
  Order,
  Purchase,
  Route,
  RouteStop,
  StockItem,
  StockMove,
  StockReturn,
  User,
  Vehicle,
} from '../types';

/* Fronteira entre o banco e o domínio.
 *
 * O banco fala português e é normalizado (pedido_itens, rota_paradas,
 * rota_carga…); o app fala os tipos de `types.ts`, com os itens aninhados no
 * pedido. Toda tradução acontece aqui — nenhuma tela ou store conhece nome de
 * coluna, e trocar o backend significa reescrever só este arquivo.
 */

/* ------------------------------------------------------------- Leitura */

export interface EstadoRemoto {
  produtos: Product[];
  fornecedores: Supplier[];
  usuarios: User[];
  clientes: Customer[];
  veiculos: Vehicle[];
  pedidos: Order[];
  rotas: Route[];
  estoque: StockItem[];
  movimentacoes: StockMove[];
  compras: Purchase[];
  contas: Account[];
  caixa: CashEntry[];
  ocorrencias: Incident[];
  devolucoes: StockReturn[];
  notificacoes: AppNotification[];
}

const num = (v: unknown) => Number(v ?? 0);
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : undefined);

/** Um `date` do Postgres vira meio-dia local, não meia-noite UTC — assim a
 *  data não "anda" um dia para trás em fusos negativos como o do Brasil. */
function dataLocal(v: unknown): string {
  if (!v) return new Date().toISOString();
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00`).toISOString();
  return new Date(s).toISOString();
}

export async function carregarEstado(): Promise<EstadoRemoto> {
  const [
    produtos, fornecedores,
    usuarios, clientes, veiculos, produtosEstoque, lotes, movimentacoes,
    rotas, paradas, carga, paradaPedidos, pedidos, itens,
    compras, compraItens, contas, caixa, ocorrencias, devolucoes, notificacoes,
  ] = await Promise.all([
    // Ordem explícita em tudo que aparece em lista: sem ORDER BY o Postgres
    // não garante ordem nenhuma, e o cadastro trocaria de posição a cada
    // carga sem motivo aparente para quem usa.
    sel('produtos', 'nome'),
    sel('fornecedores', 'nome'),
    sel('usuarios', 'nome'),
    sel('clientes', 'nome_fantasia'),
    sel('veiculos', 'nome'),
    sel('estoque'),
    sel('lotes'),
    sel('movimentacoes_estoque', 'em', false),
    sel('rotas'),
    sel('rota_paradas', 'sequencia', true),
    sel('rota_carga'),
    sel('rota_parada_pedidos'),
    sel('pedidos', 'criado_em', false),
    sel('pedido_itens'),
    sel('compras', 'criado_em', false),
    sel('compra_itens'),
    sel('contas', 'vencimento', true),
    sel('caixa_lancamentos', 'em', false),
    sel('ocorrencias', 'em', false),
    sel('devolucoes', 'em', false),
    sel('notificacoes', 'em', false),
  ]);

  const itensPorPedido = agrupar(itens, (r) => String(r.pedido_id));
  const pedidosPorParada = agrupar(paradaPedidos, (r) => String(r.parada_id));
  const paradasPorRota = agrupar(paradas, (r) => String(r.rota_id));
  const cargaPorRota = agrupar(carga, (r) => String(r.rota_id));
  const lotesPorProduto = agrupar(lotes, (r) => String(r.produto_id));
  const itensPorCompra = agrupar(compraItens, (r) => String(r.compra_id));

  return {
    produtos: produtos.map((r) => ({
      id: String(r.id),
      name: String(r.nome),
      kind: r.tipo as Product['kind'],
      price: num(r.preco),
      cost: num(r.custo),
      unit: String(r.unidade ?? 'caixa'),
      dozensPerBox: num(r.duzias_por_caixa),
      emoji: String(r.emoji ?? '🥚'),
    })),

    fornecedores: fornecedores.map((r) => ({
      id: String(r.id),
      name: String(r.nome),
      document: String(r.documento ?? ''),
      phone: String(r.telefone ?? ''),
      city: String(r.cidade ?? ''),
    })),

    usuarios: usuarios.map((r) => ({
      id: String(r.id),
      name: String(r.nome),
      role: r.papel as User['role'],
      phone: String(r.telefone ?? ''),
      email: String(r.email ?? ''),
      initials: String(r.iniciais ?? ''),
      vehicleId: r.veiculo_id ? String(r.veiculo_id) : undefined,
    })),

    clientes: clientes.map((r) => ({
      id: String(r.id),
      name: String(r.nome),
      tradeName: String(r.nome_fantasia),
      document: String(r.documento ?? ''),
      phone: String(r.telefone ?? ''),
      district: String(r.bairro ?? ''),
      address: String(r.endereco ?? ''),
      status: r.status as Customer['status'],
      balance: num(r.saldo),
      creditLimit: num(r.limite_credito),
      totalPurchased: num(r.total_comprado),
      paymentTerms: String(r.condicao_pagamento ?? 'À vista'),
      x: num(r.x),
      y: num(r.y),
      // Derivada dos pedidos, como no restante do app — o cadastro não guarda
      // essa data para os dois não saírem de sincronia.
      lastPurchaseAt:
        pedidos
          .filter((p) => p.cliente_id === r.id)
          .reduce<string | null>(
            (ult, p) => (!ult || String(p.criado_em) > ult ? String(p.criado_em) : ult),
            null,
          ),
    })),

    veiculos: veiculos.map((r) => ({
      id: String(r.id),
      name: String(r.nome),
      plate: String(r.placa),
      model: String(r.modelo ?? ''),
      driverId: String(r.motorista_id ?? ''),
      status: r.status as Vehicle['status'],
      capacityBoxes: num(r.capacidade_caixas),
      odometer: num(r.odometro),
      kmToday: num(r.km_hoje),
      x: num(r.x),
      y: num(r.y),
      routeId: r.rota_id ? String(r.rota_id) : undefined,
      lastMaintenance: String(r.ultima_manutencao ?? ''),
      fuelLevel: num(r.nivel_combustivel),
    })),

    estoque: produtosEstoque.map((r) => ({
      productId: String(r.produto_id),
      onHand: num(r.em_maos),
      reserved: num(r.reservado),
      minimum: num(r.minimo),
      batches: (lotesPorProduto[String(r.produto_id)] ?? []).map((l) => ({
        id: String(l.id),
        productId: String(l.produto_id),
        code: String(l.codigo),
        expiresAt: dataLocal(l.validade),
        boxes: num(l.caixas),
        supplierId: String(l.fornecedor_id ?? ''),
      })),
    })),

    movimentacoes: movimentacoes.map((r) => ({
      id: String(r.id),
      kind: r.tipo as StockMove['kind'],
      productId: String(r.produto_id),
      boxes: num(r.caixas),
      note: String(r.observacao ?? ''),
      user: String(r.usuario ?? ''),
      at: String(r.em),
    })),

    rotas: rotas.map((r) => ({
      id: String(r.id),
      number: String(r.numero),
      driverId: String(r.motorista_id ?? ''),
      vehicleId: String(r.veiculo_id ?? ''),
      status: r.status as Route['status'],
      date: dataLocal(r.data),
      distanceKm: num(r.distancia_km),
      estimatedMinutes: num(r.minutos_estimados),
      startedAt: iso(r.iniciada_em),
      finishedAt: iso(r.finalizada_em),
      load: (cargaPorRota[String(r.id)] ?? []).map((c) => ({
        productId: String(c.produto_id),
        boxes: num(c.caixas),
      })),
      stops: (paradasPorRota[String(r.id)] ?? [])
        .slice()
        .sort((a, b) => num(a.sequencia) - num(b.sequencia))
        .map<RouteStop>((s) => ({
          id: String(s.id),
          customerId: String(s.cliente_id),
          sequence: num(s.sequencia),
          status: s.status as RouteStop['status'],
          distanceKm: num(s.distancia_km),
          etaMinutes: num(s.eta_minutos),
          arrivedAt: iso(s.chegou_em),
          completedAt: iso(s.concluida_em),
          orderIds: (pedidosPorParada[String(s.id)] ?? []).map((p) => String(p.pedido_id)),
        })),
    })),

    pedidos: pedidos.map((r) => ({
      id: String(r.id),
      number: String(r.numero),
      customerId: String(r.cliente_id),
      discount: num(r.desconto),
      status: r.status as Order['status'],
      payment: r.pagamento as Order['payment'],
      dueDate: r.vencimento ? dataLocal(r.vencimento) : undefined,
      installments: r.parcelas ? num(r.parcelas) : undefined,
      sellerId: String(r.vendedor_id ?? ''),
      routeId: r.rota_id ? String(r.rota_id) : undefined,
      createdAt: String(r.criado_em),
      items: (itensPorPedido[String(r.id)] ?? []).map((i) => ({
        productId: String(i.produto_id),
        quantity: num(i.quantidade),
        unitPrice: num(i.preco_unitario),
      })),
    })),

    compras: compras.map((r) => ({
      id: String(r.id),
      number: String(r.numero),
      supplierId: String(r.fornecedor_id ?? ''),
      status: r.status as Purchase['status'],
      createdAt: String(r.criado_em),
      expectedAt: dataLocal(r.previsto_para),
      items: (itensPorCompra[String(r.id)] ?? []).map((i) => ({
        productId: String(i.produto_id),
        boxes: num(i.caixas),
        unitCost: num(i.custo_unitario),
        batchCode: String(i.codigo_lote ?? ''),
        expiresAt: dataLocal(i.validade),
      })),
    })),

    contas: contas.map((r) => ({
      id: String(r.id),
      kind: r.tipo as Account['kind'],
      partyId: String(r.parte_id),
      partyName: String(r.parte_nome),
      amount: num(r.valor),
      paidAmount: num(r.valor_pago),
      dueDate: dataLocal(r.vencimento),
      status: r.status as Account['status'],
      orderId: r.pedido_id ? String(r.pedido_id) : undefined,
      method: (r.metodo ?? undefined) as Account['method'],
    })),

    caixa: caixa.map((r) => ({
      id: String(r.id),
      description: String(r.descricao),
      amount: num(r.valor),
      direction: r.direcao as CashEntry['direction'],
      method: r.metodo as CashEntry['method'],
      at: String(r.em),
    })),

    ocorrencias: ocorrencias.map((r) => ({
      id: String(r.id),
      kind: r.tipo as Incident['kind'],
      customerId: String(r.cliente_id ?? ''),
      routeId: String(r.rota_id ?? ''),
      note: String(r.observacao ?? ''),
      at: String(r.em),
    })),

    devolucoes: devolucoes.map((r) => ({
      id: String(r.id),
      customerId: String(r.cliente_id ?? ''),
      routeId: String(r.rota_id ?? ''),
      productId: String(r.produto_id),
      boxes: num(r.caixas),
      reason: r.motivo as StockReturn['reason'],
      at: String(r.em),
    })),

    notificacoes: notificacoes.map((r) => ({
      id: String(r.id),
      kind: r.tipo as AppNotification['kind'],
      title: String(r.titulo),
      body: String(r.corpo ?? ''),
      read: Boolean(r.lida),
      at: String(r.em),
    })),
  };
}

type Linha = Record<string, unknown>;

async function sel(tabela: string, ordenarPor?: string, asc = true): Promise<Linha[]> {
  let q = supabase.from(tabela).select('*');
  if (ordenarPor) q = q.order(ordenarPor, { ascending: asc });
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao ler "${tabela}": ${error.message}`);
  return (data ?? []) as Linha[];
}

function agrupar(linhas: Linha[], chave: (l: Linha) => string) {
  return linhas.reduce<Record<string, Linha[]>>((acc, l) => {
    const k = chave(l);
    (acc[k] ??= []).push(l);
    return acc;
  }, {});
}

/* ------------------------------------------------------------- Escrita */

/* Cada função abaixo é uma operação de negócio, não um CRUD genérico: o store
   as chama por dentro do `commit`, que decide se executa agora ou enfileira
   até a conexão voltar. */

async function exec(rotulo: string, p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(`${rotulo}: ${error.message}`);
}

export async function inserirPedido(pedido: Order) {
  await exec(
    'gravar pedido',
    supabase.from('pedidos').insert({
      id: pedido.id,
      numero: pedido.number,
      cliente_id: pedido.customerId,
      desconto: pedido.discount,
      status: pedido.status,
      pagamento: pedido.payment,
      vencimento: pedido.dueDate ? pedido.dueDate.slice(0, 10) : null,
      parcelas: pedido.installments ?? null,
      vendedor_id: pedido.sellerId || null,
      rota_id: pedido.routeId ?? null,
      criado_em: pedido.createdAt,
    }),
  );
  if (pedido.items.length > 0) {
    await exec(
      'gravar itens do pedido',
      supabase.from('pedido_itens').insert(
        pedido.items.map((i) => ({
          pedido_id: pedido.id,
          produto_id: i.productId,
          quantidade: i.quantity,
          preco_unitario: i.unitPrice,
        })),
      ),
    );
  }
}

export async function atualizarPedido(id: string, campos: { status?: Order['status'] }) {
  await exec(
    'atualizar pedido',
    supabase.from('pedidos').update({ status: campos.status }).eq('id', id),
  );
}

export async function atualizarPedidosDaRota(rotaId: string, de: Order['status'], para: Order['status']) {
  await exec(
    'atualizar pedidos da rota',
    supabase.from('pedidos').update({ status: para }).eq('rota_id', rotaId).eq('status', de),
  );
}

export async function salvarCliente(cliente: Customer) {
  await exec(
    'gravar cliente',
    supabase.from('clientes').upsert({
      id: cliente.id,
      nome: cliente.name,
      nome_fantasia: cliente.tradeName,
      documento: cliente.document,
      telefone: cliente.phone,
      bairro: cliente.district,
      endereco: cliente.address,
      status: cliente.status,
      saldo: cliente.balance,
      limite_credito: cliente.creditLimit,
      total_comprado: cliente.totalPurchased,
      condicao_pagamento: cliente.paymentTerms,
      x: cliente.x,
      y: cliente.y,
      atualizado_em: new Date().toISOString(),
    }),
  );
}

export async function salvarEstoque(item: StockItem) {
  await exec(
    'atualizar estoque',
    supabase
      .from('estoque')
      .update({ em_maos: item.onHand, reservado: item.reserved, minimo: item.minimum })
      .eq('produto_id', item.productId),
  );
}

export async function inserirMovimentacao(m: StockMove) {
  await exec(
    'gravar movimentação',
    supabase.from('movimentacoes_estoque').insert({
      id: m.id,
      tipo: m.kind,
      produto_id: m.productId,
      caixas: m.boxes,
      observacao: m.note,
      usuario: m.user,
      em: m.at,
    }),
  );
}

export async function atualizarRota(rota: Route) {
  await exec(
    'atualizar rota',
    supabase
      .from('rotas')
      .update({
        status: rota.status,
        iniciada_em: rota.startedAt ?? null,
        finalizada_em: rota.finishedAt ?? null,
      })
      .eq('id', rota.id),
  );
}

export async function atualizarParada(parada: RouteStop) {
  await exec(
    'atualizar parada',
    supabase
      .from('rota_paradas')
      .update({
        status: parada.status,
        chegou_em: parada.arrivedAt ?? null,
        concluida_em: parada.completedAt ?? null,
      })
      .eq('id', parada.id),
  );
}

export async function atualizarVeiculo(v: Vehicle) {
  await exec(
    'atualizar veículo',
    supabase
      .from('veiculos')
      .update({ status: v.status, rota_id: v.routeId ?? null, x: v.x, y: v.y })
      .eq('id', v.id),
  );
}

export async function inserirConta(conta: Account) {
  await exec(
    'gravar conta',
    supabase.from('contas').insert({
      id: conta.id,
      tipo: conta.kind,
      parte_id: conta.partyId,
      parte_nome: conta.partyName,
      valor: conta.amount,
      valor_pago: conta.paidAmount,
      vencimento: conta.dueDate.slice(0, 10),
      status: conta.status,
      pedido_id: conta.orderId ?? null,
      metodo: conta.method ?? null,
    }),
  );
}

export async function atualizarConta(conta: Account) {
  await exec(
    'atualizar conta',
    supabase
      .from('contas')
      .update({ valor_pago: conta.paidAmount, status: conta.status })
      .eq('id', conta.id),
  );
}

export async function inserirLancamento(c: CashEntry) {
  await exec(
    'gravar lançamento',
    supabase.from('caixa_lancamentos').insert({
      id: c.id,
      descricao: c.description,
      valor: c.amount,
      direcao: c.direction,
      metodo: c.method,
      em: c.at,
    }),
  );
}

export async function inserirOcorrencia(o: Incident) {
  await exec(
    'gravar ocorrência',
    supabase.from('ocorrencias').insert({
      id: o.id,
      tipo: o.kind,
      cliente_id: o.customerId || null,
      rota_id: o.routeId || null,
      observacao: o.note,
      em: o.at,
    }),
  );
}

export async function inserirDevolucao(d: StockReturn) {
  await exec(
    'gravar devolução',
    supabase.from('devolucoes').insert({
      id: d.id,
      cliente_id: d.customerId || null,
      rota_id: d.routeId || null,
      produto_id: d.productId,
      caixas: d.boxes,
      motivo: d.reason,
      em: d.at,
    }),
  );
}

export async function inserirCompra(compra: Purchase) {
  await exec(
    'gravar compra',
    supabase.from('compras').insert({
      id: compra.id,
      numero: compra.number,
      fornecedor_id: compra.supplierId || null,
      status: compra.status,
      criado_em: compra.createdAt,
      previsto_para: compra.expectedAt.slice(0, 10),
    }),
  );
  if (compra.items.length > 0) {
    await exec(
      'gravar itens da compra',
      supabase.from('compra_itens').insert(
        compra.items.map((i) => ({
          compra_id: compra.id,
          produto_id: i.productId,
          caixas: i.boxes,
          custo_unitario: i.unitCost,
          codigo_lote: i.batchCode,
          validade: i.expiresAt.slice(0, 10),
        })),
      ),
    );
  }
}

export async function atualizarCompraStatus(id: string, status: Purchase['status']) {
  await exec('atualizar compra', supabase.from('compras').update({ status }).eq('id', id));
}

export async function inserirLote(lote: StockItem['batches'][number]) {
  await exec(
    'gravar lote',
    supabase.from('lotes').insert({
      id: lote.id,
      produto_id: lote.productId,
      codigo: lote.code,
      validade: lote.expiresAt.slice(0, 10),
      caixas: lote.boxes,
      fornecedor_id: lote.supplierId || null,
    }),
  );
}

export async function marcarNotificacoesLidas() {
  await exec(
    'marcar notificações',
    supabase.from('notificacoes').update({ lida: true }).eq('lida', false),
  );
}
