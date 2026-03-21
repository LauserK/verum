// frontend/src/app/admin/settings/users/[id]/UserPermissions.tsx
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTranslations } from '@/components/I18nProvider';
import { Loader2, Check, AlertCircle } from 'lucide-react';

interface CustomRole {
  id: string;
  name: string;
}

export function UserPermissions({ userId }: { userId: string }) {
  const { t } = useTranslations('admin');
  const supabase = createClient();
  
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 1. Fetch user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();
        if (profile) setUserName(profile.full_name);

        // 2. Fetch all available roles
        const { data: allRoles } = await supabase
          .from('custom_roles')
          .select('id, name')
          .order('name');
        if (allRoles) setRoles(allRoles);

        // 3. Fetch current user role
        const { data: userRole } = await supabase
          .from('profile_roles')
          .select('role_id')
          .eq('profile_id', userId)
          .single();
        if (userRole) setSelectedRoleId(userRole.role_id);

      } catch (err) {
        console.error('Error fetching permissions data:', err);
      } finally {
        setLoading(false);
      }
    }

    if (userId) fetchData();
  }, [userId, supabase]);

  const handleRoleChange = async (roleId: string) => {
    setSelectedRoleId(roleId);
    setSaving(true);
    setSaveStatus('idle');

    try {
      if (!roleId) {
        // If empty selection, remove the role
        await supabase.from('profile_roles').delete().eq('profile_id', userId);
      } else {
        // Upsert the role
        const { error } = await supabase
          .from('profile_roles')
          .upsert({ profile_id: userId, role_id: roleId });
        
        if (error) throw error;
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Error saving role:', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-text-primary text-lg">
            {t('users.assignedRoleFor', { userId: userName || userId })}
          </h2>
          {saveStatus === 'success' && (
            <span className="text-success text-sm flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
              <Check className="w-4 h-4" /> Guardado
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-error text-sm flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> Error al guardar
            </span>
          )}
        </div>

        <div className="relative">
          <select 
            value={selectedRoleId}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={saving}
            className="bg-surface border border-border rounded-xl px-4 h-12 w-full text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none appearance-none disabled:opacity-50 transition-all cursor-pointer"
          >
            <option value="">{t('users.selectRolePlaceholder')}</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '▼'}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm opacity-50 cursor-not-allowed">
        <h2 className="font-bold text-text-primary text-lg mb-2">{t('users.individualOverrides')}</h2>
        <p className="text-text-secondary text-sm mb-4">{t('users.overridesDesc')}</p>
        <button 
          disabled
          className="border border-border text-text-primary rounded-xl h-11 px-6 font-semibold transition-colors"
        >
          {t('users.addOverride')} (Próximamente)
        </button>
      </div>
    </div>
  );
}
