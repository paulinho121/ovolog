import { motion } from 'motion/react';
import { TrendingUp, PackageSearch, Truck, AlertCircle } from 'lucide-react';
import { useApp } from '../store';

export function ManagerDashboard() {
  const { setCurrentView } = useApp();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-4 p-4 pb-24"
    >
       <div className="mb-2">
         <h1 className="text-2xl font-black text-slate-900">Visão Geral</h1>
         <p className="text-slate-500 font-medium">Operação em tempo real</p>
       </div>

       {/* Kpis Grid */}
       <div className="grid grid-cols-2 gap-3">
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Vendas Hoje</span>
            <span className="text-xl font-black text-slate-900">R$ 12.840</span>
         </div>
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-1">
              <PackageSearch className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pedidos (Qtd)</span>
            <span className="text-xl font-black text-slate-900">24</span>
         </div>
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
              <Truck className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Veículos em Rota</span>
            <span className="text-xl font-black text-slate-900">3/5</span>
         </div>
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mb-1">
              <AlertCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Ocorrências</span>
            <span className="text-xl font-black text-slate-900">2</span>
         </div>
       </div>

       <h2 className="text-lg font-bold text-slate-900 mt-2">Operação Agora</h2>
       <div className="relative w-full h-48 bg-slate-800 rounded-2xl overflow-hidden shadow-sm">
         <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
         <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-slate-400 font-medium text-sm">Mapa da Operação (Placeholder)</span>
         </div>
         <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-md">
            Van 03 • João • Em movimento
         </div>
       </div>

       <h2 className="text-lg font-bold text-slate-900 mt-2">Alertas</h2>
       <div className="flex flex-col gap-2">
         <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <h4 className="font-bold text-red-900 text-sm">Estoque Baixo</h4>
              <p className="text-xs text-red-700 mt-0.5">Ovo Branco Extra (CX) atingiu nível mínimo.</p>
            </div>
         </div>
         <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">Pagamento Vencido</h4>
              <p className="text-xs text-amber-700 mt-0.5">Mercadinho São José possui fatura em aberto.</p>
            </div>
         </div>
       </div>

    </motion.div>
  );
}
