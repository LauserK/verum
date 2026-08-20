'use client'

import { useState } from 'react'
import { 
  useTaxes, 
  useCreateTax, 
  useUpdateTax, 
  useDeleteTax 
} from '@/hooks/useSales'
import { 
  Receipt, 
  Plus, 
  X, 
  Check, 
  Building2, 
  MapPin, 
  Coins, 
  AlertTriangle, 
  Edit3, 
  Percent, 
  CheckCircle2, 
  HelpCircle,
  Lock
} from 'lucide-react'
import Link from 'next/link'

export default function CompanyTaxesPage() {
  const { data: taxes, isLoading: loadingTaxes } = useTaxes()
  const { mutateAsync: createTax, isPending: creatingTax } = useCreateTax()
  const { mutateAsync: updateTax, isPending: updatingTax } = useUpdateTax()

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null)
  const [taxError, setTaxError] = useState<string | null>(null)
  const [taxForm, setTaxForm] = useState({
    name: '',
    rate: 16,
    is_active: true,
  })

  const openCreateModal = () => {
    setEditingTaxId(null)
    setTaxForm({
      name: '',
      rate: 16,
      is_active: true,
    })
    setTaxError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (tax: any) => {
    setEditingTaxId(tax.id)
    const rateNum = Number(tax.rate)
    setTaxForm({
      name: tax.name,
      rate: rateNum <= 1 ? Number((rateNum * 100).toFixed(2)) : rateNum,
      is_active: tax.is_active !== false,
    })
    setTaxError(null)
    setIsModalOpen(true)
  }

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault()
    setTaxError(null)
    if (!taxForm.name.trim()) {
      setTaxError('El nombre del impuesto es obligatorio.')
      return
    }
    if (taxForm.rate < 0) {
      setTaxError('La tasa del impuesto no puede ser negativa.')
      return
    }

    try {
      const normalizedRate = Number(taxForm.rate) / 100.0

      if (editingTaxId) {
        await updateTax({
          id: editingTaxId,
          data: {
            name: taxForm.name.trim(),
            rate: normalizedRate,
            is_active: taxForm.is_active,
          }
        })
      } else {
        await createTax({
          name: taxForm.name.trim(),
          rate: normalizedRate,
          is_active: taxForm.is_active,
        })
      }
      setIsModalOpen(false)
    } catch (err: any) {
      setTaxError(err.message || 'Error guardando impuesto.')
    }
  }

  const handleToggleActive = async (tax: any) => {
    try {
      await updateTax({
        id: tax.id,
        data: {
          is_active: !tax.is_active,
        }
      })
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado del impuesto')
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Configuración de Empresa
          </h1>
          <p className="text-sm text-text-secondary mt-1">Gestión corporativa de impuestos, alícuotas de IVA y exenciones tributarias</p>
        </div>
      </div>

      {/* Submenu Redirection Links */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <Link href="/admin/venues" className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> Sedes y Locales
        </Link>
        <Link href="/admin/venues/currencies" className="px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" /> Monedas y Tasas
        </Link>
        <Link href="/admin/venues/taxes" className="px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
          <Receipt className="w-4 h-4" /> Impuestos y Alícuotas
        </Link>
      </div>

      {/* Taxes Catalog */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" /> Impuestos y Alícuotas
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">Tasas aplicables en ventas, compras y catálogo de artículos</p>
          </div>
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all shadow-md shadow-primary/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Nuevo Impuesto
          </button>
        </div>

        {/* Info card */}
        <div className="p-4 rounded-xl bg-surface-raised border border-border/80 text-xs text-text-secondary flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-text-primary">Alícuotas Tributarias de la Empresa:</span> Los impuestos configurados aquí estarán disponibles inmediatamente en el módulo de facturación, terminales de punto de venta (POS) y fichas técnicas de inventario.
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[10px] font-black uppercase tracking-wider text-text-secondary">
                <th className="pb-3 pl-2">Impuesto / Concepto</th>
                <th className="pb-3 text-right">Alícuota (%)</th>
                <th className="pb-3 text-center">Tipo</th>
                <th className="pb-3 text-center">Estado</th>
                <th className="pb-3 text-right pr-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loadingTaxes ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-secondary animate-pulse">Cargando impuestos...</td>
                </tr>
              ) : (!taxes || taxes.length === 0) ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-secondary">No hay impuestos registrados aún.</td>
                </tr>
              ) : (
                taxes.map(tax => {
                  const rateNum = Number(tax.rate)
                  const displayRate = rateNum <= 1 ? (rateNum * 100).toFixed(2) : rateNum.toFixed(2)
                  const isExempt = rateNum === 0

                  return (
                    <tr key={tax.id} className="hover:bg-surface-raised/40 transition-colors">
                      <td className="py-3.5 pl-2 font-bold text-text-primary">
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4 text-primary" />
                          <span>{tax.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-text-primary">
                        {isExempt ? (
                          <span className="text-text-secondary font-normal">0.00% (Exento)</span>
                        ) : (
                          <span className="text-primary">{displayRate}%</span>
                        )}
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
                          tax.org_id ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-raised text-text-secondary border-border'
                        }`}>
                          {!tax.org_id && <Lock className="w-2.5 h-2.5 text-text-secondary" />}
                          {tax.org_id ? 'Empresa' : 'Sistema'}
                        </span>
                      </td>
                      <td className="py-3.5 text-center">
                        {tax.org_id ? (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(tax)}
                            disabled={updatingTax}
                            className="inline-flex items-center gap-1 cursor-pointer focus:outline-none"
                            title="Haga clic para cambiar estado"
                          >
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              tax.is_active !== false 
                                ? 'bg-success/10 text-success border border-success/20 hover:bg-success/20' 
                                : 'bg-surface-raised text-text-secondary border border-border hover:bg-surface'
                            }`}>
                              {tax.is_active !== false ? 'Activo' : 'Inactivo'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 inline-flex items-center gap-1 cursor-default" title="Impuesto base del sistema siempre activo">
                            Activo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        {tax.org_id ? (
                          <button 
                            onClick={() => openEditModal(tax)}
                            className="p-1.5 text-text-secondary hover:text-primary hover:bg-surface-raised rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                            title="Editar Impuesto"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Editar
                          </button>
                        ) : (
                          <span className="text-xs text-text-secondary italic inline-flex items-center gap-1 cursor-default" title="Impuesto predeterminado del sistema (No editable)">
                            <Lock className="w-3 h-3 text-text-disabled" /> Sistema
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Impuesto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-text-primary">
                  {editingTaxId ? 'Editar Impuesto' : 'Nuevo Impuesto'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {taxError && (
              <div className="p-3 rounded-xl bg-error/10 text-error border border-error/20 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{taxError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTax} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Nombre del Impuesto *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: IVA General, IVA Reducido, Exento, IGTF..."
                  value={taxForm.name}
                  onChange={e => setTaxForm({...taxForm, name: e.target.value})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3.5 h-11 text-sm focus:border-primary outline-none mt-1 font-semibold text-text-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Porcentaje / Tasa (%) *</label>
                <div className="relative mt-1">
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="16"
                    value={taxForm.rate}
                    onChange={e => setTaxForm({...taxForm, rate: Number(e.target.value)})}
                    className="w-full bg-surface-raised border border-border rounded-xl px-3.5 pr-8 h-11 text-sm font-mono focus:border-primary outline-none text-text-primary font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary font-mono text-sm">%</span>
                </div>
                <p className="text-[11px] text-text-secondary mt-1">Ej: ingrese <strong>16</strong> para 16% o <strong>0</strong> para Exento.</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="tax_is_active"
                  checked={taxForm.is_active}
                  onChange={e => setTaxForm({...taxForm, is_active: e.target.checked})}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label htmlFor="tax_is_active" className="text-xs font-bold text-text-primary cursor-pointer select-none">
                  Impuesto habilitado y activo para facturación
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 h-11 border border-border bg-surface hover:bg-surface-raised text-text-primary rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={creatingTax || updatingTax}
                  className="bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <Check className="w-4 h-4" /> {creatingTax || updatingTax ? 'Guardando...' : editingTaxId ? 'Actualizar Impuesto' : 'Crear Impuesto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
