'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  UserPlus,
  User,
  Phone,
  CreditCard,
  Mail,
  MapPin,
  Calendar,
  Instagram,
  FileText,
  X,
  Check,
  AlertCircle,
  Loader2,
  Users
} from 'lucide-react'
import { useCustomers, useCreateCustomer } from '@/hooks/useSales'

interface CustomerSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (customer: { id: string | null; name: string; taxId: string | null }) => void
  required?: boolean
}

export function CustomerSelectorModal({
  isOpen,
  onClose,
  onSelect,
  required = false
}: CustomerSelectorModalProps) {
  const [view, setView] = useState<'search' | 'create'>('search')
  const [searchQuery, setSearchQuery] = useState('')

  // Form state for creating customer
  const [formData, setFormData] = useState({
    name: '',
    tax_id: '',
    phone: '',
    email: '',
    address: '',
    birth_date: '',
    social_media: '',
    notes: ''
  })
  const [formErrors, setFormErrors] = useState<{ name?: string; tax_id?: string }>({})

  const { data: customers = [], isLoading } = useCustomers()
  const createCustomerMutation = useCreateCustomer()

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers.slice(0, 15)
    const q = searchQuery.toLowerCase()
    return customers
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.tax_id?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
      .slice(0, 20)
  }, [customers, searchQuery])

  if (!isOpen) return null

  const handleSelect = (customer: { id: string | null; name: string; taxId: string | null }) => {
    onSelect(customer)
  }

  const handleSelectGeneral = () => {
    onSelect({ id: null, name: 'Cliente General', taxId: null })
  }

  const validateForm = () => {
    const errors: { name?: string; tax_id?: string } = {}
    if (!formData.name.trim()) errors.name = 'El nombre es obligatorio'
    if (!formData.tax_id.trim()) errors.tax_id = 'El RIF / Cédula es obligatorio'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      const created = await createCustomerMutation.mutateAsync({
        name: formData.name.trim(),
        tax_id: formData.tax_id.trim(),
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        notes: [
          formData.birth_date ? `Cumpleaños: ${formData.birth_date}` : '',
          formData.social_media ? `Redes: ${formData.social_media}` : '',
          formData.notes ? formData.notes : ''
        ]
          .filter(Boolean)
          .join(' | ') || undefined
      })

      onSelect({
        id: created.id,
        name: created.name,
        taxId: created.tax_id || null
      })
      setView('search')
      setFormData({
        name: '',
        tax_id: '',
        phone: '',
        email: '',
        address: '',
        birth_date: '',
        social_media: '',
        notes: ''
      })
    } catch (err: any) {
      console.error('Error creating customer:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-raised/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {view === 'search' ? 'Asignar Cliente' : 'Nuevo Cliente'}
              </h2>
              <p className="text-xs text-text-secondary">
                {view === 'search'
                  ? 'Busca por nombre, RIF, teléfono o email'
                  : 'Registra los datos para la orden o factura'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view === 'search' ? (
              <button
                type="button"
                onClick={() => setView('create')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Nuevo</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setView('search')}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
              >
                Volver a búsqueda
              </button>
            )}

            {!required && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {view === 'search' ? (
          <div className="flex-1 flex flex-col p-6 overflow-hidden space-y-4">
            {/* Search Input & Consumidor Final Button */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cliente (ej. Juan, J-12345678, 0414)..."
                  className="w-full pl-10 pr-4 py-3 bg-surface-raised border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm text-text-primary placeholder:text-text-secondary outline-none transition-all"
                  autoFocus
                />
              </div>

              {!required && (
                <button
                  type="button"
                  onClick={handleSelectGeneral}
                  className="px-4 py-3 bg-surface-raised hover:bg-surface border border-border hover:border-primary/30 text-xs font-bold text-text-primary rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2"
                >
                  <User className="w-4 h-4 text-text-secondary" />
                  <span>Consumidor Final</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[250px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-text-secondary gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Cargando clientes...</span>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-6 border border-dashed border-border rounded-xl">
                  <User className="w-8 h-8 text-text-secondary/50 mb-2" />
                  <p className="text-sm font-semibold text-text-primary">No se encontraron clientes</p>
                  <p className="text-xs text-text-secondary mt-1">
                    {searchQuery ? `No hay resultados para "${searchQuery}"` : 'Empieza escribiendo para buscar'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, name: searchQuery }))
                      setView('create')
                    }}
                    className="mt-3 text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Registrar &quot;{searchQuery || 'nuevo'}&quot;
                  </button>
                </div>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      handleSelect({
                        id: c.id,
                        name: c.name,
                        taxId: c.tax_id || null
                      })
                    }
                    className="w-full flex items-center justify-between p-3.5 bg-surface-raised/40 hover:bg-surface-raised border border-border/60 hover:border-primary/40 rounded-xl transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 group-hover:scale-105 transition-transform">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors flex items-center gap-2">
                          {c.name}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
                          {c.tax_id && (
                            <span className="flex items-center gap-1 font-mono">
                              <CreditCard className="w-3 h-3" /> {c.tax_id}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {c.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-text-secondary group-hover:text-primary rounded-lg transition-colors">
                      <Check className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Form for creating new customer */
          <form onSubmit={handleCreateCustomer} className="flex-1 flex flex-col p-6 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Nombre o Razón Social *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej. Inversiones García C.A. / María Pérez"
                    className={`w-full pl-10 pr-4 py-2.5 bg-surface-raised border ${
                      formErrors.name ? 'border-error' : 'border-border'
                    } focus:border-primary rounded-xl text-sm text-text-primary outline-none transition-all`}
                  />
                </div>
                {formErrors.name && (
                  <p className="text-xs text-error flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.name}
                  </p>
                )}
              </div>

              {/* Tax ID */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  RIF / Cédula / Tax ID *
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    required
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value.toUpperCase() })}
                    placeholder="J-12345678-9 o V-12345678"
                    className={`w-full pl-10 pr-4 py-2.5 bg-surface-raised border ${
                      formErrors.tax_id ? 'border-error' : 'border-border'
                    } focus:border-primary rounded-xl text-sm font-mono text-text-primary outline-none transition-all`}
                  />
                </div>
                {formErrors.tax_id && (
                  <p className="text-xs text-error flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.tax_id}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Teléfono (opcional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0414-1234567"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-raised border border-border focus:border-primary rounded-xl text-sm text-text-primary outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Correo Electrónico (opcional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cliente@ejemplo.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-raised border border-border focus:border-primary rounded-xl text-sm text-text-primary outline-none transition-all"
                  />
                </div>
              </div>

              {/* Birth date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Cumpleaños (opcional)
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-raised border border-border focus:border-primary rounded-xl text-sm text-text-primary outline-none transition-all"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Dirección Fiscal / Entrega (opcional)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-text-secondary" />
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Av. Principal, Edificio X, Piso 1..."
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-raised border border-border focus:border-primary rounded-xl text-sm text-text-primary outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {/* Social media & notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Instagram / Redes (opcional)
                </label>
                <div className="relative">
                  <Instagram className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={formData.social_media}
                    onChange={(e) => setFormData({ ...formData, social_media: e.target.value })}
                    placeholder="@usuario"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-raised border border-border focus:border-primary rounded-xl text-sm text-text-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Notas Adicionales (opcional)
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Preferencias, alergias, etc."
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-raised border border-border focus:border-primary rounded-xl text-sm text-text-primary outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setView('search')}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createCustomerMutation.isPending}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-black hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {createCustomerMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Guardar y Asignar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
