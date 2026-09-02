'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Utensils,
  X,
  User,
  UserCheck,
  Users,
  Search,
  Check,
  AlertCircle,
  Tag
} from 'lucide-react'
import { Customer, TableItem } from '@/lib/api/sales'
import { useCustomers, useTeamUsers } from '@/hooks/useSales'
import { useProfile } from '@/hooks/useProfile'

export interface OpenTableModalProps {
  isOpen: boolean
  onClose: () => void
  table: TableItem | null
  customerRequirement?: 'required' | 'optional' | 'disabled'
  teamUsers?: any[]
  customers?: Customer[]
  onConfirm: (data: {
    customName?: string | null
    customerId?: string | null
    customerName?: string | null
    customerTaxId?: string | null
    assignedTo?: string | null
    assignedToName?: string | null
    guestsCount?: number
  }) => Promise<void> | void
  isSubmitting?: boolean
}

export function OpenTableModal({
  isOpen,
  onClose,
  table,
  customerRequirement = 'optional',
  teamUsers: passedTeamUsers,
  customers: passedCustomers,
  onConfirm,
  isSubmitting = false,
}: OpenTableModalProps) {
  const { data: profile } = useProfile()
  const { data: cachedTeamUsers = [] } = useTeamUsers()
  const { data: cachedCustomers = [] } = useCustomers()

  const teamUsers = passedTeamUsers || cachedTeamUsers
  const customers = passedCustomers || cachedCustomers

  // Form states
  const [customName, setCustomName] = useState<string>('')
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>('')
  const [guestsCount, setGuestsCount] = useState<number>(1)

  // Customer states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState<string>('')
  const [isSelectingCustomer, setIsSelectingCustomer] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset and initialize default values when table changes or modal opens
  useEffect(() => {
    if (isOpen && table) {
      setCustomName('')
      setGuestsCount(1)
      setErrorMsg(null)
      setIsSelectingCustomer(false)
      setCustomerSearch('')
      setSelectedCustomer(null)

      // Default waiter to currently logged in profile if matches
      if (profile?.id) {
        setSelectedWaiterId(profile.id)
      } else if (teamUsers.length > 0) {
        setSelectedWaiterId(teamUsers[0].id)
      } else {
        setSelectedWaiterId('')
      }
    }
  }, [isOpen, table, profile, teamUsers])

  // Filtered customers list
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 8)
    const q = customerSearch.toLowerCase()
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.tax_id && c.tax_id.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    ).slice(0, 8)
  }, [customers, customerSearch])

  // Waiters list including fallback to current logged user if not in admin list
  const availableWaiters = useMemo(() => {
    const list = [...teamUsers]
    if (profile?.id && !list.some((u) => u.id === profile.id)) {
      list.unshift({
        id: profile.id,
        full_name: profile.full_name || 'Mi Usuario',
        email: profile.email || null,
        role: profile.role || 'staff',
        organization_id: profile.organization_id || '',
        venue_id: profile.venue_id || null,
        shift_id: null,
      })
    }
    return list
  }, [teamUsers, profile])

  if (!isOpen || !table) return null

  const isCustomerRequired = customerRequirement === 'required'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    // Validate customer requirement
    if (isCustomerRequired && !selectedCustomer) {
      setErrorMsg('La empresa exige registrar un cliente para abrir la mesa.')
      return
    }

    const assignedWaiter = availableWaiters.find((w) => w.id === selectedWaiterId)

    try {
      await onConfirm({
        customName: customName.trim() ? customName.trim() : null,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || null,
        customerTaxId: selectedCustomer?.tax_id || null,
        assignedTo: selectedWaiterId || null,
        assignedToName: assignedWaiter?.full_name || null,
        guestsCount: Math.max(1, guestsCount),
      })
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al abrir la mesa.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg flex flex-col bg-surface border border-border/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="shrink-0 px-6 py-4 bg-surface-raised/50 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-xs">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-text-primary tracking-tight">
                  Abrir Mesa
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/20">
                  {table.name}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Configura los datos del servicio para iniciar la comanda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-raised text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Custom Name / Alias */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span>Nombre o Nota de la Mesa</span>
              </label>
              <span className="text-[10px] text-text-secondary/80 font-medium">Opcional</span>
            </div>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={`Ej. ${table.name} - Cumpleaños, Reserva Juan...`}
              className="w-full px-4 py-2.5 bg-surface-raised border border-border focus:border-primary rounded-2xl text-xs font-bold text-text-primary outline-none transition-all shadow-inner placeholder:font-normal placeholder:text-text-secondary/50"
              maxLength={40}
            />
          </div>

          {/* 2. Waiter / Mesonero Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Mesonero Asignado</span>
              </label>
              <span className="text-[10px] text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                Atención en Salón
              </span>
            </div>

            <div className="relative">
              <select
                value={selectedWaiterId}
                onChange={(e) => setSelectedWaiterId(e.target.value)}
                className="w-full px-4 py-3 bg-surface-raised border border-border focus:border-sky-500 rounded-2xl text-xs font-bold text-text-primary outline-none transition-all appearance-none cursor-pointer pr-10 shadow-inner"
              >
                <option value="">Sin mesonero específico (General)</option>
                {availableWaiters.map((waiter) => (
                  <option key={waiter.id} value={waiter.id}>
                    {waiter.full_name} {waiter.id === profile?.id ? '(Tú)' : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                <UserCheck className="w-4 h-4 text-sky-400" />
              </div>
            </div>
          </div>

          {/* 3. Customer Assignment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Cliente de la Comanda</span>
              </label>
              {isCustomerRequired ? (
                <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  * Requerido por empresa
                </span>
              ) : (
                <span className="text-[10px] text-text-secondary/80 font-medium">Opcional</span>
              )}
            </div>

            {selectedCustomer ? (
              <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-2xl flex items-center justify-between animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-primary text-black flex items-center justify-center font-black text-xs shrink-0">
                    {selectedCustomer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-text-primary truncate">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-[10px] text-text-secondary font-mono">
                      {selectedCustomer.tax_id || selectedCustomer.email || 'Sin documento'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null)
                    setIsSelectingCustomer(false)
                  }}
                  className="p-1.5 text-text-secondary hover:text-error hover:bg-error/10 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="Quitar cliente"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : isSelectingCustomer ? (
              <div className="p-3.5 bg-surface-raised border border-border rounded-2xl space-y-2.5 animate-in fade-in duration-150">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Buscar por nombre, RIF o cédula..."
                    className="w-full pl-9 pr-8 py-2 bg-surface border border-border focus:border-primary rounded-xl text-xs font-semibold text-text-primary outline-none transition-all"
                    autoFocus
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-[11px] text-text-secondary text-center py-2">
                      No se encontraron clientes coincidentes.
                    </p>
                  ) : (
                    filteredCustomers.map((cust) => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(cust)
                          setIsSelectingCustomer(false)
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-surface text-left transition-colors cursor-pointer text-xs"
                      >
                        <span className="font-bold text-text-primary truncate mr-2">
                          {cust.name}
                        </span>
                        <span className="font-mono text-[10px] text-text-secondary shrink-0">
                          {cust.tax_id || cust.email || ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSelectingCustomer(false)}
                    className="text-[11px] font-bold text-text-secondary hover:text-text-primary px-2 py-1"
                  >
                    Cancelar búsqueda
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSelectingCustomer(true)}
                  className="flex-1 py-2.5 px-3.5 bg-surface-raised hover:bg-surface border border-border hover:border-primary/40 rounded-2xl text-xs font-bold text-text-secondary hover:text-text-primary flex items-center justify-between transition-all cursor-pointer shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-primary" />
                    <span>Seleccionar Cliente</span>
                  </span>
                  <span className="text-[10px] text-primary font-bold">Buscar</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Guests / Comensales Count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cantidad de Comensales (Pax)</span>
              </label>
              <span className="text-xs font-mono font-black text-emerald-400">
                {guestsCount} {guestsCount === 1 ? 'persona' : 'personas'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5, 6, 8].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setGuestsCount(num)}
                  className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    guestsCount === num
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20 font-black scale-105'
                      : 'bg-surface-raised hover:bg-surface border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {num}
                </button>
              ))}
              <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-xl px-1">
                <button
                  type="button"
                  onClick={() => setGuestsCount((prev) => Math.max(1, prev - 1))}
                  className="px-2 py-1 text-text-secondary hover:text-text-primary font-bold text-xs cursor-pointer"
                >
                  -
                </button>
                <span className="text-xs font-mono font-bold w-4 text-center">{guestsCount}</span>
                <button
                  type="button"
                  onClick={() => setGuestsCount((prev) => prev + 1)}
                  className="px-2 py-1 text-text-secondary hover:text-text-primary font-bold text-xs cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-border/70 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-2xl border border-border hover:bg-surface-raised text-xs font-bold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-black font-black text-xs shadow-lg shadow-primary/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isSubmitting ? 'Abriendo Mesa...' : 'Abrir Mesa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
