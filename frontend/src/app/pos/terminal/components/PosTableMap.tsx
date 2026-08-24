'use client'

import React, { useState, useMemo } from 'react'
import { 
  Utensils, 
  Users, 
  MapPin, 
  LayoutGrid, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Plus, 
  Clock,
  ArrowRight
} from 'lucide-react'
import { useVenue } from '@/components/VenueContext'
import { useFloorPlans } from '@/hooks/useSales'
import { usePosStore } from '@/store/posStore'

export default function PosTableMap() {
  const { selectedVenueId, selectedVenueName } = useVenue()
  const { data: floorPlans = [], isLoading } = useFloorPlans(selectedVenueId || undefined)
  const { activeTableId, setActiveTable } = usePosStore()

  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  // Default to first floor plan
  React.useEffect(() => {
    if (floorPlans.length > 0) {
      if (!selectedPlanId || !floorPlans.some((p) => p.id === selectedPlanId)) {
        setSelectedPlanId(floorPlans[0].id)
      }
    }
  }, [floorPlans, selectedPlanId])

  const currentPlan = floorPlans.find((p) => p.id === selectedPlanId) || floorPlans[0]
  const currentTables = currentPlan?.tables?.filter((t) => t.is_active) || []

  const handleSelectTable = (tableId: string, tableName: string) => {
    setActiveTable(tableId, tableName)
  }

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-bg">
        <div className="w-12 h-12 rounded-2xl bg-surface-raised animate-pulse mb-3" />
        <p className="text-xs text-text-secondary">Cargando plano de mesas...</p>
      </div>
    )
  }

  // Fallback if no floor plans are configured for this venue
  if (floorPlans.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-bg select-none">
        <div className="w-16 h-16 rounded-3xl bg-surface border border-border flex items-center justify-center text-primary mb-4 shadow-sm">
          <LayoutGrid className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-text-primary">No hay planos de mesas registrados</h3>
        <p className="text-xs text-text-secondary max-w-sm mt-1 mb-6">
          Aún no se han configurado planos ni salones para la sede <strong>{selectedVenueName || 'actual'}</strong>. Puedes seleccionar mesas rápidas o diseñar el plano en el panel administrativo.
        </p>

        {/* Quick Tables Grid */}
        <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-5 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center justify-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-primary" /> Mesas Rápidas
          </span>
          <div className="grid grid-cols-4 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => {
              const tableNum = `Mesa ${i + 1}`
              return (
                <button
                  key={i}
                  onClick={() => handleSelectTable(`quick-table-${i + 1}`, tableNum)}
                  className="p-3.5 rounded-2xl bg-surface-raised border border-border hover:border-primary hover:bg-primary/5 hover:text-primary transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                >
                  <Utensils className="w-4 h-4 text-text-secondary" />
                  <span className="text-xs font-bold text-text-primary">{tableNum}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full bg-bg overflow-hidden select-none">
      {/* Top Header / Zone Selector Tabs */}
      <div className="shrink-0 p-4 pb-3 flex items-center justify-between bg-surface/80 backdrop-blur-md border-b border-border/70 z-10">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary mr-2 flex items-center gap-1.5 shrink-0">
            <Layers className="w-3.5 h-3.5 text-primary" /> Salones:
          </span>
          {floorPlans.map((plan) => {
            const isSelected = (selectedPlanId || floorPlans[0]?.id) === plan.id
            const tableCount = plan.tables?.filter((t) => t.is_active).length || 0

            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-text-inverse shadow-md shadow-primary/25 ring-2 ring-primary/30'
                    : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-raised'
                }`}
              >
                <span>{plan.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-black/20 text-text-inverse' : 'bg-surface-raised text-text-secondary'
                  }`}
                >
                  {tableCount}
                </span>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-4 text-[11px] text-text-secondary font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
            <span>Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
            <span>En Atención</span>
          </div>
        </div>
      </div>

      {/* 2D Canvas / Table Grid Area */}
      <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-radial from-surface/20 to-bg relative">
        {currentTables.length === 0 ? (
          <div className="text-center p-8 bg-surface border border-dashed border-border rounded-3xl max-w-sm">
            <Utensils className="w-8 h-8 text-text-secondary mx-auto mb-2 opacity-50" />
            <h4 className="font-bold text-sm text-text-primary">Salón sin mesas</h4>
            <p className="text-xs text-text-secondary mt-1">
              No hay mesas configuradas en {currentPlan?.name}.
            </p>
          </div>
        ) : (
          <div
            className="relative bg-surface/50 border border-border/70 rounded-3xl shadow-xl overflow-hidden"
            style={{
              width: `${currentPlan?.width || 800}px`,
              height: `${currentPlan?.height || 600}px`,
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {currentTables.map((table) => {
              const isSelected = activeTableId === table.id
              const isCircle = table.shape === 'circle'

              return (
                <button
                  key={table.id}
                  onClick={() => handleSelectTable(table.id, table.name)}
                  style={{
                    left: `${table.x}px`,
                    top: `${table.y}px`,
                    width: `${table.width}px`,
                    height: `${table.height}px`,
                  }}
                  className={`absolute transition-all duration-150 flex flex-col items-center justify-center text-center p-2 cursor-pointer shadow-md select-none group active:scale-95 hover:z-20 ${
                    isCircle ? 'rounded-full' : 'rounded-2xl'
                  } ${
                    isSelected
                      ? 'bg-primary text-text-inverse ring-4 ring-primary/30 border-2 border-primary shadow-lg shadow-primary/30 scale-105 z-10'
                      : 'bg-surface border-2 border-border hover:border-primary/80 hover:bg-surface-raised hover:shadow-lg'
                  }`}
                >
                  {/* Table Icon / Shape Indicator */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <Utensils className={`w-3.5 h-3.5 ${isSelected ? 'text-text-inverse' : 'text-primary'}`} />
                  </div>

                  {/* Table Name */}
                  <span className={`font-bold text-xs sm:text-sm tracking-tight leading-tight line-clamp-1 ${
                    isSelected ? 'text-text-inverse' : 'text-text-primary'
                  }`}>
                    {table.name}
                  </span>

                  {/* Table Capacity (pax) */}
                  <div className="flex items-center gap-1 text-[10px] opacity-80 mt-0.5">
                    <Users className="w-2.5 h-2.5" />
                    <span>{table.capacity || 4}p</span>
                  </div>

                  {/* Quick Select Tooltip Feedback */}
                  <div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md pointer-events-none whitespace-nowrap shadow-md">
                    Abrir Comanda
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Bar Info */}
      <div className="shrink-0 px-6 py-3 bg-surface/80 backdrop-blur-md border-t border-border/70 flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span>Sede: <strong className="text-text-primary">{selectedVenueName || 'Sede Principal'}</strong></span>
          <span className="text-border mx-1">|</span>
          <span>Salón: <strong className="text-text-primary">{currentPlan?.name || 'Salón'}</strong></span>
        </div>
        <div className="flex items-center gap-1 text-primary font-bold">
          <span>Haz clic en una mesa para tomar la orden</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  )
}
