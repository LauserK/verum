# Especificación de Diseño: Refactorización de API en el Frontend

## Contexto
Actualmente, múltiples componentes y páginas del frontend en el proyecto Verum están realizando consultas directas a la base de datos a través de Supabase (`supabase.from(...)`). Esto rompe la arquitectura deseada, donde todas las operaciones de datos deben pasar primero por el backend (FastAPI).

Afortunadamente, el backend ya expone los endpoints necesarios para estas entidades (`/assets`, `/asset-categories`, `/roles`, etc.) y el archivo `src/lib/api.ts` del frontend ya contiene gran parte de las definiciones de estas llamadas, aunque los componentes no las estén utilizando.

## Objetivo
Eliminar todas las consultas directas a la base de datos desde los componentes del frontend y delegarlas a funciones específicas que hagan peticiones HTTP (vía `fetchWithAuth`) al backend de FastAPI.
El uso de Supabase en el frontend quedará estrictamente limitado a:
1. Autenticación (obtención de tokens JWT de sesión).
2. Subida directa de imágenes pesadas a Supabase Storage (ej. `PhotoQuestion.tsx`), por motivos de rendimiento.

## Arquitectura Propuesta

### 1. Organización de la Capa API (`src/lib/api/`)
Debido a que `src/lib/api.ts` tiene más de 1300 líneas, se dividirá en submódulos por dominio:
*   `src/lib/api/core.ts`: Contendrá la configuración base, las variables de entorno y la función principal `fetchWithAuth`.
*   `src/lib/api/inventory.ts`: Contendrá las funciones de llamadas para `assets`, `categories`, `venues`, `tickets`, `uom-presentations`, etc.
*   `src/lib/api/settings.ts`: Contendrá las funciones para manejo de roles y permisos.
*   `src/lib/api/attendance.ts`: Funciones relacionadas con asistencias, turnos, reportes.
*   `src/lib/api.ts` (Index): Se modificará para re-exportar todas las funciones de los submódulos, evitando romper importaciones existentes en otros archivos.

### 2. Refactorización de Componentes (.tsx)
Los siguientes archivos (entre otros) serán actualizados:
*   `src/app/admin/inventory/assets/page.tsx`
*   `src/app/admin/inventory/categories/page.tsx`
*   `src/app/admin/inventory/movements/issues/page.tsx`
*   `src/app/admin/inventory/movements/receipts/page.tsx`
*   `src/app/admin/inventory/movements/transfers/create/page.tsx`
*   `src/app/admin/inventory/tickets/[id]/page.tsx`
*   `src/app/admin/inventory/tickets/page.tsx`
*   `src/app/admin/settings/roles/RoleManager.tsx`
*   `src/app/admin/settings/users/[id]/UserPermissions.tsx`

**Cambios por componente:**
*   Eliminar las importaciones de `createClient()` provenientes de `utils/supabase/client`, salvo donde se necesite estrictamente `supabase.auth.getUser()` para inicialización de UI si no está cubierto por el backend.
*   Reemplazar sentencias `supabase.from('tabla').select('*')` con métodos importados de nuestra API, por ejemplo: `await inventoryApi.getAssets()`.
*   Asegurar que los datos mostrados en tablas y listados mapeen correctamente la estructura de respuesta que devuelve el backend FastAPI (que podría diferir ligeramente del resultado crudo de Supabase).

## Manejo de Errores y Testing
*   El manejo de errores centralizado ya es proveído por `fetchWithAuth` (lanzando excepciones si `res.ok` es falso).
*   En los componentes, los bloques `try/catch` actualizarán el estado de error de la interfaz gráfica sin problemas, sustituyendo la verificación condicional `if (err)` típica del cliente de Supabase.

## Límite de la Tarea (Scope)
*   **No** se requiere desarrollar nuevos endpoints en el backend de FastAPI (se asume que los actuales, tras verificación, son suficientes; si falta alguno menor, se reportará).
*   **No** se cambiará la arquitectura de autenticación (los usuarios se seguirán logueando a través de los helpers del lado del cliente/servidor de Supabase en Next.js).
