export type Role = 'driver' | 'manager';

export interface User {
  id: string;
  name: string;
  role: Role;
  vehicle?: string;
  avatar?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  image?: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  distance: string;
  eta: string;
  lastPurchase: string;
  balance: number;
  status: 'active' | 'inactive' | 'overdue';
}

export interface OrderItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  customer: Customer;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'delivered' | 'cancelled';
  date: string;
}

export interface RouteStop {
  id: string;
  customer: Customer;
  status: 'pending' | 'in_transit' | 'arrived' | 'completed';
  expectedDelivery: string;
  itemsToDeliver: { description: string; qty: number; boxes: number }[];
}

export interface Route {
  id: string;
  driverId: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  stops: RouteStop[];
  totalBoxes: number;
  deliveredBoxes: number;
  totalValue: number;
  collectedValue: number;
}
