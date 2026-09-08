import React, { createContext, useContext, useState } from 'react';
import { User } from './types';
import { mockUser } from './data';

export type AppView = 'home' | 'customers' | 'orders' | 'routes' | 'more' | 'route-stop' | 'new-order';

interface AppState {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  user: User;
  setUser: (user: User) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [user, setUser] = useState<User>(mockUser);

  return (
    <AppContext.Provider value={{ currentView, setCurrentView, user, setUser }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
