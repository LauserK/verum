'use client';

import { useState, useEffect } from 'react';
import { adminApi, UOMPresentation } from '@/lib/api';
import { 
  Plus, ClipboardList, Search, Loader2, ArrowUpRight, ArrowDownRight, 
  ArrowRightLeft, Eye, X, Save, Trash2, CheckCircle, Ban, Truck, Calendar, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useVenue } from '@/components/VenueContext';
import ConfirmationModal from '@/components/ConfirmationModal';

interface DocumentLine {
  id?: string;
  item_id: string;
  qty_presentation: number;
  presentation_id: string;
  unit_cost_presentation?: number;
  lot_number?: string;
  expiry_date?: string;
  search_query?: string;
  show_suggestions?: boolean;
}

export default function InventoryDocumentsPage() {
  const { availableVenues } = useVenue();
  const [documents, setDocuments] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  // Cache of presentations per item
  const [itemPresentations, setItemPresentations] = useState<Record<string, UOMPresentation[]>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'receipt' | 'issue' | 'transfer'>('all');
  const [activeStatus, setActiveStatus] = useState<'all' | 'draft' | 'in_transit' | 'confirmed' | 'cancelled'>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });
  const [cancelConfirmModal, setCancelConfirmModal] = useState({ isOpen: false, docId: '' });
  
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [selectedDocLines, setSelectedDocLines] = useState<any[]>([]);

  // Forms state
  const [newDoc, setNewDoc] = useState<{
    document_type: 'receipt' | 'issue' | 'transfer';
    warehouse_id: string;
    destination_warehouse_id: string;
    supplier: string;
    reason: 'sale' | 'waste' | 'adjustment' | 'internal_consumption';
    notes: string;
    auto_confirm?: boolean;
    lines: DocumentLine[];
  }>({
    document_type: 'receipt',
    warehouse_id: '',
    destination_warehouse_id: '',
    supplier: '',
    reason: 'adjustment',
    notes: '',
    auto_confirm: false,
    lines: []
  });

  // Transfer reception state
  const [receiveLines, setReceiveLines] = useState<any[]>([]);
  const [receiveNotes, setReceiveNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const typeParam = params.get('type');
      const statusParam = params.get('status');
      const idParam = params.get('id');
      if (typeParam && ['all', 'receipt', 'issue', 'transfer'].includes(typeParam)) {
        setActiveTab(typeParam as any);
      }
      if (statusParam && ['all', 'draft', 'in_transit', 'confirmed', 'cancelled'].includes(statusParam)) {
        setActiveStatus(statusParam as any);
      }
      if (idParam) {
        handleViewDetail(idParam);
      }
    }
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [docsData, itemsData, whData] = await Promise.all([
        adminApi.getInventoryDocuments(),
        adminApi.getInventoryItems(),
        adminApi.getInventoryWarehouses()
      ]);
      setDocuments(docsData);
      setItems(itemsData);
      setWarehouses(whData.filter((w: any) => w.is_active));
    } catch (error) {
      console.error('Error loading inventory data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchItemPresentations(itemId: string) {
    if (itemPresentations[itemId]) return;
    try {
      const pres = await adminApi.getItemPresentations(itemId);
      setItemPresentations(prev => ({ ...prev, [itemId]: pres }));
    } catch (error) {
      console.error(`Error loading presentations for item ${itemId}:`, error);
    }
  }

  async function handleViewDetail(id: string) {
    try {
      const doc = (await adminApi.getInventoryDocument(id)) as { header: any; lines: any[] };
      setSelectedDoc(doc.header);
      setSelectedDocLines(doc.lines);
      setShowDetailModal(true);
    } catch (error: any) {
      setErrorModal({ isOpen: true, message: error?.message || 'Error al cargar detalles del documento' });
    }
  }

  async function handleSaveDocument() {
    if (!newDoc.warehouse_id) {
      setErrorModal({ isOpen: true, message: 'Debe seleccionar un almacén de origen' });
      return;
    }
    if (newDoc.document_type === 'transfer' && !newDoc.destination_warehouse_id) {
      setErrorModal({ isOpen: true, message: 'Debe seleccionar un almacén de destino' });
      return;
    }
    if (newDoc.lines.length === 0) {
      setErrorModal({ isOpen: true, message: 'Debe agregar al menos una línea al documento' });
      return;
    }

    setSaving(true);
    try {
      await adminApi.createInventoryDocument(newDoc);
      setShowCreateModal(false);
      resetNewDoc();
      await loadData();
    } catch (error: any) {
      setErrorModal({ isOpen: true, message: error?.message || 'Error al guardar el documento' });
    } finally {
      setSaving(false);
    }
  }

  async function handleProcessDocument(id: string) {
    setSaving(true);
    try {
      await adminApi.processInventoryDocument(id);
      setShowDetailModal(false);
      await loadData();
    } catch (error: any) {
      setErrorModal({ isOpen: true, message: error?.message || 'Error al procesar el documento' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelDocument(id: string) {
    setSaving(true);
    try {
      await adminApi.cancelInventoryDocument(id);
      setShowDetailModal(false);
      await loadData();
    } catch (error: any) {
      setErrorModal({ isOpen: true, message: error?.message || 'Error al anular el documento' });
    } finally {
      setSaving(false);
    }
  }

  function openReceiveModal(doc: any, lines: any[]) {
    setSelectedDoc(doc);
    setReceiveLines(lines.map(l => ({
      id: l.id,
      item_name: l.items?.name || 'Artículo',
      presentation_name: l.uom_presentations?.name || l.items?.uom_base?.name || 'Unidad',
      qty_sent_presentation: l.qty_presentation,
      qty_received_presentation: l.qty_presentation
    })));
    setReceiveNotes('');
    setShowReceiveModal(true);
  }

  async function handleReceiveTransfer() {
    setSaving(true);
    try {
      await adminApi.receiveTransferDocument(selectedDoc.id, {
        notes: receiveNotes,
        lines: receiveLines.map(l => ({
          id: l.id,
          qty_received_presentation: parseFloat(l.qty_received_presentation)
        }))
      });
      setShowReceiveModal(false);
      setShowDetailModal(false);
      await loadData();
    } catch (error: any) {
      setErrorModal({ isOpen: true, message: error?.message || 'Error al recibir el traslado' });
    } finally {
      setSaving(false);
    }
  }

  function resetNewDoc() {
    setNewDoc({
      document_type: 'receipt',
      warehouse_id: '',
      destination_warehouse_id: '',
      supplier: '',
      reason: 'adjustment',
      notes: '',
      auto_confirm: false,
      lines: []
    });
  }

  function addLine() {
    setNewDoc(prev => ({
      ...prev,
      lines: [...prev.lines, { item_id: '', qty_presentation: 1, presentation_id: '', unit_cost_presentation: 0 }]
    }));
  }

  function removeLine(index: number) {
    setNewDoc(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  }

  function updateLine(index: number, field: keyof DocumentLine, value: any) {
    if (field === 'item_id') {
      fetchItemPresentations(value);
    }
    setNewDoc(prev => {
      const updated = [...prev.lines];
      updated[index] = { ...updated[index], [field]: value } as DocumentLine;
      return { ...prev, lines: updated };
    });
  }

  // Filters logic
  const filteredDocuments = documents.filter(doc => {
    const matchesTab = activeTab === 'all' || doc.document_type === activeTab;
    const matchesStatus = activeStatus === 'all' || doc.status === activeStatus;
    const matchesSearch = 
      (doc.document_number || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
      (doc.supplier || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
      (doc.notes || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
      (doc.warehouse_name || doc.warehouse?.name || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
      (doc.destination_warehouse_name || doc.destination_warehouse?.name || '').toLowerCase().includes(filterQuery.toLowerCase());
      
    return matchesTab && matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <ConfirmationModal 
        isOpen={errorModal.isOpen}
        title="Atención"
        message={errorModal.message}
        confirmLabel="Cerrar"
        cancelLabel=""
        onConfirm={() => setErrorModal({ ...errorModal, isOpen: false })}
        onCancel={() => setErrorModal({ ...errorModal, isOpen: false })}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" /> Documentos de Inventario
          </h1>
          <p className="text-sm text-text-secondary mt-1">Registro centralizado de movimientos de stock</p>
        </div>
        <button 
          onClick={() => { resetNewDoc(); setShowCreateModal(true); }}
          className="flex items-center gap-2 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo Documento
        </button>
      </div>

      {/* Filter Options */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Document Type Tabs */}
          <div className="flex bg-surface-raised p-1 rounded-xl border border-border">
            <button 
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'all' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setActiveTab('receipt')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'receipt' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Ingresos
            </button>
            <button 
              onClick={() => setActiveTab('issue')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'issue' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Egresos
            </button>
            <button 
              onClick={() => setActiveTab('transfer')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'transfer' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Traslados
            </button>
          </div>

          {/* Status Filters */}
          <div className="flex gap-2">
            <select
              value={activeStatus}
              onChange={e => setActiveStatus(e.target.value as any)}
              className="bg-surface border border-border rounded-xl px-3 h-10 text-xs font-semibold focus:border-primary outline-none"
            >
              <option value="all">Todos los Estados</option>
              <option value="draft">Borrador</option>
              <option value="in_transit">En Tránsito</option>
              <option value="confirmed">Confirmado</option>
              <option value="cancelled">Anulado</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input 
            type="text"
            placeholder="Buscar por número, proveedor, almacén o notas..."
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded-xl pl-10 pr-4 h-10 text-sm outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Document Grid/List */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-raised border-b border-border text-xs font-bold text-text-secondary uppercase">
                <th className="p-4">Nº Documento</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Origen / Almacén</th>
                <th className="p-4">Destino</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredDocuments.map(doc => (
                <tr key={doc.id} className="hover:bg-surface-raised/40 transition-colors">
                  <td className="p-4 font-bold text-text-primary">{doc.document_number}</td>
                  <td className="p-4">
                    {doc.document_type === 'receipt' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-md">
                        <ArrowUpRight className="w-3.5 h-3.5" /> Ingreso
                      </span>
                    )}
                    {doc.document_type === 'issue' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-error bg-error/10 px-2 py-1 rounded-md">
                        <ArrowDownRight className="w-3.5 h-3.5" /> Egreso
                      </span>
                    )}
                    {doc.document_type === 'transfer' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                        <ArrowRightLeft className="w-3.5 h-3.5" /> Traslado
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-semibold text-text-primary">
                    {doc.warehouse_name || doc.warehouse?.name || 'N/A'}
                  </td>
                  <td className="p-4 text-text-secondary">
                    {doc.document_type === 'transfer' ? (doc.destination_warehouse_name || doc.destination_warehouse?.name || 'N/A') : '-'}
                  </td>
                  <td className="p-4 text-xs text-text-secondary">
                    {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      doc.status === 'confirmed' ? 'bg-success/10 text-success' :
                      doc.status === 'cancelled' ? 'bg-error/10 text-error' :
                      doc.status === 'in_transit' ? 'bg-warning/10 text-warning' : 'bg-text-secondary/10 text-text-secondary'
                    }`}>
                      {doc.status === 'confirmed' ? 'Confirmado' :
                       doc.status === 'cancelled' ? 'Anulado' :
                       doc.status === 'in_transit' ? 'En Tránsito' : 'Borrador'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleViewDetail(doc.id)}
                      className="p-1.5 hover:bg-surface border border-border hover:border-primary/40 rounded-lg text-text-secondary hover:text-primary transition-all inline-flex items-center gap-1"
                      title="Ver Detalles"
                    >
                      <Eye className="w-4 h-4" /> <span className="text-xs font-semibold">Detalle</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-text-secondary">
                    No se encontraron documentos en este listado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE DOCUMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-surface rounded-3xl p-6 w-full max-w-4xl shadow-2xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Nuevo Documento de Inventario</h2>
                <p className="text-xs text-text-secondary">Seleccione el tipo de transacción y agregue los artículos</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-surface-raised rounded-full border border-border transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Tipo de Documento</label>
                  <select
                    value={newDoc.document_type}
                    onChange={e => setNewDoc(prev => ({ ...prev, document_type: e.target.value as any }))}
                    className="bg-surface-raised border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                  >
                    <option value="receipt">Ingreso por Compra</option>
                    <option value="issue">Egreso de Stock</option>
                    <option value="transfer">Traslado entre Almacenes</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">
                    {newDoc.document_type === 'transfer' ? 'Almacén de Origen' : 'Almacén'}
                  </label>
                  <select
                    value={newDoc.warehouse_id}
                    onChange={e => setNewDoc(prev => ({ ...prev, warehouse_id: e.target.value }))}
                    className="bg-surface-raised border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Seleccionar Almacén...</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>

                {newDoc.document_type === 'transfer' && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Almacén de Destino</label>
                      <select
                        value={newDoc.destination_warehouse_id}
                        onChange={e => setNewDoc(prev => ({ ...prev, destination_warehouse_id: e.target.value }))}
                        className="bg-surface-raised border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                      >
                        <option value="">Seleccionar Almacén...</option>
                        {warehouses.filter(w => w.id !== newDoc.warehouse_id).map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 md:col-span-3 bg-surface-raised p-3.5 rounded-xl border border-border mt-1">
                      <input 
                        type="checkbox"
                        id="auto_confirm"
                        checked={newDoc.auto_confirm || false}
                        onChange={e => setNewDoc(prev => ({ ...prev, auto_confirm: e.target.checked }))}
                        className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary"
                      />
                      <label htmlFor="auto_confirm" className="text-xs font-bold text-text-primary select-none cursor-pointer">
                        Confirmar en destino inmediatamente (Procesar sin tránsito)
                      </label>
                    </div>
                  </>
                )}

                {newDoc.document_type === 'receipt' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Proveedor</label>
                    <input
                      type="text"
                      placeholder="Nombre del proveedor..."
                      value={newDoc.supplier}
                      onChange={e => setNewDoc(prev => ({ ...prev, supplier: e.target.value }))}
                      className="bg-surface-raised border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                    />
                  </div>
                )}

                {newDoc.document_type === 'issue' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Motivo de Egreso</label>
                    <select
                      value={newDoc.reason}
                      onChange={e => setNewDoc(prev => ({ ...prev, reason: e.target.value as any }))}
                      className="bg-surface-raised border border-border rounded-xl px-4 h-11 text-sm outline-none focus:border-primary"
                    >
                      <option value="adjustment">Ajuste de Inventario</option>
                      <option value="waste">Merma / Desperdicio</option>
                      <option value="sale">Venta / Salida</option>
                      <option value="internal_consumption">Consumo Interno</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Notas / Comentarios</label>
                <textarea
                  rows={2}
                  placeholder="Información adicional del documento..."
                  value={newDoc.notes}
                  onChange={e => setNewDoc(prev => ({ ...prev, notes: e.target.value }))}
                  className="bg-surface-raised border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
                />
              </div>

              {/* Document Lines */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-t border-border pt-4">
                  <h3 className="text-sm font-bold text-text-primary">Líneas de Artículos</h3>
                  <button
                    type="button"
                    onClick={addLine}
                    className="flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Artículo
                  </button>
                </div>

                <div className="space-y-3">
                  {newDoc.lines.map((line, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-3 items-end bg-surface-raised p-4 rounded-xl border border-border relative">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="absolute top-2 right-2 text-text-secondary hover:text-error transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Search Item Input with Suggestions */}
                      <div className="flex-1 w-full flex flex-col gap-1 relative">
                        <label className="text-[10px] font-bold text-text-secondary uppercase">Artículo</label>
                        <input
                          type="text"
                          value={(line as any).search_query ?? ''}
                          onFocus={() => updateLine(idx, 'show_suggestions', true)}
                          onBlur={() => {
                            setTimeout(() => {
                              updateLine(idx, 'show_suggestions', false);
                            }, 200);
                          }}
                          onChange={e => {
                            const val = e.target.value;
                            updateLine(idx, 'search_query', val);
                            updateLine(idx, 'show_suggestions', true);
                            if (!val) {
                              updateLine(idx, 'item_id', '');
                            }
                          }}
                          placeholder="Escriba para buscar artículo..."
                          className="bg-surface border border-border rounded-lg px-2 h-9 text-xs outline-none focus:border-primary w-full font-semibold"
                        />
                        {(line as any).show_suggestions && (
                          <div className="absolute z-[999] w-full left-0 top-14 bg-surface border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                            {items
                              .filter(item => {
                                const q = ((line as any).search_query || '').toLowerCase();
                                return (
                                  item.name.toLowerCase().includes(q) ||
                                  (item.code || '').toLowerCase().includes(q)
                                );
                              })
                              .map(item => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    updateLine(idx, 'item_id', item.id);
                                    updateLine(idx, 'search_query', item.name);
                                    updateLine(idx, 'show_suggestions', false);
                                  }}
                                  className="w-full text-left px-3 py-2.5 hover:bg-surface-raised border-b border-border last:border-0 text-xs font-semibold text-text-primary flex items-center gap-2"
                                >
                                  {item.name}
                                </button>
                              ))}
                            {items.filter(item => {
                              const q = ((line as any).search_query || '').toLowerCase();
                              return item.name.toLowerCase().includes(q) || (item.code || '').toLowerCase().includes(q);
                            }).length === 0 && (
                              <p className="p-3 text-xs text-text-secondary text-center">No se encontraron artículos</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Presentation */}
                      <div className="w-full md:w-36 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase">Presentación</label>
                        <select
                          value={line.presentation_id}
                          onChange={e => updateLine(idx, 'presentation_id', e.target.value)}
                          className="bg-surface border border-border rounded-lg px-2 h-9 text-xs outline-none focus:border-primary w-full"
                          disabled={!line.item_id}
                        >
                          <option value="">
                            {(() => {
                              const selItem = items.find(i => i.id === line.item_id);
                              return selItem && selItem.uom_name ? selItem.uom_name : 'Conversión';
                            })()}
                          </option>
                          {(itemPresentations[line.item_id] || []).map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.conversion_factor} uds)</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="w-full md:w-20 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase">Cantidad</label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={line.qty_presentation}
                          onChange={e => updateLine(idx, 'qty_presentation', parseFloat(e.target.value) || 0)}
                          className="bg-surface border border-border rounded-lg px-2 h-9 text-xs text-center outline-none focus:border-primary w-full"
                        />
                      </div>

                      {/* Unit Cost - Only for Receipts */}
                      {newDoc.document_type === 'receipt' && (
                        <div className="w-full md:w-24 flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-text-secondary uppercase">Costo Unit.</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.unit_cost_presentation || 0}
                            onChange={e => updateLine(idx, 'unit_cost_presentation', parseFloat(e.target.value) || 0)}
                            className="bg-surface border border-border rounded-lg px-2 h-9 text-xs text-center outline-none focus:border-primary w-full"
                          />
                        </div>
                      )}

                      {/* Lot / Expiry - Optional for Receipts */}
                      {newDoc.document_type === 'receipt' && (
                        <>
                          <div className="w-full md:w-28 flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-text-secondary uppercase">Lote (Opc.)</label>
                            <input
                              type="text"
                              placeholder="Lote..."
                              value={line.lot_number || ''}
                              onChange={e => updateLine(idx, 'lot_number', e.target.value)}
                              className="bg-surface border border-border rounded-lg px-2 h-9 text-xs outline-none focus:border-primary w-full"
                            />
                          </div>

                          <div className="w-full md:w-32 flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-text-secondary uppercase">Vencim. (Opc.)</label>
                            <input
                              type="date"
                              value={line.expiry_date || ''}
                              onChange={e => updateLine(idx, 'expiry_date', e.target.value)}
                              className="bg-surface border border-border rounded-lg px-2 h-9 text-xs outline-none focus:border-primary w-full"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {newDoc.lines.length === 0 && (
                    <div className="text-center py-6 text-xs text-text-secondary bg-surface-raised border border-dashed border-border rounded-xl">
                      Haga clic en "Agregar Artículo" para ingresar líneas al documento.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="border-t border-border pt-4 flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 h-10 border border-border hover:bg-surface-raised rounded-xl text-sm font-semibold transition-colors"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDocument}
                className="flex items-center gap-2 bg-primary text-text-inverse px-5 h-10 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors"
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Borrador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DOCUMENT DETAILS MODAL */}
      {showDetailModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-surface rounded-3xl p-6 w-full max-w-4xl shadow-2xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6 border-b border-border pb-4">
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                  selectedDoc.document_type === 'receipt' ? 'bg-success/15 text-success' :
                  selectedDoc.document_type === 'issue' ? 'bg-error/15 text-error' : 'bg-primary/15 text-primary'
                }`}>
                  {selectedDoc.document_type === 'receipt' ? 'Ingreso' : selectedDoc.document_type === 'issue' ? 'Egreso' : 'Traslado'}
                </span>
                <h2 className="text-xl font-bold text-text-primary mt-1 flex items-center gap-2">
                  Documento {selectedDoc.document_number}
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Creado el {format(new Date(selectedDoc.created_at), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-surface-raised rounded-full border border-border transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>
            </div>

            {/* Document details container */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-surface-raised p-5 rounded-2xl border border-border text-sm">
                <div>
                  <p className="text-xs font-bold text-text-secondary uppercase">Estado</p>
                  <p className="font-semibold text-text-primary mt-0.5 flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      selectedDoc.status === 'confirmed' ? 'bg-success' :
                      selectedDoc.status === 'cancelled' ? 'bg-error' :
                      selectedDoc.status === 'in_transit' ? 'bg-warning animate-pulse' : 'bg-text-secondary'
                    }`} />
                    {selectedDoc.status === 'confirmed' ? 'Confirmado' :
                     selectedDoc.status === 'cancelled' ? 'Anulado' :
                     selectedDoc.status === 'in_transit' ? 'En Tránsito' : 'Borrador'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-text-secondary uppercase">Almacén Origen</p>
                  <p className="font-semibold text-text-primary mt-0.5">{selectedDoc.warehouse_name || selectedDoc.warehouse?.name || 'N/A'}</p>
                </div>

                {selectedDoc.document_type === 'transfer' && (
                  <div>
                    <p className="text-xs font-bold text-text-secondary uppercase">Almacén Destino</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedDoc.destination_warehouse_name || selectedDoc.destination_warehouse?.name || 'N/A'}</p>
                  </div>
                )}

                {selectedDoc.document_type === 'receipt' && (
                  <div>
                    <p className="text-xs font-bold text-text-secondary uppercase">Proveedor</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedDoc.supplier || 'N/A'}</p>
                  </div>
                )}

                {selectedDoc.document_type === 'issue' && (
                  <div>
                    <p className="text-xs font-bold text-text-secondary uppercase">Motivo</p>
                    <p className="font-semibold text-text-primary mt-0.5 capitalize">
                      {selectedDoc.reason?.replace('_', ' ')}
                    </p>
                  </div>
                )}

                <div className="col-span-full border-t border-border pt-3 mt-1">
                  <p className="text-xs font-bold text-text-secondary uppercase">Comentarios / Notas</p>
                  <p className="text-text-primary mt-1 text-xs italic">{selectedDoc.notes || 'Sin comentarios'}</p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-text-primary">Líneas de Artículos</h3>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface-raised border-b border-border font-bold text-text-secondary uppercase">
                        <th className="p-3">Artículo</th>
                        <th className="p-3">Presentación</th>
                        <th className="p-3 text-center">Cant. Solicitada</th>
                        {selectedDoc.document_type === 'transfer' && <th className="p-3 text-center">Cant. Recibida</th>}
                        {selectedDoc.document_type === 'receipt' && <th className="p-3 text-right">Costo Unit.</th>}
                        {selectedDoc.document_type === 'receipt' && <th className="p-3">Lote</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs">
                      {selectedDocLines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-surface-raised/20">
                          <td className="p-3 font-semibold text-text-primary">{line.items?.name || 'Artículo'}</td>
                          <td className="p-3 text-text-secondary">{line.uom_presentations?.name || line.items?.uom_base?.name || 'Unidad'}</td>
                          <td className="p-3 text-center font-bold">{line.qty_presentation}</td>
                          {selectedDoc.document_type === 'transfer' && (
                            <td className="p-3 text-center font-bold text-primary">
                              {line.qty_received_presentation !== null ? line.qty_received_presentation : '-'}
                            </td>
                          )}
                          {selectedDoc.document_type === 'receipt' && (
                            <td className="p-3 text-right text-text-primary font-mono">
                              ${parseFloat(line.unit_cost_presentation || 0).toFixed(2)}
                            </td>
                          )}
                          {selectedDoc.document_type === 'receipt' && (
                            <td className="p-3 text-text-secondary">{line.lot_number || '-'}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t border-border pt-4 mt-6 flex flex-wrap gap-2 justify-between">
              <div>
                {selectedDoc.status === 'draft' && (
                  <button
                    onClick={() => setCancelConfirmModal({ isOpen: true, docId: selectedDoc.id })}
                    className="flex items-center gap-1.5 text-xs font-bold text-error border border-error/20 bg-error/5 hover:bg-error/15 px-4 h-9 rounded-xl transition-all"
                    disabled={saving}
                  >
                    <Ban className="w-3.5 h-3.5" /> Anular Documento
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 h-9 border border-border hover:bg-surface-raised rounded-xl text-xs font-semibold transition-colors"
                >
                  Cerrar
                </button>
                
                {selectedDoc.status === 'draft' && (
                  <button
                    onClick={() => handleProcessDocument(selectedDoc.id)}
                    className="flex items-center gap-1.5 bg-success text-text-inverse px-5 h-9 rounded-xl text-xs font-semibold hover:bg-success-hover transition-colors"
                    disabled={saving}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Procesar Documento
                  </button>
                )}

                {selectedDoc.status === 'in_transit' && selectedDoc.document_type === 'transfer' && (
                  <button
                    onClick={() => openReceiveModal(selectedDoc, selectedDocLines)}
                    className="flex items-center gap-1.5 bg-primary text-text-inverse px-5 h-9 rounded-xl text-xs font-semibold hover:bg-primary-hover transition-colors"
                    disabled={saving}
                  >
                    <Truck className="w-3.5 h-3.5" /> Confirmar Recepción
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE TRANSFER MODAL */}
      {showReceiveModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-surface rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Confirmar Recepción de Traslado</h2>
                <p className="text-xs text-text-secondary">Ingrese las cantidades recibidas en destino</p>
              </div>
              <button 
                onClick={() => setShowReceiveModal(false)}
                className="p-2 hover:bg-surface-raised rounded-full border border-border transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-sm">
              <div className="space-y-3">
                {receiveLines.map((line, idx) => (
                  <div key={line.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center bg-surface-raised p-4 rounded-xl border border-border">
                    <div className="md:col-span-2">
                      <p className="font-bold text-text-primary">{line.item_name}</p>
                      <p className="text-xs text-text-secondary">{line.presentation_name}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-text-secondary uppercase font-bold">Enviado</p>
                      <p className="text-lg font-black text-text-primary">{line.qty_sent_presentation}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-secondary uppercase block mb-1">Recibido</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.qty_received_presentation}
                        onChange={e => {
                          const val = e.target.value;
                          setReceiveLines(prev => {
                            const updated = [...prev];
                            updated[idx].qty_received_presentation = val;
                            return updated;
                          });
                        }}
                        className="bg-surface border border-border rounded-lg h-9 px-2 text-center text-sm font-bold w-full outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 pt-4">
                <label className="text-xs font-bold text-text-secondary uppercase">Notas de Recepción</label>
                <textarea
                  rows={2}
                  placeholder="Observaciones sobre discrepancias, estado de los artículos, etc..."
                  value={receiveNotes}
                  onChange={e => setReceiveNotes(e.target.value)}
                  className="bg-surface-raised border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4 flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="px-4 h-10 border border-border hover:bg-surface-raised rounded-xl text-sm font-semibold transition-colors"
                disabled={saving}
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleReceiveTransfer}
                className="flex items-center gap-2 bg-primary text-text-inverse px-5 h-10 rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors"
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirmar Recepción
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Cancellation */}
      <ConfirmationModal 
        isOpen={cancelConfirmModal.isOpen}
        title="Anular Documento"
        message="¿Está seguro de que desea anular este documento de inventario? Esta acción no se puede deshacer y liberará los cambios pendientes."
        confirmLabel="Anular Documento"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          const docId = cancelConfirmModal.docId;
          setCancelConfirmModal({ isOpen: false, docId: '' });
          await handleCancelDocument(docId);
        }}
        onCancel={() => setCancelConfirmModal({ isOpen: false, docId: '' })}
      />
    </div>
  );
}
