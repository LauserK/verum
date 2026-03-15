// frontend/src/app/admin/inventory/assets/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, QrCode, Edit3, Save, X, Loader2 } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { QRCodePrint } from '@/components/inventory/QRCodePrint'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'

interface Asset {
  id: string
  name: string
  venue_id: string
  category_id: string
  status: string
  qr_code: string
  asset_categories?: { name: string }
}

interface Category {
  id: string
  name: string
}

interface Venue {
  id: string
  name: string
  org_id: string
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assetToPrint, setAssetToPrint] = useState<Asset | null>(null)
  
  // Form State
  const [newName, setNewName] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newVenueId, setNewVenueId] = useState('')
  const [newSerial, setNewSerial] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newModel, setNewModel] = useState('')

  const printRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true
    
    const fetchData = async () => {
      setLoading(true)
      
      // 1. Get user profile for org mapping
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes.user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userRes.user.id)
        .single()
        
      const orgId = profile?.organization_id

      // 2. Fetch parallel data
      const [assetsRes, catsRes, venuesRes] = await Promise.all([
        supabase.from('assets').select('*, asset_categories(name)').neq('status', 'baja'),
        orgId ? supabase.from('asset_categories').select('id, name').eq('org_id', orgId) : Promise.resolve({ data: [] }),
        orgId ? supabase.from('venues').select('id, name, org_id').eq('org_id', orgId) : Promise.resolve({ data: [] })
      ])
      
      if (isMounted) {
        if (assetsRes.data) setAssets(assetsRes.data as Asset[])
        if (catsRes.data) setCategories(catsRes.data)
        if (venuesRes.data) {
          setVenues(venuesRes.data)
          if (venuesRes.data.length > 0) setNewVenueId(venuesRes.data[0].id)
        }
        setLoading(false)
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const handlePrintTrigger = useReactToPrint({
    contentRef: printRef,
    documentTitle: assetToPrint ? `QR-${assetToPrint.name}` : 'QR-Code',
    onAfterPrint: () => setAssetToPrint(null)
  })

  const handlePrint = (asset: Asset) => {
    setAssetToPrint(asset)
    setTimeout(() => {
      handlePrintTrigger()
    }, 100)
  }

  const handleCreate = async () => {
    setError('')
    if (!newName || !newCategoryId || !newVenueId) {
      setError('Nombre, categoría y sede son obligatorios.')
      return
    }

    setSaving(true)
    try {
      const selectedVenue = venues.find(v => v.id === newVenueId)
      const qr_code = uuidv4() // Generate UUID for the QR code locally
      
      const { data, error: err } = await supabase.from('assets').insert({
        org_id: selectedVenue?.org_id,
        venue_id: newVenueId,
        category_id: newCategoryId,
        name: newName,
        serial: newSerial || null,
        brand: newBrand || null,
        model: newModel || null,
        status: 'operativo',
        qr_code: qr_code
      }).select('*, asset_categories(name)').single()

      if (err) throw err
      
      if (data) {
        setAssets(prev => [data as Asset, ...prev])
        setShowCreate(false)
        setNewName('')
        setNewSerial('')
        setNewBrand('')
        setNewModel('')
        // Prompt user to print immediately
        if (confirm('Activo guardado exitosamente. ¿Deseas imprimir el código QR ahora?')) {
          handlePrint(data as Asset)
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Error al guardar el activo')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Activos Fijos</h1>
          <div className="flex items-center gap-6 mt-2">
            <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1">Lista de Activos</span>
            <Link href="/admin/inventory/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              Categorías
            </Link>
          </div>
        </div>
        <button 
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancelar' : 'Nuevo Activo'}
        </button>
      </div>

      {/* Formulario Crear Activo */}
      {showCreate && (
        <div className="bg-surface border border-primary/30 rounded-2xl p-6 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-bold text-text-primary">Registrar Nuevo Activo</h2>
          
          {error && (
            <div className="p-3 bg-error-light text-error text-sm rounded-xl border border-error/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Nombre *</label>
              <input 
                placeholder="Ej. Nevera Principal"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Categoría *</label>
              <select 
                value={newCategoryId}
                onChange={e => setNewCategoryId(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
              >
                <option value="">Seleccionar categoría</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Sede *</label>
              <select 
                value={newVenueId}
                onChange={e => setNewVenueId(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
              >
                <option value="">Seleccionar sede</option>
                {venues.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Número de Serial (Opcional)</label>
              <input 
                placeholder="SN-123456789"
                value={newSerial}
                onChange={e => setNewSerial(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Marca (Opcional)</label>
              <input 
                placeholder="Ej. Samsung"
                value={newBrand}
                onChange={e => setNewBrand(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-text-secondary">Modelo (Opcional)</label>
              <input 
                placeholder="Ej. RF28R7201"
                value={newModel}
                onChange={e => setNewModel(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>
          
          <div className="pt-2 flex justify-end">
            <button 
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-text-inverse px-6 h-11 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Guardar y Generar QR'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-raised rounded-xl w-full"></div>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-2xl">
          <QrCode className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text-primary mb-1">Sin activos registrados</h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto mb-6">Comienza registrando tus equipos y maquinarias para generarles un código QR.</p>
          <button 
            onClick={() => setShowCreate(true)}
            className="text-primary font-medium hover:underline"
          >
            Registrar mi primer activo
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
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
                  <td className="px-6 py-4">
                    <p className="font-semibold text-text-primary">{asset.name}</p>
                    <p className="text-xs text-text-secondary font-mono mt-0.5" title={asset.qr_code}>ID: {asset.qr_code.substring(0,8)}</p>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{asset.asset_categories?.name || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider
                      ${asset.status === 'operativo' ? 'bg-success/10 text-success' : 
                        asset.status === 'baja' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}>
                      {asset.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex justify-end gap-2">
                    <button 
                      onClick={() => handlePrint(asset)}
                      className="p-2 text-text-secondary hover:text-primary transition-colors bg-surface-raised rounded-lg border border-transparent hover:border-primary/20" 
                      title="Imprimir QR"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-text-secondary hover:text-primary transition-colors bg-surface-raised rounded-lg border border-transparent hover:border-primary/20" title="Editar">
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
              venueName: venues.find(v => v.id === assetToPrint.venue_id)?.name || 'Sede'
            }} 
          />
        )}
      </div>
    </div>
  )
}
