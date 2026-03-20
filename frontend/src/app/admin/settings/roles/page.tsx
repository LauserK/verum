// frontend/src/app/admin/settings/roles/page.tsx
'use client';
import { useTranslations } from '@/components/I18nProvider';
import { RoleManager } from './RoleManager';
import Link from 'next/link';

export default function RolesPage() {
  const { t } = useTranslations('admin');
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">{t('roles.title')}</h1>
          <div className="flex items-center gap-6 mt-2 overflow-x-auto">
            <Link href="/admin/team" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
              Usuarios
            </Link>
            <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">Roles y Permisos</span>
          </div>
        </div>
      </div>
      <RoleManager />
    </div>
  );
}
