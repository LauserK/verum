'use client'

import React, { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import Link from 'next/link'
import { Plus, Loader2, FileText, CheckCircle, Clock } from 'lucide-react'

export default function AdminPhysicalInventoryList() {
  const [counts, setCounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
        <Link 
          href="/inventory/count" 
          className="bg-primary hover:bg-primary-hover text-text-inverse rounded-xl h-11 px-4 font-semibold text-sm flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo Conteo Físico
        </Link>
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
    </div>
  )
}
