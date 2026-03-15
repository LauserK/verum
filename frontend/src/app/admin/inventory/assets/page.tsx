// frontend/src/app/admin/inventory/assets/page.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, QrCode, Edit3 } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { QRCodePrint } from '@/components/inventory/QRCodePrint'

interface Asset {
  id: string
  name: string
  venue_id: string
  category_id: string
  status: string
  qr_code: string
  asset_categories?: { name: string }
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [assetToPrint, setAssetToPrint] = useState<Asset | null>(null)
  
  const printRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('assets')
      .select('*, asset_categories(name)')
      .neq('status', 'baja')
    if (data) setAssets(data as Asset[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const handlePrintTrigger = useReactToPrint({
    contentRef: printRef,
    documentTitle: assetToPrint ? `QR-${assetToPrint.name}` : 'QR-Code',
    onAfterPrint: () => setAssetToPrint(null)
  })

  const handlePrint = (asset: Asset) => {
    setAssetToPrint(asset)
    // Small delay to allow the component to render before printing
    setTimeout(() => {
      handlePrintTrigger()
    }, 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Activos Fijos</h1>
        <button className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Activo
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-raised rounded-xl w-full"></div>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          No hay activos registrados.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised text-text-secondary font-semibold">
              <tr>
                <th className="px-6 py-4">Nombre</th>
                <th className="px-6 py-4">Categoría</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assets.map(asset => (
                <tr key={asset.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-text-primary">{asset.name}</td>
                  <td className="px-6 py-4 text-text-secondary">{asset.asset_categories?.name || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wider
                      ${asset.status === 'operativo' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {asset.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex justify-end gap-2">
                    <button 
                      onClick={() => handlePrint(asset)}
                      className="p-2 text-text-secondary hover:text-primary transition-colors bg-surface-raised rounded-lg" 
                      title="Imprimir QR"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-text-secondary hover:text-primary transition-colors bg-surface-raised rounded-lg" title="Editar">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hidden print container */}
      <div className="hidden">
        {assetToPrint && (
          <QRCodePrint 
            ref={printRef} 
            asset={{
              name: assetToPrint.name,
              qr_code: assetToPrint.qr_code,
              venueName: 'Sede' // TODO: Fetch real venue name
            }} 
          />
        )}
      </div>
    </div>
  )
}
