'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminApi } from '@/lib/api'
import { Loader2, ArrowLeft, AlertTriangle, Play, Save, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
import ConfirmationModal from '@/components/ConfirmationModal'

export default function AdminPhysicalInventoryDetail() {
  const params = useParams()
  const router = useRouter()
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [editedLines, setEditedLines] = useState<any[]>([])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Modal state
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Entendido',
    cancelLabel: '',
    onConfirm: () => {}
  })

  const showAlert = (title: string, message: string, onConfirm = () => {}) => {
    setModalState({
      isOpen: true,
      title,
      message,
      confirmLabel: 'Entendido',
      cancelLabel: '',
      onConfirm: () => {
        setModalState(prev => ({ ...prev, isOpen: false }))
        onConfirm()
      }
    })
  }

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalState({
      isOpen: true,
      title,
      message,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      onConfirm: () => {
        setModalState(prev => ({ ...prev, isOpen: false }))
        onConfirm()
      }
    })
  }

  useEffect(() => {
    loadDetail()
  }, [params.id])

  const loadDetail = async () => {
    try {
      const [data, itemsData] = await Promise.all([
        adminApi.getPhysicalInventoryDetail(params.id as string),
        adminApi.getInventoryItems()
      ]) as any
      setDetail(data)
      setNotes(data.notes || '')
      setEditedLines(data.lines || [])
      setItems(itemsData || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItemLine = async (item: any) => {
    if (editedLines.some(l => l.item_id === item.id)) {
      showAlert('Artículo duplicado', 'Este artículo ya se encuentra agregado al conteo físico.')
      setSearchQuery('')
      setShowSuggestions(false)
      return
    }

    setProcessing(true)
    try {
      const stockRes = await adminApi.getItemStock(item.id) as any[]
      const whStock = (stockRes || []).find((s: any) => s.warehouse_id === detail.warehouse_id)
      const expected = whStock ? parseFloat(whStock.qty_base) || 0.0 : 0.0

      const newLine = {
        id: null,
        item_id: item.id,
        item_name: item.name,
        qty_expected_base: expected,
        qty_counted_base: 0.0,
        presentation_id: null,
        presentation_name: null,
        qty_presentation: null,
        notes: ''
      }

      setEditedLines(prev => [...prev, newLine])
      setSearchQuery('')
      setShowSuggestions(false)
    } catch (err) {
      console.error('Error adding item line:', err)
      showAlert('Error', 'No se pudo obtener el stock teórico del artículo.')
    } finally {
      setProcessing(false)
    }
  }

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...editedLines];
    const line = { ...newLines[index] };
    
    if (field === 'qty_presentation') {
      const qtyPres = parseFloat(value) || 0;
      line.qty_presentation = qtyPres;
      if (line.qty_counted_base && line.qty_presentation) {
        const factor = Number(line.qty_counted_base) / Number(line.qty_presentation);
        line.qty_counted_base = qtyPres * (factor || 1.0);
      } else {
        line.qty_counted_base = qtyPres;
      }
    } else if (field === 'qty_counted_base') {
      line.qty_counted_base = parseFloat(value) || 0;
    } else if (field === 'notes') {
      line.notes = value;
    }
    
    newLines[index] = line;
    setEditedLines(newLines);
  }

  const handleSaveDraft = async () => {
    setProcessing(true)
    try {
      const payload = {
        warehouse_id: detail.warehouse_id,
        notes: notes,
        lines: editedLines.map(l => ({
          item_id: l.item_id,
          qty_counted_base: parseFloat(l.qty_counted_base) || 0,
          presentation_id: l.presentation_id || null,
          qty_presentation: l.qty_presentation !== null && l.qty_presentation !== undefined ? parseFloat(l.qty_presentation) : null,
          notes: l.notes || ''
        }))
      }
      await adminApi.updatePhysicalInventory(params.id as string, payload)
      showAlert('Conteo Guardado', 'Los cambios en el borrador de conteo han sido guardados correctamente.', () => {
        loadDetail()
      })
    } catch (err) {
      console.error(err)
      showAlert('Error', 'Ocurrió un error al intentar guardar los cambios del conteo.')
    } finally {
      setProcessing(false)
    }
  }

  const handleProcess = () => {
    showConfirm(
      '¿Procesar Conteo?',
      '¿Está seguro de procesar este conteo? Esto actualizará el stock disponible y registrará los movimientos de ajuste en el Kardex.',
      async () => {
        setProcessing(true)
        try {
          // Guardar cambios automáticamente antes de procesar
          const payload = {
            warehouse_id: detail.warehouse_id,
            notes: notes,
            lines: editedLines.map(l => ({
              item_id: l.item_id,
              qty_counted_base: parseFloat(l.qty_counted_base) || 0,
              presentation_id: l.presentation_id || null,
              qty_presentation: l.qty_presentation !== null && l.qty_presentation !== undefined ? parseFloat(l.qty_presentation) : null,
              notes: l.notes || ''
            }))
          }
          await adminApi.updatePhysicalInventory(params.id as string, payload)

          await adminApi.processPhysicalInventory(params.id as string)
          showAlert('Ajustes Aplicados', 'Los ajustes de inventario han sido aplicados correctamente en la base de datos.', () => {
            loadDetail()
          })
        } catch (err) {
          console.error(err)
          showAlert('Error', 'Ocurrió un error al procesar los ajustes de inventario.')
        } finally {
          setProcessing(false)
        }
      }
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/inventory/physical" className="p-2 hover:bg-surface rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{detail.document_number}</h1>
            {detail.status === 'processed' ? (
              <span className="bg-success-light text-success text-xs px-2.5 py-1 rounded-full font-medium border border-success/15">
                Procesado
              </span>
            ) : (
              <span className="bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full font-medium border border-primary/15">
                Borrador
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary">Revisión y Ajuste de Inventario Físico</p>
        </div>
      </div>

      {/* Metadata Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border">
          <span className="text-xs text-text-secondary uppercase font-bold tracking-wider">Almacén</span>
          <p className="text-base font-semibold mt-1">{detail.warehouse_name}</p>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <span className="text-xs text-text-secondary uppercase font-bold tracking-wider">Creado por</span>
          <p className="text-base font-semibold mt-1">{detail.creator_name} ({new Date(detail.created_at).toLocaleDateString()})</p>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <span className="text-xs text-text-secondary uppercase font-bold tracking-wider">Procesado por</span>
          <p className="text-base font-semibold mt-1">
            {detail.processor_name ? `${detail.processor_name} (${new Date(detail.processed_at).toLocaleDateString()})` : 'Pendiente de Auditoría'}
          </p>
        </div>
      </div>

      {/* Document Notes */}
      <div className="bg-surface p-4 rounded-xl border border-border">
        <span className="text-xs text-text-secondary uppercase font-bold tracking-wider">Notas del Conteo</span>
        {detail.status === 'draft' ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas generales sobre este conteo físico..."
            className="w-full mt-2 p-3 bg-surface border border-border rounded-xl text-sm outline-none focus:border-primary resize-none h-20"
          />
        ) : (
          <p className="text-sm text-text-primary mt-2">{detail.notes || 'Sin observaciones.'}</p>
        )}
      </div>

      {/* Lines Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-bg flex flex-col sm:flex-row justify-between items-center gap-3">
          <h2 className="text-base font-bold">Artículos Contados</h2>
          
          {detail.status === 'draft' && (
            <div className="relative w-full sm:w-72">
              <div className="relative">
                <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Agregar artículo..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full pl-9 pr-4 h-9 bg-surface border border-border rounded-lg text-xs outline-none focus:border-primary text-text-primary"
                />
              </div>
              
              {showSuggestions && searchQuery.trim() !== '' && (
                <div className="absolute right-0 z-10 w-full mt-1 bg-surface border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {items
                    .filter(item => 
                      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (item.code || '').toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .slice(0, 5)
                    .map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddItemLine(item)}
                        className="w-full text-left px-4 py-2 hover:bg-surface-raised text-xs flex flex-col border-b border-border last:border-0 text-text-primary transition-colors cursor-pointer"
                      >
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-[10px] text-text-secondary">{item.code || 'Sin código'}</span>
                      </button>
                    ))}
                  {items.filter(item => 
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (item.code || '').toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="px-4 py-3 text-center text-text-disabled text-xs">No se encontraron artículos</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                <th className="p-4">Artículo</th>
                <th className="p-4">Esperado (Sist.)</th>
                <th className="p-4">Contado (Físico)</th>
                <th className="p-4">Diferencia</th>
                <th className="p-4">Notas</th>
                {detail.status === 'draft' && <th className="p-4 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {editedLines.map((l: any, index: number) => {
                const diff = (l.qty_counted_base || 0) - (l.qty_expected_base || 0);
                const hasPresentation = l.presentation_id && l.presentation_name;
                
                return (
                  <tr key={l.id || l.item_id} className="border-b border-border hover:bg-surface-raised transition-colors text-sm">
                    <td className="p-4 font-semibold">{l.item_name}</td>
                    <td className="p-4">{l.qty_expected_base}</td>
                    
                    {/* Counted Cell (Editable if Draft) */}
                    <td className="p-4">
                      {detail.status === 'draft' ? (
                        <div className="flex items-center gap-2 max-w-[280px]">
                          {hasPresentation ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <input
                                type="number"
                                step="any"
                                value={l.qty_presentation ?? 0}
                                onChange={(e) => handleLineChange(index, 'qty_presentation', e.target.value)}
                                className="w-16 bg-surface border border-border rounded-lg px-2 h-9 text-sm text-center outline-none focus:border-primary font-bold text-text-primary"
                              />
                              <span className="text-xs text-text-secondary truncate max-w-[60px]" title={l.presentation_name}>{l.presentation_name}</span>
                              <span className="text-xs text-text-disabled whitespace-nowrap">({Number(l.qty_counted_base).toFixed(2)} base)</span>
                            </div>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              value={l.qty_counted_base ?? 0}
                              onChange={(e) => handleLineChange(index, 'qty_counted_base', e.target.value)}
                              className="w-20 bg-surface border border-border rounded-lg px-2 h-9 text-sm text-center outline-none focus:border-primary font-bold text-text-primary"
                            />
                          )}
                        </div>
                      ) : (
                        <span>
                          {l.qty_counted_base} {l.presentation_name && `(${l.qty_presentation} ${l.presentation_name})`}
                        </span>
                      )}
                    </td>
                    
                    <td className="p-4 font-bold">
                      {diff > 0 ? (
                        <span className="text-success">+{diff.toFixed(2)}</span>
                      ) : diff < 0 ? (
                        <span className="text-error">{diff.toFixed(2)}</span>
                      ) : (
                        <span className="text-text-secondary">0</span>
                      )}
                    </td>
                    
                    {/* Notes Cell (Editable if Draft) */}
                    <td className="p-4">
                      {detail.status === 'draft' ? (
                        <input
                          type="text"
                          value={l.notes || ''}
                          placeholder="Añadir nota de varianza..."
                          onChange={(e) => handleLineChange(index, 'notes', e.target.value)}
                          className="w-full bg-surface border border-border rounded-lg px-3 h-9 text-xs outline-none focus:border-primary text-text-primary"
                        />
                      ) : (
                        <span className="text-text-secondary text-xs">{l.notes || '-'}</span>
                      )}
                    </td>

                    {/* Action Cell (Editable if Draft) */}
                    {detail.status === 'draft' && (
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditedLines(prev => prev.filter((_, i) => i !== index));
                          }}
                          className="p-1.5 text-text-disabled hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                          title="Quitar artículo del conteo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Apply Adjustments */}
      {detail.status === 'draft' && (
        <div className="bg-surface-raised p-6 rounded-2xl border border-border flex flex-col md:flex-row justify-between items-center gap-4 animate-in fade-in">
          <div className="flex gap-3">
            <AlertTriangle className="w-10 h-10 text-warning shrink-0" />
            <div>
              <p className="text-sm font-semibold">Procesar Ajustes de Kardex</p>
              <p className="text-xs text-text-secondary max-w-xl">
                Al presionar procesar, el sistema registrará los movimientos de ajuste positivo y negativo utilizando costo PEPS en el Kardex. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            <button
              disabled={processing}
              onClick={handleSaveDraft}
              className="w-full sm:w-auto border border-border bg-surface hover:bg-surface-raised text-text-primary rounded-xl h-12 px-6 font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" /> Guardar Cambios
                </>
              )}
            </button>
            <button
              disabled={processing}
              onClick={handleProcess}
              className="w-full sm:w-auto bg-success hover:bg-success/90 text-text-inverse rounded-xl h-12 px-6 font-bold flex items-center justify-center gap-2 transition-all shadow-md"
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> Procesar y Ajustar Stock
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        confirmLabel={modalState.confirmLabel}
        cancelLabel={modalState.cancelLabel}
        onConfirm={modalState.onConfirm}
        onCancel={() => setModalState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
