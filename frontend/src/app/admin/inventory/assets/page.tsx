// frontend/src/app/admin/inventory/assets/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { adminApi, getProfile, type VenueInfo, type Asset } from '@/lib/api'
import { Plus, QrCode, Edit3, Save, X, Loader2, Search, Filter } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { QRCodePrint } from '@/components/inventory/QRCodePrint'
import { BulkQRCodePrint } from '@/components/inventory/BulkQRCodePrint'
import { PrintConfigModal } from '@/components/inventory/PrintConfigModal'
import { v4 as uuidv4 } from 'uuid'
import Link from 'next/link'
import { useTranslations } from '@/components/I18nProvider'
import { createClient } from '@/utils/supabase/client'

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
  const { t } = useTranslations()
  const [assets, setAssets] = useState<Asset[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assetToPrint, setAssetToPrint] = useState<Asset | null>(null)
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [venueFilter, setVenueFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'operativo' | 'en_reparacion' | 'baja'>('all')

  // Form State
  const [newName, setNewName] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newVenueId, setNewVenueId] = useState('')
  const [newSerial, setNewSerial] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newModel, setNewModel] = useState('')

  const [showPrintConfig, setShowPrintConfig] = useState(false)
  const [gridConfig, setGridConfig] = useState<{ rows: number; cols: number; scale?: number }>({ rows: 2, cols: 2 })
  const bulkPrintRef = useRef<HTMLDivElement>(null)

  const printRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const handleBulkPrintTrigger = useReactToPrint({
    contentRef: bulkPrintRef,
    documentTitle: 'Inventario-QRs-Masivo',
    onAfterPrint: () => setShowPrintConfig(false)
  })

  const handleConfirmPrint = (config: { rows: number; cols: number; scale?: number }) => {
    setGridConfig(config)
    setTimeout(() => {
      handleBulkPrintTrigger()
    }, 200)
  }

  const resetForm = () => {
    setNewName('')
    setNewCategoryId('')
    setNewVenueId(venues.length > 0 ? venues[0].id : '')
    setNewSerial('')
    setNewBrand('')
    setNewModel('')
    setEditingAsset(null)
    setError('')
  }

  const startEdit = (asset: Asset) => {
    setEditingAsset(asset)
    setNewName(asset.name)
    setNewCategoryId(asset.category_id)
    setNewVenueId(asset.venue_id)
    setNewSerial(asset.serial || '')
    setNewBrand(asset.brand || '')
    setNewModel(asset.model || '')
    setShowCreate(true)
  }

  useEffect(() => {
    let isMounted = true
    
    const fetchData = async () => {
      setLoading(true)
      
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes.user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userRes.user.id)
        .single()
        
      const orgId = profile?.organization_id

      const [assetsRes, catsRes, venuesRes] = await Promise.all([
        supabase.from('assets').select('*, asset_categories(name)').neq('status', 'baja').order('created_at', { ascending: false }),
        orgId ? supabase.from('asset_categories').select('id, name').eq('org_id', orgId).order('name') : Promise.resolve({ data: [] }),
        orgId ? supabase.from('venues').select('id, name, org_id').eq('org_id', orgId).order('name') : Promise.resolve({ data: [] })
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

  const handleSave = async () => {
    setError('')
    if (!newName || !newCategoryId || !newVenueId) {
      setError(t('inventory.assets.errors.required'))
      return
    }

    setSaving(true)
    try {
      const selectedVenue = venues.find(v => v.id === newVenueId)
      
      const payload = {
        venue_id: newVenueId,
        category_id: newCategoryId,
        name: newName,
        serial: newSerial || null,
        brand: newBrand || null,
        model: newModel || null,
      }

      if (editingAsset) {
        const { data, error: err } = await supabase
          .from('assets')
          .update(payload)
          .eq('id', editingAsset.id)
          .select('*, asset_categories(name)')
          .single()

        if (err) throw err
        if (data) {
          setAssets(prev => prev.map(a => a.id === editingAsset.id ? (data as Asset) : a))
          setShowCreate(false)
          resetForm()
        }
      } else {
        const insertPayload = {
          ...payload,
          org_id: selectedVenue?.org_id,
          status: 'operativo',
          qr_code: uuidv4()
        }

        const { data, error: err } = await supabase
          .from('assets')
          .insert(insertPayload)
          .select('*, asset_categories(name)')
          .single()

        if (err) throw err
        if (data) {
          setAssets(prev => [data as Asset, ...prev])
          setShowCreate(false)
          resetForm()
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(t('inventory.assets.errors.generic'))
      }
    } finally {
      setSaving(false)
    }
  }

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.asset_categories?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = !categoryFilter || asset.category_id === categoryFilter
    const matchesVenue = !venueFilter || asset.venue_id === venueFilter
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter

    return matchesSearch && matchesCategory && matchesVenue && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">{t('inventory.assets.title')}</h1>
          <div className="flex items-center gap-6 mt-2">
            <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1">{t('inventory.assets.listTab')}</span>
            <Link href="/admin/inventory/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.assets.categoriesTab')}
            </Link>
            <Link href="/admin/inventory/utensils" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.utensils.listTab')}
            </Link>
            <Link href="/admin/inventory/utensils/categories" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              {t('inventory.utensils.categoriesTab')}
            </Link>
            <Link href="/admin/inventory/utensils/schedules" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors">
              Programación
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowPrintConfig(true)}
            disabled={filteredAssets.length === 0}
            className="flex items-center gap-2 bg-surface border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors disabled:opacity-50"
          >
            <QrCode className="w-4 h-4" />
            Imprimir Filtrados
          </button>
          <button 
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('inventory.assets.newAsset')}
          </button>
        </div>
      </div>

      {/* Formulario Crear Activo (Modal) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative bg-surface border border-border rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-6 space-y-4 animate-in slide-in-from-bottom-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-text-primary">
                {editingAsset ? t('inventory.assets.editTitle') : t('inventory.assets.createTitle')}
              </h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 text-text-secondary hover:bg-surface-raised rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {error && (
              <div className="p-3 bg-error-light text-error text-sm rounded-xl border border-error/20">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">{t('inventory.assets.nameLabel')}</label>
                <input 
                  placeholder={t('inventory.assets.namePlaceholder')}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">{t('inventory.assets.categoryLabel')}</label>
                  <select 
                    value={newCategoryId}
                    onChange={e => setNewCategoryId(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">{t('inventory.assets.selectCategory')}</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">{t('inventory.assets.venueLabel')}</label>
                  <select 
                    value={newVenueId}
                    onChange={e => setNewVenueId(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">{t('inventory.assets.selectVenue')}</option>
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-text-secondary">{t('inventory.assets.serialLabel')}</label>
                <input 
                  placeholder={t('inventory.assets.serialPlaceholder')}
                  value={newSerial}
                  onChange={e => setNewSerial(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">{t('inventory.assets.brandLabel')}</label>
                  <input 
                    placeholder={t('inventory.assets.brandPlaceholder')}
                    value={newBrand}
                    onChange={e => setNewBrand(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-secondary">{t('inventory.assets.modelLabel')}</label>
                  <input 
                    placeholder={t('inventory.assets.modelPlaceholder')}
                    value={newModel}
                    onChange={e => setNewModel(e.target.value)}
                    className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="flex-1 h-12 rounded-xl font-semibold text-sm border border-border text-text-primary hover:bg-surface-raised transition-colors"
              >
                {t('inventory.assets.cancel')}
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] flex items-center justify-center gap-2 bg-primary text-text-inverse px-6 h-12 rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? t('inventory.assets.saving') : editingAsset ? t('inventory.assets.save') : t('inventory.assets.saveAndQR')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input 
              placeholder="Buscar activos por nombre, serial o categoría..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 h-11 text-sm text-text-primary focus:border-primary outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 border px-4 rounded-xl transition-colors
              ${showFilters || categoryFilter || venueFilter || statusFilter !== 'all' 
                ? 'bg-primary/10 border-primary text-primary' 
                : 'bg-surface border-border text-text-secondary hover:bg-surface-raised'}`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">Filtros</span>
          </button>
        </div>

        {showFilters && (
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Categoría</label>
              <select 
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
              >
                <option value="">Todas las categorías</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Sede</label>
              <select 
                value={venueFilter}
                onChange={e => setVenueFilter(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none"
              >
                <option value="">Todas las sedes</option>
                {venues.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto min-w-[250px]">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Estado</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'operativo', 'en_reparacion', 'baja'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 h-10 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border
                      ${statusFilter === s 
                        ? 'bg-primary text-text-inverse border-primary' 
                        : 'bg-surface-raised border-border text-text-secondary hover:border-border-strong'}`}
                  >
                    {s === 'all' ? 'Todos' : s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full flex items-end">
              <button 
                onClick={() => { setCategoryFilter(''); setVenueFilter(''); setStatusFilter('all'); }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-raised rounded-xl w-full"></div>
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-2xl">
          <QrCode className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text-primary mb-1">{t('inventory.assets.noAssetsTitle')}</h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto mb-6">{t('inventory.assets.noAssetsDesc')}</p>
          <button 
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="text-primary font-medium hover:underline"
          >
            {t('inventory.assets.createFirst')}
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised text-text-secondary font-semibold">
              <tr>
                <th className="px-6 py-4">{t('inventory.assets.table.name')}</th>
                <th className="px-6 py-4">{t('inventory.assets.table.category')}</th>
                <th className="px-6 py-4">{t('inventory.assets.table.status')}</th>
                <th className="px-6 py-4 text-right">{t('inventory.assets.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAssets.map(asset => (
                <tr key={asset.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/inventory/assets/${asset.qr_code}`} className="block hover:opacity-80 transition-opacity">
                      <p className="font-semibold text-primary hover:underline">{asset.name}</p>
                      <p className="text-xs text-text-secondary font-mono mt-0.5" title={asset.qr_code}>ID: {asset.qr_code.substring(0,8)}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{asset.asset_categories?.name || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider
                      ${asset.status === 'operativo' ? 'bg-success/10 text-success' : 
                        asset.status === 'baja' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}>
                      {t('inventory.assets.status.' + asset.status)}
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
                    <button 
                      onClick={() => startEdit(asset)}
                      className="p-2 text-text-secondary hover:text-primary transition-colors bg-surface-raised rounded-lg border border-transparent hover:border-primary/20" 
                      title="Editar"
                    >
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
        <BulkQRCodePrint 
          ref={bulkPrintRef}
          assets={filteredAssets}
          venues={venues}
          gridConfig={gridConfig}
        />
      </div>

      <PrintConfigModal 
        isOpen={showPrintConfig}
        onClose={() => setShowPrintConfig(false)}
        onConfirm={handleConfirmPrint}
        totalAssets={filteredAssets.length}
      />
    </div>
  )
}
