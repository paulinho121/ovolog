import { User, Map, Package, Users, Menu } from 'lucide-react';
import { useApp } from '../store';
import { cn } from '../lib/utils';

export function BottomNav() {
  const { currentView, setCurrentView } = useApp();

  const tabs = [
    { id: 'home', icon: Map, label: 'Início' },
    { id: 'customers', icon: Users, label: 'Clientes' },
    { id: 'orders', icon: Package, label: 'Pedidos' },
    { id: 'routes', icon: Map, label: 'Rotas' }, // Using Map again for simplicity, normally different icon
    { id: 'more', icon: Menu, label: 'Mais' },
  ] as const;

  // Don't show bottom nav on deep screens to maximize space if needed, 
  // but requirements say "A navegação inferior deve ficar sempre acessível nas telas principais."
  // We will hide it on 'route-stop' and 'new-order' to give full focus to the task.
  const hideNav = currentView === 'route-stop' || currentView === 'new-order';

  if (hideNav) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-white/95 backdrop-blur-xl border-t border-slate-200">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id as any)}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-full transition-colors",
                isActive ? "text-amber-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-6 h-6 mb-1" strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn("text-[10px] font-semibold tracking-wide", isActive && "font-bold")}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
