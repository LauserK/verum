'use client';

import { useState, useEffect, useRef } from 'react';
import { adminApi, StockMovement, InventoryItem, Warehouse } from '@/lib/api';
import { Loader2, ArrowLeft, Printer, ArrowUpRight, ArrowDownRight, History, Search } from 'lucide-react';
import Link from 'next/link';
import { useReactToPrint } from 'react-to-print';
import { MovementPrint } from '@/components/inventory/MovementPrint';
import MovementDetailModal from '@/components/inventory/MovementDetailModal';
import DocumentsHistoryModal from '@/components/inventory/DocumentsHistoryModal';
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

  // Modal history state
  const [showHistory, setShowHistory] = useState(false);

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

  async function fetchMovementDetail(movement: any) {
    const referenceId = movement.reference_id || movement.id;
    const referenceType = movement.reference_type || (movement.type === 'receipt' ? 'purchase_receipt' : 'issue_document');
    
    try {
        if (referenceType === 'purchase_receipt') {
            const detail = await adminApi.getPurchaseReceipt(referenceId);
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
            const lines = await adminApi.getMovementsByReference(referenceId);
            if (lines.length > 0) {
                const first = lines[0];
                return {
                    type: 'issue',
                    id: referenceId,
                    warehouseName: (first as any).warehouses?.name || 'Almacén',
                    reason: (movement.reason) || (movement.movement_type === 'sale' ? 'Venta' : 'Ajuste / Salida'),
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

  async function handleShowDetail(movement: any) {
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/inventory" className="p-2 hover:bg-surface-raised rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Kardex de Inventario</h1>
            <p className="text-sm text-text-secondary">Historial detallado de movimientos por lote (PEPS)</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowHistory(true)}
            className="px-5 h-11 bg-surface-raised border border-border text-text-primary rounded-xl font-bold text-sm hover:bg-surface transition-all flex items-center gap-2"
          >
            <History className="w-4 h-4 text-primary" />
            Ver Historial Documentos
          </button>
          <Link 
            href="/admin/inventory/movements/receipts"
            className="px-5 h-11 border border-primary text-primary rounded-xl font-bold text-sm hover:bg-primary/5 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Registrar Ingreso
          </Link>
          <Link 
            href="/admin/inventory/movements/issues"
            className="px-5 h-11 bg-primary text-text-inverse rounded-xl font-bold text-sm hover:bg-primary-hover transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <ArrowDownRight className="w-4 h-4" />
            Registrar Egreso
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1">Artículo</label>
            <select 
              value={filters.item_id}
              onChange={e => setFilters({ ...filters, item_id: e.target.value })}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary appearance-none cursor-pointer"
            >
              <option value="">Todos los artículos</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1">Almacén</label>
            <select 
              value={filters.warehouse_id}
              onChange={e => setFilters({ ...filters, warehouse_id: e.target.value })}
              className="w-full bg-surface border border-border rounded-xl px-4 h-11 text-sm text-text-primary outline-none focus:border-primary appearance-none cursor-pointer"
            >
              <option value="">Todos los almacenes</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border">
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Fecha / Hora</th>
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Tipo</th>
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Artículo</th>
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Almacén</th>
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right">Cant. (Base)</th>
                <th className="p-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest">Referencia / Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center"><Loader2 className="animate-spin w-8 h-8 text-primary mx-auto" /></td>
                </tr>
              ) : movements.map((m) => (
                <tr key={m.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="p-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-text-primary">
                        {new Date(m.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-text-secondary uppercase">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                  </td>
                  <td className="p-4">
                      <div className="flex items-center gap-2">
                        {m.qty_base > 0 ? (
                          <ArrowUpRight className="w-4 h-4 text-success" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-error" />
                        )}
                        <span className={`text-xs font-bold uppercase ${m.qty_base > 0 ? 'text-success' : 'text-error'}`}>
                          {tMov.t(m.movement_type)}
                        </span>
                      </div>
                  </td>
                  <td className="p-4">
                      <p className="text-sm font-bold text-text-primary">
                        {items.find(i => i.id === m.item_id)?.name || 'Artículo'}
                      </p>
                      <p className="text-[10px] text-text-secondary uppercase">
                        {items.find(i => i.id === m.item_id)?.code || '---'}
                      </p>
                  </td>
                  <td className="p-4">
                      <p className="text-sm font-medium text-text-primary">
                        {warehouses.find(w => w.id === m.warehouse_id)?.name || 'Almacén'}
                      </p>
                  </td>
                  <td className={`p-4 text-sm font-mono font-bold text-right ${m.qty_base > 0 ? 'text-text-primary' : 'text-text-primary'}`}>
                      {m.qty_base > 0 ? '+' : ''}{m.qty_base.toFixed(2)}
                  </td>
                  <td className="p-4">
                      <p className="text-xs text-text-primary font-medium">{m.notes || '---'}</p>
                      <p className="text-[10px] text-text-secondary font-mono truncate max-w-[120px]">REF: {m.reference_id?.slice(0, 8) || '---'}</p>
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

      {/* History Modal */}
      <DocumentsHistoryModal 
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onViewDetail={handleShowDetail}
      />

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
        title="Error"
        message={errorModal.message}
        confirmLabel="Entendido"
        cancelLabel=""
        onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
        onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
      />
    </div>
  );
}
