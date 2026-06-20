'use client'

import { useState, useEffect, useMemo, Fragment } from 'react'
import { adminApi, Warehouse, StockSnapshotItem } from '@/lib/api'
import { Loader2, ArrowLeft, Download, Calendar, Warehouse as WhIcon, DollarSign, Package, Search, ChevronUp, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

type SortField = 'item_code' | 'item_name' | 'warehouse_name' | 'qty_on_hand' | 'uom_name' | 'valuation';
type GroupByOption = 'none' | 'warehouse' | 'item';

export default function InventorySnapshotPage() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [snapshotItems, setSnapshotItems] = useState<StockSnapshotItem[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [groupBy, setGroupBy] = useState<GroupByOption>('none')
  const [sortField, setSortField] = useState<SortField>('item_name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
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
      setSnapshotItems(res.items || [])
    } catch (err) {
      console.error('Error loading inventory snapshot:', err)
    } finally {
      setLoading(false)
    }
  }

  // 1. Filter items by search term
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return snapshotItems
    const term = searchTerm.toLowerCase().trim()
    return snapshotItems.filter(item => 
      (item.item_code || '').toLowerCase().includes(term) ||
      item.item_name.toLowerCase().includes(term) ||
      item.warehouse_name.toLowerCase().includes(term)
    )
  }, [snapshotItems, searchTerm])

  // 2. Calculate summary totals based on filtered items
  const filteredTotalQty = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.qty_on_hand, 0)
  }, [filteredItems])

  const filteredTotalValuation = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.valuation, 0)
  }, [filteredItems])

  // Helper function to compare values for sorting
  const compareValues = (a: any, b: any, field: SortField) => {
    let valA = a[field]
    let valB = b[field]

    if (valA === undefined || valA === null) valA = ''
    if (valB === undefined || valB === null) valB = ''

    if (typeof valA === 'string' && typeof valB === 'string') {
      return valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true })
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return valA - valB
    }

    return String(valA).localeCompare(String(valB))
  }

  // 3. Sort items for ungrouped view
  const sortedItems = useMemo(() => {
    const items = [...filteredItems]
    items.sort((a, b) => {
      const comparison = compareValues(a, b, sortField)
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return items
  }, [filteredItems, sortField, sortDirection])

  // 4. Group items by warehouse
  const warehouseGroups = useMemo(() => {
    if (groupBy !== 'warehouse') return []
    
    const groupsMap: { [key: string]: StockSnapshotItem[] } = {}
    
    filteredItems.forEach(item => {
      const key = item.warehouse_name || 'Sin Almacén'
      if (!groupsMap[key]) {
        groupsMap[key] = []
      }
      groupsMap[key].push(item)
    })

    const groupsList = Object.keys(groupsMap).map(warehouseName => {
      const items = groupsMap[warehouseName]
      const totalQty = items.reduce((sum, item) => sum + item.qty_on_hand, 0)
      const totalValuation = items.reduce((sum, item) => sum + item.valuation, 0)

      // Sort items within group
      const sortedGroupItems = [...items].sort((a, b) => {
        const comparison = compareValues(a, b, sortField)
        return sortDirection === 'asc' ? comparison : -comparison
      })

      return {
        warehouseName,
        items: sortedGroupItems,
        totalQty,
        totalValuation
      }
    })

    // Sort the groups themselves by warehouse name
    groupsList.sort((a, b) => {
      const comp = a.warehouseName.localeCompare(b.warehouseName)
      return sortDirection === 'asc' ? comp : -comp
    })
    
    return groupsList
  }, [filteredItems, groupBy, sortField, sortDirection])

  // 5. Consolidate/Group items by article
  const consolidatedItems = useMemo(() => {
    if (groupBy !== 'item') return []

    const itemMap: { [key: string]: {
      item_code?: string | null;
      item_name: string;
      uom_name?: string | null;
      qty_on_hand: number;
      valuation: number;
      warehousesList: Set<string>;
    }} = {}

    filteredItems.forEach(item => {
      const key = `${item.item_code || ''}_${item.item_name}`
      if (!itemMap[key]) {
        itemMap[key] = {
          item_code: item.item_code,
          item_name: item.item_name,
          uom_name: item.uom_name,
          qty_on_hand: 0,
          valuation: 0,
          warehousesList: new Set()
        }
      }
      const entry = itemMap[key]
      entry.qty_on_hand += item.qty_on_hand
      entry.valuation += item.valuation
      if (item.warehouse_name) {
        entry.warehousesList.add(item.warehouse_name)
      }
    })

    const list = Object.values(itemMap).map(entry => ({
      item_code: entry.item_code,
      item_name: entry.item_name,
      uom_name: entry.uom_name,
      qty_on_hand: entry.qty_on_hand,
      valuation: entry.valuation,
      warehouse_name: Array.from(entry.warehousesList).join(', ') || '---'
    }))

    // Sort the consolidated items
    list.sort((a, b) => {
      const comparison = compareValues(a, b, sortField)
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return list
  }, [filteredItems, groupBy, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleExportCSV = () => {
    const itemsToExport = groupBy === 'item' ? consolidatedItems : (groupBy === 'warehouse' ? filteredItems : sortedItems)
    if (itemsToExport.length === 0) return
    
    // Header
    const csvRows = [
      ['Código', 'Artículo', 'Almacén', 'Cantidad en Mano', 'U.M.', 'Valoración ($)'].join(',')
    ]
    
    // Body rows
    itemsToExport.forEach(item => {
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
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `inventario-snapshot-${date}-${groupBy !== 'none' ? `agrupado-${groupBy}` : 'filtrado'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderSortableHeader = (field: SortField, label: string, align: 'left' | 'center' | 'right' = 'left', extraClass: string = '') => {
    const isActive = sortField === field
    return (
      <th 
        onClick={() => handleSort(field)}
        className={`p-3.5 px-4 font-bold text-text-secondary uppercase tracking-wider text-[9px] cursor-pointer hover:bg-surface-raised transition-colors select-none group ${extraClass}`}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          <span className="w-3.5 h-3.5 flex items-center justify-center">
            {isActive ? (
              sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 text-text-secondary transition-opacity" />
            )}
          </span>
        </div>
      </th>
    )
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
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 h-10 text-xs font-semibold outline-none focus:border-primary appearance-none transition-all"
            >
              <option value="">Todos los Almacenes...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          {/* Export Button */}
          <button 
            onClick={handleExportCSV}
            disabled={snapshotItems.length === 0}
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
            <p className="text-xl font-black text-text-primary mt-0.5">
              {loading ? '...' : (groupBy === 'item' ? consolidatedItems.length : filteredItems.length)}
            </p>
          </div>
        </div>
        <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-warning/10 text-warning rounded-xl">
            <WhIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Cantidad Física Consolidada</p>
            <p className="text-xl font-black text-text-primary mt-0.5">
              {loading ? '...' : filteredTotalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </p>
          </div>
        </div>
        <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-success/10 text-success rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Valoración Histórica (PEPS)</p>
            <p className="text-xl font-black text-success mt-0.5">
              {loading ? '...' : `$${filteredTotalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Grouping Toolbar */}
      <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input 
            type="text" 
            placeholder="Buscar por código, artículo o almacén..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded-xl pl-10 pr-4 h-10 text-xs font-medium outline-none focus:border-primary transition-all"
          />
        </div>

        {/* Group By */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider whitespace-nowrap">Agrupar por:</span>
          <div className="flex bg-surface-raised border border-border p-0.5 rounded-xl">
            <button
              onClick={() => setGroupBy('none')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${groupBy === 'none' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Ninguno
            </button>
            <button
              onClick={() => setGroupBy('warehouse')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${groupBy === 'warehouse' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Almacén
            </button>
            <button
              onClick={() => setGroupBy('item')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${groupBy === 'item' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Artículo
            </button>
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
        ) : snapshotItems.length === 0 ? (
          <div className="p-20 text-center text-text-secondary text-xs">
            No se encontraron movimientos registrados en la fecha y almacenes seleccionados.
          </div>
        ) : (groupBy === 'warehouse' ? warehouseGroups.length === 0 : groupBy === 'item' ? consolidatedItems.length === 0 : sortedItems.length === 0) ? (
          <div className="p-20 text-center text-text-secondary text-xs flex flex-col items-center gap-2">
            <span className="font-semibold text-text-primary">Sin resultados</span>
            <span>No hay artículos que coincidan con la búsqueda "{searchTerm}".</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  {renderSortableHeader('item_code', 'Código', 'left', 'w-28')}
                  {renderSortableHeader('item_name', 'Artículo')}
                  {renderSortableHeader('warehouse_name', 'Almacén')}
                  {renderSortableHeader('qty_on_hand', 'Cantidad en Mano', 'right')}
                  {renderSortableHeader('uom_name', 'U.M.', 'center', 'w-20')}
                  {renderSortableHeader('valuation', 'Valoración ($)', 'right', 'w-36')}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {groupBy === 'warehouse' && (
                  warehouseGroups.map((group, groupIdx) => (
                    <Fragment key={groupIdx}>
                      {/* Group Header Row */}
                      <tr className="bg-surface-raised/80 font-bold border-y border-border">
                        <td colSpan={6} className="p-3.5 px-4 text-xs text-text-primary font-bold">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <WhIcon className="w-4 h-4 text-primary" />
                              <span>Almacén: {group.warehouseName}</span>
                              <span className="text-[10px] font-normal text-text-secondary bg-surface border border-border px-2 py-0.5 rounded-full">
                                {group.items.length} {group.items.length === 1 ? 'artículo' : 'artículos'}
                              </span>
                            </div>
                            <div className="flex gap-4 text-[10px] font-semibold text-text-secondary">
                              <span>Cant. Consolidada: <strong className="text-text-primary">{group.totalQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</strong></span>
                              <span>Valoración: <strong className="text-success">${group.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Group Items */}
                      {group.items.map((item, itemIdx) => (
                        <tr key={`${groupIdx}-${itemIdx}`} className="hover:bg-surface-raised/40 transition-colors">
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
                    </Fragment>
                  ))
                )}

                {groupBy === 'item' && (
                  consolidatedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-raised/40 transition-colors">
                      <td className="p-3.5 px-4 font-medium text-text-secondary">{item.item_code || '---'}</td>
                      <td className="p-3.5 px-4 font-semibold text-text-primary">{item.item_name}</td>
                      <td className="p-3.5 px-4 font-medium text-text-secondary italic">
                        <span title={item.warehouse_name} className="truncate max-w-[200px] block">
                          {item.warehouse_name}
                        </span>
                      </td>
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
                  ))
                )}

                {groupBy === 'none' && (
                  sortedItems.map((item, idx) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

