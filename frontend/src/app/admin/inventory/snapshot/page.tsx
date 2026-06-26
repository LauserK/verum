'use client'

import { useState, useEffect } from 'react'
import { adminApi, Warehouse, StockSnapshotItem } from '@/lib/api'
import { Loader2, ArrowLeft, Download, Calendar, Warehouse as WhIcon, DollarSign, Package, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function InventorySnapshotPage() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [snapshotItems, setSnapshotItems] = useState<StockSnapshotItem[]>([])
  const [totalValuation, setTotalValuation] = useState<number>(0)
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'item_name', direction: 'asc' })

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const filteredItems = selectedWarehouseId
    ? snapshotItems.filter(item => item.warehouse_id === selectedWarehouseId)
    : snapshotItems

  const sortedSnapshotItems = [...filteredItems].sort((a, b) => {
    let aValue: any = (a as any)[sortConfig.key]
    let bValue: any = (b as any)[sortConfig.key]

    // Fallbacks for null or undefined values
    if (aValue === null || aValue === undefined) aValue = ''
    if (bValue === null || bValue === undefined) bValue = ''

    if (typeof aValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue)
    } else {
      return sortConfig.direction === 'asc' 
        ? (aValue > bValue ? 1 : -1) 
        : (aValue < bValue ? 1 : -1)
    }
  })

  const SortIndicator = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <div className="w-3.5 h-3.5 opacity-10 flex items-center justify-center"><ChevronUp className="w-2.5 h-2.5" /></div>
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-2.5 h-2.5 text-primary" /> 
      : <ChevronDown className="w-2.5 h-2.5 text-primary" />
  }
  
  useEffect(() => {
    // Load warehouses
    adminApi.getInventoryWarehouses()
      .then(setWarehouses)
      .catch(console.error)
  }, [])

  useEffect(() => {
    loadSnapshot()
  }, [date, selectedWarehouseId])

  async function loadSnapshot() {
    if (!date) return
    setLoading(true)
    try {
      const res = await adminApi.getInventorySnapshot(date, selectedWarehouseId || undefined)
      // Sort alphabetically by item name
      const sorted = (res.items || []).sort((a, b) => a.item_name.localeCompare(b.item_name))
      setSnapshotItems(sorted)
      setTotalValuation(res.total_valuation || 0)
    } catch (err) {
      console.error('Error loading inventory snapshot:', err)
    } finally {
      setLoading(false)
    }
  }

  // Group consolidated quantities by unit of measure
  const qtyByUom = filteredItems.reduce((acc, curr) => {
    const uom = curr.uom_name || 'un'
    if (!acc[uom]) {
      acc[uom] = 0
    }
    acc[uom] += curr.qty_on_hand
    return acc
  }, {} as Record<string, number>)

  const handleExportCSV = () => {
    if (sortedSnapshotItems.length === 0) return
    
    // Header
    const csvRows = [
      ['Código', 'Artículo', 'Almacén', 'Cantidad en Mano', 'U.M.', 'Valoración ($)'].join(',')
    ]
    
    // Body rows
    sortedSnapshotItems.forEach(item => {
      const row = [
        `"${item.item_code || ''}"`,
        `"${item.item_name}"`,
        `"${item.warehouse_name}"`,
        item.qty_on_hand.toFixed(4),
        `"${item.uom_name || 'un'}"`,
        item.valuation.toFixed(2)
      ]
      csvRows.push(row.join(','))
    })
    
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.join('\n')
    const encodedUri = encodeURI(csvContent)
    
    // Customize filename based on selected warehouse
    const selectedWh = warehouses.find(w => w.id === selectedWarehouseId)
    const whSuffix = selectedWh ? `-${selectedWh.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : ''
    
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `inventario-snapshot${whSuffix}-${date}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-[1500px] mx-auto space-y-6 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/admin/inventory" 
            className="group p-2 bg-surface hover:bg-surface-raised border border-border rounded-xl transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4 text-text-secondary group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Historial de Inventario</h1>
            <p className="text-xs text-text-secondary mt-0.5">Consulta de stock y valorización PEPS a fechas pasadas</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Date Picker */}
          <div className="relative flex-1 sm:flex-initial sm:w-44">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary pointer-events-none" />
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 h-10 text-xs font-semibold outline-none focus:border-primary focus:bg-surface-raised transition-all"
            />
          </div>
          {/* Warehouse Selector */}
          <div className="relative flex-1 sm:flex-initial sm:w-52">
            <WhIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary pointer-events-none" />
            <select 
              value={selectedWarehouseId}
              onChange={e => setSelectedWarehouseId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-8 h-10 text-xs font-semibold outline-none focus:border-primary appearance-none transition-all cursor-pointer"
            >
              <option value="">Todos los Depósitos...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary pointer-events-none" />
          </div>
          {/* Export Button */}
          <button 
            onClick={handleExportCSV}
            disabled={sortedSnapshotItems.length === 0}
            className="h-10 px-4 bg-primary hover:bg-primary-hover text-text-inverse disabled:opacity-50 disabled:hover:bg-primary rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-primary/10 active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Productos con Registro</p>
            <p className="text-xl font-black text-text-primary mt-0.5">{filteredItems.length}</p>
          </div>
        </div>
        <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm flex items-start gap-4 min-h-[92px]">
          <div className="p-3 bg-warning/10 text-warning rounded-xl shrink-0">
            <WhIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Cantidad Física Consolidada</p>
            <div className="mt-1 space-y-1 max-h-[85px] overflow-y-auto pr-0.5 scrollbar-thin">
              {loading ? (
                <p className="text-sm font-black text-text-primary">...</p>
              ) : Object.keys(qtyByUom).length === 0 ? (
                <p className="text-sm font-black text-text-primary">0.00</p>
              ) : (
                Object.entries(qtyByUom).map(([uom, qty]) => (
                  <div key={uom} className="flex justify-between items-center text-xs font-bold text-text-primary border-b border-border/30 pb-0.5 last:border-0 last:pb-0">
                    <span className="font-black">{qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                    <span className="text-[9px] text-text-secondary font-semibold uppercase ml-2 bg-surface-raised px-1.5 py-0.5 rounded border border-border/40 shrink-0">{uom}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-success/10 text-success rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Valoración Histórica (PEPS)</p>
            <p className="text-xl font-black text-success mt-0.5">
              {loading ? '...' : `$${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>
      </div>

      {/* Table view */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary opacity-40 mb-3" />
            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Generando snapshot...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-20 text-center text-text-secondary text-xs">
            No se encontraron movimientos registrados en la fecha y almacenes seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th 
                    className="p-3.5 px-4 font-bold text-text-secondary uppercase tracking-wider w-28 text-[9px] cursor-pointer hover:bg-surface-raised/60 transition-colors select-none"
                    onClick={() => handleSort('item_code')}
                  >
                    <div className="flex items-center gap-1">
                      Código
                      <SortIndicator column="item_code" />
                    </div>
                  </th>
                  <th 
                    className="p-3.5 px-4 font-bold text-text-secondary uppercase tracking-wider text-[9px] cursor-pointer hover:bg-surface-raised/60 transition-colors select-none"
                    onClick={() => handleSort('item_name')}
                  >
                    <div className="flex items-center gap-1">
                      Artículo
                      <SortIndicator column="item_name" />
                    </div>
                  </th>
                  <th 
                    className="p-3.5 px-4 font-bold text-text-secondary uppercase tracking-wider text-[9px] cursor-pointer hover:bg-surface-raised/60 transition-colors select-none"
                    onClick={() => handleSort('warehouse_name')}
                  >
                    <div className="flex items-center gap-1">
                      Almacén
                      <SortIndicator column="warehouse_name" />
                    </div>
                  </th>
                  <th 
                    className="p-3.5 px-4 font-bold text-text-secondary uppercase tracking-wider text-[9px] text-right cursor-pointer hover:bg-surface-raised/60 transition-colors select-none"
                    onClick={() => handleSort('qty_on_hand')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Cantidad en Mano
                      <SortIndicator column="qty_on_hand" />
                    </div>
                  </th>
                  <th 
                    className="p-3.5 px-4 font-bold text-text-secondary uppercase tracking-wider text-[9px] text-center w-20 cursor-pointer hover:bg-surface-raised/60 transition-colors select-none"
                    onClick={() => handleSort('uom_name')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      U.M.
                      <SortIndicator column="uom_name" />
                    </div>
                  </th>
                  <th 
                    className="p-3.5 px-4 font-bold text-text-secondary uppercase tracking-wider text-[9px] text-right w-36 cursor-pointer hover:bg-surface-raised/60 transition-colors select-none"
                    onClick={() => handleSort('valuation')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Valoración ($)
                      <SortIndicator column="valuation" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sortedSnapshotItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-raised/40 transition-colors">
                    <td className="p-3.5 px-4 font-medium text-text-secondary">{item.item_code || '---'}</td>
                    <td className="p-3.5 px-4 font-semibold text-text-primary">{item.item_name}</td>
                    <td className="p-3.5 px-4 font-medium text-text-secondary">{item.warehouse_name}</td>
                    <td className="p-3.5 px-4 text-right font-bold text-text-primary">
                      {item.qty_on_hand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td className="p-3.5 px-4 text-center">
                      <span className="text-[9px] font-semibold text-text-secondary bg-surface-raised border border-border/40 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {item.uom_name || 'un'}
                      </span>
                    </td>
                    <td className="p-3.5 px-4 text-right font-black text-primary">
                      ${item.valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
