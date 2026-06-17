'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Send, Loader2, ArrowLeft, Barcode, Check, X } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { useRouter } from 'next/navigation'

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
  
  // Search & input form state
  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [qtyInput, setQtyInput] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [presentations, setPresentations] = useState<any[]>([])
  const [selectedPresId, setSelectedPresId] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    loadInitialData()
  }, [])

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
    setSearchResults([]) // Clear old results during new search
    setSelectedItem(null)

    // Artificial search delay for smooth loading effect
    setTimeout(() => {
      const query = barcodeQuery.trim().toLowerCase()

      // Find all matching items by code, name or category
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
        alert('No se encontraron artículos')
      }
    }, 400)
  }

  const addLine = () => {
    if (!selectedItem || !qtyInput) return
    const qty = parseFloat(qtyInput)
    if (isNaN(qty) || qty <= 0) return

    const selectedPres = presentations.find(p => p.id === selectedPresId)
    const factor = selectedPres ? parseFloat(selectedPres.conversion_factor) : 1.0
    const qty_counted_base = qty * factor

    // Add or update line
    const existingIdx = lines.findIndex(l => l.item_id === selectedItem.id)
    if (existingIdx > -1) {
      const updated = [...lines]
      updated[existingIdx].qty_counted_base += qty_counted_base
      updated[existingIdx].qty_presentation = (updated[existingIdx].qty_presentation || 0) + qty
      setLines(updated)
    } else {
      setLines([...lines, {
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        qty_counted_base,
        presentation_id: selectedPresId || null,
        presentation_name: selectedPres ? selectedPres.name : selectedItem.uom_name || 'Unidades',
        qty_presentation: qty
      }])
    }

    setSelectedItem(null)
    setQtyInput('')
    setPresentations([])
    setSelectedPresId('')
  }

  const handleSave = async (submitToProcess = false) => {
    if (!selectedWarehouseId) {
      alert('Por favor selecciona un almacén')
      return
    }
    if (lines.length === 0) {
      alert('Agrega al menos un artículo para contar')
      return
    }

    setSaving(true)
    try {
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
      if (submitToProcess) {
        await adminApi.processPhysicalInventory(doc.id)
        alert('Inventario procesado y Kardex actualizado exitosamente.')
      } else {
        alert('Borrador de conteo guardado exitosamente.')
      }
      router.push('/admin/inventory/physical')
    } catch (err) {
      console.error(err)
      alert('Error guardando el conteo de inventario')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary px-4 py-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 hover:bg-surface rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Conteo de Inventario</h1>
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

        {/* Input Barcode / Search */}
        {selectedWarehouseId && (
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
                <Loader2 className="w-6 h-6 animate-spin text-primary animate-duration-1000" />
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
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                className="p-2 text-error hover:bg-error/10 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      {selectedWarehouseId && lines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-border flex gap-2">
          <button 
            disabled={saving}
            onClick={() => handleSave(false)}
            className="flex-1 border border-border hover:bg-bg text-text-primary rounded-xl h-12 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Guardar Borrador
          </button>
          <button 
            disabled={saving}
            onClick={() => handleSave(true)}
            className="flex-1 bg-success hover:bg-success-light text-text-inverse rounded-xl h-12 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Procesar / Ajustar
          </button>
        </div>
      )}
    </div>
  )
}
