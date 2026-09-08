import { useState } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { useApp } from '../store';
import { mockProducts } from '../data';
import { cn } from '../lib/utils';

export function OrderEntry() {
  const { setCurrentView } = useApp();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const totalValue = mockProducts.reduce((acc: number, product) => {
    return acc + (product.price * (quantities[product.id] || 0));
  }, 0);

  const totalItems = Object.values(quantities).reduce((acc: number, qty) => acc + (qty as number), 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col h-screen bg-slate-50"
    >
      {/* Scrollable Product List */}
      <div className="flex-1 overflow-y-auto pt-16 pb-32 px-4">
        <div className="flex flex-col gap-3">
          {mockProducts.map((product) => {
            const qty = quantities[product.id] || 0;
            return (
              <div key={product.id} className={cn("bg-white p-4 rounded-2xl shadow-sm border transition-colors duration-200", qty > 0 ? "border-amber-400 ring-1 ring-amber-400" : "border-slate-200")}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{product.name}</h3>
                    <p className="text-sm text-slate-500 font-medium">{product.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 block">R$ {product.price.toFixed(2)}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">por {product.unit}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1 border border-slate-100">
                  <button 
                    onClick={() => updateQty(product.id, -1)}
                    disabled={qty === 0}
                    className="w-12 h-12 flex items-center justify-center bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600 disabled:opacity-50 active:bg-slate-100"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <div className="flex flex-col items-center justify-center w-16">
                    <span className="text-2xl font-black text-slate-900">{qty}</span>
                  </div>
                  <button 
                    onClick={() => updateQty(product.id, 1)}
                    className="w-12 h-12 flex items-center justify-center bg-amber-100 rounded-lg shadow-sm border border-amber-200 text-amber-700 active:bg-amber-200"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed Bottom Checkout Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe z-50">
        <div className="flex items-center justify-between mb-3 px-1">
           <div className="flex flex-col">
             <span className="text-xs uppercase font-bold text-slate-500">Resumo do Pedido</span>
             <span className="text-sm font-semibold text-slate-700">{totalItems} itens selecionados</span>
           </div>
           <div className="flex flex-col items-end">
             <span className="text-xs uppercase font-bold text-slate-500">Total</span>
             <span className="text-2xl font-black text-slate-900">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
           </div>
        </div>
        
        <button 
          onClick={() => setCurrentView('route-stop')}
          disabled={totalItems === 0}
          className="w-full h-14 bg-slate-900 disabled:bg-slate-300 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:bg-slate-800 transition-colors shadow-sm"
        >
          <ShoppingCart className="w-5 h-5" />
          Continuar para Pagamento
        </button>
      </div>
    </motion.div>
  );
}
