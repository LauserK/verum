// frontend/src/components/ConnectionErrorGuard.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function ConnectionErrorGuard({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleConnectionError = () => {
      setHasError(true);
    };

    window.addEventListener('connection-error', handleConnectionError);
    return () => window.removeEventListener('connection-error', handleConnectionError);
  }, []);

  if (hasError) {
    return (
      <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-surface border border-border max-w-sm w-full rounded-2xl p-6 text-center space-y-6 animate-in zoom-in-95 duration-300 shadow-xl">
          <div className="w-16 h-16 bg-error-light rounded-full flex items-center justify-center mx-auto border border-error/10">
            <WifiOff className="w-8 h-8 text-error" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text-primary">Error de Conexión</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              No se pudo establecer comunicación con el servidor de VERUM. Verifica tu conexión a internet o si el backend está encendido y accesible.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setHasError(false)}
              className="w-full bg-surface-raised border border-border text-text-primary h-12 rounded-xl font-bold hover:bg-surface-raised/80 transition-all active:scale-[0.98] text-sm"
            >
              Cerrar
            </button>
            <button
              onClick={() => {
                setHasError(false);
                window.location.reload();
              }}
              className="w-full bg-primary text-text-inverse h-12 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all active:scale-[0.98] text-sm"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
