'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminApi } from '@/lib/api'
import { Loader2, ArrowLeft, AlertTriangle, Play } from 'lucide-react'
import Link from 'next/link'

export default function AdminPhysicalInventoryDetail() {
  const params = useParams()
  const router = useRouter()
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadDetail()
  }, [params.id])

  const loadDetail = async () => {
    try {
      const data = await adminApi.getPhysicalInventoryDetail(params.id as string)
      setDetail(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!confirm('¿Está seguro de procesar este conteo? Esto actualizará el stock disponible y registrará los movimientos de ajuste en el Kardex.')) {
      return
    }

    setProcessing(true)
    try {
      await adminApi.processPhysicalInventory(params.id as string)
      alert('Ajustes aplicados correctamente en la base de datos.')
      loadDetail()
    } catch (err) {
      console.error(err)
      alert('Error al procesar los ajustes de inventario.')
    } finally {
      setProcessing(false)
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

      {/* Lines Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-bg">
          <h2 className="text-base font-bold">Artículos Contados</h2>
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
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((l: any) => {
                const diff = l.qty_counted_base - l.qty_expected_base
                return (
                  <tr key={l.id} className="border-b border-border hover:bg-surface-raised transition-colors text-sm">
                    <td className="p-4 font-semibold">{l.item_name}</td>
                    <td className="p-4">{l.qty_expected_base}</td>
                    <td className="p-4">
                      {l.qty_counted_base} {l.presentation_name && `(${l.qty_presentation} ${l.presentation_name})`}
                    </td>
                    <td className="p-4 font-bold">
                      {diff > 0 ? (
                        <span className="text-success">+{diff}</span>
                      ) : diff < 0 ? (
                        <span className="text-error">{diff}</span>
                      ) : (
                        <span className="text-text-secondary">0</span>
                      )}
                    </td>
                    <td className="p-4 text-text-secondary text-xs">{l.notes || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Apply Adjustments */}
      {detail.status === 'draft' && (
        <div className="bg-surface-raised p-6 rounded-2xl border border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-10 h-10 text-warning shrink-0" />
            <div>
              <p className="text-sm font-semibold">Procesar Ajustes de Kardex</p>
              <p className="text-xs text-text-secondary max-w-xl">
                Al presionar procesar, el sistema registrará los movimientos de ajuste positivo y negativo utilizando costo PEPS en el Kardex. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
          <button
            disabled={processing}
            onClick={handleProcess}
            className="w-full md:w-auto bg-success hover:bg-success-light text-text-inverse rounded-xl h-12 px-6 font-bold flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
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
      )}
    </div>
  )
}
