// frontend/src/app/admin/purchasing/invoices/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi, PurchaseOrderResponse, SupplierResponse, InventoryItem } from '@/lib/api';
import { 
  ArrowLeft, Loader2, AlertCircle, ShoppingCart, Calendar, 
  Building2, User, Check, Plus, FileSpreadsheet, Percent, Info
} from 'lucide-react';
import Link from 'next/link';

interface InvoiceLineState {
  po_line_id: string;
  item_id: string;
  item_name: string;
  uom_name: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost_ordered: number;
  qty_invoiced: number;
  unit_cost_invoiced: number;
  line_total: number;
}

export default function NewSupplierInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poIdFromParam = searchParams.get('po_id');

  // Master lists
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderResponse[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [itemTaxRates, setItemTaxRates] = useState<Record<string, number>>({});

  // Selected entities
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>('');

  // Invoice header form
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');

  // Lines state
  const [lines, setLines] = useState<InvoiceLineState[]>([]);

  // Auto-calculated totals
  const [subtotal, setSubtotal] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingPO, setLoadingPO] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initial load of suppliers & purchase orders
  useEffect(() => {
    const fetchMasterData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [suppliersData, posData, itemsData] = await Promise.all([
          adminApi.getSuppliers(),
          adminApi.getPurchaseOrders(),
          adminApi.getInventoryItems()
        ]);
        
        // Filter POs to show only sent, partially_received, or received
        const eligiblePOs = posData.filter(p => 
          ['sent', 'partially_received', 'received'].includes(p.status)
        );
        
        setSuppliers(suppliersData);
        setPurchaseOrders(eligiblePOs);

        const taxMap: Record<string, number> = {};
        (itemsData || []).forEach((item: any) => {
          taxMap[item.id] = item.tax_rate ?? 0.0;
        });
        setItemTaxRates(taxMap);

        // If po_id was passed, pre-populate
        if (poIdFromParam) {
          const poDetails = posData.find(p => p.id === poIdFromParam);
          if (poDetails) {
            setSelectedSupplierId(poDetails.supplier_id);
            setSelectedPoId(poDetails.id);
          }
        }
      } catch (err) {
        console.error('Error loading master data:', err);
        setError('No se pudo cargar la información de proveedores u órdenes de compra.');
      } finally {
        setLoading(false);
      }
    };
    fetchMasterData();
  }, [poIdFromParam]);

  // When PO changes, fetch linked receipts and PO lines
  useEffect(() => {
    const handlePoChange = async () => {
      if (!selectedPoId) {
        setLines([]);
        setReceipts([]);
        setSelectedReceiptId('');
        return;
      }

      setLoadingPO(true);
      setError(null);
      try {
        // Fetch detailed PO to get lines
        const poDetails = await adminApi.getPurchaseOrder(selectedPoId);
        
        // Fetch receipts to filter linked ones
        const allDocs: any = await adminApi.getInventoryDocuments('receipt');
        const poReceipts = allDocs.filter((doc: any) => doc.po_id === selectedPoId && doc.status === 'confirmed');
        setReceipts(poReceipts);

        // Pre-select first receipt if available
        let chosenReceiptId = '';
        let receiptLinesMap: Record<string, number> = {};

        if (poReceipts.length > 0) {
          chosenReceiptId = poReceipts[0].id;
          setSelectedReceiptId(chosenReceiptId);
          
          // Get detailed receipt to map line quantities
          const receiptDetails: any = await adminApi.getInventoryDocument(chosenReceiptId);
          if (receiptDetails && receiptDetails.lines) {
            receiptDetails.lines.forEach((rl: any) => {
              if (rl.po_line_id) {
                receiptLinesMap[rl.po_line_id] = (receiptLinesMap[rl.po_line_id] || 0) + rl.qty_base;
              }
            });
          }
        } else {
          setSelectedReceiptId('');
        }

        // Initialize lines
        const initialLines = poDetails.lines.map(line => {
          const qty_received = receiptLinesMap[line.id] || line.qty_received_base || 0;
          return {
            po_line_id: line.id,
            item_id: line.item_id,
            item_name: line.item_name || 'Artículo sin nombre',
            uom_name: line.uom_name || 'und',
            qty_ordered: line.qty_ordered_base,
            qty_received: qty_received,
            unit_cost_ordered: line.unit_cost_base,
            // Defaults quantity invoiced to quantity received, fallback to ordered
            qty_invoiced: qty_received > 0 ? qty_received : line.qty_ordered_base,
            unit_cost_invoiced: line.unit_cost_base,
            line_total: Math.round(((qty_received > 0 ? qty_received : line.qty_ordered_base) * line.unit_cost_base) * 100) / 100
          };
        });

        setLines(initialLines);
      } catch (err) {
        console.error('Error loading PO details:', err);
        setError('No se pudieron obtener los detalles de la orden de compra seleccionada.');
      } finally {
        setLoadingPO(false);
      }
    };
    handlePoChange();
  }, [selectedPoId]);

  // Handle selected receipt change
  const handleReceiptChange = async (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    if (!receiptId) {
      // Clear receipt quantities from lines
      const resetLines = lines.map(line => ({
        ...line,
        qty_received: 0,
        qty_invoiced: line.qty_ordered,
        line_total: Math.round((line.qty_ordered * line.unit_cost_invoiced) * 100) / 100
      }));
      setLines(resetLines);
      return;
    }

    setLoadingPO(true);
    try {
      const receiptDetails: any = await adminApi.getInventoryDocument(receiptId);
      const receiptLinesMap: Record<string, number> = {};
      
      if (receiptDetails && receiptDetails.lines) {
        receiptDetails.lines.forEach((rl: any) => {
          if (rl.po_line_id) {
            receiptLinesMap[rl.po_line_id] = (receiptLinesMap[rl.po_line_id] || 0) + rl.qty_base;
          }
        });
      }

      const updatedLines = lines.map(line => {
        const qty_received = receiptLinesMap[line.po_line_id] || 0;
        return {
          ...line,
          qty_received: qty_received,
          qty_invoiced: qty_received > 0 ? qty_received : line.qty_ordered,
          line_total: Math.round(((qty_received > 0 ? qty_received : line.qty_ordered) * line.unit_cost_invoiced) * 100) / 100
        };
      });
      setLines(updatedLines);
    } catch (err) {
      console.error('Error loading receipt details:', err);
      setError('No se pudo cargar el detalle del documento de recepción.');
    } finally {
      setLoadingPO(false);
    }
  };

  // Recalculate totals whenever lines change
  useEffect(() => {
    const sub = lines.reduce((acc, line) => acc + line.line_total, 0);
    const roundedSub = Math.round(sub * 100) / 100;
    const tax = lines.reduce((acc, line) => {
      const rate = itemTaxRates[line.item_id] ?? 0.0;
      return acc + (line.line_total * rate);
    }, 0);
    const roundedTax = Math.round(tax * 100) / 100;
    setSubtotal(roundedSub);
    setTaxAmount(roundedTax);
    setTotal(Math.round((roundedSub + roundedTax) * 100) / 100);
  }, [lines, itemTaxRates]);

  const handleLineQtyChange = (index: number, val: number) => {
    const updated = [...lines];
    const qty = Math.max(0, val);
    updated[index].qty_invoiced = qty;
    updated[index].line_total = Math.round((qty * updated[index].unit_cost_invoiced) * 100) / 100;
    setLines(updated);
  };

  const handleLineCostChange = (index: number, val: number) => {
    const updated = [...lines];
    const cost = Math.max(0, val);
    updated[index].unit_cost_invoiced = cost;
    updated[index].line_total = Math.round((updated[index].qty_invoiced * cost) * 100) / 100;
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      setError('Debes seleccionar un proveedor.');
      return;
    }
    if (!invoiceNumber.trim()) {
      setError('Debes ingresar el número de factura.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        supplier_id: selectedSupplierId,
        po_id: selectedPoId || null,
        receipt_id: selectedReceiptId || null,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        currency: 'USD',
        subtotal: subtotal,
        tax_amount: taxAmount,
        total: total,
        pdf_url: pdfUrl || null,
        lines: lines.map(l => ({
          po_line_id: l.po_line_id || null,
          item_id: l.item_id,
          qty_invoiced_base: l.qty_invoiced,
          unit_cost_base: l.unit_cost_invoiced,
          line_total: l.line_total
        }))
      };

      const res = await adminApi.createSupplierInvoice(payload);
      setSuccess(true);
      setTimeout(() => {
        router.push(`/admin/purchasing/invoices/${res.id}`);
      }, 1500);
    } catch (err: any) {
      console.error('Error creating supplier invoice:', err);
      const errMsg = err?.detail || err?.message || 'Error al guardar la factura del proveedor.';
      setError(errMsg);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando pantallas de factura...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-24">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-background-hover rounded-xl border border-border transition-colors text-text-primary active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Registrar Factura de Proveedor
          </h1>
          <p className="text-xs text-text-secondary">Ingresa los datos para realizar la conciliación de tres vías (3-Way Matching)</p>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-success-light border border-success/20 text-success rounded-2xl flex items-center gap-3 font-semibold text-sm">
          <Check className="h-5 w-5" />
          <span>¡Factura registrada y conciliada con éxito! Redirigiendo al detalle...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-error-light border border-error/20 text-error rounded-2xl flex items-center gap-3 font-semibold text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: PO & Receipt selection */}
        <div className="bg-background-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider">
            Vínculo Comercial
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Supplier Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Proveedor *</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  // Reset PO when supplier changes if not linking param
                  setSelectedPoId('');
                }}
                disabled={!!poIdFromParam}
                required
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
              >
                <option value="">Selecciona Proveedor</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* PO Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Orden de Compra</label>
              <select
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                disabled={!!poIdFromParam}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
              >
                <option value="">Sin Asignar (Factura Directa)</option>
                {purchaseOrders
                  .filter(p => !selectedSupplierId || p.supplier_id === selectedSupplierId)
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.po_number} ({p.supplier_name})</option>
                  ))
                }
              </select>
            </div>

            {/* Warehouse Receipt Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Recepción de Inventario</label>
              <select
                value={selectedReceiptId}
                onChange={(e) => handleReceiptChange(e.target.value)}
                disabled={!selectedPoId}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
              >
                <option value="">Sin Recepción (Conciliación 2 vías)</option>
                {receipts.map(r => (
                  <option key={r.id} value={r.id}>
                    Doc: #{r.id.slice(0,8)} ({new Date(r.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Invoice Metadata */}
        <div className="bg-background-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider">
            Datos de la Factura
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Invoice Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Número de Factura *</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="FAC-12345"
                required
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-mono font-bold"
              />
            </div>

            {/* Invoice Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Fecha de Facturación *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold font-mono"
              />
            </div>

            {/* Due Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Fecha de Vencimiento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold font-mono"
              />
            </div>

            {/* PDF URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">URL Documento PDF</label>
              <input
                type="url"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Lines details */}
        <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Desglose de Líneas de Factura
            </h3>
            {loadingPO && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>

          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border rounded-xl bg-surface-raised/10">
              <Info className="h-8 w-8 text-text-disabled" />
              <p className="text-xs text-text-disabled mt-2">Selecciona una Orden de Compra para cargar las líneas del desglose.</p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-raised/50 border-b border-border text-text-secondary text-xs font-bold uppercase">
                    <th className="py-3 px-4">Artículo</th>
                    <th className="py-3 px-4 text-center">Cant. PO</th>
                    <th className="py-3 px-4 text-center">Cant. Recibida</th>
                    <th className="py-3 px-4 text-center w-28">Cant. Facturada</th>
                    <th className="py-3 px-4 text-right">Costo PO</th>
                    <th className="py-3 px-4 text-right w-32">Costo Facturado</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, idx) => (
                    <tr key={line.po_line_id} className="hover:bg-surface-raised/10 transition-colors">
                      <td className="py-4 px-4 font-semibold text-text-primary">
                        {line.item_name}
                        <span className="block text-[10px] text-text-secondary uppercase mt-0.5 font-bold">Unidad: {line.uom_name}</span>
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-text-secondary">
                        {line.qty_ordered}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-success font-semibold">
                        {line.qty_received}
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={line.qty_invoiced}
                          onChange={(e) => handleLineQtyChange(idx, parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-center font-mono text-text-primary focus:outline-none focus:border-primary font-bold text-sm"
                        />
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-text-secondary">
                        ${line.unit_cost_ordered.toFixed(2)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-xs text-text-secondary font-bold">$</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={line.unit_cost_invoiced}
                            onChange={(e) => handleLineCostChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-full bg-surface border border-border rounded-xl pl-6 pr-2.5 py-1.5 text-right font-mono text-text-primary focus:outline-none focus:border-primary font-bold text-sm"
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-text-primary">
                        ${line.line_total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col items-end gap-1.5 pt-4 border-t border-border">
            <div className="flex justify-between w-full max-w-[260px] text-xs text-text-secondary">
              <span>Subtotal Factura:</span>
              <span className="font-semibold text-text-primary">${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between w-full max-w-[260px] text-xs text-text-secondary">
              <span>Impuesto (IVA 16%):</span>
              <span className="font-semibold text-text-primary">${taxAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between w-full max-w-[260px] text-base font-bold text-text-primary border-t border-border/50 pt-2">
              <span>Total Facturado:</span>
              <span>${total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-error-light border border-error/20 text-error rounded-2xl flex items-center gap-3 font-semibold text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center bg-surface border border-border text-text-primary px-6 h-12 rounded-xl text-sm font-bold hover:bg-surface-raised active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || success || lines.length === 0}
            className="flex items-center gap-2 bg-primary text-text-inverse px-6 h-12 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Procesando Conciliación...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Registrar Factura y Conciliar
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
