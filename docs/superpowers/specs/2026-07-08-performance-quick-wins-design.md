# Especificación de Diseño: Optimizaciones de Rendimiento — Quick Wins

**Fecha:** 2026-07-08  
**Estado:** Aprobado  
**Alcance:** Optimizaciones de mayor impacto con menor riesgo (80/20)  

---

## 1. Contexto y Diagnóstico

Un análisis exhaustivo del proyecto VERUM reveló múltiples problemas de rendimiento tanto en frontend como en backend. Esta especificación cubre las 4 optimizaciones de mayor impacto que atacan los síntomas principales reportados:

- **Carga inicial lenta** → Bundle JS inflado con librerías pesadas no utilizadas + `next.config.ts` sin optimizaciones.
- **Navegación entre secciones lenta** → Llamadas redundantes a `getProfile()` en 23+ páginas hijas que el layout padre ya resuelve.
- **Lentitud general** → Respuestas JSON del backend viajando sin compresión desde Ohio.

### Problemas identificados pero fuera de alcance (fase futura)
- Integración de librería de caching (SWR / TanStack Query)
- Refactorización de N+1 queries en backend
- Reemplazo de `.select("*")` por columnas específicas
- Paginación en listados grandes
- Migración a React Server Components
- Descomposición de archivos monolíticos (api.ts de 49KB, import-utility de 70KB)

---

## 2. Optimización 1: Compresión GZip en el Backend

### Problema
Las respuestas JSON del backend FastAPI (hospedado en Render, Ohio) viajan sin comprimir. Una respuesta de 50KB podría reducirse a ~8KB con GZip.

### Solución
Agregar `GZipMiddleware` de Starlette en [backend/app/__init__.py](file:///C:/Users/dmj-travel/proyectos/verum/backend/app/__init__.py), inmediatamente después de `CORSMiddleware`.

### Implementación
```python
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=500)
```

### Parámetros
- `minimum_size=500`: Solo comprime respuestas mayores a 500 bytes. Respuestas pequeñas (ej. `{"ok": true}`) no se comprimen porque el overhead de GZip las haría más grandes.

### Riesgo
Mínimo. Es middleware nativo de Starlette/FastAPI. Sin efectos secundarios.

---

## 3. Optimización 2: Eliminar Llamadas Duplicadas a `getProfile()`

### Problema
El layout `admin/layout.tsx` ya llama a `getProfile()` y verifica que el usuario sea admin. Sin embargo, 23+ páginas hijas vuelven a llamar al mismo endpoint `/me`, que ejecuta 3-5 queries secuenciales en Supabase (profile → orgs → venues → shift). Cada navegación interna genera al menos 2 llamadas HTTP idénticas al servidor.

### Páginas afectadas (lista parcial)
- `admin/dashboard/page.tsx`
- `admin/attendance/absences/page.tsx`
- `admin/checklists/dashboard/page.tsx`
- `admin/submissions/page.tsx`
- `admin/templates/page.tsx`
- ~18 archivos más bajo `/admin/`

### Solución
Crear un `ProfileContext` que el `AdminLayout` provea con el perfil cargado.

### Archivos a crear
- `frontend/src/components/ProfileContext.tsx`: Context + Provider + hook `useProfile()`.

### Archivos a modificar
- `frontend/src/app/admin/layout.tsx`: Envolver `{children}` con `<ProfileProvider value={profile}>`.
- ~20 archivos `page.tsx` bajo `/admin/`: Reemplazar `const p = await getProfile()` por `const profile = useProfile()`.

### Comportamiento
- El layout carga el perfil una sola vez al montar.
- Los hijos consumen el perfil del contexto sin hacer requests adicionales.
- Si un componente necesita datos frescos del perfil (caso excepcional), puede seguir llamando a `getProfile()` directamente.

### Riesgo
Bajo. Patrón React estándar. No cambia la lógica de autenticación — el layout sigue siendo el guardián de acceso.

---

## 4. Optimización 3: Dynamic Imports para Librerías Pesadas

### Problema
El bundle inicial de JavaScript incluye librerías que solo se usan en 1-2 páginas específicas:

| Librería | Tamaño aprox. | Usado en |
|----------|--------------|----------|
| `xlsx` | ~500KB | `import-utility/page.tsx` |
| `html5-qrcode` | ~400KB | Páginas de escaneo QR |
| `qrcode` + `qrcode.react` | ~150KB | Páginas de impresión QR |
| `react-datepicker` | ~100KB | `checklists/dashboard` |

Total: ~1.1MB+ de JavaScript cargado innecesariamente en cada visita.

### Solución

#### A) Páginas completas con `next/dynamic`
Para páginas que son inherentemente pesadas y solo se acceden por ruta directa:
```tsx
import dynamic from 'next/dynamic'
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false
})
```

Candidatas:
- `import-utility/page.tsx` (xlsx)
- Componentes de escaneo QR (html5-qrcode)
- Componente de impresión masiva de QR (qrcode.react)

#### B) Imports dinámicos de librerías dentro de handlers
Para librerías que solo se necesitan al ejecutar una acción del usuario:
```tsx
// Antes:
import * as XLSX from 'xlsx'

// Después (dentro del handler):
const handleImport = async () => {
  const XLSX = await import('xlsx')
  // ... usar XLSX
}
```

#### C) `react-datepicker` como dynamic import
Envolver el componente DatePicker en un dynamic import con `ssr: false`.

### Riesgo
Bajo. Las páginas ya muestran spinners de carga. El usuario no notará diferencia excepto que la app carga más rápido inicialmente.

---

## 5. Optimización 4: Configuración de `next.config.ts`

### Problema
El archivo `frontend/next.config.ts` está vacío — no aprovecha optimizaciones de Next.js.

### Solución
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default nextConfig;
```

### Detalle de cada opción

#### `optimizePackageImports`
- **`lucide-react`**: Exporta ~1500 iconos. Sin esta opción, el bundler puede incluir todos aunque solo se importen ~20. Con ella, Next.js aplica tree-shaking agresivo. Reducción estimada: ~150-200KB.
- **`date-fns`**: Exporta ~200 funciones. Mismo principio. Reducción estimada: ~50-100KB.

#### `images.remotePatterns`
Permite usar `next/image` con imágenes de Supabase Storage. Prepara el terreno para reemplazar los 3 tags `<img>` nativos por `<Image>` optimizado en el futuro.

### Riesgo
Mínimo. `optimizePackageImports` es estable desde Next.js 14. No cambia comportamiento visible.

---

## 6. Impacto Esperado

| Optimización | Métrica afectada | Mejora estimada |
|-------------|-----------------|-----------------|
| GZip Backend | Tiempo de respuesta API | 60-80% reducción en tamaño de payload |
| Eliminar getProfile() duplicados | Requests por navegación | ~23 requests menos por sesión |
| Dynamic imports | Bundle size inicial | ~1MB+ menos en carga inicial |
| next.config optimizePackageImports | Bundle size | ~200-300KB menos en bundle |
| **Total** | **Percepción general** | **Carga inicial y navegación significativamente más rápidas** |

---

## 7. Criterios de Aceptación

1. El backend responde con header `Content-Encoding: gzip` para respuestas mayores a 500 bytes.
2. Ninguna página hija bajo `/admin/` llama a `getProfile()` directamente (excepto casos justificados).
3. Las librerías `xlsx`, `html5-qrcode`, `qrcode.react` y `react-datepicker` no aparecen en el bundle inicial (verificable con `next build` analyzer o bundle size output).
4. `npx tsc --noEmit` y `npm run build` completan sin errores en el frontend.
5. La funcionalidad existente no presenta regresiones visibles.
