# Especificación de Diseño: Tabla de Catering y Gestión de Estado Completado

**Fecha:** 2026-07-08  
**Estado:** Propuesto (Pendiente de Aprobación del Usuario)  
**Autor:** Antigravity (AI Coding Assistant)  

---

## 1. Introducción y Objetivos
El módulo de Catering & Eventos (`/admin/production/catering`) actualmente muestra las solicitudes únicamente en formato de tarjetas (grid) y no proporciona una manera directa de cambiar su estado a "Realizado" (completed), a pesar de que la base de datos ya soporta este estado mediante restricciones de comprobación en la tabla `catering_requests`.

Esta especificación detalla el diseño técnico para:
- Implementar una vista alternativa de **tabla** para listar los eventos de catering.
- Incorporar pestañas de filtros rápidos por estado: **Activos**, **Realizados**, **Cancelados** y **Todos**.
- Añadir la capacidad de transicionar el estado de un evento a **Realizado** (completed) o **Cancelado** (cancelled) tanto desde el listado general como desde la consola de detalle del evento.

---

## 2. Requerimientos de Backend

### 2.1. Esquemas de Datos
Se agregará la clase `CateringStatusUpdate` en [schemas.py](file:///C:/Users/dmj-travel/proyectos/verum/backend/app/catering/schemas.py):
```python
from pydantic import BaseModel

class CateringStatusUpdate(BaseModel):
    status: str
```

### 2.2. Endpoints
Se expondrá un nuevo endpoint `PATCH /production/catering/{req_id}/status` en [router.py](file:///C:/Users/dmj-travel/proyectos/verum/backend/app/catering/router.py):
- **Método**: `PATCH`
- **Ruta**: `/production/catering/{req_id}/status`
- **Permisos requeridos**: `production.manage_catering`
- **Acción**: Actualizar el campo `status` del registro en la tabla `catering_requests` con validación estricta de que el estado pertenezca al conjunto `['planning', 'confirmed', 'completed', 'cancelled']`.

---

## 3. Requerimientos de Frontend

### 3.1. API Client
Se registrará la nueva llamada en [api.ts](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/lib/api.ts):
```typescript
updateCateringStatus: (id: string, status: string): Promise<any> =>
    fetchWithAuth(`/production/catering/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    })
```

### 3.2. Pantalla de Listado (`catering/page.tsx`)
Se modificará el componente `CateringListPage` en [page.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/production/catering/page.tsx) para incluir:

- **Estados Interactivos**:
  - `viewMode`: `'grid' | 'table'` (por defecto `'grid'`).
  - `statusTab`: `'active' | 'completed' | 'cancelled' | 'all'` (por defecto `'active'`).
  - `selectedMenuId`: `string | null` (para controlar qué menú contextual de tres puntos está abierto).

- **Filtros por Pestañas**:
  - Un panel de pestañas superiores con el conteo de elementos para filtrar la lista:
    - **Activos**: Eventos en estado `'planning'` o `'confirmed'`.
    - **Realizados**: Eventos en estado `'completed'`.
    - **Cancelados**: Eventos en estado `'cancelled'`.
    - **Todos**: Todos los eventos.

- **Conmutador de Vistas**:
  - Botones con iconos de rejilla (`Grid`) y lista (`LayoutList`) al lado de la barra de filtros.

- **Acciones Rápidas**:
  - En la vista de tabla, un botón directo "Realizado" en cada fila.
  - En ambas vistas, un menú contextual (`MoreVertical`) que permite:
    - Ver Detalle.
    - Cambiar a Planificación (si está confirmado, completado o cancelado).
    - Marcar Realizado.
    - Cancelar Evento.

### 3.3. Pantalla de Detalle (`catering/[id]/page.tsx`)
Se modificará el componente `MRPConsolePage` en [page.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/production/catering/[id]/page.tsx):
- **Actualización de Status Badge**: Mostrar de forma correcta el texto y colores correspondientes al estado `'completed'` (Realizado).
- **Botón de Cabecera**: Agregar un botón principal verde de éxito con el icono `CheckCircle2` y etiqueta "Marcar Realizado", visible solo si el estado actual del evento es distinto de `completed`.
- **Lógica de Ejecución**: Invocar a `updateCateringStatus` y llamar a `loadData()` al completarse.

---

## 4. Pruebas y Criterios de Aceptación
1. Alternar entre vista de cuadrícula (grid) y vista de tabla (table) funciona sin recargar la página.
2. Hacer clic en "Marcar Realizado" en el listado o en el detalle actualiza el estado a `completed` en la base de datos Supabase.
3. Los eventos realizados se ocultan por defecto en la pestaña "Activos" y se muestran en la pestaña "Realizados".
4. La compilación de TypeScript y del backend finalizan sin errores.
