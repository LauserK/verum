# Plan de Implementación: Tabla de Catering y Gestión de Estado Completado

Este plan describe las tareas de desarrollo secuenciales para implementar la vista de tabla alternativa, la barra de filtros por pestañas de estado y el cambio de estado a "Realizado" (completed) en el módulo de Catering & Eventos de VERUM.

---

## Fases y Tareas de Desarrollo

### ⚙️ Fase 1: Backend (Schemas & Router)
*   **Tarea 1.1: Agregar modelo Pydantic para actualización de estado**
    *   Archivo: [schemas.py](file:///C:/Users/dmj-travel/proyectos/verum/backend/app/catering/schemas.py)
    *   Definir la clase `CateringStatusUpdate(BaseModel)` con el campo `status: str`.
*   **Tarea 1.2: Crear el endpoint de actualización de estado**
    *   Archivo: [router.py](file:///C:/Users/dmj-travel/proyectos/verum/backend/app/catering/router.py)
    *   Importar `CateringStatusUpdate`.
    *   Implementar la ruta `PATCH /production/catering/{req_id}/status` validando permisos y que el estado sea válido (`planning`, `confirmed`, `completed`, `cancelled`).
    *   Actualizar el campo `status` del registro correspondiente en `catering_requests`.

### 🔌 Fase 2: API Client Frontend
*   **Tarea 2.1: Registrar el endpoint en el cliente HTTP**
    *   Archivo: [api.ts](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/lib/api.ts)
    *   Agregar la función `updateCateringStatus(id, status)` llamando con el método `PATCH` y enviando el payload JSON.

### 🖥️ Fase 3: Interfaz del Listado (`catering/page.tsx`)
*   **Tarea 3.1: Actualizar importaciones y estados**
    *   Archivo: [page.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/production/catering/page.tsx)
    *   Importar iconos `Grid` y `LayoutList` de `lucide-react`.
    *   Definir estados `viewMode` ('grid' | 'table'), `statusTab` ('active' | 'completed' | 'cancelled' | 'all') y `selectedMenuId: string | null`.
*   **Tarea 3.2: Implementar los controles de filtrado y visualización**
    *   Añadir la barra de pestañas para filtrar por estado arriba del listado.
    *   Insertar los botones de selección de vista (rejilla/lista) en el panel de filtros.
*   **Tarea 3.3: Desarrollar la Vista de Tabla**
    *   Diseñar la tabla responsiva con columnas: Evento, Fecha, Notas, Estado y Acciones.
    *   Agregar un botón rápido "Realizado" en las filas y el menú contextual `MoreVertical` con acciones rápidas para transicionar estados.
    *   Renderizar condicionalmente la tabla o el grid actual según el estado `viewMode`.

### 🖥️ Fase 4: Interfaz de Detalle (`catering/[id]/page.tsx`)
*   **Tarea 4.1: Añadir soporte para el estado `completed`**
    *   Archivo: [page.tsx](file:///C:/Users/dmj-travel/proyectos/verum/frontend/src/app/admin/production/catering/[id]/page.tsx)
    *   Actualizar la visualización y traducción del badge de estado.
*   **Tarea 4.2: Incorporar el botón "Marcar Realizado"**
    *   Crear el botón en la cabecera visible solo si el estado es diferente de `completed`.
    *   Implementar la función `handleMarkCompleted` que llame a la API, actualice la información local y recargue la página.

### 🧪 Fase 5: Pruebas y Verificación
*   **Tarea 5.1: Validación e Integración**
    *   Compilar y probar que no existan errores estáticos en TypeScript con `npx tsc --noEmit`.
    *   Verificar transiciones de estados y filtrado en caliente en el navegador.

---

## Criterios de Aceptación
1.  El backend actualiza el estado de las solicitudes de catering a `completed` sin errores de RLS o base de datos.
2.  La vista de tabla renderiza la información de los eventos de forma limpia e idéntica a la maqueta aprobada.
3.  Las pestañas de estado segmentan adecuadamente los eventos ("Activos" muestra planificación y confirmados, "Realizados" muestra completados).
4.  La compilación de TypeScript no tiene errores.
