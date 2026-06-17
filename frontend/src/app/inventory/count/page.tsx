'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Send, Loader2, ArrowLeft, Barcode, Check } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function MobileInventoryCount() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const [lines, setLines] = useState<any[]>([])
  
  // Search & input form state
  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [qtyInput, setQtyInput] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [presentations, setPresentations] = useState<any[]>([])
  const [selectedPresId, setSelectedPresId] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [whList, itemList] = await Promise.all([
        adminApi.getInventoryWarehouses(),
        adminApi.getInventoryItems()
      ])
      setWarehouses(whList || [])
      setItems(itemList || [])
    } catch (err) {
      console.error('Error loading inventory count data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeQuery) return
    
    // Find item by code/barcode
    const item = items.find(it => it.code === barcodeQuery || it.name.toLowerCase().includes(barcodeQuery.toLowerCase()))
    if (item) {
      setSelectedItem(item)
      setBarcodeQuery('')
      // Load presentations
      adminApi.getItemPresentations(item.id).then(pres => {
        setPresentations(pres || [])
        setSelectedPresId('')
      })
    } else {
      alert('Artículo no encontrado')
    }
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
                  placeholder="Escanea o escribe código..."
                  value={barcodeQuery}
                  onChange={e => setBarcodeQuery(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl pl-10 pr-3 h-11 text-sm outline-none focus:border-primary text-text-primary"
                />
              </div>
              <button type="submit" className="bg-primary hover:bg-primary-hover text-text-inverse px-4 rounded-xl h-11 text-sm font-semibold">
                Buscar
              </button>
            </form>

            {selectedItem && (
              <div className="mt-4 p-3 bg-bg rounded-lg border border-border">
                <p className="text-sm font-bold">{selectedItem.name}</p>
                <p className="text-xs text-text-secondary mb-3">Base: {selectedItem.uom_name || 'Unidades'}</p>
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
