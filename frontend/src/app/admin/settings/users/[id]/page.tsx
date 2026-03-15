// frontend/src/app/admin/settings/users/[id]/page.tsx
import { UserPermissions } from './UserPermissions';

export default async function UserProfilePage({ params }: { params: { id: string } }) {
  const { id } = params; 
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Perfil de Usuario</h1>
      <UserPermissions userId={id} />
    </div>
  );
}
