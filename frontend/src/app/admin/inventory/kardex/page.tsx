'use client';

import { useState, useEffect, useRef } from 'react';
import { adminApi, StockMovement, InventoryItem, Warehouse } from '@/lib/api';
import { Loader2, ArrowLeft, Printer, ArrowUpRight, ArrowDownRight, History } from 'lucide-react';
import Link from 'next/link';
import { useReactToPrint } from 'react-to-print';
import { MovementPrint } from '@/components/inventory/MovementPrint';
import MovementDetailModal from '@/components/inventory/MovementDetailModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useTranslations } from '@/components/I18nProvider';

export default function KardexPage() {
  const { t } = useTranslations('inventory.items');
  const tMov = useTranslations('inventory.movements');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [filters, setFilters] = useState({ item_id: '', warehouse_id: '' });

  // Modal detail state
  const [showDetail, setShowDetail] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ''
  });

  // Printing state
  const printRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<any>(null);
  
  const handlePrintTrigger = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Documento-${printData?.receiptNumber || 'Ref'}`,
    onAfterPrint: () => {
        setPrintData(null);
    }
  });

  useEffect(() => {
    if (printData && printRef.current) {
        handlePrintTrigger();
    }
  }, [printData]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [filters]);

  async function loadInitialData() {
    try {
      const [itemsData, whData] = await Promise.all([
        adminApi.getInventoryItems(),
        adminApi.getInventoryWarehouses()
      ]);
      setItems(itemsData);
      setWarehouses(whData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  async function loadMovements() {
    setLoading(true);
    try {
      const data = await adminApi.getKardex(filters);
      setMovements(data);
    } catch (error) {
      console.error('Error loading movements:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMovementDetail(movement: StockMovement) {
    if (!movement.reference_id) return null;
    
    try {
        if (movement.reference_type === 'purchase_receipt') {
            const detail = await adminApi.getPurchaseReceipt(movement.reference_id);
            return {
                type: 'receipt',
                id: detail.header.id,
                warehouseName: detail.header.warehouses?.name || 'Almacén',
                supplier: detail.header.supplier,
                receiptNumber: detail.header.receipt_number,
                createdAt: detail.header.confirmed_at || detail.header.created_at,
                date: detail.header.date,
                notes: detail.header.notes,
                lines: detail.lines.map((l: any) => ({
                    itemName: l.items?.name || 'Artículo',
                    qty: l.qty_presentation,
                    uom: l.uom_presentations?.name || 'Unidad',
                    cost: l.unit_cost_base * (l.qty_base / l.qty_presentation),
                    lot: l.lot_number
                }))
            };
        } else {
            const lines = await adminApi.getMovementsByReference(movement.reference_id);
            if (lines.length > 0) {
                const first = lines[0];
                return {
                    type: 'issue',
                    id: movement.reference_id,
                    warehouseName: (first as any).warehouses?.name || 'Almacén',
                    reason: movement.movement_type === 'sale' ? 'Venta' : 'Ajuste / Salida',
                    notes: movement.notes,
                    createdAt: movement.created_at,
                    lines: lines.map(l => ({
                        itemName: (l as any).items?.name || 'Artículo',
                        qty: Math.abs(l.qty_base),
                        uom: 'Unidad Base',
                        lot: (l as any).stock_lots?.lot_number
                    }))
                };
            }
        }
    } catch (error: any) {
        console.error('Detail fetch error:', error);
        throw error;
    }
    return null;
  }

  async function handleShowDetail(movement: StockMovement) {
    setFetchingDetail(true);
    try {
        const detail = await fetchMovementDetail(movement);
        if (detail) {
            setSelectedDetail(detail);
            setShowDetail(true);
        }
    } catch (error: any) {
        setErrorModal({
            isOpen: true,
            message: `No se pudo obtener el detalle del documento: ${error.message}`
        });
    } finally {
        setFetchingDetail(false);
    }
  }

  async function handlePrintFromModal() {
    setPrintData(selectedDetail);
    setShowDetail(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <Link href="/admin/inventory" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </Link>
            <div>
                <h1 className="text-2xl font-bold text-text-primary">Kardex de Inventario</h1>
                <p className="text-sm text-text-secondary mt-1">Historial detallado de movimientos por lote (PEPS)</p>
            </div>
        </div>
        <div className="flex gap-2">
            <Link 
                href="/admin/inventory/movements/receipts"
                className="flex items-center gap-2 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
            >
                <ArrowUpRight className="w-4 h-4 text-success" />
                Registrar Ingreso
            </Link>
            <Link 
                href="/admin/inventory/movements/issues"
                className="flex items-center gap-2 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-all"
            >
                <ArrowDownRight className="w-4 h-4 text-error" />
                Registrar Egreso
            </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 ml-1">Filtrar por Artículo</label>
              <select 
                value={filters.item_id}
                onChange={e => setFilters({...filters, item_id: e.target.value})}
                className="w-full bg-surface-raised border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary"
              >
                  <option value="">Todos los artículos</option>
                  {items.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
              </select>
          </div>
          <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 ml-1">Filtrar por Almacén</label>
              <select 
                value={filters.warehouse_id}
                onChange={e => setFilters({...filters, warehouse_id: e.target.value})}
                className="w-full bg-surface-raised border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary"
              >
                  <option value="">Todos los almacenes</option>
                  {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
              </select>
          </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border">
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Fecha</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Tipo</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest">Almacén / Artículo</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">Cantidad</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">Total</th>
                <th className="p-4 text-xs font-bold text-text-secondary uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                  <tr>
                      <td colSpan={6} className="p-12 text-center">
                          <Loader2 className="animate-spin w-8 h-8 text-primary mx-auto mb-2" />
                          <p className="text-text-secondary text-sm">Cargando movimientos...</p>
                      </td>
                  </tr>
              ) : movements.map(m => (
                <tr key={m.id} className="hover:bg-surface-raised transition-colors group">
                  <td className="p-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-text-primary">
                          {new Date(m.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-text-secondary">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                  </td>
                  <td className="p-4">
                      <div className="flex items-center gap-2">
                        {m.qty_base > 0 ? (
                            <ArrowUpRight className="w-3 h-3 text-success" />
                        ) : (
                            <ArrowDownRight className="w-3 h-3 text-error" />
                        )}
                        <span className={`text-xs font-bold ${m.qty_base > 0 ? 'text-success' : 'text-error'}`}>
                            {tMov.t(m.movement_type)}
                        </span>
                      </div>
                  </td>
                  <td className="p-4">
                      <p className="text-sm font-bold text-text-primary">
                          {items.find(i => i.id === m.item_id)?.name || 'Artículo'}
                      </p>
                      <p className="text-[10px] text-text-secondary uppercase">
                          {warehouses.find(w => w.id === m.warehouse_id)?.name || 'Almacén'}
                      </p>
                  </td>
                  <td className="p-4 text-right">
                      <span className={`text-sm font-mono font-bold ${m.qty_base > 0 ? 'text-text-primary' : 'text-text-primary'}`}>
                          {m.qty_base > 0 ? '+' : ''}{m.qty_base.toFixed(2)}
                      </span>
                  </td>
                  <td className="p-4 text-right">
                      <span className="text-sm font-bold text-text-primary font-mono">
                          ${Math.abs(m.total_cost || 0).toFixed(2)}
                      </span>
                  </td>
                  <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {m.reference_id && (
                          <>
                            <button 
                                onClick={() => handleShowDetail(m)}
                                disabled={fetchingDetail}
                                className="p-2 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                title="Ver detalle del documento"
                            >
                                {fetchingDetail && selectedDetail?.id === m.reference_id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <History className="w-4 h-4" />
                                )}
                            </button>
                            <button 
                                onClick={() => {
                                    handleShowDetail(m).then(() => {
                                        // We can't easily chain here without refs or state, 
                                        // so we rely on the modal's print button if needed or just handleRePrint
                                    })
                                    handleRePrint(m)
                                }}
                                className="p-2 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                title="Re-imprimir comprobante original"
                            >
                                <Printer className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                  </td>
                </tr>
              ))}
              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                      <History className="w-12 h-12 text-text-disabled mx-auto mb-4" />
                      <p className="text-text-secondary font-medium">No se han encontrado movimientos para los filtros aplicados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <MovementDetailModal 
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        data={selectedDetail}
      />

      {/* Hidden print container */}
      <div className="hidden">
        {printData && (
          <MovementPrint 
            ref={printRef}
            type={printData.type}
            data={printData}
          />
        )}
      </div>

      <ConfirmationModal 
        isOpen={errorModal.isOpen}
        title="Error al imprimir"
        message={errorModal.message}
        confirmLabel="Entendido"
        cancelLabel=""
        onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
        onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
      />
    </div>
  );
}
