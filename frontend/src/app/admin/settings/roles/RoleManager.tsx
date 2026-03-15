// frontend/src/app/admin/settings/roles/RoleManager.tsx
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface CustomRole {
  id: string;
  name: string;
}

export function RoleManager() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.from('custom_roles').select('*').then(({ data }) => {
      if (data) setRoles(data as CustomRole[]);
    });
  }, []);

  return (
    <div className="flex gap-6">
      <div className="w-1/3 bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4">Roles</h2>
        <ul className="space-y-2">
          {roles.map((r) => (
            <li key={r.id} className="p-2 bg-surface-raised rounded-md border border-border">
              {r.name}
            </li>
          ))}
        </ul>
        <button className="mt-4 w-full bg-primary text-text-inverse rounded-xl h-10 font-semibold hover:bg-primary-hover transition-colors">
          + Crear rol
        </button>
      </div>
      <div className="w-2/3 bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4">Permisos</h2>
        <p className="text-text-secondary">Selecciona un rol para editar sus permisos</p>
      </div>
    </div>
  );
}
