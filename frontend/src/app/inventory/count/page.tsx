'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Send, Loader2, ArrowLeft, Barcode, Check, X, AlertTriangle, ArrowRight } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { useRouter } from 'next/navigation'
import ConfirmationModal from '@/components/ConfirmationModal'

export default function MobileInventoryCount() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [lines, setLines] = useState<any[]>([])
  
  // Draft & Auto-save state
  const [draftId, setDraftId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Search & input form state
  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [qtyInput, setQtyInput] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [presentations, setPresentations] = useState<any[]>([])
  const [selectedPresId, setSelectedPresId] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  // Modal alert state
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Entendido',
    onConfirm: () => {}
  })

  const showAlert = (title: string, message: string, onConfirm = () => {}) => {
    setModalState({
      isOpen: true,
      title,
      message,
      confirmLabel: 'Entendido',
      onConfirm: () => {
        setModalState(prev => ({ ...prev, isOpen: false }))
        onConfirm()
      }
    })
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  // Load active draft when warehouse changes
  useEffect(() => {
    if (selectedWarehouseId) {
      loadActiveDraft(selectedWarehouseId)
    } else {
      setLines([])
      setDraftId(null)
      setSaveStatus('idle')
    }
  }, [selectedWarehouseId])

  // Clear "Guardado" status after 3s
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [saveStatus])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [whList, itemList, catList] = await Promise.all([
        adminApi.getInventoryWarehouses(),
        adminApi.getInventoryItems(),
        adminApi.getItemCategories()
      ])
      setWarehouses(whList || [])
      setItems(itemList || [])
      setCategories(catList || [])
    } catch (err) {
      console.error('Error loading inventory count data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadActiveDraft = async (warehouseId: string) => {
    setLoading(true)
    try {
      const list = await adminApi.getPhysicalInventories()
      const draft = list.find((c: any) => c.warehouse_id === warehouseId && c.status === 'draft')
      if (draft) {
        const detail = await adminApi.getPhysicalInventoryDetail(draft.id)
        setDraftId(draft.id)
        setLines(detail.lines.map((l: any) => ({
          item_id: l.item_id,
          item_name: l.item_name,
          qty_counted_base: parseFloat(l.qty_counted_base),
          presentation_id: l.presentation_id,
          presentation_name: l.presentation_name || l.uom_name || 'Unidades',
          qty_presentation: l.qty_presentation ? parseFloat(l.qty_presentation) : null
        })))
        setSaveStatus('saved')
      } else {
        setLines([])
        setDraftId(null)
        setSaveStatus('idle')
      }
    } catch (err) {
      console.error('Error loading active draft:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectItem = (item: any) => {
    setSelectedItem(item)
    setBarcodeQuery('')
    setSearchResults([])
    // Load presentations
    adminApi.getItemPresentations(item.id).then(pres => {
      setPresentations(pres || [])
      setSelectedPresId('')
    })
  }

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeQuery.trim()) return
    
    setSearching(true)
    setSearchResults([]) 
    setSelectedItem(null)

    setTimeout(() => {
      const query = barcodeQuery.trim().toLowerCase()

      const matches = items.filter(it => {
        const matchesCode = it.code && it.code.toLowerCase() === query
        const matchesName = it.name.toLowerCase().includes(query)
        
        const category = categories.find(c => c.id === it.category_id)
        const matchesCategory = category && category.name.toLowerCase().includes(query)

        return matchesCode || matchesName || matchesCategory
      })

      setSearching(false)

      if (matches.length === 1 && matches[0].code?.toLowerCase() === query) {
        selectItem(matches[0])
      } else if (matches.length > 0) {
        setSearchResults(matches)
      } else {
        setSearchResults([])
        showAlert('Artículo no encontrado', 'No se encontró ningún artículo con el término o código ingresado.')
      }
    }, 400)
  }

  const saveChanges = async (currentLines: any[]) => {
    if (!selectedWarehouseId) return
    
    setSaveStatus('saving')
    try {
      const data = {
        warehouse_id: selectedWarehouseId,
        notes: 'Conteo físico desde dispositivo móvil (Auto-guardado)',
        lines: currentLines.map(l => ({
          item_id: l.item_id,
          qty_counted_base: l.qty_counted_base,
          presentation_id: l.presentation_id,
          qty_presentation: l.qty_presentation
        }))
      }

      if (draftId) {
        await adminApi.updatePhysicalInventory(draftId, data)
        setSaveStatus('saved')
      } else {
        const doc = await adminApi.createPhysicalInventory(data)
        setDraftId(doc.id)
        setSaveStatus('saved')
      }
    } catch (err) {
      console.error('Error auto-saving draft:', err)
      setSaveStatus('error')
    }
  }

  const addLine = () => {
    if (!selectedItem || !qtyInput) return
    const qty = parseFloat(qtyInput)
    if (isNaN(qty) || qty <= 0) return

    const selectedPres = presentations.find(p => p.id === selectedPresId)
    const factor = selectedPres ? parseFloat(selectedPres.conversion_factor) : 1.0
    const qty_counted_base = qty * factor

    let updatedLines = []
    const existingIdx = lines.findIndex(l => l.item_id === selectedItem.id)
    if (existingIdx > -1) {
      updatedLines = [...lines]
      updatedLines[existingIdx].qty_counted_base += qty_counted_base
      updatedLines[existingIdx].qty_presentation = (updatedLines[existingIdx].qty_presentation || 0) + qty
    } else {
      updatedLines = [...lines, {
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        qty_counted_base,
        presentation_id: selectedPresId || null,
        presentation_name: selectedPres ? selectedPres.name : selectedItem.uom_name || 'Unidades',
        qty_presentation: qty
      }]
    }

    setLines(updatedLines)
    saveChanges(updatedLines)

    setSelectedItem(null)
    setQtyInput('')
    setPresentations([])
    setSelectedPresId('')
  }

  const handleProcess = async () => {
    if (!selectedWarehouseId) return
    if (lines.length === 0) return

    setSaving(true)
    try {
      let currentDraftId = draftId
      if (!currentDraftId) {
        const data = {
          warehouse_id: selectedWarehouseId,
          notes: 'Conteo físico desde dispositivo móvil',
          lines: lines.map(l => ({
            item_id: l.item_id,
            qty_counted_base: l.qty_counted_base,
            presentation_id: l.presentation_id,
            qty_presentation: l.qty_presentation
          }))
        }
        const doc = await adminApi.createPhysicalInventory(data)
        currentDraftId = doc.id
        setDraftId(doc.id)
      }

      await adminApi.processPhysicalInventory(currentDraftId)
      showAlert('Inventario Procesado', 'El inventario físico ha sido procesado y el Kardex ha sido ajustado exitosamente.', () => {
        router.push('/admin/inventory/physical')
      })
    } catch (err) {
      console.error(err)
      showAlert('Error', 'Ocurrió un error al intentar procesar el inventario físico.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !selectedWarehouseId) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary px-4 py-6 flex flex-col justify-between">
      <ConfirmationModal 
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmLabel={modalState.confirmLabel}
        cancelLabel=""
        onConfirm={modalState.onConfirm}
        onCancel={() => setModalState(prev => ({ ...prev, isOpen: false }))}
      />

      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/admin/inventory/physical')} className="p-2 hover:bg-surface rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Conteo de Inventario</h1>
          </div>

          {/* Auto-save Status Indicator */}
          {selectedWarehouseId && (
            <div className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all duration-300">
              {saveStatus === 'saving' && (
                <span className="text-primary flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-success flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Guardado
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-error flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Error de red
                </span>
              )}
            </div>
          )}
        </div>

        {/* Almacén Selector */}
        <div className="bg-surface p-4 rounded-xl border border-border mb-4">
          <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Almacén / Sede</label>
          <select 
            value={selectedWarehouseId}
            onChange={e => setSelectedWarehouseId(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl px-3 h-11 text-sm outline-none focus:border-primary text-text-primary"
          >
            <option value="">Selecciona Almacén...</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        {/* Loading Indicator for Draft Load */}
        {loading && selectedWarehouseId && (
          <div className="flex py-12 items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-text-secondary ml-2">Cargando borrador activo...</p>
          </div>
        )}

        {/* Input Barcode / Search */}
        {!loading && selectedWarehouseId && (
          <div className="bg-surface p-4 rounded-xl border border-border mb-4">
            <form onSubmit={handleBarcodeSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-3 w-5 h-5 text-text-secondary" />
                <input 
                  type="text"
                  placeholder="Buscar por código, nombre o categoría..."
                  value={barcodeQuery}
                  onChange={e => {
                    setBarcodeQuery(e.target.value)
                    if (!e.target.value) setSearchResults([])
                  }}
                  className="w-full bg-bg border border-border rounded-xl pl-10 pr-3 h-11 text-sm outline-none focus:border-primary text-text-primary"
                />
              </div>
              <button type="submit" className="bg-primary hover:bg-primary-hover text-text-inverse px-4 rounded-xl h-11 text-sm font-semibold">
                Buscar
              </button>
            </form>

            {/* Loading Indicator */}
            {searching && (
              <div className="mt-3 py-6 flex flex-col items-center justify-center gap-2 bg-bg border border-border rounded-xl animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-[11px] font-medium text-text-secondary">Buscando artículos...</p>
              </div>
            )}

            {/* List of Search Results */}
            {!searching && searchResults.length > 0 && (
              <div className="mt-2 bg-bg border border-border rounded-xl max-h-60 overflow-y-auto divide-y divide-border shadow-sm animate-slide-down-fade">
                {searchResults.map(item => {
                  const category = categories.find(c => c.id === item.category_id)
                  return (
                    <div 
                      key={item.id}
                      onClick={() => selectItem(item)}
                      className="p-3 hover:bg-surface-raised cursor-pointer transition-colors flex justify-between items-center text-sm"
                    >
                      <div>
                        <p className="font-semibold text-text-primary">{item.name}</p>
                        <p className="text-xs text-text-secondary">
                          {item.code ? `Código: ${item.code}` : 'Sin código'} 
                          {category && ` • Cat: ${category.name}`}
                        </p>
                      </div>
                      <span className="text-xs bg-surface border border-border text-text-secondary px-2.5 py-0.5 rounded-full">
                        {item.uom_name || 'Base'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Active Item Selection Box */}
            {selectedItem && (
              <div className="mt-4 p-3 bg-bg rounded-lg border border-border relative animate-slide-down-fade">
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-2 right-2 p-1 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                  type="button"
                  title="Quitar selección"
                >
                  <X className="w-4 h-4" />
                </button>
                <p className="text-sm font-bold pr-8">{selectedItem.name}</p>
                <p className="text-xs text-text-secondary mb-3">
                  Base: {selectedItem.uom_name || 'Unidades'}
                  {categories.find(c => c.id === selectedItem.category_id) && ` • Cat: ${categories.find(c => c.id === selectedItem.category_id).name}`}
                </p>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    placeholder="Cant."
                    value={qtyInput}
                    onChange={e => setQtyInput(e.target.value)}
                    className="w-20 bg-surface border border-border rounded-lg px-2 h-10 text-sm outline-none focus:border-primary text-text-primary"
                  />
                  <select
                    value={selectedPresId}
                    onChange={e => setSelectedPresId(e.target.value)}
                    className="flex-1 bg-surface border border-border rounded-lg px-2 h-10 text-sm outline-none focus:border-primary text-text-primary"
                  >
                    <option value="">{selectedItem.uom_name || 'Base'}</option>
                    {presentations.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button onClick={addLine} className="bg-success text-text-inverse px-3 rounded-lg h-10 hover:bg-success-light transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lines List */}
        {!loading && selectedWarehouseId && (
          <div className="space-y-2 mb-20">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Artículos Contados ({lines.length})</h2>
            {lines.map((l, idx) => (
              <div key={l.item_id} className="bg-surface border border-border rounded-xl p-3 flex justify-between items-center shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{l.item_name}</p>
                  <p className="text-xs text-text-secondary">
                    {l.qty_presentation} {l.presentation_name} ({l.qty_counted_base} base)
                  </p>
                </div>
                <button 
                  onClick={() => {
                    const updated = lines.filter((_, i) => i !== idx)
                    setLines(updated)
                    saveChanges(updated)
                  }}
                  className="p-2 text-error hover:bg-error/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {!loading && selectedWarehouseId && lines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-border flex gap-2">
          <button 
            onClick={() => router.push('/admin/inventory/physical')}
            className="flex-1 border border-border hover:bg-bg text-text-primary rounded-xl h-12 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" /> Salir (Guardado)
          </button>
          <button 
            disabled={saving}
            onClick={handleProcess}
            className="flex-1 bg-success hover:bg-success-light text-text-inverse rounded-xl h-12 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Procesar / Ajustar
          </button>
        </div>
      )}
    </div>
  )
}
