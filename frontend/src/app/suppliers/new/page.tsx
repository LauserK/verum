'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { ArrowLeft, Save, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NewSupplierPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    tax_id: '',
    email: '',
    phone: '',
    address: '',
    payment_terms_days: 0,
    credit_limit: '',
    currency: 'USD',
    status: 'active',
    notes: '',
  });

  // Contact State (Optional Inline Primary Contact)
  const [contact, setContact] = useState({
    name: '',
    role: 'ventas',
    email: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        ...formData,
        payment_terms_days: Number(formData.payment_terms_days),
        credit_limit: formData.credit_limit ? Number(formData.credit_limit) : null,
      };

      // If user filled contact name, attach it to contacts array
      if (contact.name.trim()) {
        payload.contacts = [
          {
            ...contact,
            is_primary: true,
          },
        ];
      }

      await adminApi.createSupplier(payload);
      router.push('/suppliers');
    } catch (err: any) {
      console.error('Error creating supplier:', err);
      setError(err?.detail || 'Error al intentar registrar el proveedor. Valida los campos ingresados.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Navigation & Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/suppliers"
          className="p-2 hover:bg-background-hover rounded-lg border border-border transition-colors text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nuevo Proveedor</h1>
          <p className="text-sm text-text-secondary">Ingresa los datos generales y comerciales del nuevo proveedor.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: General Info */}
        <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-text-primary border-b border-border pb-2 text-sm uppercase text-text-muted">
            Información General
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-1 md:col-span-2">
              <label className="text-sm font-medium text-text-primary">
                Nombre Comercial / Razón Social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Distribuidora XYZ, C.A."
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Código Personalizado (Opcional)</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ej. SUP-001"
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Identificación Fiscal (RIF / NIT / RFC)</label>
              <input
                type="text"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="Ej. J-12345678-9"
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Correo Electrónico</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="correo@proveedor.com"
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Teléfono</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Ej. +58 412 1234567"
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5 col-span-1 md:col-span-2">
              <label className="text-sm font-medium text-text-primary">Dirección Física</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle, zona industrial, ciudad..."
                rows={2}
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Commercial Terms */}
        <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-text-primary border-b border-border pb-2 text-sm uppercase text-text-muted">
            Condiciones Comerciales
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Términos de Pago (Días)</label>
              <input
                type="number"
                min="0"
                value={formData.payment_terms_days}
                onChange={(e) => setFormData({ ...formData, payment_terms_days: Number(e.target.value) })}
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-text-secondary">0 = Pago de contado.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Límite de Crédito (USD)</label>
              <input
                type="number"
                min="0"
                value={formData.credit_limit}
                onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                placeholder="Opcional"
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Moneda Preferida</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              >
                <option value="USD">USD - Dólares</option>
                <option value="VES">VES - Bolívares</option>
                <option value="COP">COP - Pesos Colombianos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Contact Person */}
        <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-text-primary border-b border-border pb-2 text-sm uppercase text-text-muted">
            Contacto Principal (Opcional)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Nombre del Contacto</label>
              <input
                type="text"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                placeholder="Ej. María Gómez"
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Rol / Cargo</label>
              <select
                value={contact.role}
                onChange={(e) => setContact({ ...contact, role: e.target.value })}
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              >
                <option value="ventas">Ejecutivo de Ventas</option>
                <option value="logística">Logística / Despacho</option>
                <option value="administración">Facturación / Cobranzas</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Correo del Contacto</label>
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                placeholder="maria@proveedor.com"
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Teléfono del Contacto</label>
              <input
                type="tel"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                placeholder="Ej. +58 414 1234567"
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-background-card border border-border rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Notas / Comentarios Internos</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Escribe comentarios generales o condiciones particulares acordadas..."
              rows={3}
              className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/suppliers"
            className="px-5 py-2.5 rounded-xl border border-border hover:bg-background-hover text-text-primary font-semibold text-sm transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-primary/10 hover:shadow-primary/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Registrar Proveedor
          </button>
        </div>
      </form>
    </div>
  );
}
