import * as repo from './repositorio';

/* Catálogo das mutações que podem entrar na fila offline.
 *
 * A fila antiga guardava closures: `() => repo.salvarCliente(cliente)`. Isso
 * funciona em memória e é impossível de persistir — função não serializa. Como
 * a fila vivia só na memória, recarregar a página apagava tudo que a equipe
 * tinha registrado sem sinal.
 *
 * Aqui a operação vira dado: o nome da função e os argumentos. Isso atravessa
 * o `structuredClone` do IndexedDB, sobrevive a fechar o app e é reexecutável
 * na próxima abertura.
 *
 * Só entra neste catálogo o que é seguro repetir. Toda função abaixo grava um
 * registro com id já decidido pelo app (upsert ou update por id), nunca um
 * insert que gera id novo no banco — assim, se a mesma operação subir duas
 * vezes por causa de uma reconexão no meio, o resultado é o mesmo. */
export const OPERACOES = {
  inserirPedido: repo.inserirPedido,
  atualizarPedido: repo.atualizarPedido,
  atualizarPedidosDaRota: repo.atualizarPedidosDaRota,
  salvarCliente: repo.salvarCliente,
  salvarEstoque: repo.salvarEstoque,
  inserirMovimentacao: repo.inserirMovimentacao,
  atualizarRota: repo.atualizarRota,
  atualizarParada: repo.atualizarParada,
  atualizarVeiculo: repo.atualizarVeiculo,
  inserirConta: repo.inserirConta,
  atualizarConta: repo.atualizarConta,
  inserirLancamento: repo.inserirLancamento,
  inserirOcorrencia: repo.inserirOcorrencia,
  inserirDevolucao: repo.inserirDevolucao,
  inserirCompra: repo.inserirCompra,
  atualizarCompraStatus: repo.atualizarCompraStatus,
  inserirLote: repo.inserirLote,
  marcarNotificacoesLidas: repo.marcarNotificacoesLidas,
} as const;

export type NomeOperacao = keyof typeof OPERACOES;

/* União discriminada: cada `fn` só aceita os argumentos da função com aquele
   nome. Errar a ordem ou o tipo de um argumento vira erro de compilação, não
   uma falha de sincronização descoberta no celular do motorista. */
export type Operacao = {
  [K in NomeOperacao]: { fn: K; args: Parameters<(typeof OPERACOES)[K]> };
}[NomeOperacao];

/** Constrói uma operação já validada pelo compilador. */
export function op<K extends NomeOperacao>(
  fn: K,
  ...args: Parameters<(typeof OPERACOES)[K]>
): Operacao {
  return { fn, args } as Operacao;
}

export function executarOperacao(operacao: Operacao): Promise<void> {
  const alvo = OPERACOES[operacao.fn] as (...args: unknown[]) => Promise<void>;
  return alvo(...operacao.args);
}

/** Texto curto para a interface dizer o que está pendente, sem jargão. */
export function descreverOperacao(operacao: Operacao): string {
  const rotulos: Record<NomeOperacao, string> = {
    inserirPedido: 'pedido',
    atualizarPedido: 'status de pedido',
    atualizarPedidosDaRota: 'pedidos da rota',
    salvarCliente: 'cliente',
    salvarEstoque: 'saldo de estoque',
    inserirMovimentacao: 'movimentação de estoque',
    atualizarRota: 'rota',
    atualizarParada: 'parada',
    atualizarVeiculo: 'veículo',
    inserirConta: 'conta',
    atualizarConta: 'baixa de conta',
    inserirLancamento: 'lançamento de caixa',
    inserirOcorrencia: 'ocorrência',
    inserirDevolucao: 'devolução',
    inserirCompra: 'compra',
    atualizarCompraStatus: 'status de compra',
    inserirLote: 'lote',
    marcarNotificacoesLidas: 'notificações lidas',
  };
  return rotulos[operacao.fn];
}
