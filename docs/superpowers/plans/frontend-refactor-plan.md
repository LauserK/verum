# Plan de Implementación: Refactorización API Frontend

Este plan detalla los pasos a seguir para eliminar las conexiones directas a Supabase desde los componentes del frontend de Verum y delegarlas a la capa API para que se comuniquen con el backend.

## Fase 1: Reestructuración de la Capa de API
1. **Crear estructura base:**
   - Crear el directorio `src/lib/api/` si no existe.
   - Crear `src/lib/api/core.ts` y mover allí la configuración de `API_URL` y la función base `fetchWithAuth`.

2. **Dividir por dominios (Mover desde `api.ts`):**
   - Crear `src/lib/api/inventory.ts` e importar `fetchWithAuth` de `core.ts`. Mover todas las funciones de `adminApi` relacionadas con activos, categorías, herramientas (utensils) y tickets.
   - Crear `src/lib/api/admin.ts` para las funciones relacionadas con organizaciones, sedes (venues) y reportes administrativos.
   - Crear `src/lib/api/settings.ts` para las funciones relacionadas con gestión de usuarios, roles y permisos.
   - Crear `src/lib/api/attendance.ts` para turnos, asistencias y ausencias.
   - Crear `src/lib/api/production.ts` para manejo de almacenes, kardex y facturas/recibos.

3. **Indexación:**
   - Refactorizar `src/lib/api.ts` para que sirva únicamente como un punto de entrada (index) que importe y re-exporte todas las interfaces y funciones de los nuevos archivos de dominio. Esto evitará romper las importaciones actuales en toda la aplicación.

## Fase 2: Refactorización de Componentes - Inventario
4. **`assets/page.tsx`:**
   - Reemplazar las llamadas de `supabase.from('assets')`, `supabase.from('asset_categories')` y `supabase.from('venues')`.
   - Utilizar las funciones equivalentes de `inventoryApi` y `adminApi` para cargar los datos en el bloque `useEffect`.
   - Actualizar los métodos de `insert` y `update` en el formulario para usar `inventoryApi.createAsset()` y `inventoryApi.updateAsset()`.

5. **`categories/page.tsx`:**
   - Eliminar `supabase.from('asset_categories')` y usar `inventoryApi.getAssetCategories()` / `createAssetCategory()` / `updateAssetCategory()`.

6. **Tickets (`tickets/page.tsx` y `tickets/[id]/page.tsx`):**
   - Reemplazar las consultas directas de tickets de reparación usando la nueva API.

## Fase 3: Refactorización de Componentes - Movimientos
7. **`movements/issues/page.tsx` y `movements/receipts/page.tsx`:**
   - Reemplazar llamadas a `uom_presentations` u otras tablas por métodos de la API (`productionApi.getUOMPresentations`, etc.).

8. **`movements/transfers/create/page.tsx`:**
   - Reemplazar consultas de sucursales e ítems para usar llamadas formales de API.

## Fase 4: Refactorización de Componentes - Ajustes y Reportes
9. **`attendance/reports/page.tsx`:**
   - Reemplazar cualquier extracción manual mediante `supabase.from()` y apuntar al endpoint unificado de reportes de asistencia en el backend.

10. **`settings/roles/RoleManager.tsx` y `settings/users/[id]/UserPermissions.tsx`:**
    - Eliminar cliente directo y usar funciones en `settingsApi` (ej. `getRoles`, `updatePermissions`).

## Fase 5: Validación y Testing
11. **Revisión de `PhotoQuestion.tsx`:**
    - Verificar visualmente que la subida de imágenes a Supabase Storage no se haya visto afectada, ya que esta se mantendrá directa al storage.

12. **Pruebas Integrales:**
    - Correr el linter de TypeScript `npm run lint` para asegurar que todas las firmas de las funciones API correspondan con el uso en los componentes.
    - Levantar el frontend y backend localmente para probar de manera manual los CRUD refactorizados (Activos, Categorías, Roles).
