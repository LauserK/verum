'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, SupplierReturnResponse, SupplierInvoiceResponse } from '@/lib/api';
import { 
  ArrowLeft, Loader2, AlertCircle, FileText, Check, Calculator
} from 'lucide-react';

export default function NewCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: returnId } = use(params);

  const [ret, setRet] = useState<SupplierReturnResponse | null>(null);
  const [invoices, setInvoices] = useState<SupplierInvoiceResponse[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [cnNumber, setCnNumber] = useState('');
  const [cnDate, setCnDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

  // Tax settings per return line
  const [lineTaxes, setLineTaxes] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [returnData, taxesList] = await Promise.all([
          adminApi.getSupplierReturn(returnId),
          adminApi.getPurchasingTaxes()
        ]);

        setRet(returnData);
        setTaxes(taxesList || []);

        // Cargar impuestos iniciales de las líneas en base al tax_rate por defecto del artículo de la devolución
        const initialTaxes: Record<string, number> = {};
        returnData.lines.forEach((l) => {
          initialTaxes[l.id] = l.tax_rate !== undefined && l.tax_rate !== null ? l.tax_rate : 0.16;
        });
        setLineTaxes(initialTaxes);

        // Cargar facturas impagas del proveedor
        const unpaidInvoices = await adminApi.getSupplierInvoices({
          supplier_id: returnData.supplier_id,
          payment_status: 'unpaid'
        });
        setInvoices(unpaidInvoices || []);

      } catch (err) {
        console.error('Error fetching data for credit note:', err);
        setError('No se pudo cargar la información de la devolución u alícuotas.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [returnId]);

  const handleTaxChange = (lineId: string, taxRate: number) => {
    setLineTaxes(prev => ({
      ...prev,
      [lineId]: taxRate
    }));
  };

  const getCalculations = () => {
    if (!ret) return { subtotal: 0, taxAmount: 0, total: 0 };
    
    let subtotal = 0;
    let taxAmount = 0;

    ret.lines.forEach((line) => {
      const lineSubtotal = (line.qty_base || 0) * (line.unit_cost_base || 0);
      const taxRate = lineTaxes[line.id] || 0;
      subtotal += lineSubtotal;
      taxAmount += lineSubtotal * taxRate;
    });

    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = getCalculations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnNumber.trim()) {
      setError('Debes ingresar el número de la Nota de Crédito.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await adminApi.createCreditNote(returnId, {
        credit_note_number: cnNumber,
        amount: parseFloat(total.toFixed(2)),
        issue_date: cnDate,
        applied_to_invoice_id: selectedInvoiceId || null
      });

      router.push(`/admin/purchasing/returns/${returnId}`);
    } catch (err: any) {
      console.error('Error creating credit note:', err);
      setError(err?.message || 'Error al registrar la Nota de Crédito.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando devolución y alícuotas...</p>
      </div>
    );
  }

  if (error && !ret) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-text-primary">Error de Carga</h3>
        <p className="text-sm text-text-secondary">{error}</p>
        <button 
          onClick={() => router.back()} 
          className="bg-primary text-text-inverse px-4 py-2 rounded-xl text-sm font-bold"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-background-hover rounded-xl border border-border transition-colors text-text-primary active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Registrar Nota de Crédito
          </h1>
          <p className="text-xs text-text-secondary">Genera la nota de crédito mercantil asociada a la devolución {ret?.return_number}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-3 font-semibold text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {ret && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header Data Card */}
          <div className="bg-background-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase text-text-secondary tracking-wider">
              Datos Legales de la Nota de Crédito
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Número de Control / Nota de Crédito *</label>
                <input
                  type="text"
                  required
                  value={cnNumber}
                  onChange={(e) => setCnNumber(e.target.value)}
                  placeholder="Ej: NC-00021"
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Fecha de Emisión *</label>
                <input
                  type="date"
                  required
                  value={cnDate}
                  onChange={(e) => setCnDate(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Aplicar a Factura (Opcional)</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
                >
                  <option value="">No aplicar (Quedar saldo a favor)</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      Fact: #{inv.invoice_number} (Saldo: ${inv.total.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Lines Table Card */}
          <div className="bg-background-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase text-text-secondary tracking-wider">
              Desglose de Líneas y Tasas de IVA
            </h3>

            <div className="border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-raised/50 border-b border-border text-text-secondary text-xs font-bold uppercase">
                    <th className="py-3 px-4">Artículo</th>
                    <th className="py-3 px-4 text-center">Cant.</th>
                    <th className="py-3 px-4 text-right">Costo Unitario</th>
                    <th className="py-3 px-4 text-center w-48">Alícuota IVA</th>
                    <th className="py-3 px-4 text-right">Total Línea</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ret.lines.map((line) => {
                    const lineSub = (line.qty_base || 0) * (line.unit_cost_base || 0);
                    const currentTax = lineTaxes[line.id] || 0;
                    const lineTotalWithTax = lineSub * (1 + currentTax);

                    return (
                      <tr key={line.id} className="hover:bg-surface-raised/10 transition-colors">
                        <td className="py-4 px-4 font-semibold text-text-primary">
                          {line.item_name}
                        </td>
                        <td className="py-4 px-4 text-center font-mono text-text-secondary">
                          {line.qty_base} <span className="text-[10px] text-text-muted uppercase font-bold">{line.uom_name || 'uds'}</span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-text-secondary">
                          ${(line.unit_cost_base || 0).toFixed(2)}
                        </td>
                        <td className="py-4 px-4">
                          <select
                            value={currentTax}
                            onChange={(e) => handleTaxChange(line.id, parseFloat(e.target.value))}
                            className="w-full bg-surface border border-border rounded-xl px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary font-bold"
                          >
                            {taxes.map((t) => (
                              <option key={t.id} value={t.rate}>
                                {t.name} ({Math.round(t.rate * 100)}%)
                              </option>
                            ))}
                            {/* Fallback si la lista de impuestos falla */}
                            {taxes.length === 0 && (
                              <>
                                <option value="0.16">IVA General (16%)</option>
                                <option value="0.0">Exento</option>
                              </>
                            )}
                          </select>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-text-primary">
                          ${lineTotalWithTax.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations and Totals summary */}
            <div className="flex justify-end pt-4">
              <div className="w-72 bg-surface-raised/20 border border-border rounded-2xl p-4 space-y-2.5 text-sm">
                <div className="flex justify-between text-text-secondary font-medium">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono font-bold text-text-primary">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-text-secondary font-medium">
                  <span>Monto IVA:</span>
                  <span className="font-mono font-bold text-text-primary">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-black text-text-primary">
                  <span className="flex items-center gap-1"><Calculator className="h-4 w-4 text-primary" /> Total NC:</span>
                  <span className="font-mono text-lg text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

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
              disabled={submitting}
              className="flex items-center gap-2 bg-primary text-text-inverse px-6 h-12 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Registrar Nota de Crédito
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
