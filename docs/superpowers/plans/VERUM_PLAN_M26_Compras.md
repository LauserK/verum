# Plan de Implementación: M26-SRM — Órdenes de Compra y Aprobaciones

Este hito introduce el flujo core de creación, edición y autorización de Órdenes de Compra (PO) en VERUM. Conecta a los proveedores (M25) con los artículos (M6) bajo un proceso estructurado con controles de monto por rol.

## Fase 1: Base de Datos (Supabase)
**Script de migración:** `backend/migrations/050_srm_purchase_orders.sql`

1. **Tablas Principales:**
   - `purchase_orders`: Información general (número autogenerado, proveedor, fecha solicitada, moneda, total, estado).
   - `purchase_order_lines`: Detalle por artículo, cantidades pedidas en presentación y base, costo unitario base, cálculo de subtotal.
   - `po_approvals`: Historial de auditoría para registrar cada intento de aprobación o rechazo (quién, cuándo, nota y acción).

2. **Tipos y Restricciones:**
   - Validar transiciones de estado a través de checks (`draft`, `pending`, `approved`, `sent`, etc.).
   - Constraint para evitar precios unitarios negativos o cantidades en cero.

3. **Políticas de Seguridad (RLS):**
   - Solo los usuarios de la organización autenticada pueden leer sus POs.
   - Restringir la creación/edición a usuarios autenticados.

## Fase 2: Backend (FastAPI)
**Ubicación:** `backend/app/purchasing/`

1. **Esquemas (Pydantic v2):**
   - Definir `PurchaseOrderCreate`, `PurchaseOrderUpdate`, `PurchaseOrderOut`.
   - Definir `PurchaseOrderLineCreate`, con validadores para asegurar concordancia matemática (`line_total = qty * unit_cost`).
   - Definir `ApprovalActionCreate` (para rechazar/aprobar enviando notas).

2. **Endpoints API:**
   - `GET /purchase-orders` (con filtros `status`, `supplier_id`).
   - `GET /purchase-orders/{id}` (PO completa con historial de aprobaciones).
   - `POST /purchase-orders` (Crear PO en draft).
   - `PATCH /purchase-orders/{id}` (Editar mientras está en `draft`).
   - `POST /purchase-orders/{id}/submit` (Cambiar a `pending` para revisión).
   - `POST /purchase-orders/{id}/approve` (Aprobar). Lógica fuerte:
     - Leer configuración global `po_approval_config` (validar si el creador puede auto-aprobarse).
     - Leer el `max_amount` del perfil del aprobador (`po_approval_limits`).
     - Rechazar con error HTTP 403 si el monto de la PO supera su límite.
   - `POST /purchase-orders/{id}/reject` (Devolver a `draft` con una nota obligatoria).
   - `POST /purchase-orders/{id}/cancel` (Anular permanentemente).

## Fase 3: Frontend (Next.js)
**Ubicación:** `frontend/src/app/purchasing/orders/`

1. **Cliente API:**
   - Ampliar `frontend/src/lib/api/purchasing.ts` con todos los nuevos métodos HTTP (GET, POST, PATCH y endpoints de acción).

2. **Vistas e Interfaces:**
   - **`/purchasing/orders`:**
     - Tabla/Listado principal con badges de estado de colores.
     - Filtros por estado, fecha y proveedor.
   - **`/purchasing/orders/new`:**
     - Formulario master-detail.
     - Cabecera: Selector de proveedor en caliente.
     - Líneas: Búsqueda de artículos filtrada por el proveedor elegido (utilizando catálogo). Input de cantidades y visualización en tiempo real del subtotal, impuestos y total global.
   - **`/purchasing/orders/[id]`:**
     - Pantalla de solo lectura y revisión operativa.
     - **Timeline superior:** Progreso visual del documento (Borrador → Pendiente → Aprobada).
     - **Panel de acciones flotante/fijo:** Botones contextuales dinámicos. Por ejemplo, "Enviar a Aprobación" si es draft; "Aprobar" / "Rechazar" si está pendiente y se tienen permisos.
     - Pestaña inferior de **Historial de Aprobaciones** para trazar notas de revisión.

## Criterios de Aceptación
1. Poder crear una PO de varios ítems y que la suma sea precisa.
2. Un usuario con un límite de $1,000 debe recibir un error si intenta aprobar una PO de $1,500.
3. El rol "dueño" puede aprobar cualquier monto (límite nulo).
4. El timeline debe reflejar instantáneamente el paso de `draft` a `pending` y de `pending` a `approved`.
