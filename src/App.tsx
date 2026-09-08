import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, useApp } from './store';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DriverHome } from './views/DriverHome';
import { RouteStop } from './views/RouteStop';
import { OrderEntry } from './views/OrderEntry';
import { ManagerDashboard } from './views/ManagerDashboard';
import { AnimatePresence } from 'motion/react';
import './index.css';

function AppContent() {
  const { currentView, user } = useApp();

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return user.role === 'driver' ? <DriverHome /> : <ManagerDashboard />;
      case 'route-stop':
        return <RouteStop />;
      case 'new-order':
        return <OrderEntry />;
      case 'customers':
      case 'orders':
      case 'routes':
      case 'more':
        return (
          <div className="flex items-center justify-center h-screen pt-16">
            <p className="text-slate-500 font-medium">Tela {currentView} em desenvolvimento...</p>
          </div>
        );
      default:
        return <DriverHome />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-amber-200">
      <Header />
      <main className="w-full max-w-md mx-auto relative pt-14">
        <AnimatePresence mode="wait">
          {renderView()}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
