'use client'

import React, { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, FileText, CheckCircle, Clock, X } from 'lucide-react'

export default function AdminPhysicalInventoryList() {
  const router = useRouter()
  const [counts, setCounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedWhId, setSelectedWhId] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadCounts()
  }, [])

  const loadCounts = async () => {
    try {
      const data = await adminApi.getPhysicalInventories()
      setCounts(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreateModal = async () => {
    setShowCreateModal(true)
    if (warehouses.length === 0) {
      try {
        const whData = await adminApi.getInventoryWarehouses() as any[]
        setWarehouses(whData || [])
        if (whData && whData.length > 0) {
          setSelectedWhId(whData[0].id)
        }
      } catch (err) {
        console.error('Error loading warehouses:', err)
      }
    }
  }

  const handleCreateCount = async () => {
    if (!selectedWhId) return
    setCreating(true)
    try {
      const payload = {
        warehouse_id: selectedWhId,
        notes: 'Creado desde panel de administración',
        lines: []
      }
      const newDoc = await adminApi.createPhysicalInventory(payload) as any
      setShowCreateModal(false)
      router.push(`/admin/inventory/physical/${newDoc.id}`)
    } catch (err) {
      console.error('Error creating physical count:', err)
    } finally {
      setCreating(false)
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conteos Físicos de Inventario</h1>
          <p className="text-sm text-text-secondary">Historial y borradores de auditorías físicas de almacenes</p>
        </div>
        <button 
          onClick={handleOpenCreateModal} 
          className="bg-primary hover:bg-primary-hover text-text-inverse rounded-xl h-11 px-4 font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nuevo Conteo Físico
        </button>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                <th className="p-4">Documento</th>
                <th className="p-4">Almacén</th>
                <th className="p-4">Creado Por</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Fecha</th>
                <th className="p-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {counts.map(c => (
                <tr key={c.id} className="border-b border-border hover:bg-surface-raised transition-colors text-sm">
                  <td className="p-4 font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-text-secondary" />
                    {c.document_number}
                  </td>
                  <td className="p-4">{c.warehouse_name}</td>
                  <td className="p-4">{c.creator_name}</td>
                  <td className="p-4">
                    {c.status === 'processed' ? (
                      <span className="inline-flex items-center gap-1 bg-success-light text-success text-xs px-2.5 py-1 rounded-full font-medium border border-success/15">
                        <CheckCircle className="w-3.5 h-3.5" /> Procesado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-primary-light text-primary text-xs px-2.5 py-1 rounded-full font-medium border border-primary/15">
                        <Clock className="w-3.5 h-3.5" /> Borrador
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-text-secondary">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <Link 
                      href={`/admin/inventory/physical/${c.id}`} 
                      className="text-primary hover:underline font-semibold"
                    >
                      Revisar Detalles
                    </Link>
                  </td>
                </tr>
              ))}
              {counts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-secondary">
                    No se han registrado conteos físicos de inventario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warehouse Selector Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full shadow-xl space-y-4 animate-in scale-in duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-text-primary">Nuevo Conteo Físico</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-surface-raised rounded-lg text-text-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">Almacén a contar</label>
              <select
                value={selectedWhId}
                onChange={(e) => setSelectedWhId(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary text-text-primary"
              >
                {warehouses.length === 0 ? (
                  <option>Cargando almacenes...</option>
                ) : (
                  warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))
                )}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 h-11 border border-border hover:bg-bg text-text-primary rounded-xl font-semibold text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCount}
                disabled={creating || !selectedWhId}
                className="flex-1 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Crear Borrador
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
