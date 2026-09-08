import { motion } from 'motion/react';
import { Navigation, AlertTriangle, Route as RouteIcon, MapPin, CheckCircle2, ChevronRight, PhoneCall } from 'lucide-react';
import { useApp } from '../store';
import { mockRoute } from '../data';
import { cn } from '../lib/utils';

export function DriverHome() {
  const { user, setCurrentView } = useApp();
  const route = mockRoute;
  
  const pendingStops = route.stops.filter(s => s.status === 'pending' || s.status === 'in_transit');
  const nextStop = pendingStops[0];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-4 p-4 pb-24"
    >
      {/* Identity Header */}
      <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold uppercase rounded-md">Turno Manhã</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold uppercase rounded-md">{route.id}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bom dia, {user.name.split(' ')[0]}</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">{user.vehicle} • ZL / Mooca</p>
          </div>
          <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 shrink-0">
             {/* Placeholder for avatar, using icon */}
             <span className="font-bold text-xl text-slate-400">{user.name.charAt(0)}</span>
          </div>
        </div>
      </section>

      {/* FEFO Alert */}
      <section className="bg-amber-100 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
        <div className="bg-amber-500 p-2 rounded-lg text-white shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-amber-900 font-bold text-xs uppercase tracking-wide mb-1">Prioridade FEFO • Validade Curta</h3>
          <p className="text-amber-800 text-sm font-medium leading-snug">
            Padaria Central: Lote #0826 vence em 5 dias. Entregar primeiro!
          </p>
        </div>
      </section>

      {/* Giant Action Button */}
      <button 
        onClick={() => setCurrentView('route-stop')}
        className="w-full bg-amber-500 active:bg-amber-600 text-amber-950 p-4 rounded-2xl flex items-center justify-between shadow-md transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-4">
          <div className="bg-amber-900/10 p-2.5 rounded-xl">
            <Navigation className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="text-left">
            <span className="block text-xs uppercase font-bold tracking-wider opacity-80 mb-0.5">Próxima Etapa</span>
            <span className="block text-lg font-extrabold">Continuar Rota (3ª Parada)</span>
          </div>
        </div>
        <ChevronRight className="w-7 h-7 stroke-[3]" />
      </button>

      {/* Operations Overview */}
      <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RouteIcon className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Operação de Hoje</h2>
          </div>
          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">66% Concluído</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Stops */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wide">Roteiro Clientes</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-slate-900">12</span>
              <span className="text-sm text-slate-500 font-medium">/ 18 metas</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: '66%' }} />
            </div>
          </div>
          
          {/* Cargo */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wide">Carga a Bordo (CX)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-slate-900">46</span>
              <span className="text-sm text-slate-500 font-medium">/ 180 inicial</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: '25%' }} />
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-1">
           <div className="flex justify-between items-center text-sm">
             <span className="text-slate-600 font-medium">Faturamento Realizado</span>
             <span className="font-bold text-slate-900">R$ 8.420,00</span>
           </div>
           <div className="flex justify-between items-center text-sm mt-1">
             <span className="text-emerald-700 font-medium flex items-center gap-1">
               <CheckCircle2 className="w-4 h-4" /> Liquidado (PIX/Dinheiro)
             </span>
             <span className="font-bold text-emerald-700">R$ 6.900,00</span>
           </div>
        </div>
      </section>

      {/* Next Stops Timeline */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
           <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
             <MapPin className="w-5 h-5 text-slate-400" />
             Próximas Paradas
           </h3>
           <span className="text-sm font-bold text-blue-600">Ver Mapa</span>
        </div>
        
        <div className="flex flex-col gap-3 relative">
          {/* Timeline connecting line */}
          <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200 z-0"></div>

          {pendingStops.map((stop, idx) => (
            <div key={stop.id} onClick={() => setCurrentView('route-stop')} className="relative z-10 flex gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-100 active:bg-slate-50 transition-colors">
               <div className={cn(
                 "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border-2 font-bold text-lg",
                 idx === 0 ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-slate-50 border-slate-200 text-slate-500"
               )}>
                 0{idx + 3}
               </div>
               <div className="flex-1 flex flex-col justify-center min-w-0">
                 <div className="flex items-start justify-between gap-2">
                   <h4 className="font-bold text-slate-900 truncate">{stop.customer.name}</h4>
                   {idx === 0 && (
                     <span className="shrink-0 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded-md flex items-center gap-1">
                       <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                       A Caminho
                     </span>
                   )}
                 </div>
                 <p className="text-sm text-slate-500 truncate">{stop.customer.address.split(' - ')[0]}</p>
                 <div className="flex items-center gap-2 mt-2">
                   <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                     {stop.itemsToDeliver.reduce((acc, item) => acc + item.boxes, 0)} CX Total
                   </span>
                   <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                     ETA {stop.expectedDelivery}
                   </span>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </section>

    </motion.div>
  );
}
