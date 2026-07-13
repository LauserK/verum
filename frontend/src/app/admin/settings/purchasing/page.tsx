'use client';

import { useState, useEffect } from 'react';
import { useVenue } from '@/components/VenueContext';
import { adminApi } from '@/lib/api';
import { Shield, Save, Check, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface CustomRole {
  id: string;
  name: string;
  description?: string;
  is_admin?: boolean;
}

interface POApprovalLimit {
  role_id: string;
  max_amount: number | null;
}

export default function PurchasingSettingsPage() {
  const { activeOrgId } = useVenue();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [limits, setLimits] = useState<Record<string, number | null>>({});
  const [config, setConfig] = useState<{
    creator_can_approve_own: boolean;
    require_approval_above: number;
  }>({
    creator_can_approve_own: false,
    require_approval_above: 0,
  });

  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingLimit, setSavingLimit] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!activeOrgId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch roles
        const rolesData = await adminApi.getRoles(activeOrgId);
        setRoles((rolesData as CustomRole[]) || []);

        // Fetch current PO approval limits
        const limitsData = await adminApi.getPOApprovalLimits();
        const limitsMap: Record<string, number | null> = {};
        (limitsData || []).forEach((limit) => {
          limitsMap[limit.role_id] = limit.max_amount ?? null;
        });
        setLimits(limitsMap);

        // Fetch PO approval config
        const configData = await adminApi.getPOApprovalConfig(activeOrgId);
        if (configData) {
          setConfig({
            creator_can_approve_own: configData.creator_can_approve_own,
            require_approval_above: configData.require_approval_above,
          });
        }
      } catch (error) {
        console.error('Error fetching purchasing settings:', error);
        setMessage({ text: 'Error al cargar las configuraciones', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeOrgId]);

  const handleSaveConfig = async () => {
    if (!activeOrgId) return;
    setSavingConfig(true);
    setMessage(null);
    try {
      await adminApi.updatePOApprovalConfig(activeOrgId, config);
      setMessage({ text: 'Configuración general guardada con éxito', type: 'success' });
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ text: 'Error al guardar la configuración general', type: 'error' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveLimit = async (roleId: string, name: string) => {
    const isOwner = name.toLowerCase() === 'dueño' || name.toLowerCase() === 'owner';
    if (isOwner) return;

    setSavingLimit(roleId);
    setMessage(null);
    try {
      const maxAmount = limits[roleId] === undefined || limits[roleId] === null ? null : Number(limits[roleId]);
      await adminApi.updatePOApprovalLimit({
        role_id: roleId,
        max_amount: maxAmount,
      });
      setMessage({ text: `Límite actualizado para el rol: ${name}`, type: 'success' });
    } catch (error) {
      console.error('Error updating limit:', error);
      setMessage({ text: `Error al actualizar el límite para el rol: ${name}`, type: 'error' });
    } finally {
      setSavingLimit(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Cargando configuración de compras...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">Configuración de Compras</h1>
        <div className="flex items-center gap-6 mt-2 overflow-x-auto">
          <Link href="/admin/team" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent transition-colors whitespace-nowrap">
            Usuarios
          </Link>
          <Link href="/admin/settings/roles" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent transition-colors whitespace-nowrap">
            Roles y Permisos
          </Link>
          <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">Aprobaciones de Compra</span>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
          message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {message.type === 'success' ? <Check className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* General Config Card */}
        <div className="lg:col-span-1 bg-background-card rounded-xl border border-border p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-text-primary">Reglas Generales</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="can-approve" className="text-sm font-medium text-text-primary pr-2">
                ¿Creador puede auto-aprobar sus POs?
              </label>
              <input
                id="can-approve"
                type="checkbox"
                checked={config.creator_can_approve_own}
                onChange={(e) => setConfig({ ...config, creator_can_approve_own: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="min-amount" className="text-sm font-medium text-text-primary">
                Aprobación obligatoria arriba de (USD)
              </label>
              <input
                id="min-amount"
                type="number"
                value={config.require_approval_above}
                onChange={(e) => setConfig({ ...config, require_approval_above: Number(e.target.value) })}
                className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-primary"
                min="0"
              />
              <span className="text-xs text-text-secondary">0 significa que todas las POs requieren aprobación.</span>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Configuración
            </button>
          </div>
        </div>

        {/* Roles Limits Table */}
        <div className="lg:col-span-2 bg-background-card rounded-xl border border-border p-6 space-y-4">
          <div className="border-b border-border pb-3">
            <h2 className="font-semibold text-text-primary">Límites de Aprobación por Rol</h2>
            <p className="text-xs text-text-secondary mt-0.5">Establece el monto máximo que cada rol puede aprobar. Deja vacío para "Sin límite".</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-secondary">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-text-muted">
                  <th className="py-3 px-4 font-semibold">Rol</th>
                  <th className="py-3 px-4 font-semibold">Monto Máximo de Aprobación (USD)</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {roles.map((role) => {
                  const isOwner = role.name.toLowerCase() === 'dueño' || role.name.toLowerCase() === 'owner';
                  const limitVal = limits[role.id];
                  return (
                    <tr key={role.id} className="hover:bg-background-hover/20">
                      <td className="py-4 px-4">
                        <div className="font-medium text-text-primary">{role.name}</div>
                        {role.description && <div className="text-xs text-text-secondary mt-0.5">{role.description}</div>}
                      </td>
                      <td className="py-4 px-4">
                        {isOwner ? (
                          <input
                            type="text"
                            disabled
                            value="Sin límite (Dueño)"
                            className="bg-background-input/40 border border-border/60 text-text-secondary text-sm rounded-lg px-3 py-1.5 w-full max-w-[200px]"
                          />
                        ) : (
                          <input
                            type="number"
                            placeholder="Sin límite"
                            value={limitVal === null || limitVal === undefined ? '' : limitVal}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : Number(e.target.value);
                              setLimits({ ...limits, [role.id]: val });
                            }}
                            className="bg-background-input border border-border text-text-primary text-sm rounded-lg px-3 py-1.5 w-full max-w-[200px] focus:outline-none focus:border-primary"
                            min="0"
                          />
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {!isOwner && (
                          <button
                            onClick={() => handleSaveLimit(role.id, role.name)}
                            disabled={savingLimit !== null}
                            className="inline-flex items-center gap-1.5 bg-background-button hover:bg-background-button-hover text-text-primary px-3 py-1.5 rounded-lg text-xs font-semibold border border-border transition-colors disabled:opacity-50"
                          >
                            {savingLimit === role.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Actualizar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
