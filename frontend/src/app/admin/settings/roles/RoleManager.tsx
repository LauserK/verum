// frontend/src/app/admin/settings/roles/RoleManager.tsx
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTranslations } from '@/components/I18nProvider';

interface CustomRole {
  id: string;
  name: string;
}

export function RoleManager() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const supabase = createClient();
  const { t } = useTranslations('admin.roles');

  useEffect(() => {
    supabase.from('custom_roles').select('*').then(({ data }) => {
      if (data) setRoles(data as CustomRole[]);
    });
  }, [supabase]);

  return (
    <div className="flex gap-6">
      <div className="w-1/3 bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4">{t('rolesSubtitle')}</h2>
        <ul className="space-y-2">
          {roles.map((r) => (
            <li key={r.id} className="p-2 bg-surface-raised rounded-md border border-border">
              {r.name}
            </li>
          ))}
        </ul>
        <button className="mt-4 w-full bg-primary text-text-inverse rounded-xl h-10 font-semibold hover:bg-primary-hover transition-colors">
          {t('createRole')}
        </button>
      </div>
      <div className="w-2/3 bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4">{t('permissionsSubtitle')}</h2>
        <p className="text-text-secondary">{t('selectRoleToEdit')}</p>
      </div>
    </div>
  );
}
