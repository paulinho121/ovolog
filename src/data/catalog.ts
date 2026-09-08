import type { Customer, Product, Supplier, User, Vehicle } from '../types';

/* Cadastros estáveis do protótipo. O movimento (pedidos, rotas, contas) é
   gerado em `seed.ts` com datas relativas a hoje, para o app nunca parecer
   uma captura de tela velha. */

export const products: Product[] = [
  { id: 'p1', name: 'Ovo Branco Grande', kind: 'branco', price: 185, cost: 142, unit: 'caixa', dozensPerBox: 30, emoji: '🥚' },
  { id: 'p2', name: 'Ovo Vermelho Grande', kind: 'vermelho', price: 208, cost: 161, unit: 'caixa', dozensPerBox: 30, emoji: '🥚' },
  { id: 'p3', name: 'Ovo Caipira', kind: 'caipira', price: 264, cost: 205, unit: 'caixa', dozensPerBox: 20, emoji: '🐓' },
  { id: 'p4', name: 'Ovo de Codorna', kind: 'codorna', price: 96, cost: 71, unit: 'caixa', dozensPerBox: 60, emoji: '🐤' },
  { id: 'p5', name: 'Ovo Orgânico', kind: 'organico', price: 318, cost: 252, unit: 'caixa', dozensPerBox: 20, emoji: '🌿' },
  { id: 'p6', name: 'Ovo Branco Médio', kind: 'branco', price: 162, cost: 124, unit: 'caixa', dozensPerBox: 30, emoji: '🥚' },
];

export const suppliers: Supplier[] = [
  { id: 's1', name: 'Granja Santa Rita', document: '12345678000190', phone: '1938220145', city: 'Bastos - SP' },
  { id: 's2', name: 'Avícola Vale Verde', document: '23456789000181', phone: '1938224477', city: 'Salto - SP' },
  { id: 's3', name: 'Granja Ouro Amarelo', document: '34567890000172', phone: '1439912200', city: 'Bauru - SP' },
  { id: 's4', name: 'Sítio Caipira Feliz', document: '45678901000163', phone: '1499887766', city: 'Itapetininga - SP' },
];

export const users: User[] = [
  { id: 'u1', name: 'João Silva', role: 'vendedor', phone: '11987654321', email: 'joao@ovolog.com.br', vehicleId: 'v1', initials: 'JS' },
  { id: 'u2', name: 'Carlos Ramos', role: 'motorista', phone: '11986543210', email: 'carlos@ovolog.com.br', vehicleId: 'v2', initials: 'CR' },
  { id: 'u3', name: 'Pedro Nunes', role: 'motorista', phone: '11985432109', email: 'pedro@ovolog.com.br', vehicleId: 'v3', initials: 'PN' },
  { id: 'u4', name: 'Marina Costa', role: 'gestor', phone: '11984321098', email: 'marina@ovolog.com.br', initials: 'MC' },
  { id: 'u5', name: 'Rita Alves', role: 'estoque', phone: '11983210987', email: 'rita@ovolog.com.br', initials: 'RA' },
  { id: 'u6', name: 'Bruno Dias', role: 'compras', phone: '11982109876', email: 'bruno@ovolog.com.br', initials: 'BD' },
  { id: 'u7', name: 'Sofia Lima', role: 'financeiro', phone: '11981098765', email: 'sofia@ovolog.com.br', initials: 'SL' },
];

export const vehicles: Vehicle[] = [
  { id: 'v1', name: 'Van 03', plate: 'BRA-2E19', model: 'Renault Master', driverId: 'u1', status: 'em_rota', capacityBoxes: 220, odometer: 84320, kmToday: 41, x: 46, y: 52, routeId: 'r1', lastMaintenance: '2026-07-14', fuelLevel: 0.62 },
  { id: 'v2', name: 'Carro 02', plate: 'FKL-7823', model: 'Fiat Fiorino', driverId: 'u2', status: 'em_rota', capacityBoxes: 90, odometer: 51907, kmToday: 27, x: 68, y: 31, routeId: 'r2', lastMaintenance: '2026-08-02', fuelLevel: 0.44 },
  { id: 'v3', name: 'Van 04', plate: 'GHT-4501', model: 'Mercedes Sprinter', driverId: 'u3', status: 'manutencao', capacityBoxes: 260, odometer: 129450, kmToday: 0, x: 22, y: 74, lastMaintenance: '2026-09-01', fuelLevel: 0.18 },
  { id: 'v4', name: 'Van 05', plate: 'JPQ-1190', model: 'Renault Master', driverId: 'u2', status: 'disponivel', capacityBoxes: 220, odometer: 33180, kmToday: 0, x: 30, y: 40, lastMaintenance: '2026-08-20', fuelLevel: 0.95 },
];

/* x/y são coordenadas no plano 0–100 do mapa estilizado (MapCanvas), não
   latitude/longitude — o protótipo simula GPS sem provedor externo. */
export const customers: Customer[] = [
  { id: 'c1', name: 'Mercadinho São José Ltda', tradeName: 'Mercadinho São José', document: '11222333000144', phone: '11912340001', district: 'Centro', address: 'Rua XV de Novembro, 210', status: 'ativo', balance: 450, creditLimit: 8000, lastPurchaseAt: null, totalPurchased: 74300, paymentTerms: '21 dias', x: 52, y: 46 },
  { id: 'c2', name: 'Padaria Central ME', tradeName: 'Padaria Central', document: '22333444000155', phone: '11912340002', district: 'Centro', address: 'Av. Brasil, 1180', status: 'ativo', balance: 1520, creditLimit: 10000, lastPurchaseAt: null, totalPurchased: 128900, paymentTerms: '28 dias', x: 61, y: 38 },
  { id: 'c3', name: 'Mercado Boa Compra', tradeName: 'Mercado Boa Compra', document: '33444555000166', phone: '11912340003', district: 'Jardim Aurora', address: 'Rua das Palmeiras, 77', status: 'ativo', balance: 0, creditLimit: 12000, lastPurchaseAt: null, totalPurchased: 156450, paymentTerms: 'À vista', x: 70, y: 30 },
  { id: 'c4', name: 'Restaurante Sabor Caseiro', tradeName: 'Sabor Caseiro', document: '44555666000177', phone: '11912340004', district: 'Vila Nova', address: 'Rua Sete de Setembro, 44', status: 'ativo', balance: 890, creditLimit: 6000, lastPurchaseAt: null, totalPurchased: 61200, paymentTerms: '14 dias', x: 76, y: 44 },
  { id: 'c5', name: 'Supermercado Estrela', tradeName: 'Super Estrela', document: '55666777000188', phone: '11912340005', district: 'Jardim Aurora', address: 'Av. dos Trabalhadores, 900', status: 'ativo', balance: 3200, creditLimit: 25000, lastPurchaseAt: null, totalPurchased: 342800, paymentTerms: '28 dias', x: 66, y: 22 },
  { id: 'c6', name: 'Empório do Bairro', tradeName: 'Empório do Bairro', document: '66777888000199', phone: '11912340006', district: 'Vila Nova', address: 'Rua Ipiranga, 305', status: 'inadimplente', balance: 2740, creditLimit: 5000, lastPurchaseAt: null, totalPurchased: 44100, paymentTerms: '21 dias', x: 82, y: 52 },
  { id: 'c7', name: 'Lanchonete do Zé', tradeName: 'Lanchonete do Zé', document: '77888999000100', phone: '11912340007', district: 'Centro', address: 'Praça da Matriz, 12', status: 'ativo', balance: 320, creditLimit: 3000, lastPurchaseAt: null, totalPurchased: 22600, paymentTerms: '7 dias', x: 57, y: 55 },
  { id: 'c8', name: 'Confeitaria Doce Mel', tradeName: 'Doce Mel', document: '88999000000111', phone: '11912340008', district: 'Bela Vista', address: 'Rua Amazonas, 501', status: 'ativo', balance: 1180, creditLimit: 7000, lastPurchaseAt: null, totalPurchased: 88700, paymentTerms: '21 dias', x: 44, y: 64 },
  { id: 'c9', name: 'Mercearia Bom Preço', tradeName: 'Bom Preço', document: '99000111000122', phone: '11912340009', district: 'Bela Vista', address: 'Rua Goiás, 88', status: 'ativo', balance: 0, creditLimit: 6000, lastPurchaseAt: null, totalPurchased: 51900, paymentTerms: 'À vista', x: 36, y: 70 },
  { id: 'c10', name: 'Hotel Primavera', tradeName: 'Hotel Primavera', document: '10111222000133', phone: '11912340010', district: 'Centro', address: 'Av. Central, 2200', status: 'ativo', balance: 4100, creditLimit: 20000, lastPurchaseAt: null, totalPurchased: 210300, paymentTerms: '28 dias', x: 48, y: 34 },
  { id: 'c11', name: 'Pastelaria Nova Era', tradeName: 'Pastelaria Nova Era', document: '11222333000155', phone: '11912340011', district: 'Vila Nova', address: 'Rua Bahia, 640', status: 'ativo', balance: 760, creditLimit: 4000, lastPurchaseAt: null, totalPurchased: 33400, paymentTerms: '14 dias', x: 88, y: 38 },
  { id: 'c12', name: 'Rotisseria Sabor & Arte', tradeName: 'Sabor & Arte', document: '12333444000166', phone: '11912340012', district: 'Bela Vista', address: 'Rua Ceará, 15', status: 'ativo', balance: 0, creditLimit: 5000, lastPurchaseAt: null, totalPurchased: 39800, paymentTerms: 'À vista', x: 30, y: 58 },
  { id: 'c13', name: 'Atacadão do Ovo', tradeName: 'Atacadão do Ovo', document: '13444555000177', phone: '11912340013', district: 'Distrito Industrial', address: 'Rod. SP-101, km 12', status: 'ativo', balance: 8900, creditLimit: 60000, lastPurchaseAt: null, totalPurchased: 780200, paymentTerms: '28 dias', x: 18, y: 26 },
  { id: 'c14', name: 'Buffet Encanto', tradeName: 'Buffet Encanto', document: '14555666000188', phone: '11912340014', district: 'Jardim Aurora', address: 'Rua Paraná, 320', status: 'inativo', balance: 0, creditLimit: 4000, lastPurchaseAt: null, totalPurchased: 18200, paymentTerms: '14 dias', x: 74, y: 16 },
  { id: 'c15', name: 'Padaria Pão Quente', tradeName: 'Pão Quente', document: '15666777000199', phone: '11912340015', district: 'Centro', address: 'Rua Minas Gerais, 410', status: 'novo', balance: 0, creditLimit: 2000, lastPurchaseAt: null, totalPurchased: 0, paymentTerms: 'À vista', x: 55, y: 28 },
  { id: 'c16', name: 'Cantina da Nona', tradeName: 'Cantina da Nona', document: '16777888000110', phone: '11912340016', district: 'Vila Nova', address: 'Rua Santa Luzia, 9', status: 'ativo', balance: 540, creditLimit: 3500, lastPurchaseAt: null, totalPurchased: 27500, paymentTerms: '7 dias', x: 84, y: 62 },
];

/* Buscas por id nos cadastros. Só para dados que não mudam em runtime
   (nome, placa, e-mail) — estado vivo (status do veículo, saldo do cliente)
   deve vir do store, nunca daqui. */
export const productById = (id: string) => products.find((p) => p.id === id)!;
export const userById = (id: string) => users.find((u) => u.id === id)!;
export const vehicleById = (id: string) => vehicles.find((v) => v.id === id)!;
export const supplierById = (id: string) => suppliers.find((s) => s.id === id)!;

/* ------------------------------------------------------------ Hidratação */

/* Os arrays acima são o valor inicial; a fonte de verdade é o banco.
   `hidratarCatalogo` substitui o conteúdo no lugar, uma única vez no boot,
   antes de qualquer tela renderizar.

   Mutar em vez de reatribuir é o que permite as ~10 telas continuarem
   importando `products`/`users` direto, sem passar tudo por contexto: este é
   dado de referência, estável durante a sessão inteira. Dado que MUDA em
   runtime (saldo do cliente, status do veículo) vive no store, com estado do
   React — as cópias aqui servem só de ponto de partida. */
function substituir<T>(destino: T[], origem: T[]) {
  if (origem.length === 0) return; // banco vazio: preserva o fallback local
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
