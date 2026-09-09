import type { Operacao } from '../data/operacoes';

/* Fila de sincronização persistida em IndexedDB.
 *
 * O que a equipe registra na rua precisa sobreviver a fechar o app, ao
 * navegador reciclar a aba em segundo plano e à bateria acabar. Antes a fila
 * era um array em memória: qualquer uma dessas três coisas apagava pedidos e
 * entregas já registrados.
 *
 * IndexedDB e não localStorage por dois motivos: guarda objeto estruturado sem
 * passar por JSON (datas e números sobrevivem), e não tem o teto de ~5 MB que
 * um dia de rota sem sinal alcançaria.
 *
 * A chave é autoincremental de propósito — ela É a ordem da fila. As operações
 * dependem umas das outras (o item do pedido não existe antes do pedido), e
 * reenviar fora de ordem quebraria a chave estrangeira no banco.
 */

const BANCO = 'ovolog';
const VERSAO = 1;
const LOJA = 'fila';

export interface ItemFila {
  /** Ordem de entrada. Definida pelo IndexedDB, nunca pelo app. */
  id: number;
  operacao: Operacao;
  /** Quando entrou na fila — a interface usa para dizer "há 20 minutos". */
  em: string;
}

let conexao: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (conexao) return conexao;
  conexao = new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOJA)) {
        db.createObjectStore(LOJA, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponível'));
  });
  /* Uma falha na abertura não pode envenenar as próximas tentativas: sem isto,
     um erro momentâneo deixaria a promessa rejeitada em cache para sempre. */
  conexao.catch(() => {
    conexao = null;
  });
  return conexao;
}

function transacao<T>(
  modo: IDBTransactionMode,
  executar: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(LOJA, modo);
        const req = executar(tx.objectStore(LOJA));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Falha no IndexedDB'));
      }),
  );
}

/* O IndexedDB pode simplesmente não existir: navegação anônima em alguns
   navegadores, armazenamento bloqueado por política, cota esgotada. Nesses
   casos o app não pode parar de funcionar — ele volta ao comportamento antigo
   (fila só em memória) e avisa quem está usando. A flag registra isso. */
let persistenciaOk = true;

export const filaPersistente = () => persistenciaOk;

function falhou(e: unknown) {
  persistenciaOk = false;
  console.warn('[fila] persistência indisponível, seguindo só em memória', e);
}

export async function lerFila(): Promise<ItemFila[]> {
  try {
    const itens = await transacao<ItemFila[]>('readonly', (loja) => loja.getAll());
    // getAll devolve na ordem da chave, que é a ordem de entrada.
    return itens;
  } catch (e) {
    falhou(e);
    return [];
  }
}

export async function enfileirarNoDisco(operacao: Operacao): Promise<number | null> {
  try {
    const chave = await transacao<IDBValidKey>('readwrite', (loja) =>
      loja.add({ operacao, em: new Date().toISOString() }),
    );
    return Number(chave);
  } catch (e) {
    falhou(e);
    return null;
  }
}

export async function removerDoDisco(id: number): Promise<void> {
  try {
    await transacao('readwrite', (loja) => loja.delete(id));
  } catch (e) {
    falhou(e);
  }
}

/** Usada só pelo suporte, quando uma operação da fila é irrecuperável. */
export async function limparFila(): Promise<void> {
  try {
    await transacao('readwrite', (loja) => loja.clear());
  } catch (e) {
    falhou(e);
  }
}
