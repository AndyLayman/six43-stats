'use client';

import { useEffect, useState, useCallback } from 'react';

interface Toast {
  id: number;
  message: string;
  type: 'error' | 'info' | 'success';
  fading?: boolean;
}

let nextId = 0;

/** Show a toast notification from anywhere: `showToast("message")` or `showToast("msg", "error")` */
export function showToast(message: string, type: 'error' | 'info' | 'success' = 'info') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    // Start fade out after 3s
    setTimeout(() => setToasts(prev => prev.map(t => t.id === id ? { ...t, fading: true } : t)), 3000);
    // Remove after fade
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent).detail;
      addToast(message, type);
    }
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, [addToast]);

  // Online/offline detection
  useEffect(() => {
    function handleOffline() { addToast('You are offline', 'error'); }
    function handleOnline() { addToast('Back online', 'success'); }
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border backdrop-blur-sm transition-all duration-500 ${
            t.fading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          } ${
            t.type === 'error'
              ? 'bg-destructive/90 text-destructive-foreground border-destructive/50'
              : t.type === 'success'
              ? 'bg-emerald-600/90 text-white border-emerald-500/50'
              : 'bg-sidebar/90 text-foreground border-border/50'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
