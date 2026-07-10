// frontend/src/app/admin/settings/users/[id]/UserPermissions.tsx
'use client';
import { useState, useEffect } from 'react';
import { settingsApi } from '@/lib/api';
import { useTranslations } from '@/components/I18nProvider';
import { useVenue } from '@/components/VenueContext';
import { Loader2, Check, AlertCircle } from 'lucide-react';

interface CustomRole {
  id: string;
  name: string;
}

export function UserPermissions({ userId }: { userId: string }) {
  const { t } = useTranslations('admin');
  const { activeOrgId } = useVenue();
  
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    async function fetchData() {
      if (!userId || !activeOrgId) return;
      setLoading(true);
      try {
        // Fetch all users to find this user
        const allUsers = await settingsApi.getUsers();
        const user = allUsers.find(u => u.id === userId);
        if (user) {
          setUserName(user.full_name);
        }

        // Fetch custom roles for active organization
        const allRoles = await settingsApi.getRoles(activeOrgId);
        setRoles(allRoles);

        // Find the selected role ID from user's current role name
        if (user) {
          const matchingRole = allRoles.find(r => r.name === user.role);
          setSelectedRoleId(matchingRole ? matchingRole.id : '');
        }
      } catch (err) {
        console.error('Error fetching permissions data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId, activeOrgId]);

  const handleRoleChange = async (roleId: string) => {
    if (!activeOrgId) return;
    
    setSelectedRoleId(roleId);
    setSaving(true);
    setSaveStatus('idle');

    try {
      const selectedRole = roles.find(r => r.id === roleId);
      const roleName = selectedRole ? selectedRole.name : 'staff';

      await settingsApi.updateUser(userId, { role: roleName });
      
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
