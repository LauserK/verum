'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { 
  ArrowLeft, Loader2, AlertCircle, ShoppingCart, 
  Check, RotateCcw, Info, Search, Calendar, User, FileText, X
} from 'lucide-react';

export default function NewSupplierReturnPage() {
  const router = useRouter();

  // Recepciones & Búsqueda
  const [receipts, setReceipts] = useState<any[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>('');
  const [selectedReceiptDoc, setSelectedReceiptDoc] = useState<any | null>(null);
  
  // Modal de búsqueda
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Vista previa dentro del modal
  const [previewReceiptId, setPreviewReceiptId] = useState<string | null>(null);
  const [previewDetails, setPreviewDetails] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Formulario principal
  const [globalReason, setGlobalReason] = useState<'damaged' | 'wrong_item' | 'excess_qty' | 'quality' | 'expired'>('damaged');
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<any[]>([]);

  // Estados de carga e interfaz
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const allDocs: any = await adminApi.getInventoryDocuments('receipt');
        const confirmedReceipts = allDocs.filter((doc: any) => doc.status === 'confirmed');
        setReceipts(confirmedReceipts);
      } catch (err) {
        console.error('Error loading receipts:', err);
        setError('No se pudieron cargar las recepciones.');
      } finally {
        setLoading(false);
      }
    };
    fetchReceipts();
  }, []);

  const handlePreviewSelect = async (receiptId: string) => {
    setPreviewReceiptId(receiptId);
    setLoadingPreview(true);
    try {
      const details = await adminApi.getInventoryDocument(receiptId);
      setPreviewDetails(details);
    } catch (err) {
      console.error('Error loading preview details:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmReceiptSelection = () => {
    if (!previewReceiptId || !previewDetails) return;

    const receiptId = previewReceiptId;
    const details = previewDetails;

    setSelectedReceiptId(receiptId);
    
    // Buscar la cabecera correspondiente
    const headerDoc = receipts.find(r => r.id === receiptId);
    setSelectedReceiptDoc(headerDoc || details.header || null);

    // Mapear líneas de la recepción
    const newLines = (details.lines || []).map((line: any) => ({
      item_id: line.item_id,
      item_name: line.item_name || 'Artículo desconocido',
      uom_name: line.items?.uom_base?.name || line.uom_presentations?.name || 'uds',
      qty_received: line.qty_base,
      qty_to_return: 0,
      unit_cost_base: line.unit_cost_base,
      lot_id: line.lot_id,
      reason: ''
    }));

    setLines(newLines);
    setShowSearchModal(false);

    // Limpiar temporales
    setSearchQuery('');
    setPreviewReceiptId(null);
    setPreviewDetails(null);
  };

  const handleLineQtyChange = (index: number, val: number) => {
    const updated = [...lines];
    updated[index].qty_to_return = Math.max(0, Math.min(val, updated[index].qty_received));
    setLines(updated);
  };

  const handleLineReasonChange = (index: number, val: string) => {
    const updated = [...lines];
    updated[index].reason = val;
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceiptId) {
      setError('Debes seleccionar una recepción.');
      return;
    }

    const returnLines = lines.filter(l => l.qty_to_return > 0).map(l => ({
      item_id: l.item_id,
      qty_base: l.qty_to_return,
      lot_id: l.lot_id || null,
      unit_cost_base: l.unit_cost_base || null,
      reason: l.reason || null
    }));

    if (returnLines.length === 0) {
      setError('Debes devolver al menos 1 artículo (cantidad mayor a 0).');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const receiptDetails = receipts.find(r => r.id === selectedReceiptId) || selectedReceiptDoc;
      const supplier_id = receiptDetails?.supplier_id;
      if (!supplier_id) throw new Error('La recepción no tiene proveedor asignado.');

      const payload = {
        receipt_id: selectedReceiptId,
        supplier_id: supplier_id,
        po_id: receiptDetails?.po_id || null,
        reason: globalReason,
        notes: notes || null,
        lines: returnLines
      };

      const res = await adminApi.createSupplierReturn(payload);
      router.push(`/admin/purchasing/returns/${res.id}`);
    } catch (err: any) {
      console.error('Error creating return:', err);
      setError(err?.message || 'Error al crear la devolución.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrado de recepciones para el modal de búsqueda
  const filteredReceipts = receipts.filter((r) => {
    const query = searchQuery.toLowerCase();
    const docIdShort = r.id.slice(0, 8).toLowerCase();
    const supplierName = (r.supplier_name || '').toLowerCase();
    const poNumber = (r.po_number || '').toLowerCase();
    return docIdShort.includes(query) || supplierName.includes(query) || poNumber.includes(query);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando recepciones...</p>
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
            <RotateCcw className="h-5 w-5 text-primary" /> Nueva Devolución
          </h1>
          <p className="text-xs text-text-secondary">Devuelve artículos desde una recepción confirmada</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-error-light border border-error/20 text-error rounded-2xl flex items-center gap-3 font-semibold text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-background-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider">
            Información General
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Input con Buscador en Modal */}
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-bold text-text-secondary uppercase">Recepción de Inventario *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  placeholder="Haga clic en la lupa para buscar recepción..."
                  value={
                    selectedReceiptDoc 
                      ? `Doc: #${selectedReceiptDoc.id.slice(0, 8)} - ${selectedReceiptDoc.supplier_name || 'Proveedor'} (${new Date(selectedReceiptDoc.created_at).toLocaleDateString()})`
                      : ''
                  }
                  onClick={() => setShowSearchModal(true)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none cursor-pointer font-semibold placeholder:text-text-muted truncate"
                />
                <button
                  type="button"
                  onClick={() => setShowSearchModal(true)}
                  className="p-2.5 bg-primary text-text-inverse rounded-xl hover:bg-primary-hover active:scale-95 transition-all flex items-center justify-center shrink-0 w-11 h-11"
                  title="Buscar recepción"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Razón Principal *</label>
              <select
                value={globalReason}
                onChange={(e) => setGlobalReason(e.target.value as any)}
                required
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary font-semibold"
              >
                <option value="damaged">Mercancía dañada</option>
                <option value="wrong_item">Artículo incorrecto</option>
                <option value="excess_qty">Exceso de cantidad</option>
                <option value="quality">Calidad deficiente</option>
                <option value="expired">Vencido</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-text-secondary uppercase">Notas (Opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-text-secondary tracking-wider flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Líneas a Devolver
          </h3>

          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border rounded-xl bg-surface-raised/10">
              <Info className="h-8 w-8 text-text-disabled" />
              <p className="text-xs text-text-disabled mt-2">Selecciona una Recepción mediante la lupa para cargar las líneas.</p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-raised/50 border-b border-border text-text-secondary text-xs font-bold uppercase">
                    <th className="py-3 px-4">Artículo</th>
                    <th className="py-3 px-4 text-center">Cant. Recibida</th>
                    <th className="py-3 px-4 text-center w-32">Cant. Devolver</th>
                    <th className="py-3 px-4 w-48">Razón Específica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-surface-raised/10 transition-colors">
                      <td className="py-4 px-4 font-semibold text-text-primary">
                        {line.item_name}
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-text-secondary">
                        {line.qty_received} <span className="text-[10px] text-text-muted uppercase font-bold">{line.uom_name}</span>
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={line.qty_received}
                          value={line.qty_to_return || ''}
                          onChange={(e) => handleLineQtyChange(idx, parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface border border-border rounded-xl px-2.5 py-1.5 text-center font-mono text-text-primary focus:outline-none focus:border-primary font-bold text-sm"
                        />
                      </td>
                      <td className="py-4 px-4">
                        <select
                          value={line.reason}
                          onChange={(e) => handleLineReasonChange(idx, e.target.value)}
                          className="w-full bg-surface border border-border rounded-xl px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
                        >
                          <option value="">Igual a la principal</option>
                          <option value="damaged">Mercancía dañada</option>
                          <option value="wrong_item">Artículo incorrecto</option>
                          <option value="excess_qty">Exceso de cantidad</option>
                          <option value="quality">Calidad deficiente</option>
                          <option value="expired">Vencido</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
            disabled={submitting || lines.length === 0}
            className="flex items-center gap-2 bg-primary text-text-inverse px-6 h-12 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Crear Devolución
          </button>
        </div>
      </form>

      {/* Modal interactivo de búsqueda de recepciones */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-raised/20 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" /> Buscar Recepción de Inventario
                </h3>
                <p className="text-xs text-text-secondary">Escribe el folio, orden de compra o proveedor para filtrar en tiempo real</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchQuery('');
                  setPreviewReceiptId(null);
                  setPreviewDetails(null);
                }}
                className="p-1.5 hover:bg-background-hover rounded-xl text-text-secondary hover:text-text-primary active:scale-95 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Caja de Búsqueda */}
            <div className="p-4 border-b border-border bg-surface shrink-0">
              <div className="flex items-center bg-background-input border border-border rounded-xl px-3.5 py-2.5 gap-2.5">
                <Search className="h-5 w-5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Escribe el folio (ej: 849425ad), proveedor o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-text-primary focus:outline-none placeholder-text-muted font-medium"
                />
              </div>
            </div>

            {/* Split layout: Listado vs Vista Previa */}
            <div className="flex-1 flex min-h-0 divide-x divide-border">
              {/* Panel Izquierdo: Lista de Recepciones */}
              <div className="w-1/2 overflow-y-auto p-4 space-y-2 bg-surface-raised/5">
                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-3">
                  Resultados Encontrados ({filteredReceipts.length})
                </h4>
                
                {filteredReceipts.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <Info className="h-8 w-8 text-text-disabled mx-auto" />
                    <p className="text-xs text-text-disabled font-medium">No se encontraron recepciones confirmadas.</p>
                  </div>
                ) : (
                  filteredReceipts.map((r) => {
                    const isSelected = previewReceiptId === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => handlePreviewSelect(r.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                          isSelected
                            ? 'bg-primary-light/10 border-primary shadow-sm'
                            : 'bg-surface border-border hover:bg-background-hover'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                            #{r.id.slice(0, 8)}
                          </span>
                          <span className="text-[10px] text-text-muted flex items-center gap-1 font-semibold">
                            <Calendar className="h-3 w-3" /> {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-text-secondary" /> {r.supplier_name || 'Proveedor sin nombre'}
                          </p>
                          {r.po_number && (
                            <p className="text-[10px] text-text-secondary flex items-center gap-1.5 font-semibold">
                              <FileText className="h-3 w-3 text-text-secondary" /> Orden: {r.po_number}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Panel Derecho: Vista Previa */}
              <div className="w-1/2 flex flex-col overflow-y-auto p-4 bg-surface">
                {!previewReceiptId ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <Info className="h-8 w-8 text-text-disabled" />
                    <h5 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Vista Previa</h5>
                    <p className="text-xs text-text-disabled max-w-xs">Selecciona una recepción del panel izquierdo para previsualizar sus artículos y detalles antes de cargarla.</p>
                  </div>
                ) : loadingPreview ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-text-secondary font-medium">Cargando detalles de recepción...</p>
                  </div>
                ) : previewDetails ? (
                  <div className="flex-1 flex flex-col justify-between h-full">
                    <div className="space-y-4">
                      {/* Cabecera de la vista previa */}
                      <div className="p-3 bg-surface-raised border border-border rounded-xl space-y-2">
                        <h4 className="text-xs font-bold text-text-primary">Resumen de Recepción</h4>
                        <div className="text-xs space-y-1.5 text-text-secondary font-medium">
                          <p className="flex items-center justify-between">
                            <span>Folio Completo:</span>
                            <span className="font-mono font-bold text-text-primary text-[11px]">{previewDetails.header?.id}</span>
                          </p>
                          <p className="flex items-center justify-between">
                            <span>Proveedor:</span>
                            <span className="font-bold text-text-primary">{previewDetails.header?.supplier_name || '—'}</span>
                          </p>
                          {previewDetails.header?.po_number && (
                            <p className="flex items-center justify-between">
                              <span>Orden de Compra:</span>
                              <span className="font-bold text-text-primary">{previewDetails.header?.po_number}</span>
                            </p>
                          )}
                          <p className="flex items-center justify-between">
                            <span>Bodega Destino:</span>
                            <span className="font-bold text-text-primary">{previewDetails.header?.warehouse?.name || '—'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Tabla de artículos en la vista previa */}
                      <div className="space-y-1.5">
                        <h5 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Artículos Recibidos</h5>
                        <div className="border border-border rounded-xl overflow-hidden shadow-sm max-h-[25vh] overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-surface-raised/50 border-b border-border text-text-secondary font-bold">
                                <th className="py-2 px-3">Artículo</th>
                                <th className="py-2 px-3 text-center">Cant.</th>
                                <th className="py-2 px-3 text-right">Costo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border font-medium">
                              {(previewDetails.lines || []).map((l: any, index: number) => (
                                <tr key={index} className="hover:bg-surface-raised/5">
                                  <td className="py-2 px-3 text-text-primary font-semibold">{l.item_name}</td>
                                  <td className="py-2 px-3 text-center font-mono text-text-secondary">{l.qty_base} <span className="text-[9px] text-text-muted">{l.items?.uom_base?.name || 'uds'}</span></td>
                                  <td className="py-2 px-3 text-right font-mono text-text-secondary">${(l.unit_cost_base || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Botón de Confirmación */}
                    <div className="pt-6 border-t border-border mt-auto">
                      <button
                        type="button"
                        onClick={handleConfirmReceiptSelection}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-text-inverse py-3 rounded-xl text-sm font-bold hover:bg-primary-hover active:scale-95 transition-all shadow-md"
                      >
                        <Check className="h-4 w-4" /> Seleccionar esta Recepción
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-6 text-error">
                    No se pudieron cargar los detalles.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
