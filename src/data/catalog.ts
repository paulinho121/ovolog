import type { Customer, Product, Supplier, User, Vehicle } from '../types';

/* Cadastros da operação, carregados do banco no boot.
 *
 * Estes arrays nascem VAZIOS de propósito. A fonte de verdade é o Supabase, e
 * um app de produção nunca deve mostrar dado inventado como se fosse real: se
 * o banco não respondeu ou não foi cadastrado, a tela tem que dizer isso, não
 * preencher o buraco com exemplo.
 *
 * Produto, equipe, fornecedor e veículo entram por SQL
 * (`supabase/migrations/0004_dados_reais.sql`) — o app ainda não tem tela de
 * cadastro para eles. Cliente entra pelo próprio app.
 */
export const products: Product[] = [];
export const suppliers: Supplier[] = [];
export const users: User[] = [];
export const vehicles: Vehicle[] = [];
export const customers: Customer[] = [];

/* ------------------------------------------------------------- Buscas */

/* Buscas por id nos cadastros. Só para dados que não mudam em runtime
   (nome, placa, e-mail) — estado vivo (status do veículo, saldo do cliente)
   deve vir do store, nunca daqui.

   Um id órfão devolve um registro neutro em vez de estourar. Acontece de
   verdade: um pedido antigo aponta para o vendedor que saiu da empresa, uma
   rota para o veículo vendido. Antes isso era `.find(...)!` — a asserção
   mentia, `undefined.name` derrubava a tela inteira. Agora aparece "—" no
   lugar do nome e o resto da tela continua de pé. */

const usuarioAusente = (id: string): User => ({
  id,
  name: '—',
  role: 'vendedor',
  phone: '',
  email: '',
  initials: '—',
});

const veiculoAusente = (id: string): Vehicle => ({
  id,
  name: '—',
  plate: '—',
  model: '',
  driverId: '',
  status: 'disponivel',
  capacityBoxes: 0,
  odometer: 0,
  kmToday: 0,
  lastMaintenance: '',
  fuelLevel: 0,
});

const produtoAusente = (id: string): Product => ({
  id,
  name: '—',
  kind: 'branco',
  price: 0,
  cost: 0,
  unit: 'caixa',
  dozensPerBox: 1,
  emoji: '❓',
});

const fornecedorAusente = (id: string): Supplier => ({
  id,
  name: '—',
  document: '',
  phone: '',
  city: '',
});

export const productById = (id: string) =>
  products.find((p) => p.id === id) ?? produtoAusente(id);
export const userById = (id: string) =>
  users.find((u) => u.id === id) ?? usuarioAusente(id);
export const vehicleById = (id: string) =>
  vehicles.find((v) => v.id === id) ?? veiculoAusente(id);
export const supplierById = (id: string) =>
  suppliers.find((s) => s.id === id) ?? fornecedorAusente(id);

/* ------------------------------------------------------------ Hidratação */

/* `hidratarCatalogo` preenche os arrays uma única vez no boot, antes de
   qualquer tela renderizar.

   Mutar em vez de reatribuir é o que permite as ~10 telas continuarem
   importando `products`/`users` direto, sem passar tudo por contexto: este é
   dado de referência, estável durante a sessão inteira. Dado que MUDA em
   runtime (saldo do cliente, status do veículo) vive no store, com estado do
   React — as cópias aqui servem só de ponto de partida. */
function substituir<T>(destino: T[], origem: T[]) {
  destino.length = 0;
  destino.push(...origem);
}

export function hidratarCatalogo(dados: {
  produtos?: Product[];
  fornecedores?: Supplier[];
  usuarios?: User[];
  veiculos?: Vehicle[];
  clientes?: Customer[];
}) {
  if (dados.produtos) substituir(products, dados.produtos);
  if (dados.fornecedores) substituir(suppliers, dados.fornecedores);
  if (dados.usuarios) substituir(users, dados.usuarios);
  if (dados.veiculos) substituir(vehicles, dados.veiculos);
  if (dados.clientes) substituir(customers, dados.clientes);
}

