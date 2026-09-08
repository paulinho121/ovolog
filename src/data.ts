import { User, Product, Customer, Route } from './types';

export const mockUser: User = {
  id: 'u1',
  name: 'João Silva',
  role: 'driver',
  vehicle: 'Van 03 - BRA-2E19',
};

export const mockProducts: Product[] = [
  { id: 'p1', name: 'Ovo Branco Grande', description: '30 dz/cx', price: 185.00, unit: 'caixa', stock: 450 },
  { id: 'p2', name: 'Ovo Vermelho Extra', description: '30 dz/cx', price: 210.00, unit: 'caixa', stock: 120 },
  { id: 'p3', name: 'Ovo Caipira', description: '20 dz/cx', price: 240.00, unit: 'caixa', stock: 50 },
  { id: 'p4', name: 'Lote Misto', description: 'Variados', price: 190.00, unit: 'caixa', stock: 30 },
];

export const mockCustomers: Customer[] = [
  { id: 'c1', name: 'Padaria Central', address: 'Rua da Mooca, 1420 - Mooca', distance: '450m', eta: '3 min', lastPurchase: 'Hoje', balance: 0, status: 'active' },
  { id: 'c2', name: 'Mercadinho São José', address: 'Av. Paes de Barros, 890 - Mooca', distance: '1.2km', eta: '5 min', lastPurchase: 'Ontem', balance: 450, status: 'active' },
  { id: 'c3', name: 'Supermercado União', address: 'Rua Juventus, 310 - Mooca', distance: '2.5km', eta: '12 min', lastPurchase: 'Há 3 dias', balance: 0, status: 'active' },
  { id: 'c4', name: 'Restaurante Sabor', address: 'Rua Oratório, 150 - Mooca', distance: '3.1km', eta: '15 min', lastPurchase: 'Há 1 semana', balance: -150, status: 'overdue' },
];

export const mockRoute: Route = {
  id: 'R-1042',
  driverId: 'u1',
  status: 'in_progress',
  totalBoxes: 180,
  deliveredBoxes: 46,
  totalValue: 8420,
  collectedValue: 6900,
  stops: [
    {
      id: 's1',
      customer: mockCustomers[0],
      status: 'in_transit',
      expectedDelivery: '10:15',
      itemsToDeliver: [{ description: 'Ovo Branco Tipo Grande', qty: 300, boxes: 10 }, { description: 'Ovo Vermelho Extra', qty: 150, boxes: 5 }]
    },
    {
      id: 's2',
      customer: mockCustomers[1],
      status: 'pending',
      expectedDelivery: '10:45',
      itemsToDeliver: [{ description: 'Ovo Vermelho Extra', qty: 600, boxes: 20 }]
    },
    {
      id: 's3',
      customer: mockCustomers[2],
      status: 'pending',
      expectedDelivery: '11:20',
      itemsToDeliver: [{ description: 'Lote Misto', qty: 1200, boxes: 40 }]
    }
  ]
};
