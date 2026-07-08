# Plan de Implementación: Optimizaciones de Rendimiento — Quick Wins

Este plan describe el desarrollo secuencial para implementar las optimizaciones de rendimiento de mayor impacto y menor riesgo en el frontend y backend de VERUM, de acuerdo con la especificación técnica en [docs/superpowers/specs/2026-07-08-performance-quick-wins-design.md](file:///C:/Users/dmj-travel/proyectos/verum/docs/superpowers/specs/2026-07-08-performance-quick-wins-design.md).

---

## Fases y Tareas de Desarrollo

### ⚙️ Fase 1: Backend GZip Compression
*   **Tarea 1.1: Habilitar compresión GZip en la API**
    *   Archivo: [backend/app/\_\_init\_\_.py](file:///C:/Users/dmj-travel/proyectos/verum/backend/app/__init__.py)
    *   Importar `GZipMiddleware` desde `starlette.middleware.gzip`.
    *   Registrar el middleware con `minimum_size=500`.

### 🛡️ Fase 2: Contexto de Perfil y Modificación del Layout Padre
*   **Tarea 2.1: Crear el Contexto `ProfileContext`**
    *   Archivo: `frontend/src/components/ProfileContext.tsx`
    *   Definir el contexto `ProfileContext` que exponga el perfil del usuario.
    *   Crear el Provider y un hook `useProfile()` exportado para uso general.
*   **Tarea 2.2: Actualizar el Layout para proveer el Perfil**
    *   Archivo: [layout.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/layout.tsx)
    *   Importar `ProfileProvider` de `ProfileContext`.
    *   Envolver el contenedor `{children}` en el render del layout con `<ProfileProvider value={profile}>`.

### 🔄 Fase 3: Reemplazo de `getProfile()` en Páginas Hijas
*   **Tarea 3.1: Identificar y Modificar las Páginas del Administrador**
    *   Modificar los archivos de rutas de administración (`page.tsx`) que llaman a `getProfile()` de forma redundante.
    *   Reemplazar la llamada asíncrona a `getProfile()` en los hooks `useEffect` por el consumo inmediato del hook `useProfile()` del contexto.
    *   *Archivos objetivo:*
        - `frontend/src/app/admin/dashboard/page.tsx`
        - `frontend/src/app/admin/checklists/dashboard/page.tsx`
        - `frontend/src/app/admin/attendance/page.tsx`
        - `frontend/src/app/admin/attendance/absences/page.tsx`
        - `frontend/src/app/admin/attendance/shifts/page.tsx`
        - `frontend/src/app/admin/attendance/reports/page.tsx`
        - `frontend/src/app/admin/inventory/page.tsx`
        - `frontend/src/app/admin/inventory/documents/page.tsx`
        - `frontend/src/app/admin/inventory/assets/page.tsx`
        - `frontend/src/app/admin/inventory/utensils/page.tsx`
        - `frontend/src/app/admin/inventory/items/page.tsx`
        - `frontend/src/app/admin/inventory/warehouses/page.tsx`
        - `frontend/src/app/admin/inventory/kardex/page.tsx`
        - `frontend/src/app/admin/inventory/snapshot/page.tsx`
        - `frontend/src/app/admin/production/page.tsx`
        - `frontend/src/app/admin/venues/page.tsx`
        - `frontend/src/app/admin/team/page.tsx`

### 📦 Fase 4: Imports Dinámicos y Configuración del Bundler
*   **Tarea 4.1: Habilitar Tree-Shaking en `next.config.ts`**
    *   Archivo: [next.config.ts](file:///C:/Users/dmj-travel/proyectos/verum/frontend/next.config.ts)
    *   Agregar `experimental.optimizePackageImports: ['lucide-react', 'date-fns']`.
    *   Agregar `images.remotePatterns` para Supabase Storage.
*   **Tarea 4.2: Implementar Carga Diferida (Lazy Loading) de Componentes Pesados**
    *   Utilizar `next/dynamic` para diferir componentes con dependencias pesadas:
        - Componente Scanner de QR (`html5-qrcode`): cargar dinámicamente solo al activar la cámara.
        - Utilidad de Importación (`xlsx`): en `import-utility/page.tsx`, modularizar el procesamiento del Excel a un dynamic import o import inline asíncrono.
        - Generador de QR (`qrcode.react`): diferir su renderización en vistas de detalles.

### 🧪 Fase 5: Pruebas y Verificación
*   **Tarea 5.1: Ejecutar Compilación de Frontend y Control de Regresiones**
    *   Ejecutar `npm run build` o `npx tsc --noEmit` en `frontend/` para validar compatibilidad de tipos TypeScript.
*   **Tarea 5.2: Validación de Red y Compresión**
    *   Verificar en el navegador que los payloads de la API viajan comprimidos y que las llamadas redundantes a `/me` se redujeron a una sola por sesión de carga.

---

## Criterios de Aceptación
1.  La compresión GZip está activa en el backend.
2.  La cantidad de llamadas al endpoint `/me` al navegar entre dashboards del administrador se reduce a una sola llamada inicial.
3.  El bundle inicial disminuye su peso sustancialmente al remover librerías pesadas (`xlsx`, `html5-qrcode`) del chunk principal.
4.  La compilación de TypeScript y Next.js se completa de manera exitosa y sin warnings de importaciones.
