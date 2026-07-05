# Plan de Implementación: Módulo Unificado de Documentos de Inventario

Este plan describe el desarrollo secuencial del módulo de Documentos de Inventario (ingresos, egresos y traslados) bajo el enfoque de tabla única unificada.

---

## Fases y Tareas de Desarrollo

### 📊 Fase 1: Base de Datos y Migración SQL
*   **Tarea 1.1: Crear archivo de migración SQL**
    *   Archivo: `backend/migrations/044_unified_inventory_documents.sql`
    *   Definir enums `inventory_document_type` (receipt, issue, transfer) e `inventory_document_status` (draft, in_transit, confirmed, cancelled).
    *   Crear tablas `inventory_documents`, `inventory_document_lines` e `inventory_document_sequences`.
    *   Habilitar Row Level Security (RLS) y políticas de acceso para usuarios autenticados.
*   **Tarea 1.2: Escribir e invocar script de migración de datos**
    *   Copiar registros de cabeceras y líneas antiguas (`purchase_receipts`, `issue_documents`, `transfer_documents`) a las nuevas tablas.
    *   Generar los números secuenciales automáticamente con prefijos (`ING-`, `EGR-`, `TRA-`).
    *   Actualizar claves foráneas en `stock_movements`.
    *   Ejecutar `DROP TABLE` para eliminar el esquema antiguo.

### ⚙️ Fase 2: Backend (Modelos y Schemas)
*   **Tarea 2.1: Crear esquemas Pydantic**
    *   Ubicación: `backend/app/production/schemas.py` o un nuevo módulo.
    *   Definir esquemas para creación, respuesta, recepción y actualización de documentos.

### 🔌 Fase 3: Backend (Controlador y Lógica de Negocio)
*   **Tarea 3.1: Implementar Router Único de Documentos**
    *   Archivo: `backend/app/inventory/router.py` (o extenderlo).
    *   Implementar `POST /inventory/documents` (creación en borrador).
    *   Implementar `GET /inventory/documents` e `GET /inventory/documents/{id}` (lectura).
    *   Implementar `PUT /inventory/documents/{id}` (edición de borradores).
*   **Tarea 3.2: Implementar Procesamiento (`/process`)**
    *   Escribir lógica para ingresos (lotes + incremento de stock + Kardex).
    *   Escribir lógica FIFO para egresos (lotes consumidos + decremento stock + Kardex).
    *   Escribir lógica para traslados (FIFO origen + decremento origen + Kardex origen + estado in_transit).
*   **Tarea 3.3: Implementar Recepción de Traslado (`/receive`)**
    *   Lógica para agregar stock a destino (lote TR + Kardex destino + cambiar estado).
*   **Tarea 3.4: Implementar Cancelación y Reversión Automática (`/cancel`)**
    *   Deshacer ingresos (restar lotes/stock + Kardex compensación).
    *   Deshacer egresos (buscar lotes consumidos en movements, reponerlos + Kardex compensación).
    *   Deshacer traslados (reponer origen y, si ya fue recibido, descontar de destino).

### 🧪 Fase 4: Pruebas Unitarias de Backend
*   **Tarea 4.1: Escribir suite de pruebas de integración**
    *   Archivo: `backend/tests/test_m25_inventory_documents.py`
    *   Casos a probar:
        *   Creación de borrador no altera existencias.
        *   Procesar ingreso genera lotes y incrementa stock.
        *   Procesar egreso consume por FIFO y decrementa.
        *   Procesar traslado y confirmación de recepción en destino.
        *   Cancelar ingreso, egreso y traslado revertiendo existencias previas.
    *   Ejecutar suite con pytest.

### 🌐 Fase 5: Integración del Cliente Frontend
*   **Tarea 5.1: Actualizar api.ts**
    *   Archivo: `frontend/src/lib/api.ts`
    *   Definir interfaces TypeScript para los documentos y líneas.
    *   Mapear llamadas HTTP para obtener, crear, editar, procesar, recibir y cancelar documentos.

### 🖥️ Fase 6: Vistas del Frontend (UI/UX)
*   **Tarea 6.1: Pantalla de Historial Unificado**
    *   Ruta: `frontend/src/app/admin/inventory/documents/page.tsx`
    *   Diseño de tabla con filtros, pestañas rápidas y badges semánticos.
*   **Tarea 6.2: Wizard Form Drawer Lateral**
    *   Drawer reutilizable para creación y edición de borradores (inputs específicos según tipo).
*   **Tarea 6.3: Vista de Detalle de Documento**
    *   Ruta: `frontend/src/app/admin/inventory/documents/[id]/page.tsx`
    *   Muestra metadata, desglose de líneas y bitácora de auditoría.
    *   Acciones de Procesar, Recibir o Cancelar.

---

## Criterios de Aceptación
1.  Todas las pruebas de `test_m25_inventory_documents.py` pasan con éxito.
2.  La compilación de TypeScript en el frontend (`npx tsc --noEmit`) no arroja errores.
3.  Los datos históricos de la base de datos se conservan íntegros tras la migración.
