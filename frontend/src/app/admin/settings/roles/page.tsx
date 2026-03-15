// frontend/src/app/admin/settings/roles/page.tsx
import { RoleManager } from './RoleManager';

export default function RolesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Roles</h1>
      <RoleManager />
    </div>
  );
}
