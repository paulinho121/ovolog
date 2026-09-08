import { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Phone, Navigation, CheckCircle2, Package, Plus, AlertTriangle, ArrowRight, ChevronRight } from 'lucide-react';
import { useApp } from '../store';
import { mockRoute } from '../data';
import { cn } from '../lib/utils';

export function RouteStop() {
  const { setCurrentView } = useApp();
  const stop = mockRoute.stops[0]; // Just taking the first pending for demo
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleItem = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const allChecked = stop.itemsToDeliver.length > 0 && stop.itemsToDeliver.every((_, i) => checkedItems[i]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-4 p-4 pb-6 mt-14"
    >
      {/* Status Bar */}
      <div className="flex items-center justify-between bg-white border border-slate-100 px-3 py-2 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Em Trânsito • até 10:30</span>
        </div>
        <div className="bg-slate-100 px-2 py-1 rounded-md">
           <span className="text-xs font-bold text-slate-700">Parada 8/18</span>
        </div>
      </div>

      {/* Client Info Card */}
      <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-bold">ID #CX-3819</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">{stop.customer.name}</h1>
          </div>
          <a href="#" className="w-10 h-10 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center active:bg-slate-200">
            <Phone className="w-5 h-5" />
          </a>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="bg-slate-50 p-2 rounded-lg flex items-center gap-2 border border-slate-100">
             <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center shadow-sm">
               <span className="text-sm">👤</span>
             </div>
             <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 uppercase font-bold">Responsável</span>
               <span className="text-sm font-semibold text-slate-900">Seu Manoel</span>
             </div>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg flex items-center gap-2 border border-slate-100">
             <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center shadow-sm text-blue-600">
               <Navigation className="w-4 h-4" />
             </div>
             <div className="flex flex-col">
               <span className="text-[10px] text-slate-500 uppercase font-bold">Distância</span>
               <span className="text-sm font-semibold text-slate-900">{stop.customer.distance} • {stop.customer.eta}</span>
             </div>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
          <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-slate-700 leading-snug">{stop.customer.address}</p>
        </div>
      </section>

      {/* Map Placeholder */}
      <div className="relative w-full h-32 bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center">
         {/* Fake Map Elements */}
         <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
         <svg className="absolute w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,80 Q25,75 50,50 T100,20" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="4 2" />
            <circle cx="10" cy="82" r="4" fill="#3b82f6" />
            <circle cx="90" cy="22" r="4" fill="#f59e0b" />
         </svg>
         
         {!isCheckedIn && (
           <div className="absolute bottom-3 right-3">
             <button className="bg-white/95 backdrop-blur text-slate-900 px-3 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 active:scale-95 transition-transform">
                <Navigation className="w-4 h-4 text-blue-600" /> Waze / Maps
             </button>
           </div>
         )}
      </div>

      {/* Main Check-in Action */}
      {!isCheckedIn ? (
        <button 
          onClick={() => setIsCheckedIn(true)}
          className="w-full h-16 bg-amber-500 active:bg-amber-600 text-amber-950 font-black text-lg rounded-2xl shadow-md flex items-center justify-between px-5 transition-transform active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-7 h-7" />
            <div className="flex flex-col text-left">
              <span>Cheguei ao Cliente</span>
              <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Validar GPS</span>
            </div>
          </div>
          <ChevronRight className="w-8 h-8" />
        </button>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-600 text-white p-4 rounded-2xl shadow-sm flex items-center gap-3"
        >
          <div className="bg-white/20 p-2 rounded-full">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base">Presença Confirmada</h3>
            <p className="text-xs font-medium text-emerald-100">GPS Registrado • Carga liberada</p>
          </div>
        </motion.div>
      )}

      {/* Cargo List (Only interactive if checked in ideally, but visible) */}
      <section className={cn("bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 transition-opacity duration-300", !isCheckedIn && "opacity-60 pointer-events-none")}>
         <div className="flex items-center justify-between border-b border-slate-100 pb-3">
           <div>
             <span className="text-[10px] uppercase font-bold text-slate-500">Romaneio de Descarga</span>
             <h2 className="text-xl font-black text-slate-900">Pedido #4892</h2>
           </div>
           <div className="text-right">
             <span className="text-[10px] uppercase font-bold text-slate-500">Valor a Faturar</span>
             <p className="text-lg font-black text-slate-900">R$ 1.840,00</p>
           </div>
         </div>

         <div className="flex flex-col gap-2 mt-1">
           <span className="text-[10px] uppercase font-bold text-slate-400">Itens para conferência:</span>
           {stop.itemsToDeliver.map((item, idx) => (
             <label key={idx} className={cn("flex items-start justify-between p-3 rounded-xl border transition-colors", checkedItems[idx] ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200")}>
               <div className="flex items-start gap-3">
                 <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5", checkedItems[idx] ? "bg-emerald-500 text-white" : "border-2 border-slate-300")}>
                    {checkedItems[idx] && <CheckCircle2 className="w-4 h-4" />}
                 </div>
                 <div>
                   <div className="flex items-center gap-2">
                     <span className={cn("font-bold text-base", checkedItems[idx] ? "text-emerald-900" : "text-slate-900")}>{item.boxes} CX</span>
                     <span className="text-sm font-semibold text-slate-600 truncate max-w-[150px]">• {item.description}</span>
                   </div>
                   <p className="text-xs text-slate-500 font-medium mt-0.5">{item.qty} dz • Lote Padrão</p>
                 </div>
               </div>
               {/* Hidden checkbox for accessibility */}
               <input type="checkbox" className="hidden" checked={checkedItems[idx] || false} onChange={() => toggleItem(idx)} />
             </label>
           ))}
         </div>
      </section>

      {/* Post-Check-in Actions */}
      <section className={cn("flex flex-col gap-3 transition-opacity duration-300", !isCheckedIn && "opacity-50 pointer-events-none")}>
        <button className={cn("w-full p-4 rounded-2xl font-bold text-lg flex items-center justify-between shadow-sm transition-all", allChecked ? "bg-slate-900 text-white active:bg-slate-800" : "bg-slate-200 text-slate-400 pointer-events-none")}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            <span>Confirmar Descarga</span>
          </div>
          <ArrowRight className="w-6 h-6" />
        </button>

        <button onClick={() => setCurrentView('new-order')} className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-700 text-base flex items-center justify-center gap-2 active:bg-slate-50 shadow-sm">
          <Plus className="w-5 h-5 text-amber-500" />
          Novo Pedido Extra (Pronta-Entrega)
        </button>

        <button className="w-full py-2 flex items-center justify-center gap-2 text-red-600 font-semibold text-sm active:opacity-70 mt-2">
           <AlertTriangle className="w-4 h-4" /> Registrar Ocorrência / Devolução
        </button>
      </section>

    </motion.div>
  );
}
