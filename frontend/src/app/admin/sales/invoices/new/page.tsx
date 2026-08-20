'use client'

import { useState, useEffect } from 'react'
import { useCustomers, useCreateInvoice, useCurrencies, useTaxes } from '@/hooks/useSales'
import { useRouter } from 'next/navigation'
import { FileText, Save, Plus, Trash2, ArrowLeft, Search, X, Users, User } from 'lucide-react'
import Link from 'next/link'

export default function NewInvoicePage() {
  const router = useRouter()
  const { data: customers } = useCustomers()
  const { data: currencies } = useCurrencies()
  const { data: taxes } = useTaxes(true)
  const { mutateAsync: createInvoice, isPending } = useCreateInvoice()

  const [customerId, setCustomerId] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [currency, setCurrency] = useState('USD')

  const selectedCustomer = customers?.find(c => c.id === customerId)

  useEffect(() => {
    if (currencies && currencies.length > 0) {
      const baseCurr = currencies.find(c => c.is_base) || currencies[0]
      setCurrency(baseCurr.code)
    }
  }, [currencies])
  const defaultTax = (() => {
    if (!taxes || taxes.length === 0) return { id: '', rate: 16 }
    const def = taxes.find(t => Number(t.rate) > 0) || taxes[0]
    const r = Number(def.rate)
    const pct = r <= 1 ? Number((r * 100).toFixed(2)) : r
    return { id: def.id, rate: pct }
  })()

  useEffect(() => {
    if (taxes && taxes.length > 0) {
      setItems(prev => prev.map(it => !it.tax_id ? { ...it, tax_id: defaultTax.id, tax_rate: defaultTax.rate } : it))
    }
  }, [taxes, defaultTax.id, defaultTax.rate])

  const [items, setItems] = useState([{ description: '', qty: 1, unit_price: 0, tax_id: '', tax_rate: 16 }])

  const subtotal = items.reduce((acc, item) => acc + (item.qty * item.unit_price), 0)
  const taxTotal = items.reduce((acc, item) => acc + (item.qty * item.unit_price * (item.tax_rate / 100)), 0)
  const total = subtotal + taxTotal

  const handleAddItem = () => {
    setItems([...items, { description: '', qty: 1, unit_price: 0, tax_id: defaultTax.id, tax_rate: defaultTax.rate }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleTaxChange = (index: number, taxId: string) => {
    const chosenTax = taxes?.find(t => t.id === taxId)
    let rate = 0
    if (chosenTax) {
      const r = Number(chosenTax.rate)
      rate = r <= 1 ? Number((r * 100).toFixed(2)) : r
    }
    const newItems = [...items]
    newItems[index] = { ...newItems[index], tax_id: taxId, tax_rate: rate }
    setItems(newItems)
  }

  const handleSave = async () => {
    if (items.length === 0 || !items[0].description) return alert('Add at least one item')
    
    try {
        await createInvoice({
            customer_id: customerId || undefined,
            currency_code: currency,
            items: items.map(it => ({
                description: it.description,
                quantity: it.qty,
                unit_price: it.unit_price,
                tax_id: it.tax_id || undefined,
            }))
        })
        router.push('/admin/sales/invoices')
    } catch (err: any) {
        console.error(err)
        alert('Error saving invoice: ' + (err.message || 'Unknown error'))
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
            <Link href="/admin/sales/invoices" className="p-2 border border-border rounded-xl text-text-secondary hover:text-primary hover:border-primary transition-colors">
                <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
            <h1 className="text-2xl font-bold text-text-primary">Nueva Factura</h1>
            <p className="text-sm text-text-secondary mt-1">Borrador de documento</p>
            </div>
        </div>
        <button 
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {isPending ? 'Guardando...' : 'Confirmar Factura'}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
          {/* Header Form */}
          <div className="p-6 bg-surface-raised/30 border-b border-border grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Cliente (Opcional)</label>
                  <div className="flex gap-2">
                      <div className="relative flex-grow">
                          <input 
                              type="text"
                              readOnly
                              placeholder="Seleccionar cliente..."
                              value={selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.tax_id ? ` (${selectedCustomer.tax_id})` : ''}` : ''}
                              onClick={() => {
                                  setCustomerSearch('')
                                  setShowCustomerModal(true)
                              }}
                              className="w-full bg-surface-raised border border-border rounded-xl px-3.5 h-11 text-sm outline-none cursor-pointer font-semibold text-text-primary placeholder:text-text-disabled truncate pr-8"
                          />
                          {customerId && (
                              <button
                                  type="button"
                                  onClick={(e) => {
                                      e.stopPropagation()
                                      setCustomerId('')
                                  }}
                                  className="absolute right-2.5 top-3.5 p-0.5 hover:bg-surface rounded-full text-text-secondary hover:text-error transition-colors"
                                  title="Quitar cliente"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          )}
                      </div>
                      <button
                          type="button"
                          onClick={() => {
                              setCustomerSearch('')
                              setShowCustomerModal(true)
                          }}
                          className="px-3.5 bg-primary text-text-inverse rounded-xl hover:bg-primary-hover active:scale-95 transition-all flex items-center justify-center shrink-0 h-11 shadow-sm"
                          title="Buscar Cliente"
                      >
                          <Search className="h-4 w-4" />
                      </button>
                  </div>
                  {selectedCustomer && (
                    <div className="flex items-center gap-3 text-xs text-text-secondary pt-0.5">
                      {selectedCustomer.tax_id && <span>RIF/CI: <span className="font-mono font-medium text-text-primary">{selectedCustomer.tax_id}</span></span>}
                      <span>Límite Crédito: <span className="font-mono font-medium text-text-primary">${Number(selectedCustomer.credit_limit || 0).toFixed(2)}</span></span>
                    </div>
                  )}
              </div>
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Moneda</label>
                  <select 
                      value={currency} 
                      onChange={e => setCurrency(e.target.value)}
                      className="w-full bg-surface-raised border border-border rounded-xl px-4 h-11 text-sm focus:border-primary outline-none font-semibold text-text-primary"
                  >
                      {currencies && currencies.length > 0 ? (
                        currencies.map(c => (
                          <option key={c.id} value={c.code}>
                            {c.code} ({c.symbol}) - {c.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="USD">USD ($) - Dólares</option>
                          <option value="VES">VES (Bs.) - Bolívares</option>
                        </>
                      )}
                  </select>
              </div>
          </div>

          {/* Line Items */}
          <div className="p-6">
              <table className="w-full text-left">
                  <thead>
                      <tr className="border-b border-border text-[10px] font-black uppercase tracking-wider text-text-secondary">
                          <th className="pb-3 w-1/2">Descripción</th>
                          <th className="pb-3 w-24">Cant.</th>
                          <th className="pb-3 w-32">Precio Unit.</th>
                          <th className="pb-3 w-24">IVA %</th>
                          <th className="pb-3 text-right">Total</th>
                          <th className="pb-3 w-10"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                      {items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-surface-raised/30 transition-colors">
                              <td className="py-2.5 pr-2">
                                  <input 
                                    type="text" 
                                    placeholder="Descripción del artículo..."
                                    value={item.description}
                                    onChange={e => handleItemChange(idx, 'description', e.target.value)}
                                    className="w-full bg-surface-raised/60 hover:bg-surface-raised focus:bg-surface border border-border/60 hover:border-border focus:border-primary rounded-xl px-3 py-2 outline-none text-sm text-text-primary placeholder:text-text-disabled transition-all"
                                  />
                              </td>
                              <td className="py-2.5 pr-2">
                                  <input 
                                    type="number" 
                                    min="1"
                                    value={item.qty}
                                    onChange={e => handleItemChange(idx, 'qty', Number(e.target.value))}
                                    className="w-full bg-surface-raised/60 hover:bg-surface-raised focus:bg-surface border border-border/60 hover:border-border focus:border-primary rounded-xl px-3 py-2 outline-none text-sm font-mono text-text-primary transition-all text-right"
                                  />
                              </td>
                              <td className="py-2.5 pr-2">
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    value={item.unit_price}
                                    onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                                    className="w-full bg-surface-raised/60 hover:bg-surface-raised focus:bg-surface border border-border/60 hover:border-border focus:border-primary rounded-xl px-3 py-2 outline-none text-sm font-mono text-text-primary transition-all text-right"
                                  />
                              </td>
                              <td className="py-2.5 pr-2">
                                  <select 
                                      value={item.tax_id || ''}
                                      onChange={e => handleTaxChange(idx, e.target.value)}
                                      className="w-full bg-surface-raised/60 hover:bg-surface-raised focus:bg-surface border border-border/60 hover:border-border focus:border-primary rounded-xl px-3 py-2 outline-none text-sm font-mono text-text-primary transition-all cursor-pointer"
                                  >
                                      {taxes && taxes.length > 0 ? (
                                        taxes.map(t => {
                                          const rateNum = Number(t.rate)
                                          const pct = rateNum <= 1 ? Number((rateNum * 100).toFixed(2)) : rateNum
                                          return (
                                            <option key={t.id} value={t.id} className="bg-surface text-text-primary py-1">
                                              {pct === 0 ? `${t.name} (0%)` : `${t.name} (${pct}%)`}
                                            </option>
                                          )
                                        })
                                      ) : (
                                        <option value="" className="bg-surface text-text-primary py-1">Exento (0%)</option>
                                      )}
                                  </select>
                              </td>
                              <td className="py-2.5 text-right font-mono text-sm font-bold text-text-primary">
                                  {((item.qty * item.unit_price) * (1 + item.tax_rate / 100)).toFixed(2)}
                              </td>
                              <td className="py-2.5 text-right pl-2">
                                  <button onClick={() => handleRemoveItem(idx)} className="text-text-secondary hover:text-error transition-colors p-1.5 hover:bg-surface-raised rounded-lg" title="Eliminar línea">
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>

              <button onClick={handleAddItem} className="mt-4 flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                  <Plus className="w-4 h-4" /> Agregar Línea
              </button>
          </div>

          {/* Totals Footer */}
          <div className="bg-surface-raised/50 border-t border-border p-6 flex justify-end">
              <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm text-text-secondary">
                      <span>Subtotal</span>
                      <span className="font-mono">{subtotal.toFixed(2)} {currency}</span>
                  </div>
                  <div className="flex justify-between text-sm text-text-secondary pb-2 border-b border-border">
                      <span>Impuestos (IVA)</span>
                      <span className="font-mono">{taxTotal.toFixed(2)} {currency}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-text-primary pt-1">
                      <span>Total</span>
                      <span className="font-mono">{total.toFixed(2)} {currency}</span>
                  </div>
              </div>
          </div>
      </div>

      {/* Modal Selección de Cliente */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-text-primary">Seleccionar Cliente</h2>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCustomerModal(false)} 
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-raised transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Buscar por nombre, RIF / C.I., email, teléfono..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                autoFocus
                className="w-full bg-surface-raised border border-border rounded-xl pl-9 pr-4 h-11 text-sm focus:border-primary outline-none transition-colors font-medium text-text-primary"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px] max-h-[48vh]">
              {customers
                ?.filter(c => {
                  if (!customerSearch.trim()) return true
                  const q = customerSearch.toLowerCase()
                  return (
                    c.name.toLowerCase().includes(q) ||
                    (c.tax_id || '').toLowerCase().includes(q) ||
                    (c.email || '').toLowerCase().includes(q) ||
                    (c.phone || '').toLowerCase().includes(q)
                  )
                })
                .map(c => {
                  const isSelected = c.id === customerId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id)
                        setShowCustomerModal(false)
                      }}
                      className={`w-full text-left p-3.5 rounded-xl transition-all border flex items-center justify-between ${
                        isSelected 
                          ? 'bg-primary/10 border-primary text-primary font-bold' 
                          : 'bg-surface hover:bg-surface-raised border-border text-text-primary'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-text-primary">{c.name}</span>
                          {c.is_active === false && (
                            <span className="text-[10px] bg-error/10 text-error px-1.5 py-0.5 rounded font-bold">Inactivo</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary font-normal">
                          {c.tax_id && <span>RIF/CI: <strong className="font-mono">{c.tax_id}</strong></span>}
                          {c.phone && <span>Tel: {c.phone}</span>}
                          {c.email && <span>{c.email}</span>}
                        </div>
                      </div>
                      {isSelected ? (
                        <span className="text-[10px] font-bold uppercase bg-primary text-text-inverse px-2 py-0.5 rounded-full shrink-0 ml-2">Seleccionado</span>
                      ) : (
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-xs font-mono text-text-secondary block">Límite: ${Number(c.credit_limit || 0).toFixed(2)}</span>
                          {Number(c.outstanding_balance || 0) > 0 && (
                            <span className="text-[10px] font-mono text-warning block">Deuda: ${Number(c.outstanding_balance || 0).toFixed(2)}</span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}

              {(!customers || customers.length === 0) && (
                <div className="text-center py-10 text-xs text-text-secondary">
                  No hay clientes registrados en el sistema.
                </div>
              )}

              {customers && customers.length > 0 && customers.filter(c => {
                const q = customerSearch.toLowerCase()
                return (
                  c.name.toLowerCase().includes(q) ||
                  (c.tax_id || '').toLowerCase().includes(q) ||
                  (c.email || '').toLowerCase().includes(q) ||
                  (c.phone || '').toLowerCase().includes(q)
                )
              }).length === 0 && customerSearch && (
                <div className="text-center py-10 text-xs text-text-secondary italic">
                  No se encontraron clientes que coincidan con "{customerSearch}"
                </div>
              )}
            </div>

            <div className="border-t border-border pt-3 flex justify-between items-center mt-2">
              {customerId ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId('')
                    setShowCustomerModal(false)
                  }}
                  className="text-xs font-bold text-error hover:underline transition-colors"
                >
                  Limpiar Selección (Sin cliente)
                </button>
              ) : (
                <span className="text-xs text-text-secondary">Ningún cliente seleccionado</span>
              )}
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="px-4 h-9 border border-border hover:bg-surface-raised rounded-xl text-xs font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
