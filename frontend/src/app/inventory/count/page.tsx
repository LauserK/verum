'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Send, Loader2, ArrowLeft, Barcode, Check, X, AlertTriangle, ArrowRight, ChevronDown, MapPin, QrCode } from 'lucide-react'
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
  
  // Custom dropdown selector state
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false)

  // Scanner state
  const [openScanner, setOpenScanner] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [openItemScanner, setOpenItemScanner] = useState(false)
  const [itemScannerError, setItemScannerError] = useState<string | null>(null)

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

  // Warehouse Scanner Logic
  useEffect(() => {
    let scannerInstance: any = null

    async function startScanner() {
      if (!openScanner) return

      try {
        // @ts-ignore
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('warehouse-qr-reader')
        scannerInstance = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (width: number, height: number) => {
              const size = Math.min(width, height) * 0.7
              return { width: size, height: size }
            }
          },
          (decodedText: string) => {
            const trimmed = decodedText.trim()
            const matchedWh = warehouses.find(wh => 
              wh.id === trimmed || 
              wh.name.toLowerCase() === trimmed.toLowerCase()
            )

            if (matchedWh) {
              setSelectedWarehouseId(matchedWh.id)
              setOpenScanner(false)
              scanner.stop().catch((err: any) => console.error('Error stopping scanner:', err))
            } else {
              setScannerError(`Código no corresponde a ningún almacén activo: "${trimmed}"`)
            }
          },
          () => {
            // Keep scanner error empty on standard non-matches during video frames
          }
        )
      } catch (err) {
        console.error('Failed to start scanner:', err)
        setScannerError('No se pudo iniciar la cámara. Asegúrate de dar los permisos necesarios.')
      }
    }

    startScanner()

    return () => {
      if (scannerInstance && scannerInstance.isScanning) {
        scannerInstance.stop().catch((err: any) => console.error('Error stopping scanner on cleanup:', err))
      }
    }
  }, [openScanner, warehouses])

  // Item Scanner Logic (Checks Client-Side Items, then Queries Backend for Lot Matches)
  useEffect(() => {
    let scannerInstance: any = null

    async function startScanner() {
      if (!openItemScanner) return

      try {
        // @ts-ignore
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('item-qr-reader')
        scannerInstance = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (width: number, height: number) => {
              const size = Math.min(width, height) * 0.7
              return { width: size, height: size }
            }
          },
          async (decodedText: string) => {
            const trimmed = decodedText.trim()
            const queryLower = trimmed.toLowerCase()

            // 1. Check local client-side match (ID, Code, Name)
            const matchedItem = items.find(it => 
              it.id === trimmed ||
              (it.code && it.code.toLowerCase() === queryLower) ||
              it.name.toLowerCase() === queryLower
            )

            if (matchedItem) {
              selectItem(matchedItem)
              setOpenItemScanner(false)
              scanner.stop().catch((err: any) => console.error('Error stopping scanner:', err))
              return
            }

            // 2. Query backend to check if it matches a stock lot number
            try {
              const res = await adminApi.resolveLotNumber(trimmed)
              if (res && res.item) {
                selectItem(res.item)
                setOpenItemScanner(false)
                scanner.stop().catch((err: any) => console.error('Error stopping scanner:', err))
                return
              }
            } catch (err: any) {
              console.error('Error resolving lot number from scanned text:', err)
            }

            // If we reach here, no match was found
            setItemScannerError(`No se encontró artículo o lote con el código: "${trimmed}"`)
          },
          () => {
            // Keep scanner error empty on standard non-matches during video frames
          }
        )
      } catch (err) {
        console.error('Failed to start item scanner:', err)
        setItemScannerError('No se pudo iniciar la cámara. Asegúrate de dar los permisos necesarios.')
      }
    }

    startScanner()

    return () => {
      if (scannerInstance && scannerInstance.isScanning) {
        scannerInstance.stop().catch((err: any) => console.error('Error stopping item scanner on cleanup:', err))
      }
    }
  }, [openItemScanner, items])

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

      await adminApi.processPhysicalInventory(currentDraftId!)
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

      {/* QR/Barcode Scanner Modal */}
      {openScanner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-border bg-surface-raised">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary animate-pulse" />
                <h3 className="font-bold text-sm">Escanear Almacén</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenScanner(false)}
                className="p-1 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col items-center justify-center">
              <div className="w-full aspect-square max-w-[280px] overflow-hidden rounded-2xl bg-black border border-border relative flex items-center justify-center">
                <div id="warehouse-qr-reader" className="w-full h-full" />
                <div className="absolute inset-0 border border-primary/40 pointer-events-none rounded-2xl animate-pulse"></div>
              </div>

              <p className="mt-4 text-xs text-text-secondary text-center max-w-[240px]">
                Enfoque el código QR o de barras del almacén para seleccionarlo automáticamente.
              </p>

              {scannerError && (
                <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl text-xs text-error font-medium flex items-center gap-2 animate-slide-down-fade">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{scannerError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR/Barcode Scanner Modal for Items */}
      {openItemScanner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-border bg-surface-raised">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary animate-pulse" />
                <h3 className="font-bold text-sm">Escanear Artículo</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenItemScanner(false)}
                className="p-1 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col items-center justify-center">
              <div className="w-full aspect-square max-w-[280px] overflow-hidden rounded-2xl bg-black border border-border relative flex items-center justify-center">
                <div id="item-qr-reader" className="w-full h-full" />
                <div className="absolute inset-0 border border-primary/40 pointer-events-none rounded-2xl animate-pulse"></div>
              </div>

              <p className="mt-4 text-xs text-text-secondary text-center max-w-[240px]">
                Enfoque el código de barras, código QR del artículo o etiqueta de lote para seleccionarlo.
              </p>

              {itemScannerError && (
                <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl text-xs text-error font-medium flex items-center gap-2 animate-slide-down-fade">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{itemScannerError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

        {/* Almacén Selector (Custom KDS Styled Dropdown & QR/Barcode Scanner Button) */}
        <div className="bg-surface p-4 rounded-xl border border-border mb-4">
          <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Almacén / Sede</label>
          <div className="flex items-center gap-2 relative">
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)}
                className={`
                  w-full flex items-center justify-between px-4 h-11 rounded-xl border transition-all duration-300 bg-bg text-sm outline-none text-text-primary font-black tracking-tight
                  ${showWarehouseDropdown ? 'border-primary bg-surface-raised shadow-lg shadow-primary/10' : 'border-border bg-bg hover:border-primary/50'}
                `}
              >
                <div className="flex items-center gap-2">
                  <MapPin className={`w-3.5 h-3.5 ${showWarehouseDropdown ? 'text-primary animate-bounce' : 'text-primary/60'}`} />
                  <span>
                    {warehouses.find(wh => wh.id === selectedWarehouseId)?.name || 'Selecciona Almacén...'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-300 ${showWarehouseDropdown ? 'rotate-180 text-primary' : ''}`} />
              </button>

              {showWarehouseDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-[105]" 
                    onClick={() => setShowWarehouseDropdown(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-2xl shadow-2xl z-[110] overflow-hidden animate-slide-down-fade">
                    <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                      {warehouses.map(wh => (
                        <button
                          key={wh.id}
                          type="button"
                          onClick={() => {
                            setSelectedWarehouseId(wh.id)
                            setShowWarehouseDropdown(false)
                          }}
                          className={`
                            w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all
                            ${selectedWarehouseId === wh.id ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'}
                          `}
                        >
                          <span className="text-sm font-bold">{wh.name}</span>
                          {selectedWarehouseId === wh.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                      {warehouses.length === 0 && (
                        <p className="p-4 text-center text-xs text-text-secondary">No hay almacenes disponibles</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* QR/Barcode scanner button next to the selector */}
            <button
              type="button"
              onClick={() => {
                setScannerError(null)
                setOpenScanner(true)
              }}
              className="h-11 w-11 bg-surface-raised hover:bg-bg border border-border hover:border-primary text-text-secondary hover:text-primary rounded-xl flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer"
              title="Escanear Código de Almacén"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>
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
              <button
                type="button"
                onClick={() => {
                  setItemScannerError(null)
                  setOpenItemScanner(true)
                }}
                className="h-11 w-11 bg-surface-raised hover:bg-bg border border-border hover:border-primary text-text-secondary hover:text-primary rounded-xl flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer"
                title="Escanear Artículo (QR/Barra)"
              >
                <QrCode className="w-5 h-5" />
              </button>
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
