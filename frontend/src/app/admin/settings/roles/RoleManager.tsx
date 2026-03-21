// frontend/src/app/admin/settings/roles/RoleManager.tsx
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTranslations } from '@/components/I18nProvider';

interface CustomRole {
  id: string;
  name: string;
}

interface Permission {
  id: string;
  module: string;
  action: string;
  key: string;
  description: string;
}

export function RoleManager() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]); // Array of permission IDs
  const [loadingPerms, setLoadingPerms] = useState(false);
  const supabase = createClient();
  const { t } = useTranslations('admin');

  useEffect(() => {
    // Initial fetch of roles and the full permissions catalog
    supabase.from('custom_roles').select('*').order('name').then(({ data }) => {
      if (data) setRoles(data as CustomRole[]);
    });
    supabase.from('permissions').select('*').order('module').then(({ data }) => {
      if (data) setAvailablePermissions(data as Permission[]);
    });
  }, [supabase]);

  const handleSelectRole = async (role: CustomRole) => {
    setSelectedRole(role);
    setLoadingPerms(true);
    const { data } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', role.id);
    
    if (data) {
      setRolePermissions(data.map(rp => rp.permission_id));
    } else {
      setRolePermissions([]);
    }
    setLoadingPerms(false);
  };

  const togglePermission = async (permId: string) => {
    if (!selectedRole) return;

    const isGranted = rolePermissions.includes(permId);
    if (isGranted) {
      // Remove
      await supabase.from('role_permissions')
        .delete()
        .eq('role_id', selectedRole.id)
        .eq('permission_id', permId);
      setRolePermissions(prev => prev.filter(id => id !== permId));
    } else {
      // Add
      await supabase.from('role_permissions')
        .insert({ role_id: selectedRole.id, permission_id: permId });
      setRolePermissions(prev => [...prev, permId]);
    }
  };

  // Group permissions by module
  const groupedPerms = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Left Column: Roles List */}
      <div className="w-1/3 bg-surface border border-border p-4 rounded-xl flex flex-col">
        <h2 className="font-semibold mb-4 text-text-primary">{t('roles.rolesSubtitle')}</h2>
        <ul className="space-y-2 overflow-y-auto flex-1 pr-1">
          {roles.map((r) => (
            <li 
              key={r.id} 
              onClick={() => handleSelectRole(r)}
              className={`p-3 rounded-xl border transition-all cursor-pointer select-none
                ${selectedRole?.id === r.id 
                  ? 'bg-primary/10 border-primary text-primary font-medium' 
                  : 'bg-surface-raised border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
                }`}
            >
              {r.name}
            </li>
          ))}
        </ul>
        <button className="mt-4 w-full bg-primary text-text-inverse rounded-xl h-11 font-semibold hover:bg-primary-hover transition-colors shadow-sm">
          {t('roles.createRole')}
        </button>
      </div>

      {/* Right Column: Permission Matrix */}
      <div className="w-2/3 bg-surface border border-border p-6 rounded-xl overflow-y-auto">
        <h2 className="font-semibold mb-6 text-text-primary border-b border-border pb-2 flex items-center justify-between">
          {t('roles.permissionsSubtitle')}
          {selectedRole && <span className="text-xs font-normal text-text-secondary italic">({selectedRole.name})</span>}
        </h2>
        
        {!selectedRole ? (
          <div className="flex flex-col items-center justify-center h-40 text-center opacity-60">
             <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center mb-3">
               🛡️
             </div>
             <p className="text-text-secondary text-sm max-w-[200px]">{t('roles.selectRoleToEdit')}</p>
          </div>
        ) : loadingPerms ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedPerms).map(([module, perms]) => (
              <div key={module} className="space-y-4">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-raised px-3 py-1.5 rounded-lg inline-block">
                  {module.replace('_', ' ')}
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {perms.map((perm) => (
                    <label 
                      key={perm.id} 
                      className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-surface-raised transition-colors cursor-pointer group"
                    >
                      <div className="mt-0.5 relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={rolePermissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                          {perm.key.split('.')[1].replace('_', ' ')}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                          {perm.description || `Acceso a ${perm.action} en ${perm.module}`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
