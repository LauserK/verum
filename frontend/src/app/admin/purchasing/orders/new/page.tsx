// frontend/src/app/admin/purchasing/orders/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, SupplierResponse, SupplierItemResponse, SupplierPriceListResponse, InventoryItem, Warehouse, UOMPresentation } from '@/lib/api';
import { 
  ArrowLeft, Plus, Trash2, Save, Loader2, AlertCircle, 
  ShoppingCart, Calendar, Building2, User, Search
} from 'lucide-react';
import Link from 'next/link';

interface OrderLineInput {
  item_id: string;
  qty_ordered_base: number;
  unit_cost_base: number;
  uom_name: string;
  item_name: string;
  presentation_id: string | null;
  qty_ordered_presentation: number | null;
  unit_cost_presentation: number | null;
  tax_rate: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [catalogItems, setCatalogItems] = useState<InventoryItem[]>([]);
  const [itemPresentations, setItemPresentations] = useState<Record<string, UOMPresentation[]>>({});
  
  // Selection/Loading States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supplier-specific price lists and linked items
  const [activePriceList, setActivePriceList] = useState<SupplierPriceListResponse | null>(null);
  const [supplierItems, setSupplierItems] = useState<SupplierItemResponse[]>([]);

  // Form State
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  const [warehouseId, setWarehouseId] = useState<string>('');
  const [requestedDate, setRequestedDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0] // Default tomorrow
  );
  const [promisedDate, setPromisedDate] = useState<string>('');
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<OrderLineInput[]>([]);

  // Temp Line Selection
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedQty, setSelectedQty] = useState<string>('1');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string>('');
  const [selectedCost, setSelectedCost] = useState<string>('0');
  const [selectedItemBaseUom, setSelectedItemBaseUom] = useState<string>('unidad');

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      setError(null);
      try {
        const supData = await adminApi.getSuppliers();
        setSuppliers(supData || []);

        const whData = await adminApi.getInventoryWarehouses();
        setWarehouses(whData || []);

        const itemData = await adminApi.getInventoryItems();
        setCatalogItems(itemData || []);
      } catch (err) {
        console.error('Error loading initial data for new PO:', err);
        setError('No se pudieron cargar los catálogos base. Valida tu conexión.');
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const fetchItemPresentations = async (itemId: string) => {
    if (itemPresentations[itemId]) return;
    try {
      const pres = await adminApi.getItemPresentations(itemId);
      setItemPresentations(prev => ({ ...prev, [itemId]: pres }));
    } catch (err) {
      console.error(`Error loading presentations for item ${itemId}:`, err);
    }
  };

  // When supplier changes, update payment terms and load their price list
  const handleSupplierChange = async (sid: string) => {
    setSupplierId(sid);
    setLines([]); // Clear lines to avoid mixing catalogs
    setActivePriceList(null);
    setSupplierItems([]);
    
    if (!sid) return;

    const selectedSup = suppliers.find(s => s.id === sid);
    if (selectedSup) {
      setPaymentTermsDays(selectedSup.payment_terms_days || 0);
      setCurrency(selectedSup.currency || 'USD');
    }

    try {
      // Load price lists
      const pls = await adminApi.getSupplierPriceLists(sid);
      // Find the first active price list (vigente)
      const activePl = pls.find(p => p.is_active);
      if (activePl) {
        setActivePriceList(activePl);
      }

      // Load linked supplier items
      const linkedItems = await adminApi.getSupplierItems(sid);
      setSupplierItems(linkedItems || []);
    } catch (err) {
      console.error('Error loading supplier pricing/items data:', err);
    }
  };

  // Handler for panel presentation changes
  const handlePanelPresentationChange = (presId: string) => {
    setSelectedPresentationId(presId);
    
    // Find base price from price list
    let basePrice = 0.0;
    if (activePriceList) {
      const plItem = activePriceList.items.find(pi => pi.item_id === selectedItemId);
      if (plItem) {
        basePrice = plItem.unit_cost_base;
      }
    }

    if (presId) {
      const p = itemPresentations[selectedItemId]?.find(pres => pres.id === presId);
      if (p) {
        // Presentation cost = base cost * conversion factor
        setSelectedCost((basePrice * p.conversion_factor).toString());
      }
    } else {
      setSelectedCost(basePrice.toString());
    }
  };

  // Add Item Line
  const handleAddLine = () => {
    if (!selectedItemId) return;

    // Check if item is already added
    if (lines.some(l => l.item_id === selectedItemId)) {
      setError('El artículo ya ha sido añadido a la lista.');
      return;
    }

    const item = catalogItems.find(i => i.id === selectedItemId);
    if (!item) return;

    let qtyBase = Number(selectedQty) || 1;
    let costBase = Number(selectedCost) || 0;
    let qtyPres: number | null = null;
    let costPres: number | null = null;

    if (selectedPresentationId) {
      const p = itemPresentations[selectedItemId]?.find(pres => pres.id === selectedPresentationId);
      if (p) {
        qtyPres = Number(selectedQty) || 1;
        costPres = Number(selectedCost) || 0;
        qtyBase = qtyPres * p.conversion_factor;
        costBase = costPres / p.conversion_factor;
      }
    }

    const itemTaxRate = item.tax_rate !== undefined ? item.tax_rate : 0.16;

    const newLine: OrderLineInput = {
      item_id: selectedItemId,
      qty_ordered_base: qtyBase,
      unit_cost_base: costBase,
      uom_name: item.uom_name || 'unidad',
      item_name: item.name,
      presentation_id: selectedPresentationId || null,
      qty_ordered_presentation: qtyPres,
      unit_cost_presentation: costPres,
      tax_rate: itemTaxRate
    };

    setLines([...lines, newLine]);
    
    // Reset selection states
    setSelectedItemId('');
    setItemSearchQuery('');
    setSelectedQty('1');
    setSelectedPresentationId('');
    setSelectedCost('0');
    setSelectedItemBaseUom('unidad');
    setError(null);
  };

  // Remove Line
  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handlePresentationChange = (idx: number, presentationId: string) => {
    const updated = [...lines];
    const line = updated[idx];
    line.presentation_id = presentationId || null;

    if (presentationId) {
      const p = itemPresentations[line.item_id]?.find(pres => pres.id === presentationId);
      if (p) {
        // Recalculate presentation quantities & costs from base fields
        line.qty_ordered_presentation = line.qty_ordered_base / p.conversion_factor;
        line.unit_cost_presentation = line.unit_cost_base * p.conversion_factor;

        // Force exact alignment
        line.qty_ordered_base = line.qty_ordered_presentation * p.conversion_factor;
        line.unit_cost_base = line.unit_cost_presentation / p.conversion_factor;
      }
    } else {
      line.qty_ordered_presentation = null;
      line.unit_cost_presentation = null;
    }
    setLines(updated);
  };

  const handleLineQtyChange = (idx: number, value: number) => {
    const updated = [...lines];
    const line = updated[idx];
    
    if (line.presentation_id) {
      const p = itemPresentations[line.item_id]?.find(pres => pres.id === line.presentation_id);
      if (p) {
        line.qty_ordered_presentation = value;
        line.qty_ordered_base = value * p.conversion_factor;
      }
    } else {
      line.qty_ordered_base = value;
    }
    setLines(updated);
  };

  const handleLineCostChange = (idx: number, value: number) => {
    const updated = [...lines];
    const line = updated[idx];
    
    if (line.presentation_id) {
      const p = itemPresentations[line.item_id]?.find(pres => pres.id === line.presentation_id);
      if (p) {
        line.unit_cost_presentation = value;
        line.unit_cost_base = value / p.conversion_factor;
      }
    } else {
      line.unit_cost_base = value;
    }
    setLines(updated);
  };

  // Calculation
  const subtotal = lines.reduce((acc, curr) => acc + (curr.qty_ordered_base * curr.unit_cost_base), 0);
  const taxAmount = Number(
    lines.reduce((acc, curr) => acc + (curr.qty_ordered_base * curr.unit_cost_base * (curr.tax_rate !== undefined ? curr.tax_rate : 0.16)), 0)
    .toFixed(2)
  );
  const total = subtotal + taxAmount;

  // Submit Order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !warehouseId || lines.length === 0) {
      setError('Falta completar campos obligatorios o añadir artículos.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      supplier_id: supplierId,
      price_list_id: activePriceList?.id || null,
      origin_type: 'manual',
      requested_date: requestedDate || null,
      promised_date: promisedDate || null,
      currency: currency,
      payment_terms_days: Number(paymentTermsDays),
      warehouse_id: warehouseId,
      notes: notes || null,
      lines: lines.map(l => ({
        item_id: l.item_id,
        qty_ordered_base: Number(l.qty_ordered_base),
        unit_cost_base: Number(l.unit_cost_base),
        qty_ordered_presentation: l.presentation_id ? Number(l.qty_ordered_presentation) : null,
        presentation_id: l.presentation_id || null,
        unit_cost_presentation: l.presentation_id ? Number(l.unit_cost_presentation) : null
      }))
    };

    try {
      await adminApi.createPurchaseOrder(payload);
      router.push('/admin/purchasing/orders');
    } catch (err: any) {
      console.error('Error creating purchase order:', err);
      setError(err?.detail || 'No se pudo crear la orden de compra. Revisa los datos ingresados.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items in drop-down: only items linked to supplier, or all if none linked
  const availableItems = catalogItems.filter(item => {
    if (supplierItems.length === 0) return true;
    return supplierItems.some(si => si.item_id === item.id);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando formulario...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-20">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/purchasing/orders"
          className="p-2 hover:bg-surface-raised rounded-xl border border-border transition-colors text-text-primary active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Nueva Orden de Compra</h1>
          <p className="text-xs text-text-secondary">Crea un borrador de orden de compra formal para enviar a autorización.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cabecera de la Orden */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold uppercase text-text-secondary tracking-wider flex items-center gap-1.5 border-b border-border pb-2.5">
            Datos del Documento
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Searchable Supplier Autocomplete */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-semibold text-text-primary flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-text-secondary" />
                Proveedor *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Escribe para buscar proveedor..."
                  value={supplierSearchQuery}
                  onFocus={() => setShowSupplierSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowSupplierSuggestions(false);
                    }, 220);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSupplierSearchQuery(val);
                    setShowSupplierSuggestions(true);
                    if (!val || supplierId) {
                      setSupplierId('');
                      setLines([]);
                      setActivePriceList(null);
                      setSupplierItems([]);
                    }
                  }}
                  className={`w-full bg-surface border border-border rounded-xl pr-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary transition-all font-semibold ${
                    supplierId ? 'pl-3' : 'pl-9'
                  }`}
                />
                {!supplierId && <Search className="absolute left-3 top-3.5 h-4 w-4 text-text-secondary" />}
              </div>

              {showSupplierSuggestions && (
                <div className="absolute z-[1000] w-full left-0 mt-1.5 bg-surface border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-border">
                  {suppliers
                    .filter(s => {
                      const q = supplierSearchQuery.toLowerCase();
                      return s.name.toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q);
                    })
                    .map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSupplierId(s.id);
                          setSupplierSearchQuery(s.name);
                          handleSupplierChange(s.id);
                          setShowSupplierSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface-raised transition-colors text-xs font-semibold text-text-primary flex flex-col gap-0.5"
                      >
                        <span className="font-bold text-text-primary">{s.name}</span>
                        <span className="text-[10px] text-text-secondary">Código: {s.code || '—'}</span>
                      </button>
                    ))}
                  {suppliers.filter(s => {
                    const q = supplierSearchQuery.toLowerCase();
                    return s.name.toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q);
                  }).length === 0 && (
                    <p className="p-3 text-xs text-text-secondary text-center italic">No se encontraron proveedores</p>
                  )}
                </div>
              )}
            </div>

            {/* Warehouse Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-text-secondary" />
                Almacén Destino *
              </label>
              <select
                required
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary cursor-pointer transition-all font-semibold"
              >
                <option value="" className="bg-surface text-text-primary">Selecciona un almacén...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id} className="bg-surface text-text-primary">{w.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-text-secondary" />
                Fecha Requerida *
              </label>
              <input
                type="date"
                required
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-text-secondary" />
                Fecha Prometida (Proveedor)
              </label>
              <input
                type="date"
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary">Días de Crédito</label>
              <input
                type="number"
                min="0"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                className="w-full bg-surface border border-border rounded-xl px-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary cursor-pointer transition-all font-semibold"
              >
                <option value="USD" className="bg-surface text-text-primary">USD ($)</option>
                <option value="VES" className="bg-surface text-text-primary">VES (Bs.)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Carga de Artículos */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold uppercase text-text-secondary tracking-wider border-b border-border pb-2.5">
            Agregar Artículos
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
            {/* Searchable Item Autocomplete (Span 2) */}
            <div className="space-y-1.5 sm:col-span-2 relative">
              <label className="text-xs font-semibold text-text-primary">Artículo</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={supplierId ? "Escribe para buscar artículo..." : "Selecciona un proveedor primero..."}
                  value={itemSearchQuery}
                  disabled={!supplierId}
                  onFocus={() => setShowItemSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowItemSuggestions(false);
                    }, 220);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItemSearchQuery(val);
                    setShowItemSuggestions(true);
                    if (!val || selectedItemId) {
                      setSelectedItemId('');
                      setSelectedPresentationId('');
                      setSelectedCost('0');
                      setSelectedItemBaseUom('unidad');
                    }
                  }}
                  className={`w-full bg-surface border border-border rounded-xl pr-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary transition-all font-semibold disabled:opacity-55 ${
                    selectedItemId ? 'pl-3' : 'pl-9'
                  }`}
                />
                {!selectedItemId && <Search className="absolute left-3 top-3.5 h-4 w-4 text-text-secondary" />}
              </div>

              {showItemSuggestions && supplierId && (
                <div className="absolute z-[1000] w-full left-0 mt-1.5 bg-surface border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-border">
                  {availableItems
                    .filter(item => {
                      const q = itemSearchQuery.toLowerCase();
                      return item.name.toLowerCase().includes(q) || (item.code || '').toLowerCase().includes(q);
                    })
                    .map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setItemSearchQuery(item.name);
                          setSelectedItemBaseUom(item.uom_name || 'unidad');
                          
                          // Pre-fill base cost from active supplier price list if it exists
                          let price = 0.0;
                          if (activePriceList) {
                            const plItem = activePriceList.items.find(pi => pi.item_id === item.id);
                            if (plItem) {
                              price = plItem.unit_cost_base;
                            }
                          }
                          setSelectedCost(price.toString());
                          setSelectedPresentationId(''); // Reset to base UOM

                          fetchItemPresentations(item.id); // Fetch presentations
                          setShowItemSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface-raised transition-colors text-xs font-semibold text-text-primary flex flex-col gap-0.5"
                      >
                        <span className="font-bold text-text-primary">{item.name}</span>
                        <span className="text-[10px] text-text-secondary">
                          U.M: {item.uom_name || 'unidad'} {item.code ? ` | Cód: ${item.code}` : ''}
                        </span>
                      </button>
                    ))}
                  {availableItems.filter(item => {
                    const q = itemSearchQuery.toLowerCase();
                    return item.name.toLowerCase().includes(q) || (item.code || '').toLowerCase().includes(q);
                  }).length === 0 && (
                    <p className="p-3 text-xs text-text-secondary text-center italic">No se encontraron artículos</p>
                  )}
                </div>
              )}
            </div>

            {/* Cantidad Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary">Cantidad</label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={selectedQty}
                onChange={(e) => setSelectedQty(e.target.value)}
                disabled={!selectedItemId}
                className="w-full bg-surface border border-border rounded-xl px-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary disabled:opacity-55 font-semibold"
              />
            </div>

            {/* Unidad Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary">Unidad</label>
              <select
                value={selectedPresentationId}
                onChange={(e) => handlePanelPresentationChange(e.target.value)}
                disabled={!selectedItemId}
                className="w-full bg-surface border border-border rounded-xl px-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary disabled:opacity-55 font-semibold cursor-pointer"
              >
                <option value="" className="bg-surface text-text-primary">{selectedItemBaseUom} (Base)</option>
                {(itemPresentations[selectedItemId] || []).map(p => (
                  <option key={p.id} value={p.id} className="bg-surface text-text-primary">{p.name}</option>
                ))}
              </select>
            </div>

            {/* Costo Unitario Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary">Costo Unit.</label>
              <div className="relative">
                <span className="absolute left-3 top-3.5 text-xs text-text-disabled font-semibold">$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={selectedCost}
                  onChange={(e) => setSelectedCost(e.target.value)}
                  disabled={!selectedItemId}
                  className="w-full bg-surface border border-border rounded-xl pl-6 pr-3 h-11 text-text-primary text-sm focus:outline-none focus:border-primary disabled:opacity-55 font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={handleAddLine}
              disabled={!selectedItemId || !supplierId}
              className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-5 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Agregar Artículo
            </button>
          </div>

          {/* Tabla de Líneas con Columna Unidad de Medida (Desplegable si hay presentaciones) */}
          {lines.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden mt-6 shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-raised/50 border-b border-border text-text-secondary text-xs font-bold uppercase">
                    <th className="py-3 px-4">Artículo</th>
                    <th className="py-3 px-4 w-24 text-right">Cantidad</th>
                    <th className="py-3 px-4 w-32 text-center">Unidad</th>
                    <th className="py-3 px-4 w-28 text-right">Costo Unit.</th>
                    <th className="py-3 px-4 w-28 text-right">Subtotal</th>
                    <th className="py-3 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, idx) => {
                    const isPres = !!line.presentation_id;
                    const qtyVal = isPres ? (line.qty_ordered_presentation || 0) : line.qty_ordered_base;
                    const costVal = isPres ? (line.unit_cost_presentation || 0) : line.unit_cost_base;

                    return (
                      <tr key={line.item_id} className="hover:bg-surface-raised/20 transition-colors">
                        <td className="py-3.5 px-4 text-text-primary font-semibold">
                          {line.item_name}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={qtyVal}
                            onChange={(e) => handleLineQtyChange(idx, Number(e.target.value))}
                            className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-right text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <select
                            value={line.presentation_id || ''}
                            onChange={(e) => handlePresentationChange(idx, e.target.value)}
                            className="bg-surface border border-border rounded-lg px-2 py-1 text-xs outline-none focus:border-primary text-text-primary font-semibold cursor-pointer max-w-[125px] w-full"
                          >
                            <option value="" className="bg-surface text-text-primary">{line.uom_name} (Base)</option>
                            {(itemPresentations[line.item_id] || []).map(p => (
                              <option key={p.id} value={p.id} className="bg-surface text-text-primary">{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-xs text-text-disabled font-semibold">$</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={costVal}
                              onChange={(e) => handleLineCostChange(idx, Number(e.target.value))}
                              className="w-24 bg-surface border border-border rounded-lg px-2 py-1 text-right text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary text-sm">
                          ${(line.qty_ordered_base * line.unit_cost_base).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-text-disabled hover:text-error active:scale-90 transition-transform p-1.5 rounded-lg hover:bg-error-light/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notas y Totales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="sm:col-span-2 bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-2">
            <label className="text-xs font-semibold text-text-primary">Notas / Instrucciones de Entrega</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Indica condiciones particulares, empaque o detalles para despacho..."
              rows={3}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-primary resize-none font-semibold"
            />
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-text-secondary">
                <span>Subtotal:</span>
                <span className="font-semibold text-text-primary">${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-text-secondary">
                <span>IVA:</span>
                <span className="font-semibold text-text-primary">${taxAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-border my-2 pt-2 flex justify-between text-sm font-bold text-text-primary">
                <span>Total:</span>
                <span>${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Link
                href="/admin/purchasing/orders"
                className="flex items-center justify-center bg-surface border border-border text-text-primary px-4 h-11 rounded-xl text-sm font-bold hover:bg-surface-raised transition-all active:scale-95 w-full text-center"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={submitting || lines.length === 0}
                className="flex items-center justify-center gap-2 bg-primary text-text-inverse px-4 h-11 rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 w-full"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Crear Borrador
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
