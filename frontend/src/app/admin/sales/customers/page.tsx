'use client'

import { useState } from 'react'
import { useCustomers, useCreateCustomer } from '@/hooks/useSales'
import { Users, Plus, Search, Phone, Mail, MapPin, X, Check, AlertTriangle } from 'lucide-react'

export default function CustomersPage() {
  const { data: customers, isLoading } = useCustomers()
  const { mutateAsync: createCustomer, isPending } = useCreateCustomer()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [customerError, setCustomerError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    tax_id: '',
    email: '',
    phone: '',
    address: '',
    credit_limit: 0,
  })

  const filteredCustomers = customers?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tax_id?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCustomerError(null)
    if (!form.name.trim()) {
      setCustomerError('El nombre o razón social es obligatorio.')
      return
    }
    
    try {
      await createCustomer({
        name: form.name.trim(),
        tax_id: form.tax_id || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        credit_limit: Number(form.credit_limit) || 0,
      })
      setIsModalOpen(false)
      setForm({ name: '', tax_id: '', email: '', phone: '', address: '', credit_limit: 0 })
    } catch (err: any) {
      setCustomerError(err.message || 'Error registrando cliente.')
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Directorio de Clientes
          </h1>
          <p className="text-sm text-text-secondary mt-1">Gestión de cuentas por cobrar, límites de crédito y datos fiscales</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input 
            type="text"
            placeholder="Buscar por nombre o RIF / C.I..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:border-primary outline-none transition-colors"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[10px] font-black uppercase tracking-wider text-text-secondary">
                <th className="pb-3 pl-2">Cliente</th>
                <th className="pb-3">RIF / C.I.</th>
                <th className="pb-3">Contacto</th>
                <th className="pb-3 text-right">Límite de Crédito</th>
                <th className="pb-3 text-right">Saldo Deudor</th>
                <th className="pb-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-secondary animate-pulse">Cargando clientes...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-secondary">No hay clientes registrados aún.</td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-raised/50 transition-colors">
                    <td className="py-3 pl-2 font-bold text-text-primary">
                      {c.name}
                      {c.address && (
                        <p className="text-xs text-text-secondary font-normal flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-text-secondary" /> {c.address}
                        </p>
                      )}
                    </td>
                    <td className="py-3 font-mono text-xs text-text-secondary">
                      {c.tax_id || '---'}
                    </td>
                    <td className="py-3 text-xs text-text-secondary space-y-0.5">
                      {c.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</div>}
                      {c.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</div>}
                      {!c.phone && !c.email && '---'}
                    </td>
                    <td className="py-3 text-right font-mono text-text-secondary">
                      ${Number(c.credit_limit || 0).toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-text-primary">
                      ${Number(c.outstanding_balance || 0).toFixed(2)}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        c.is_active !== false ? 'bg-success/10 text-success border border-success/20' : 'bg-surface-raised text-text-secondary border border-border'
                      }`}>
                        {c.is_active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">Registrar Cliente</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {customerError && (
              <div className="p-3 rounded-xl bg-error/10 text-error border border-error/20 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{customerError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Nombre o Razón Social *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: Inversiones Los Andes C.A."
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">RIF / C.I.</label>
                  <input 
                    type="text" 
                    placeholder="J-12345678-0"
                    value={form.tax_id}
                    onChange={e => setForm({...form, tax_id: e.target.value})}
                    className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">Límite Crédito ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={form.credit_limit}
                    onChange={e => setForm({...form, credit_limit: Number(e.target.value)})}
                    className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">Teléfono</label>
                  <input 
                    type="text" 
                    placeholder="+58 412-0000000"
                    value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase">Correo Electrónico</label>
                  <input 
                    type="email" 
                    placeholder="facturacion@empresa.com"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase">Dirección Fiscal</label>
                <textarea 
                  rows={2}
                  placeholder="Av. Principal, Edificio Torre..."
                  value={form.address}
                  onChange={e => setForm({...form, address: e.target.value})}
                  className="w-full bg-surface-raised border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 h-11 border border-border bg-surface hover:bg-surface-raised text-text-primary rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <Check className="w-4 h-4" /> {isPending ? 'Guardando...' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
