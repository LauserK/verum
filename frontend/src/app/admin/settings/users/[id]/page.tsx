// frontend/src/app/admin/settings/users/[id]/page.tsx
'use client';
import { useTranslations } from '@/components/I18nProvider';
import { UserPermissions } from './UserPermissions';

export default function UserProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { t } = useTranslations('admin.users');
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t('profileTitle')}</h1>
      <UserPermissions userId={id} />
    </div>
  );
}
