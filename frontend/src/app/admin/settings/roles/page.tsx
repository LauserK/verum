// frontend/src/app/admin/settings/roles/page.tsx
'use client';
import { useTranslations } from '@/components/I18nProvider';
import { RoleManager } from './RoleManager';

export default function RolesPage() {
  const { t } = useTranslations('admin');
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t('roles.title')}</h1>
      <RoleManager />
    </div>
  );
}
