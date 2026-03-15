// frontend/src/app/inventory/assets/[qr_code]/page.tsx
'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, Box, Calendar, Wrench, ShieldCheck, Activity, MapPin, Hash, Loader2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface AssetDetail {
  id: string;
  name: string;
  serial: string;
  brand: string;
  model: string;
  purchase_date: string;
  status: string;
  location_note: string;
  last_reviewed_at: string;
  asset_categories: {
    name: string;
    review_interval_days: number;
  };
}

export default function AssetPublicView({ params }: { params: Promise<{ qr_code: string }> }) {
  const { qr_code } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsReview, setNeedsReview] = useState(false);

  useEffect(() => {
    const fetchAsset = async () => {
      setLoading(true);
      try {
        // Obtenemos el perfil para asegurarnos de que hay sesión (aunque la ruta debería estar protegida por middleware)
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          router.push('/login');
          return;
        }

        // Llamamos a nuestro endpoint para resolver el QR (o directo a DB si preferimos, 
        // pero la DB es más directa para leer la tabla)
        const { data, error: dbErr } = await supabase
          .from('assets')
          .select('*, asset_categories(name, review_interval_days)')
          .eq('qr_code', qr_code)
          .single();

        if (dbErr || !data) {
          setError('No se pudo encontrar este activo o fue eliminado.');
          return;
        }

        const assetData = data as AssetDetail;
        setAsset(assetData);

        // Calcular si necesita revisión
        if (assetData.asset_categories?.review_interval_days) {
          if (!assetData.last_reviewed_at) {
            setNeedsReview(true);
          } else {
            const daysSinceReview = differenceInDays(new Date(), new Date(assetData.last_reviewed_at));
            setNeedsReview(daysSinceReview >= assetData.asset_categories.review_interval_days);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Ocurrió un error inesperado.');
      } finally {
        setLoading(false);
      }
    };

    fetchAsset();
  }, [qr_code, supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-text-secondary font-medium">Buscando información del activo...</p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 text-text-secondary">
          <Box className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">Activo no encontrado</h1>
        <p className="text-text-secondary mb-8">{error}</p>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-primary text-text-inverse px-6 h-12 rounded-xl font-semibold hover:bg-primary-hover transition-colors"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    operativo: 'bg-success text-text-inverse',
    en_reparacion: 'bg-warning text-text-primary',
    baja: 'bg-error text-text-inverse'
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Fijo */}
      <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-text-primary truncate">Ficha del Activo</h1>
      </header>

      <main className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Tarjeta Principal */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">
                {asset.asset_categories?.name || 'Categoría Desconocida'}
              </p>
              <h2 className="text-2xl font-bold text-text-primary leading-tight">{asset.name}</h2>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${statusColors[asset.status] || 'bg-surface-raised'}`}>
              {asset.status.replace('_', ' ')}
            </div>
          </div>
          
          {asset.location_note && (
            <div className="flex items-start gap-2 text-sm text-text-secondary mt-3 bg-surface-raised p-3 rounded-xl">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
              <p>{asset.location_note}</p>
            </div>
          )}
        </section>

        {/* Alerta de Revisión */}
        {needsReview && (
          <section className="bg-warning/10 border border-warning/20 rounded-2xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-warning mb-1">Revisión Preventiva Pendiente</h3>
              <p className="text-xs text-warning/80">Este equipo ha superado el tiempo recomendado para su inspección regular.</p>
            </div>
          </section>
        )}

        {/* Detalles Técnicos */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
            <Wrench className="w-4 h-4 text-text-secondary" />
            Especificaciones Técnicas
          </h3>
          
          <div className="grid grid-cols-2 gap-y-4 gap-x-3">
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Marca
              </p>
              <p className="text-sm font-semibold text-text-primary">{asset.brand || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Modelo
              </p>
              <p className="text-sm font-semibold text-text-primary">{asset.model || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Número de Serial
              </p>
              <p className="text-sm font-semibold font-mono text-text-primary bg-surface-raised px-2 py-1.5 rounded-lg border border-border inline-block">
                {asset.serial || '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Historial Corto */}
        <section className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border pb-3">
            <Calendar className="w-4 h-4 text-text-secondary" />
            Fechas Clave
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">Última revisión:</span>
              <span className="font-semibold text-text-primary">
                {asset.last_reviewed_at 
                  ? format(new Date(asset.last_reviewed_at), "dd MMM yyyy", { locale: es }) 
                  : 'Nunca'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">Fecha de compra:</span>
              <span className="font-semibold text-text-primary">
                {asset.purchase_date 
                  ? format(new Date(`${asset.purchase_date}T00:00:00`), "dd MMM yyyy", { locale: es }) 
                  : '—'}
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface/90 backdrop-blur-md border-t border-border flex gap-3 max-w-lg mx-auto">
        <button className="flex-1 bg-surface-raised text-text-primary h-12 rounded-xl font-bold border border-border hover:bg-surface transition-colors flex items-center justify-center gap-2">
          <Wrench className="w-4 h-4" /> Reportar Falla
        </button>
        <button className="flex-1 bg-primary text-text-inverse h-12 rounded-xl font-bold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shadow-sm">
          <ShieldCheck className="w-4 h-4" /> Registrar Revisión
        </button>
      </div>
    </div>
  );
}
