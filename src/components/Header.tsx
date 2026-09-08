import { Bell, UserCircle } from 'lucide-react';
import { useApp } from '../store';

export function Header() {
  const { user, currentView, setCurrentView } = useApp();

  // Custom header content based on view
  let content = null;

  if (currentView === 'home') {
    content = (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Online / GPS</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-slate-600 relative">
            <Bell className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
          </button>
          <button onClick={() => setCurrentView('more')} className="w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm">
            <UserCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  } else if (currentView === 'route-stop') {
    content = (
      <div className="flex items-center justify-center w-full relative">
        <button onClick={() => setCurrentView('home')} className="absolute left-0 text-slate-600 font-medium px-2 py-1">
          Voltar
        </button>
        <span className="font-bold text-slate-900">Parada 08</span>
      </div>
    );
  } else if (currentView === 'new-order') {
     content = (
      <div className="flex items-center justify-center w-full relative">
        <button onClick={() => setCurrentView('route-stop')} className="absolute left-0 text-slate-600 font-medium px-2 py-1">
          Cancelar
        </button>
        <span className="font-bold text-slate-900">Novo Pedido</span>
      </div>
    );
  }
  else {
    content = (
      <div className="flex items-center justify-between w-full">
         <span className="font-bold text-slate-900 capitalize">{currentView}</span>
      </div>
    )
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 pt-safe">
      <div className="h-14 px-4 flex items-center">
        {content}
      </div>
    </header>
  );
}
