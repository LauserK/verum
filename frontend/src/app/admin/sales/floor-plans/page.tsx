'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useVenue } from '@/components/VenueContext'
import {
  useFloorPlans,
  useCreateFloorPlan,
  useUpdateFloorPlan,
  useDeleteFloorPlan,
  useCreateTable,
  useUpdateTable,
  useDeleteTable,
} from '@/hooks/useSales'
import { FloorPlan, TableItem } from '@/lib/api/sales'
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Maximize2,
  Users,
  Grid,
  Square,
  Circle,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronRight,
  ChevronDown,
  Building2,
} from 'lucide-react'

const GRID_SNAP = 10

export default function FloorPlansAdminPage() {
  const { selectedVenueId, selectedVenueName, availableVenues, setSelectedVenueId } = useVenue()
  const { data: floorPlans = [], isLoading } = useFloorPlans(selectedVenueId || undefined)

  const createFloorPlan = useCreateFloorPlan()
  const updateFloorPlan = useUpdateFloorPlan()
  const deleteFloorPlan = useDeleteFloorPlan()

  const createTable = useCreateTable()
  const updateTable = useUpdateTable()
  const deleteTable = useDeleteTable()

  // Selected Zone / Floor Plan
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  // Selected Table for Inspector
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)

  // Modals state
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<FloorPlan | null>(null)
  const [zoneFormData, setZoneFormData] = useState({
    name: '',
    width: 800,
    height: 600,
  })

  // Canvas Viewport Zoom & Pan
  const [scale, setScale] = useState(1)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // Dragging state
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [tempPositions, setTempPositions] = useState<Record<string, { x: number; y: number }>>({})

  // Automatically select the first plan if none selected or if selected was deleted
  useEffect(() => {
    if (floorPlans.length > 0) {
      if (!selectedPlanId || !floorPlans.find((p) => p.id === selectedPlanId)) {
        setSelectedPlanId(floorPlans[0].id)
      }
    } else {
      setSelectedPlanId(null)
    }
  }, [floorPlans, selectedPlanId])

  const currentPlan = floorPlans.find((p) => p.id === selectedPlanId) || null
  const currentTables: TableItem[] = currentPlan?.tables || []
  const selectedTable = currentTables.find((t) => t.id === selectedTableId) || null

  // Zone Management Handlers
  const handleOpenCreateZone = () => {
    setEditingZone(null)
    setZoneFormData({
      name: '',
      width: 800,
      height: 600,
    })
    setIsZoneModalOpen(true)
  }

  const handleOpenEditZone = (plan: FloorPlan) => {
    setEditingZone(plan)
    setZoneFormData({
      name: plan.name,
      width: plan.width || 800,
      height: plan.height || 600,
    })
    setIsZoneModalOpen(true)
  }

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVenueId) return

    if (editingZone) {
      await updateFloorPlan.mutateAsync({
        id: editingZone.id,
        data: {
          name: zoneFormData.name,
          width: Number(zoneFormData.width),
          height: Number(zoneFormData.height),
        },
      })
    } else {
      const newPlan = await createFloorPlan.mutateAsync({
        venue_id: selectedVenueId,
        name: zoneFormData.name,
        width: Number(zoneFormData.width),
        height: Number(zoneFormData.height),
      })
      if (newPlan?.id) {
        setSelectedPlanId(newPlan.id)
      }
    }
    setIsZoneModalOpen(false)
  }

  const handleDeleteZone = async (plan: FloorPlan) => {
    if (!confirm(`¿Eliminar la zona "${plan.name}" y todas sus mesas asociadas?`)) return
    await deleteFloorPlan.mutateAsync(plan.id)
    if (selectedPlanId === plan.id) {
      setSelectedPlanId(null)
    }
  }

  // Table Management Handlers
  const handleAddTable = () => {
    if (!selectedPlanId) return
    const tableNumber = currentTables.length + 1
    const newTableData: Partial<TableItem> = {
      name: `Mesa ${tableNumber}`,
      shape: 'rectangle',
      x: Math.min(60 + ((tableNumber * 30) % 360), (currentPlan?.width || 800) - 100),
      y: Math.min(60 + ((tableNumber * 30) % 240), (currentPlan?.height || 600) - 100),
      width: 80,
      height: 80,
      capacity: 4,
      is_active: true,
    }

    createTable.mutate(
      {
        planId: selectedPlanId,
        data: newTableData,
      },
      {
        onSuccess: (created) => {
          if (created?.id) {
            setSelectedTableId(created.id)
          }
        },
      }
    )
  }

  const handleDuplicateTable = (table: TableItem) => {
    if (!selectedPlanId) return
    const newTableData: Partial<TableItem> = {
      name: `${table.name} (Copia)`,
      shape: table.shape,
      x: Math.min(table.x + 30, (currentPlan?.width || 800) - table.width),
      y: Math.min(table.y + 30, (currentPlan?.height || 600) - table.height),
      width: table.width,
      height: table.height,
      capacity: table.capacity,
      is_active: table.is_active,
    }

    createTable.mutate(
      {
        planId: selectedPlanId,
        data: newTableData,
      },
      {
        onSuccess: (created) => {
          if (created?.id) {
            setSelectedTableId(created.id)
          }
        },
      }
    )
  }

  const handleUpdateTableField = async (tableId: string, field: keyof TableItem, value: any) => {
    await updateTable.mutateAsync({
      tableId,
      data: { [field]: value },
    })
  }

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta mesa?')) return
    await deleteTable.mutateAsync(tableId)
    if (selectedTableId === tableId) {
      setSelectedTableId(null)
    }
  }

  // Mouse Drag Events for Tables
  const handleMouseDownTable = (e: React.MouseEvent, table: TableItem) => {
    e.stopPropagation()
    setSelectedTableId(table.id)
    setDraggingTableId(table.id)

    const currentX = tempPositions[table.id]?.x ?? table.x
    const currentY = tempPositions[table.id]?.y ?? table.y

    const canvasRect = canvasContainerRef.current?.getBoundingClientRect()
    if (!canvasRect) return

    const mouseCanvasX = (e.clientX - canvasRect.left) / scale
    const mouseCanvasY = (e.clientY - canvasRect.top) / scale

    setDragOffset({
      x: mouseCanvasX - currentX,
      y: mouseCanvasY - currentY,
    })
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingTableId || !currentPlan || !canvasContainerRef.current) return

      const canvasRect = canvasContainerRef.current.getBoundingClientRect()
      const mouseCanvasX = (e.clientX - canvasRect.left) / scale
      const mouseCanvasY = (e.clientY - canvasRect.top) / scale

      let newX = mouseCanvasX - dragOffset.x
      let newY = mouseCanvasY - dragOffset.y

      // Snap to grid
      newX = Math.round(newX / GRID_SNAP) * GRID_SNAP
      newY = Math.round(newY / GRID_SNAP) * GRID_SNAP

      // Bounds limit
      const table = currentTables.find((t) => t.id === draggingTableId)
      const tableW = table?.width || 80
      const tableH = table?.height || 80

      newX = Math.max(0, Math.min(newX, currentPlan.width - tableW))
      newY = Math.max(0, Math.min(newY, currentPlan.height - tableH))

      setTempPositions((prev) => ({
        ...prev,
        [draggingTableId]: { x: newX, y: newY },
      }))
    },
    [draggingTableId, currentPlan, dragOffset, scale, currentTables]
  )

  const handleMouseUp = useCallback(async () => {
    if (!draggingTableId) return

    const finalPos = tempPositions[draggingTableId]
    const table = currentTables.find((t) => t.id === draggingTableId)
    const tableId = draggingTableId
    setDraggingTableId(null)

    if (finalPos && table && (finalPos.x !== table.x || finalPos.y !== table.y)) {
      await updateTable.mutateAsync({
        tableId,
        data: {
          x: finalPos.x,
          y: finalPos.y,
        },
      })
    }
  }, [draggingTableId, tempPositions, currentTables, updateTable])

  useEffect(() => {
    if (draggingTableId) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [draggingTableId, handleMouseMove, handleMouseUp])

  // Keyboard accessibility for selected table (nudging and delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (!selectedTable || !currentPlan) return

      const step = e.shiftKey ? 10 : 5
      let deltaX = 0
      let deltaY = 0

      if (e.key === 'ArrowLeft') deltaX = -step
      else if (e.key === 'ArrowRight') deltaX = step
      else if (e.key === 'ArrowUp') deltaY = -step
      else if (e.key === 'ArrowDown') deltaY = step
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteTable(selectedTable.id)
        return
      } else {
        return
      }

      e.preventDefault()
      const newX = Math.max(0, Math.min(selectedTable.x + deltaX, currentPlan.width - selectedTable.width))
      const newY = Math.max(0, Math.min(selectedTable.y + deltaY, currentPlan.height - selectedTable.height))

      handleUpdateTableField(selectedTable.id, 'x', newX)
      handleUpdateTableField(selectedTable.id, 'y', newY)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTable, currentPlan])

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Planos de Mesas</h1>
            
            {/* Interactive Venue Switcher */}
            <div className="relative inline-flex items-center">
              <Building2 className="w-3.5 h-3.5 text-primary absolute left-3 pointer-events-none" />
              <select
                value={selectedVenueId || ''}
                onChange={(e) => {
                  setSelectedVenueId(e.target.value)
                  setSelectedPlanId(null)
                  setSelectedTableId(null)
                }}
                className="pl-8 pr-7 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                aria-label="Seleccionar sede"
              >
                {availableVenues.map((v) => (
                  <option key={v.id} value={v.id} className="bg-surface text-text-primary">
                    Sede: {v.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-primary absolute right-2.5 pointer-events-none opacity-70" />
            </div>
          </div>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            Diseña la distribución espacial interactiva de tu salón, terraza o barra para el Punto de Venta (POS).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateZone}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-text-inverse hover:bg-primary-hover rounded-xl text-xs font-bold transition-all shadow-sm shadow-primary/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva Zona
          </button>
        </div>
      </div>

      {/* Zone Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
        {floorPlans.length === 0 && !isLoading && (
          <div className="text-sm text-text-secondary py-2 flex items-center gap-2">
            <Layers className="w-4 h-4" /> No hay zonas creadas aún. Crea la primera zona para comenzar.
          </div>
        )}

        {floorPlans.map((plan) => {
          const isSelected = plan.id === selectedPlanId
          return (
            <div
              key={plan.id}
              role="tab"
              tabIndex={0}
              aria-selected={isSelected}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border select-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                isSelected
                  ? 'bg-primary text-text-inverse border-primary shadow-sm shadow-primary/20'
                  : 'bg-surface text-text-secondary border-border hover:text-text-primary hover:border-text-secondary/30'
              }`}
              onClick={() => {
                setSelectedPlanId(plan.id)
                setSelectedTableId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedPlanId(plan.id)
                  setSelectedTableId(null)
                }
              }}
            >
              <Layers className="w-4 h-4 opacity-80" />
              <span className="font-semibold">{plan.name}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-surface-raised text-text-secondary'
                }`}
              >
                {plan.tables?.length || 0}
              </span>
              {isSelected && (
                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-white/25">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenEditZone(plan)
                    }}
                    className="p-1 hover:bg-white/20 rounded-md transition-colors text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                    title="Editar dimensiones de zona"
                    aria-label={`Editar dimensiones de zona ${plan.name}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteZone(plan)
                    }}
                    className="p-1 hover:bg-red-500/40 rounded-md transition-colors text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                    title="Eliminar zona"
                    aria-label={`Eliminar zona ${plan.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Main Canvas & Inspector Area */}
      {currentPlan ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Canvas Viewport (3 Cols) */}
          <div className="lg:col-span-3 bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col space-y-4">
            {/* Canvas Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddTable}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-text-inverse hover:bg-primary-hover rounded-lg text-xs font-bold transition-all shadow-sm shadow-primary/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Mesa
                </button>
                <div className="h-4 w-px bg-border mx-1" />
                <span className="text-xs text-text-secondary flex items-center gap-1.5 font-mono">
                  <Grid className="w-3.5 h-3.5" /> {currentPlan.width} × {currentPlan.height} px
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.1).toFixed(1))))}
                  className="p-1.5 bg-surface-raised border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  title="Alejar"
                  aria-label="Alejar zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-medium text-text-secondary min-w-[3.5rem] text-center px-1">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.min(2.0, Number((s + 0.1).toFixed(1))))}
                  className="p-1.5 bg-surface-raised border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  title="Acercar"
                  aria-label="Acercar zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setScale(1)}
                  className="p-1.5 bg-surface-raised border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  title="Restablecer Zoom a 100%"
                  aria-label="Restablecer zoom a 100%"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Canvas Container */}
            <div
              tabIndex={0}
              aria-label="Lienzo de distribución de mesas"
              className="w-full overflow-auto max-h-[680px] min-h-[460px] bg-surface-raised/40 rounded-xl border border-dashed border-border/80 p-8 flex items-center justify-center select-none relative focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <div
                ref={canvasContainerRef}
                onClick={() => setSelectedTableId(null)}
                style={{
                  width: `${currentPlan.width}px`,
                  height: `${currentPlan.height}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  backgroundImage: `radial-gradient(var(--border) 1.5px, transparent 1.5px)`,
                  backgroundSize: '20px 20px',
                }}
                className="bg-surface relative shadow-md rounded-xl border-2 border-border transition-transform overflow-hidden"
              >
                {/* Tables rendering */}
                {currentTables.map((table) => {
                  const posX = tempPositions[table.id]?.x ?? table.x
                  const posY = tempPositions[table.id]?.y ?? table.y
                  const isSelected = table.id === selectedTableId
                  const isDragging = table.id === draggingTableId

                  return (
                    <div
                      key={table.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${table.name}, capacidad ${table.capacity} comensales`}
                      onMouseDown={(e) => handleMouseDownTable(e, table)}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTableId(table.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          setSelectedTableId(table.id)
                        }
                      }}
                      style={{
                        position: 'absolute',
                        left: `${posX}px`,
                        top: `${posY}px`,
                        width: `${table.width}px`,
                        height: `${table.height}px`,
                        cursor: isDragging ? 'grabbing' : 'grab',
                        zIndex: isSelected || isDragging ? 30 : 10,
                      }}
                      className={`flex flex-col items-center justify-center p-2 text-center select-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                        table.shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
                      } ${
                        table.is_active
                          ? isSelected
                            ? 'bg-primary/15 border-2 border-primary text-primary shadow-xl ring-2 ring-primary/40 scale-105'
                            : 'bg-surface-raised border-2 border-border hover:border-primary/60 text-text-primary shadow-sm hover:shadow-md hover:scale-[1.02]'
                          : 'bg-surface/60 border-2 border-dashed border-border/70 text-text-secondary opacity-60'
                      }`}
                    >
                      <span className="text-xs font-bold truncate max-w-full px-1 tracking-tight">
                        {table.name}
                      </span>
                      <span className="text-[10px] font-medium text-text-secondary flex items-center gap-1 mt-0.5 bg-surface/80 px-1.5 py-0.5 rounded-full border border-border/50">
                        <Users className="w-2.5 h-2.5 text-primary" />
                        {table.capacity}p
                      </span>
                    </div>
                  )
                })}

                {currentTables.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-text-secondary/70">
                    <Grid className="w-12 h-12 mb-2 stroke-[1.25] text-primary/40" />
                    <p className="text-sm font-bold text-text-primary">Lienzo vacío</p>
                    <p className="text-xs text-text-secondary">Haz clic en "+ Agregar Mesa" arriba para comenzar a estructurar este salón.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-text-secondary pt-1 gap-2">
              <span className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-primary" /> Arrastra las mesas o selecciónalas y muévelas con las flechas del teclado.
              </span>
              <span className="font-medium">
                Total: {currentTables.length} mesas ({currentTables.reduce((acc, t) => acc + (t.capacity || 0), 0)} comensales en total)
              </span>
            </div>
          </div>

          {/* Table Inspector Sidebar (1 Col) */}
          <div className="lg:col-span-1 bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-5">
            {selectedTable ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20">
                      {selectedTable.shape === 'circle' ? <Circle className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">Inspector de Mesa</h3>
                      <p className="text-xs text-text-secondary">{selectedTable.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicateTable(selectedTable)}
                      className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg transition-colors"
                      title="Duplicar mesa"
                      aria-label="Duplicar mesa"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSelectedTableId(null)}
                      className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg transition-colors"
                      title="Cerrar inspector"
                      aria-label="Cerrar inspector"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Table Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Nombre o Identificador</label>
                  <input
                    type="text"
                    value={selectedTable.name}
                    onChange={(e) => handleUpdateTableField(selectedTable.id, 'name', e.target.value)}
                    className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Shape Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Forma Geométrica</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateTableField(selectedTable.id, 'shape', 'rectangle')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        selectedTable.shape === 'rectangle'
                          ? 'bg-primary/10 border-primary text-primary shadow-xs'
                          : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <Square className="w-4 h-4" /> Rectangular
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateTableField(selectedTable.id, 'shape', 'circle')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        selectedTable.shape === 'circle'
                          ? 'bg-primary/10 border-primary text-primary shadow-xs'
                          : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <Circle className="w-4 h-4" /> Redonda
                    </button>
                  </div>
                </div>

                {/* Capacity */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Capacidad de Comensales (pax)</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Users className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={selectedTable.capacity}
                        onChange={(e) => handleUpdateTableField(selectedTable.id, 'capacity', Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 bg-surface-raised border border-border rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                      />
                    </div>
                    <div className="flex gap-1">
                      {[2, 4, 6, 8].map((cap) => (
                        <button
                          key={cap}
                          type="button"
                          onClick={() => handleUpdateTableField(selectedTable.id, 'capacity', cap)}
                          className={`px-2.5 py-2 text-xs font-mono font-semibold rounded-xl border transition-all ${
                            selectedTable.capacity === cap
                              ? 'bg-primary text-white border-primary'
                              : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {cap}p
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Ancho (px)</label>
                    <input
                      type="number"
                      min="40"
                      max="400"
                      step="10"
                      value={selectedTable.width}
                      onChange={(e) => handleUpdateTableField(selectedTable.id, 'width', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm font-mono text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Alto (px)</label>
                    <input
                      type="number"
                      min="40"
                      max="400"
                      step="10"
                      value={selectedTable.height}
                      onChange={(e) => handleUpdateTableField(selectedTable.id, 'height', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm font-mono text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Position Coordinates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Posición X</label>
                    <input
                      type="number"
                      value={selectedTable.x}
                      onChange={(e) => handleUpdateTableField(selectedTable.id, 'x', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm font-mono text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Posición Y</label>
                    <input
                      type="number"
                      value={selectedTable.y}
                      onChange={(e) => handleUpdateTableField(selectedTable.id, 'y', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm font-mono text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Active Switch */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="text-xs font-semibold text-text-primary block">Habilitada en POS</span>
                    <span className="text-[11px] text-text-secondary block">Visible para toma de pedidos</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedTable.is_active}
                    onClick={() => handleUpdateTableField(selectedTable.id, 'is_active', !selectedTable.is_active)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                      selectedTable.is_active ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        selectedTable.is_active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Delete Table Button */}
                <div className="pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => handleDeleteTable(selectedTable.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-semibold rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar Mesa
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-raised border border-border flex items-center justify-center mx-auto text-text-secondary">
                  <Maximize2 className="w-6 h-6 stroke-[1.5] text-primary/60" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Ninguna Mesa Seleccionada</h4>
                  <p className="text-xs text-text-secondary mt-1.5 leading-relaxed px-2">
                    Haz clic en una mesa del plano para editar su nombre, dimensiones, comensales, o arrástrala para reubicarla.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 text-primary">
            <Layers className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-lg font-bold text-text-primary">No hay zonas configuradas</h3>
          <p className="text-sm text-text-secondary mt-2 mb-6 leading-relaxed">
            Para diseñar la distribución de tu restaurante o local comercial, crea primero una zona (ej. Salón Principal, Terraza, Barra, VIP).
          </p>
          <button
            onClick={handleOpenCreateZone}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-text-inverse hover:bg-primary-hover rounded-xl text-xs font-bold transition-all shadow-sm shadow-primary/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Crear Zona Ahora
          </button>
        </div>
      )}

      {/* Zone Modal (Create / Edit) */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">
                {editingZone ? 'Editar Zona' : 'Nueva Zona de Mesas'}
              </h3>
              <button
                onClick={() => setIsZoneModalOpen(false)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Nombre de la Zona *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Salón Principal, Terraza, Barra, VIP"
                  value={zoneFormData.name}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-surface-raised border border-border rounded-xl text-sm font-medium text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Ancho del Lienzo (px)</label>
                  <input
                    type="number"
                    min="400"
                    max="2400"
                    step="50"
                    value={zoneFormData.width}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, width: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-surface-raised border border-border rounded-xl text-sm font-mono text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Alto del Lienzo (px)</label>
                  <input
                    type="number"
                    min="400"
                    max="2400"
                    step="50"
                    value={zoneFormData.height}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, height: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-surface-raised border border-border rounded-xl text-sm font-mono text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsZoneModalOpen(false)}
                  className="px-4 py-2 bg-surface-raised border border-border text-text-secondary hover:text-text-primary text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createFloorPlan.isPending || updateFloorPlan.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-text-inverse hover:bg-primary-hover rounded-xl text-xs font-bold transition-all shadow-sm shadow-primary/20 disabled:opacity-50 active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar Zona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
