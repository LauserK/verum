// frontend/src/app/admin/settings/users/[id]/UserPermissions.tsx
'use client';

export function UserPermissions({ userId }: { userId: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4 text-text-primary">Rol Asignado</h2>
        <select className="bg-surface border border-border rounded-xl px-4 h-12 w-full text-text-primary focus:border-primary ring-2 ring-primary/20 outline-none">
          <option>Seleccionar rol...</option>
        </select>
      </div>

      <div className="bg-surface border border-border p-4 rounded-xl">
        <h2 className="font-semibold mb-4 text-text-primary">Overrides Individuales</h2>
        <p className="text-text-secondary text-sm">Los overrides sobrescriben los permisos del rol asignado.</p>
        <button className="mt-4 border border-border text-text-primary rounded-xl h-10 px-4 hover:bg-surface-raised font-semibold transition-colors">
          Añadir Override
        </button>
      </div>
    </div>
  );
}
