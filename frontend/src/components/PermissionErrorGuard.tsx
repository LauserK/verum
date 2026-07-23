// frontend/src/components/PermissionErrorGuard.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PermissionErrorGuard({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handlePermissionError = () => {
      setHasError(true);
    };

    window.addEventListener('missing-permission', handlePermissionError);
    return () => window.removeEventListener('missing-permission', handlePermissionError);
  }, []);

  if (hasError) {
    return (
      <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-surface border border-border max-w-sm w-full rounded-2xl p-6 text-center space-y-6 animate-in zoom-in-95 duration-300 shadow-xl">
          <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto border border-error/20">
            <ShieldAlert className="w-8 h-8 text-error" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text-primary">Acceso Denegado</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              No tienes los permisos necesarios para realizar esta acción o ver este contenido.
            </p>
          </div>
          <button
            onClick={() => {
              setHasError(false);
              router.back();
            }}
            className="w-full bg-primary text-text-inverse h-12 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all active:scale-[0.98] text-sm"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
