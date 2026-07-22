'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi, SupplierResponse, SupplierItemResponse, SupplierPriceListResponse } from '@/lib/api';
import { 
  ArrowLeft, Info, DollarSign, Calendar, Star, FileText, CheckCircle, 
  XCircle, Plus, Loader2, AlertCircle, Save, Trash2, ShieldCheck, Tag
} from 'lucide-react';
import Link from 'next/link';

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<SupplierResponse | null>(null);
  const [items, setItems] = useState<SupplierItemResponse[]>([]);
  const [priceLists, setPriceLists] = useState<SupplierPriceListResponse[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]); // Catalog items from inventory

  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'prices' | 'evaluations'>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Modal / Form States
  const [showAddContact, setShowAddContact] = useState(false);
  const [showLinkItem, setShowLinkItem] = useState(false);
  const [showAddPriceList, setShowAddPriceList] = useState(false);
  const [showAddEvaluation, setShowAddEvaluation] = useState(false);

  // M31 States
  const [metrics, setMetrics] = useState<any | null>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [evalPeriodStart, setEvalPeriodStart] = useState('');
  const [evalPeriodEnd, setEvalPeriodEnd] = useState('');
  const [manualQuality, setManualQuality] = useState(5);
  const [manualCommunication, setManualCommunication] = useState(5);
  const [manualFlexibility, setManualFlexibility] = useState(5);
  const [evalNotes, setEvalNotes] = useState('');

  // Form Submissions
  const [newContact, setNewContact] = useState({
    name: '',
    role: 'ventas',
    email: '',
    phone: '',
  });

  const [newItemLink, setNewItemLink] = useState({
    item_id: '',
    supplier_sku: '',
    lead_time_days: 1,
    is_preferred: false,
  });

  const [newPriceList, setNewPriceList] = useState({
    name: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
    items: [] as Array<{ item_id: string; unit_cost_base: number; item_name?: string }>,
  });

  const [selectedCatalogItem, setSelectedCatalogItem] = useState('');
  const [selectedCatalogItemPrice, setSelectedCatalogItemPrice] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supplierId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const supData = await adminApi.getSupplier(supplierId);
        setSupplier(supData);

        const itemsData = await adminApi.getSupplierItems(supplierId);
        setItems(itemsData || []);

        const pricesData = await adminApi.getSupplierPriceLists(supplierId);
        setPriceLists(pricesData || []);

        const catItems = await adminApi.getInventoryItems();
        setCatalogItems(catItems || []);

        // Cargar Evaluaciones y Métricas
        const evalsData = await adminApi.getSupplierEvaluations(supplierId);
        setEvaluations(evalsData || []);

        const metricsData = await adminApi.getSupplierMetrics(supplierId);
        setMetrics(metricsData || null);
      } catch (err) {
        console.error('Error fetching supplier details/metrics:', err);
        setError('No se pudo cargar la información del proveedor');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supplierId]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name.trim() || !supplier) return;

    setSubmitting(true);
    setFormError(null);
    try {
      // In the real system, you might have a POST /suppliers/{id}/contacts or update supplier
      const updatedContacts = [...supplier.contacts, { ...newContact, id: crypto.randomUUID(), supplier_id: supplier.id }];
      await adminApi.updateSupplier(supplier.id, {
        contacts: updatedContacts as any
      } as any);

      // Refresh supplier
      const supData = await adminApi.getSupplier(supplierId);
      setSupplier(supData);
      setShowAddContact(false);
      setNewContact({ name: '', role: 'ventas', email: '', phone: '' });
    } catch (err: any) {
      console.error(err);
      setFormError('No se pudo guardar el contacto.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemLink.item_id || !supplier) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await adminApi.linkSupplierItem(supplier.id, {
        item_id: newItemLink.item_id,
        supplier_sku: newItemLink.supplier_sku || undefined,
        lead_time_days: Number(newItemLink.lead_time_days),
        is_preferred: newItemLink.is_preferred,
      });

      // Refresh items list
      const itemsData = await adminApi.getSupplierItems(supplierId);
      setItems(itemsData || []);
      setShowLinkItem(false);
      setNewItemLink({ item_id: '', supplier_sku: '', lead_time_days: 1, is_preferred: false });
    } catch (err: any) {
      console.error(err);
      setFormError(err?.detail || 'Error al vincular el artículo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddItemToPriceList = () => {
    if (!selectedCatalogItem || !selectedCatalogItemPrice) return;
    const catItem = catalogItems.find(i => i.id === selectedCatalogItem);
    if (!catItem) return;

    // Check if already added
    if (newPriceList.items.some(i => i.item_id === selectedCatalogItem)) {
      setFormError('Este artículo ya ha sido añadido a la lista.');
      return;
    }

    setNewPriceList({
      ...newPriceList,
      items: [
        ...newPriceList.items,
        {
          item_id: selectedCatalogItem,
          unit_cost_base: Number(selectedCatalogItemPrice),
          item_name: catItem.name,
        }
      ]
    });
    setSelectedCatalogItem('');
    setSelectedCatalogItemPrice('');
    setFormError(null);
  };

  const handleRemoveItemFromPriceList = (itemId: string) => {
    setNewPriceList({
      ...newPriceList,
      items: newPriceList.items.filter(i => i.item_id !== itemId)
    });
  };

  const handleSavePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriceList.name.trim() || !newPriceList.valid_from || !supplier) return;
    if (newPriceList.items.length === 0) {
      setFormError('Debes añadir al menos un artículo a la lista de precios.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await adminApi.createPriceList(supplier.id, {
        name: newPriceList.name,
        valid_from: newPriceList.valid_from,
        valid_until: newPriceList.valid_until || null,
        is_active: newPriceList.is_active,
        items: newPriceList.items.map(i => ({
          item_id: i.item_id,
          unit_cost_base: i.unit_cost_base
        }))
      });

      // Refresh price lists
      const pricesData = await adminApi.getSupplierPriceLists(supplierId);
      setPriceLists(pricesData || []);
      setShowAddPriceList(false);
      setNewPriceList({ name: '', valid_from: '', valid_until: '', is_active: true, items: [] });
    } catch (err: any) {
      console.error(err);
      setFormError(err?.detail || 'Error al guardar la lista de precios. Verifica que no haya conflicto de fechas.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalPeriodStart || !evalPeriodEnd || !supplier) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await adminApi.createSupplierEvaluation(supplier.id, {
        period_start: evalPeriodStart,
        period_end: evalPeriodEnd,
        manual_quality: manualQuality,
        manual_communication: manualCommunication,
        manual_flexibility: manualFlexibility,
        notes: evalNotes || null
      });

      // Recargar datos
      const evalsData = await adminApi.getSupplierEvaluations(supplierId);
      setEvaluations(evalsData || []);
      
      const metricsData = await adminApi.getSupplierMetrics(supplierId);
      setMetrics(metricsData || null);

      const supData = await adminApi.getSupplier(supplierId);
      setSupplier(supData);

      setShowAddEvaluation(false);
      setEvalPeriodStart('');
      setEvalPeriodEnd('');
      setManualQuality(5);
      setManualCommunication(5);
      setManualFlexibility(5);
      setEvalNotes('');
    } catch (err: any) {
      console.error(err);
      setFormError(err?.detail || 'Error al guardar la evaluación.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando ficha del proveedor...</p>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="p-6 text-center space-y-4 max-w-md mx-auto">
        <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-lg font-semibold text-text-primary">Error de carga</h2>
        <p className="text-sm text-text-secondary">{error || 'Proveedor no encontrado'}</p>
        <Link href="/admin/suppliers" className="inline-block bg-primary text-white text-sm px-4 py-2 rounded-xl">
          Volver al directorio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/suppliers"
            className="p-2 hover:bg-background-hover rounded-lg border border-border transition-colors text-text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{supplier.name}</h1>
              <span className="px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-md">
                {supplier.code}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">Registrado el {new Date(supplier.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {supplier.status === 'active' && (
            <span className="px-3 py-1.5 text-xs font-semibold bg-green-500/10 text-green-500 rounded-lg border border-green-500/20">
              Activo
            </span>
          )}
          {supplier.status === 'inactive' && (
            <span className="px-3 py-1.5 text-xs font-semibold bg-gray-500/10 text-gray-500 rounded-lg border border-gray-500/20">
              Inactivo
            </span>
          )}
          {supplier.status === 'blocked' && (
            <span className="px-3 py-1.5 text-xs font-semibold bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
              Bloqueado
            </span>
          )}

          {supplier.score !== null && (
            <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-600 px-3 py-1.5 rounded-lg border border-yellow-500/20 text-xs font-bold">
              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
              <span>{supplier.score.toFixed(1)} / 5.0</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto gap-4">
        <button
          onClick={() => setActiveTab('info')}
          className={`pb-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 px-1 ${
            activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Información general
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`pb-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 px-1 ${
            activeTab === 'items' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Artículos vinculados ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('prices')}
          className={`pb-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 px-1 ${
            activeTab === 'prices' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Catálogos de precios ({priceLists.length})
        </button>
        <button
          onClick={() => setActiveTab('evaluations')}
          className={`pb-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 px-1 ${
            activeTab === 'evaluations' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Evaluaciones ({evaluations.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Supplier Info Details */}
          <div className="md:col-span-2 bg-background-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-text-primary text-sm uppercase text-text-muted flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> Datos del Proveedor
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <span className="text-xs text-text-secondary">Identificación Fiscal (RIF)</span>
                <p className="font-medium text-text-primary mt-0.5">{supplier.tax_id || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-text-secondary">Condiciones de Pago</span>
                <p className="font-medium text-text-primary mt-0.5">
                  {supplier.payment_terms_days > 0 ? `Crédito ${supplier.payment_terms_days} días` : 'Pago de contado'}
                </p>
              </div>
              <div>
                <span className="text-xs text-text-secondary">Límite de Crédito</span>
                <p className="font-medium text-text-primary mt-0.5">
                  {supplier.credit_limit !== null ? `$${supplier.credit_limit.toLocaleString()}` : 'Sin límite'}
                </p>
              </div>
              <div>
                <span className="text-xs text-text-secondary">Moneda Negociada</span>
                <p className="font-medium text-text-primary mt-0.5">{supplier.currency}</p>
              </div>
              <div>
                <span className="text-xs text-text-secondary">Correo Electrónico</span>
                <p className="font-medium text-text-primary mt-0.5">{supplier.email || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-text-secondary">Teléfono de contacto</span>
                <p className="font-medium text-text-primary mt-0.5">{supplier.phone || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-xs text-text-secondary">Dirección Comercial</span>
                <p className="font-medium text-text-primary mt-0.5">{supplier.address || '—'}</p>
              </div>
              {supplier.notes && (
                <div className="sm:col-span-2 border-t border-border/40 pt-3">
                  <span className="text-xs text-text-secondary">Comentarios internos</span>
                  <p className="text-text-primary mt-1 whitespace-pre-line text-xs bg-background-hover/10 p-3 rounded-lg border border-border/40">
                    {supplier.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Contacts Sidebar */}
          <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4 h-fit">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-semibold text-text-primary text-sm uppercase text-text-muted">
                Personas de Contacto
              </h3>
              <button 
                onClick={() => { setShowAddContact(true); setFormError(null); }}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> Agregar
              </button>
            </div>

            {showAddContact && (
              <form onSubmit={handleAddContact} className="p-3 bg-background-hover/20 rounded-xl border border-border/60 space-y-3">
                <div className="text-xs font-semibold text-text-primary">Registrar contacto</div>
                <input
                  type="text"
                  required
                  placeholder="Nombre completo *"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="w-full bg-background-input border border-border rounded-md px-2 py-1.5 text-xs text-text-primary"
                />
                <select
                  value={newContact.role}
                  onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                  className="w-full bg-background-input border border-border rounded-md px-2 py-1.5 text-xs text-text-primary"
                >
                  <option value="ventas">Ventas</option>
                  <option value="logística">Logística</option>
                  <option value="administración">Cobranza/Admin</option>
                </select>
                <input
                  type="email"
                  placeholder="Correo"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="w-full bg-background-input border border-border rounded-md px-2 py-1.5 text-xs text-text-primary"
                />
                <input
                  type="tel"
                  placeholder="Teléfono"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="w-full bg-background-input border border-border rounded-md px-2 py-1.5 text-xs text-text-primary"
                />
                
                {formError && <p className="text-[10px] text-red-500">{formError}</p>}
                
                <div className="flex justify-end gap-2 pt-1">
                  <button 
                    type="button" 
                    onClick={() => setShowAddContact(false)}
                    className="px-2.5 py-1 text-[10px] border border-border rounded text-text-primary hover:bg-background-hover"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="px-2.5 py-1 text-[10px] bg-primary hover:bg-primary-hover text-white rounded font-bold"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}

            {supplier.contacts.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-4">No hay contactos registrados.</p>
            ) : (
              <div className="space-y-3">
                {supplier.contacts.map((contact) => (
                  <div key={contact.id} className="p-3 border border-border/80 rounded-xl space-y-1 relative">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-text-primary">{contact.name}</span>
                      {contact.is_primary && (
                        <span className="text-[9px] bg-primary/10 text-primary px-1 rounded">Principal</span>
                      )}
                    </div>
                    <div className="text-[10px] text-text-secondary capitalize">{contact.role}</div>
                    {contact.email && <div className="text-[10px] text-text-primary">{contact.email}</div>}
                    {contact.phone && <div className="text-[10px] text-text-secondary">{contact.phone}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Items linked */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary text-sm uppercase text-text-muted">
              Catálogo de Artículos que Suministra
            </h3>
            <button
              onClick={() => { setShowLinkItem(true); setFormError(null); }}
              className="flex items-center justify-center gap-1 bg-primary text-text-inverse px-4 h-9 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all active:scale-95 shadow-md shadow-primary/10"
            >
              <Plus className="h-4 w-4" /> Asociar Artículo
            </button>
          </div>

          {showLinkItem && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-background-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
                <div>
                  <h3 className="font-semibold text-text-primary">Vincular Artículo</h3>
                  <p className="text-xs text-text-secondary">Asocia un artículo del inventario al catálogo del proveedor.</p>
                </div>

                <form onSubmit={handleLinkItem} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-primary">Artículo *</label>
                    <select
                      required
                      value={newItemLink.item_id}
                      onChange={(e) => setNewItemLink({ ...newItemLink, item_id: e.target.value })}
                      className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="">Selecciona un artículo...</option>
                      {catalogItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.code || 'sin código'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-primary">SKU Proveedor (Opcional)</label>
                    <input
                      type="text"
                      value={newItemLink.supplier_sku}
                      onChange={(e) => setNewItemLink({ ...newItemLink, supplier_sku: e.target.value })}
                      placeholder="Código en el catálogo del proveedor"
                      className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-text-primary">Lead Time (Días)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newItemLink.lead_time_days}
                        onChange={(e) => setNewItemLink({ ...newItemLink, lead_time_days: Number(e.target.value) })}
                        className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-start h-full pt-6 gap-2">
                      <input
                        type="checkbox"
                        id="is_preferred"
                        checked={newItemLink.is_preferred}
                        onChange={(e) => setNewItemLink({ ...newItemLink, is_preferred: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary"
                      />
                      <label htmlFor="is_preferred" className="text-xs font-medium text-text-primary">
                        ¿Proveedor preferido?
                      </label>
                    </div>
                  </div>

                  {formError && (
                    <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-xs border border-red-500/20">
                      {formError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => setShowLinkItem(false)}
                      className="flex items-center justify-center bg-surface border border-border text-text-primary px-4 h-9 rounded-xl text-xs font-bold hover:bg-surface-raised transition-all active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center justify-center gap-1 bg-primary text-text-inverse px-4 h-9 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all active:scale-95 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Vincular
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Linked Items List */}
          <div className="bg-background-card border border-border rounded-2xl overflow-hidden">
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-secondary">
                No hay artículos asociados a este proveedor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background-hover/10 text-xs uppercase text-text-muted">
                      <th className="py-3 px-6 font-semibold">Artículo</th>
                      <th className="py-3 px-6 font-semibold">SKU del Proveedor</th>
                      <th className="py-3 px-6 font-semibold">Lead Time de Entrega</th>
                      <th className="py-3 px-6 font-semibold">Preferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {items.map((item) => (
                      <tr key={item.item_id} className="hover:bg-background-hover/10 transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-text-primary">
                          {item.item_name || 'Cargando...'}
                        </td>
                        <td className="py-3.5 px-6 text-text-primary">
                          {item.supplier_sku || <span className="text-text-secondary">—</span>}
                        </td>
                        <td className="py-3.5 px-6 text-text-primary">
                          {item.lead_time_days} {item.lead_time_days === 1 ? 'día' : 'días'}
                        </td>
                        <td className="py-3.5 px-6">
                          {item.is_preferred ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-green-500/10 text-green-500 rounded border border-green-500/20">
                              <ShieldCheck className="h-3 w-3" /> Preferido
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-secondary">Secundario</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Price Lists */}
      {activeTab === 'prices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary text-sm uppercase text-text-muted">
              Catálogos Tarifarios Negociados
            </h3>
            <button
              onClick={() => { setShowAddPriceList(true); setFormError(null); }}
              className="flex items-center justify-center gap-1 bg-primary text-text-inverse px-4 h-9 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all active:scale-95 shadow-md shadow-primary/10"
            >
              <Plus className="h-4 w-4" /> Nuevo Catálogo
            </button>
          </div>

          {showAddPriceList && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-background-card border border-border rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div>
                  <h3 className="font-semibold text-text-primary">Crear Catálogo de Precios</h3>
                  <p className="text-xs text-text-secondary">Carga las tarifas negociadas y sus fechas de vigencia.</p>
                </div>

                <form onSubmit={handleSavePriceList} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-1 sm:col-span-2">
                      <label className="text-xs font-medium text-text-primary">Nombre del Catálogo *</label>
                      <input
                        type="text"
                        required
                        value={newPriceList.name}
                        onChange={(e) => setNewPriceList({ ...newPriceList, name: e.target.value })}
                        placeholder="Ej. Tarifario Q3-Q4 2026, Contrato Anual 2026"
                        className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-text-primary">Vigencia Desde *</label>
                      <input
                        type="date"
                        required
                        value={newPriceList.valid_from}
                        onChange={(e) => setNewPriceList({ ...newPriceList, valid_from: e.target.value })}
                        className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-text-primary">Vigencia Hasta (Opcional)</label>
                      <input
                        type="date"
                        value={newPriceList.valid_until}
                        onChange={(e) => setNewPriceList({ ...newPriceList, valid_until: e.target.value })}
                        className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Add Price Item Box */}
                  <div className="border border-border/80 rounded-xl p-4 bg-background-hover/10 space-y-3">
                    <div className="text-xs font-semibold text-text-primary">Añadir Tarifas al Catálogo</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase text-text-secondary">Artículo</label>
                        <select
                          value={selectedCatalogItem}
                          onChange={(e) => setSelectedCatalogItem(e.target.value)}
                          className="w-full bg-background-input border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
                        >
                          <option value="">Selecciona...</option>
                          {catalogItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase text-text-secondary">Costo Unitario ($)</label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="Ej. 1.25"
                          value={selectedCatalogItemPrice}
                          onChange={(e) => setSelectedCatalogItemPrice(e.target.value)}
                          className="w-full bg-background-input border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddItemToPriceList}
                        className="flex items-center justify-center bg-primary text-text-inverse px-4 h-9 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all active:scale-95 w-full"
                      >
                        Añadir Línea
                      </button>
                    </div>
                  </div>

                  {/* Added Items Preview */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-text-primary">Tarifas del Catálogo</div>
                    {newPriceList.items.length === 0 ? (
                      <p className="text-xs text-text-secondary italic">No se han añadido tarifas aún.</p>
                    ) : (
                      <div className="max-h-[200px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
                        {newPriceList.items.map((line) => (
                          <div key={line.item_id} className="flex items-center justify-between p-2.5 text-xs">
                            <span className="font-semibold text-text-primary">{line.item_name}</span>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-text-primary">${line.unit_cost_base.toFixed(4)} / unidad</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveItemFromPriceList(line.item_id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {formError && (
                    <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-xs border border-red-500/20">
                      {formError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddPriceList(false)}
                      className="flex items-center justify-center bg-surface border border-border text-text-primary px-4 h-9 rounded-xl text-xs font-bold hover:bg-surface-raised transition-all active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center justify-center gap-1 bg-primary text-text-inverse px-4 h-9 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all active:scale-95 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Guardar Catálogo
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* List of Price Lists */}
          <div className="space-y-4">
            {priceLists.length === 0 ? (
              <div className="bg-background-card border border-border rounded-2xl p-8 text-center text-sm text-text-secondary">
                No hay catálogos tarifarios vigentes registrados para este proveedor.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {priceLists.map((pl) => (
                  <div key={pl.id} className="bg-background-card border border-border rounded-2xl p-5 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="font-semibold text-text-primary flex items-center gap-1.5">
                        <FileText className="h-4.5 w-4.5 text-primary" />
                        {pl.name}
                      </div>
                      {pl.is_active ? (
                        <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded font-bold border border-green-500/20">
                          Vigente
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-500/10 text-gray-500 px-2 py-0.5 rounded font-bold border border-gray-500/20">
                          Inactivo
                        </span>
                      )}
                    </div>

                    <div className="text-xs space-y-1.5 text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Desde {new Date(pl.valid_from).toLocaleDateString()} {pl.valid_until ? `hasta ${new Date(pl.valid_until).toLocaleDateString()}` : '(vigencia indeterminada)'}
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="text-[10px] uppercase font-bold text-text-muted mb-1 flex items-center gap-1"><Tag className="h-3 w-3" /> Tarifas ({pl.items.length})</div>
                      <div className="bg-background-hover/5 rounded-lg border border-border/40 max-h-[140px] overflow-y-auto divide-y divide-border/40">
                        {pl.items.map((line) => {
                          const catItem = catalogItems.find(i => i.id === line.item_id);
                          return (
                            <div key={line.id} className="flex justify-between items-center p-2 text-xs">
                              <span className="text-text-primary font-medium">{catItem?.name || 'Insumo'}</span>
                              <span className="font-bold text-text-primary">${line.unit_cost_base.toFixed(4)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Evaluations */}
      {activeTab === 'evaluations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary text-sm uppercase text-text-muted">
              Evaluación de Desempeño
            </h3>
            <button
              onClick={() => { setShowAddEvaluation(true); setFormError(null); }}
              className="flex items-center justify-center gap-1 bg-primary text-text-inverse px-4 h-9 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all active:scale-95 shadow-md shadow-primary/10"
            >
              <Plus className="h-4 w-4" /> Nueva Evaluación
            </button>
          </div>

          {/* Metrics Overview Cards */}
          {metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-background-card border border-border rounded-2xl p-5 space-y-2">
                <span className="text-xs text-text-secondary uppercase font-bold">Puntualidad de Entrega</span>
                <div className="text-2xl font-mono font-bold text-text-primary">
                  {metrics.auto_on_time_pct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-text-secondary">Entregas recibidas a tiempo</div>
              </div>
              <div className="bg-background-card border border-border rounded-2xl p-5 space-y-2">
                <span className="text-xs text-text-secondary uppercase font-bold">Exactitud de Cantidad</span>
                <div className="text-2xl font-mono font-bold text-text-primary">
                  {metrics.auto_qty_accuracy_pct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-text-secondary">Líneas con discrepancia cero</div>
              </div>
              <div className="bg-background-card border border-border rounded-2xl p-5 space-y-2">
                <span className="text-xs text-text-secondary uppercase font-bold">Tasa de Devoluciones</span>
                <div className="text-2xl font-mono font-bold text-text-primary">
                  {metrics.auto_return_rate_pct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-text-secondary">Tasa de artículos rechazados</div>
              </div>
              <div className="bg-background-card border border-border rounded-2xl p-5 space-y-2 bg-gradient-to-br from-primary/5 to-transparent">
                <span className="text-xs text-text-secondary uppercase font-bold">Score Automático</span>
                <div className="text-2xl font-mono font-bold text-primary flex items-center gap-1.5">
                  <Star className="h-5 w-5 fill-primary text-primary shrink-0" />
                  {metrics.auto_score.toFixed(1)} / 5.0
                </div>
                <div className="text-[10px] text-text-secondary">Ponderación automática (60%)</div>
              </div>
            </div>
          )}

          {/* Trend Graph */}
          {evaluations.length > 0 && (
            <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
              <div className="text-xs font-bold uppercase text-text-secondary tracking-wider">Tendencia del Score Final</div>
              <div className="w-full h-48 bg-surface-raised/10 rounded-xl border border-border/40 p-4 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 500 150">
                  {/* Grid Lines */}
                  <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border)" strokeDasharray="3,3" />
                  <line x1="0" y1="75" x2="500" y2="75" stroke="var(--border)" strokeDasharray="3,3" />
                  <line x1="0" y1="130" x2="500" y2="130" stroke="var(--border)" strokeDasharray="3,3" />
                  
                  {/* Polyline */}
                  {(() => {
                    const sortedEvals = [...evaluations].reverse();
                    const points = sortedEvals.map((e, idx) => {
                      const x = sortedEvals.length > 1 ? (idx / (sortedEvals.length - 1)) * 460 + 20 : 250;
                      // score map: 5.0 -> 20px, 0.0 -> 130px
                      const y = 130 - (e.final_score / 5.0) * 110;
                      return `${x},${y}`;
                    }).join(' ');
                    
                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="var(--primary)"
                          strokeWidth="3"
                          points={points}
                        />
                        {sortedEvals.map((e, idx) => {
                          const x = sortedEvals.length > 1 ? (idx / (sortedEvals.length - 1)) * 460 + 20 : 250;
                          const y = 130 - (e.final_score / 5.0) * 110;
                          return (
                            <g key={e.id} className="group cursor-pointer">
                              <circle
                                cx={x}
                                cy={y}
                                r="5"
                                className="fill-primary stroke-background-card stroke-2 hover:r-7 transition-all"
                              />
                              <text
                                x={x}
                                y={y - 10}
                                textAnchor="middle"
                                className="text-[10px] font-bold fill-text-primary"
                              >
                                {e.final_score.toFixed(1)}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}

          {/* Evaluations list */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider">Historial de Evaluaciones</h4>
            {evaluations.length === 0 ? (
              <div className="bg-background-card border border-border rounded-2xl p-8 text-center text-sm text-text-secondary">
                No hay evaluaciones registradas para este proveedor.
              </div>
            ) : (
              <div className="space-y-3">
                {evaluations.map((e) => (
                  <div key={e.id} className="bg-background-card border border-border rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-text-primary">
                          Período: {new Date(e.period_start).toLocaleDateString()} - {new Date(e.period_end).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-text-secondary">
                          Evaluado el {new Date(e.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20 text-xs font-bold font-mono">
                        <Star className="h-4 w-4 fill-primary text-primary shrink-0" />
                        <span>Score: {e.final_score.toFixed(1)} / 5.0</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t border-border pt-3">
                      <div>
                        <span className="text-text-secondary">Puntualidad:</span>
                        <p className="font-bold text-text-primary">{e.auto_on_time_pct}%</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Calidad (Manual):</span>
                        <p className="font-bold text-text-primary">{e.manual_quality} / 5</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Comunicación (Manual):</span>
                        <p className="font-bold text-text-primary">{e.manual_communication} / 5</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Flexibilidad (Manual):</span>
                        <p className="font-bold text-text-primary">{e.manual_flexibility} / 5</p>
                      </div>
                    </div>

                    {e.notes && (
                      <div className="text-xs text-text-secondary bg-surface-raised/40 p-2.5 rounded-lg border border-border/40">
                        <span className="font-semibold block text-text-primary mb-0.5">Observaciones:</span>
                        {e.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Add Evaluation */}
          {showAddEvaluation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                <div>
                  <h3 className="font-semibold text-text-primary">Registrar Nueva Evaluación</h3>
                  <p className="text-xs text-text-secondary">Evalúa al proveedor manual y cuantitativamente en base al período indicado.</p>
                </div>

                <form onSubmit={handleCreateEvaluation} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-text-primary">Desde *</label>
                      <input
                        type="date"
                        required
                        value={evalPeriodStart}
                        onChange={(e) => setEvalPeriodStart(e.target.value)}
                        className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-text-primary">Hasta *</label>
                      <input
                        type="date"
                        required
                        value={evalPeriodEnd}
                        onChange={(e) => setEvalPeriodEnd(e.target.value)}
                        className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-text-primary">
                        <span>Calidad del Producto / Servicio *</span>
                        <span className="font-bold font-mono">{manualQuality} / 5</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={manualQuality}
                        onChange={(e) => setManualQuality(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-text-primary">
                        <span>Comunicación y Soporte *</span>
                        <span className="font-bold font-mono">{manualCommunication} / 5</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={manualCommunication}
                        onChange={(e) => setManualCommunication(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-text-primary">
                        <span>Flexibilidad y Respuesta *</span>
                        <span className="font-bold font-mono">{manualFlexibility} / 5</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={manualFlexibility}
                        onChange={(e) => setManualFlexibility(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-primary">Observaciones y Notas</label>
                    <textarea
                      value={evalNotes}
                      onChange={(e) => setEvalNotes(e.target.value)}
                      rows={3}
                      placeholder="Agrega comentarios sobre el desempeño del proveedor en este período..."
                      className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                    />
                  </div>

                  {formError && (
                    <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-xs border border-red-500/20">
                      {formError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddEvaluation(false)}
                      className="flex items-center justify-center bg-surface border border-border text-text-primary px-4 h-9 rounded-xl text-xs font-bold hover:bg-surface-raised transition-all active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center justify-center gap-1 bg-primary text-text-inverse px-4 h-9 rounded-xl text-xs font-bold hover:bg-primary-hover transition-all active:scale-95 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Guardar Evaluación
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
