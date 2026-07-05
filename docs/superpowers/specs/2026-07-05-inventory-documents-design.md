# Especificación de Diseño: Módulo Unificado de Documentos de Inventario

---
name: inventory-documents-design
description: Diseño técnico y de interfaz para el módulo unificado de documentos de inventario (ingresos, egresos y traslados) bajo el enfoque de tabla única.
---

## 1. Contexto y Objetivos

Actualmente, en VERUM, los movimientos de inventario de materias primas (compras, ajustes y traslados) se ejecutan de manera directa y permanente en el momento de su registro. No existe la capacidad de guardar un trabajo en progreso como **borrador**, ni de **cancelar** un documento erróneo de forma limpia con una reversión automática de existencias. Además, la lógica de base de datos y la API están dispersas en múltiples tablas y routers independientes, lo cual incrementa la complejidad del frontend y duplica esfuerzos de mantenimiento.

Este diseño propone:
*   **Enfoque de Tabla Única:** Unificar las cabeceras y líneas de ingresos, egresos y traslados en las tablas `inventory_documents` e `inventory_document_lines`.
*   **Ciclo de Vida del Documento:** Introducir los estados `draft` (Borrador), `in_transit` (En Tránsito - para traslados), `confirmed` (Confirmado/Ejecutado), y `cancelled` (Cancelado).
*   **Reversión Automática:** Permitir la cancelación de documentos ejecutados, realizando las compensaciones correspondientes en el Kardex y reponiendo/restando el stock físico de forma transparente.
*   **Numeración Unificada:** Secuencia secuenciada automática con prefijos (`ING-XXXX` para ingresos, `EGR-XXXX` para egresos, `TRA-XXXX` para traslados).
*   **Interfaz Unificada:** Una única pantalla del historial de documentos en Next.js con un formulario lateral dinámico.

---

## 2. Arquitectura de Datos (PostgreSQL en Supabase)

### 2.1 Enums y Estructura de Tablas

Se crearán las siguientes tablas unificadas en reemplazo de `purchase_receipts`, `purchase_receipt_lines`, `issue_documents`, `issue_document_lines`, `transfer_documents` y `transfer_document_lines`.

```sql
-- Tipos de documentos en inglés
CREATE TYPE public.inventory_document_type AS ENUM ('receipt', 'issue', 'transfer');

-- Estados del ciclo de vida del documento
CREATE TYPE public.inventory_document_status AS ENUM ('draft', 'in_transit', 'confirmed', 'cancelled');

-- Cabecera de los Documentos de Inventario
CREATE TABLE public.inventory_documents (
  id                        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id                    UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  document_type             public.inventory_document_type NOT NULL,
  document_number           TEXT NOT NULL, -- Ej: ING-0023, EGR-0004, TRA-0102
  status                    public.inventory_document_status DEFAULT 'draft' NOT NULL,
  
  -- Almacenes
  warehouse_id              UUID REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL, -- Almacén origen o principal
  destination_warehouse_id  UUID REFERENCES public.warehouses(id) ON DELETE CASCADE,          -- Nulo excepto para 'transfer'
  
  -- Metadatos específicos
  supplier                  TEXT, -- Nulo excepto para 'receipt'
  reason                    TEXT, -- Nulo excepto para 'issue' (sale, adjustment, waste, internal_consumption)
  
  notes                     TEXT,
  created_by                UUID REFERENCES public.profiles(id) NOT NULL,
  processed_by              UUID REFERENCES public.profiles(id),
  processed_at              TIMESTAMP WITH TIME ZONE,
  cancelled_by              UUID REFERENCES public.profiles(id),
  cancelled_at              TIMESTAMP WITH TIME ZONE,
  created_at                TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Restricción para garantizar numeración secuencial única por organización
  CONSTRAINT unique_org_document_number UNIQUE (org_id, document_number)
);

-- Detalle/Líneas de los Documentos
CREATE TABLE public.inventory_document_lines (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id           UUID REFERENCES public.inventory_documents(id) ON DELETE CASCADE NOT NULL,
  item_id               UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  
  -- Cantidad especificada en presentación
  qty_presentation          NUMERIC(18, 6) NOT NULL,
  presentation_id           UUID REFERENCES public.uom_presentations(id),
  qty_base                  NUMERIC(18, 6) NOT NULL, -- Cantidad convertida a base UOM
  
  -- Específico para 'receipt' (Compras)
  unit_cost_presentation    NUMERIC(18, 6),
  unit_cost_base            NUMERIC(18, 6),
  lot_number                TEXT,
  expiry_date               DATE,
  
  -- Específico para 'transfer' (Recepción)
  qty_received_presentation NUMERIC(18, 6),
  qty_received_base         NUMERIC(18, 6)
);
```

### 2.2 Secuencias de Documentos
Para evitar colisiones de numeración concurrente en un entorno multi-tenant, se creará una tabla que guarde el conteo secuencial por organización y tipo de documento:

```sql
CREATE TABLE public.inventory_document_sequences (
  org_id        UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  document_type public.inventory_document_type NOT NULL,
  last_value    INTEGER DEFAULT 0 NOT NULL,
  PRIMARY KEY (org_id, document_type)
);
```

Se utilizará una función de base de datos o lógica en FastAPI que ejecute un `UPSERT` seguro para obtener y avanzar la secuencia antes de guardar la cabecera.

---

## 3. Plan de Migración de Datos

Para asegurar una transición fluida en desarrollo y producción, se diseñará un script SQL que realice los siguientes pasos de migración:

1.  **Migrar cabeceras de compras:**
    Insertar de `purchase_receipts` a `inventory_documents` con `document_type = 'receipt'`, `status = 'confirmed'`, mapeando `confirmed_at` a `processed_at`, y asignando un número secuencial correlativo incremental por organización.
2.  **Migrar cabeceras de egresos:**
    Insertar de `issue_documents` a `inventory_documents` con `document_type = 'issue'`, `status = 'confirmed'`, mapeando `created_at` a `processed_at`, y asignando números secuenciales correlativos con prefijo `EGR-`.
3.  **Migrar cabeceras de traslados:**
    Insertar de `transfer_documents` a `inventory_documents` con `document_type = 'transfer'`, mapeando los estados `'confirmed'` / `'confirmed_with_discrepancy'` a `'confirmed'` y `'in_transit'` a `'in_transit'`. Asignar prefijo `TRA-`.
4.  **Migrar líneas de detalles:**
    Migrar líneas de `purchase_receipt_lines`, `issue_document_lines` y `transfer_document_lines` a `inventory_document_lines`, enlazándolas con los nuevos IDs asignados a los documentos migrados en el paso anterior.
5.  **Actualizar Historial de Movimientos (`stock_movements`):**
    Reemplazar las referencias en la tabla `stock_movements`. Las filas con `reference_type` igual a `'purchase_receipt'`, `'issue_document'` o `'transfer_document'` pasarán a ser `'inventory_document'`, y su `reference_id` se reasignará al nuevo ID unificado.
6.  **Eliminación de Tablas Antiguas:**
    Ejecutar `DROP TABLE` sobre las seis tablas obsoletas.

---

## 4. Endpoints de la API del Backend (FastAPI)

Los routers de `/inventory/purchase-receipts`, `/inventory/issue-documents` y `/inventory/transfers` se deprecian y se consolidan bajo un único router `/inventory/documents` en el backend.

### 2.1 Esquemas Pydantic (Request/Response)
```python
class InventoryDocumentLineSchema(BaseModel):
    item_id: UUID
    qty_presentation: float
    presentation_id: Optional[UUID] = None
    
    # Solo para 'receipt'
    unit_cost_presentation: Optional[float] = None
    lot_number: Optional[str] = None
    expiry_date: Optional[str] = None

class InventoryDocumentCreate(BaseModel):
    document_type: str # 'receipt', 'issue', 'transfer'
    warehouse_id: UUID
    destination_warehouse_id: Optional[UUID] = None
    supplier: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    lines: List[InventoryDocumentLineSchema]

class InventoryDocumentResponse(BaseModel):
    id: UUID
    document_type: str
    document_number: str
    status: str
    warehouse_id: UUID
    destination_warehouse_id: Optional[UUID] = None
    supplier: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None
```

### 2.2 Flujos de Lógica de Transiciones

#### A. Procesar Documento (`POST /inventory/documents/{id}/process`)
Este endpoint ejecuta el stock físico al confirmar el borrador:
*   **Si es ingreso (`receipt`):**
    *   Genera registros en `stock_lots` con cantidades y costos base calculados.
    *   Incrementa existencias en `stock`.
    *   Actualiza el `last_purchase_cost` del artículo en la tabla `items`.
    *   Inserta fila en `stock_movements` (tipo `purchase`, valor positivo).
*   **Si es egreso (`issue`):**
    *   Consume existencias aplicando el algoritmo **FIFO** sobre los lotes del almacén.
    *   Deduce cantidades de `stock`.
    *   Inserta filas en `stock_movements` (tipo `adjustment_out` o `sale`, valor negativo).
*   **Si es traslado (`transfer`):**
    *   Consume existencias por **FIFO** del almacén de origen.
    *   Deduce stock del almacén de origen en `stock`.
    *   Registra en `stock_movements` (tipo `transfer_out`, valor negativo) con referencia al traslado.
    *   Transiciona el estado a `'in_transit'`.

#### B. Recibir Traslado (`POST /inventory/documents/{id}/receive`)
Exclusivo para traslados en tránsito. El usuario del almacén destino registra la recepción física:
1.  Compara cantidades recibidas contra enviadas. Si hay discrepancia, se computa.
2.  Crea lotes de inventario en destino (`stock_lots`) con el costo ponderado arrastrado desde el origen.
3.  Incrementa cantidades en `stock` en el almacén de destino.
4.  Crea registros en `stock_movements` (tipo `transfer_in`, valor positivo).
5.  Actualiza el estado del documento a `'confirmed'` o `'confirmed_with_discrepancy'`.

#### C. Cancelar Documento (`POST /inventory/documents/{id}/cancel`)
Transiciona el estado a `'cancelled'` y revierte existencias:
*   **Ingresos (`receipt`):**
    *   Ubica el lote creado por la compra, resta la cantidad original e invalida el lote si queda en cero o negativo.
    *   Resta la cantidad total de la tabla `stock`.
    *   Registra una salida de compensación en `stock_movements`.
*   **Egresos (`issue`):**
    *   Consulta en `stock_movements` los lotes afectados y les suma de vuelta el stock consumido.
    *   Incrementa la tabla `stock`.
    *   Registra una entrada de compensación en `stock_movements`.
*   **Traslados (`transfer`):**
    *   *Si estaba en tránsito:* Revierte solo el descuento del almacén de origen reponiendo sus lotes originales.
    *   *Si estaba confirmado:* Revierte los lotes de origen y descarga del almacén destino el stock sumado durante la recepción.

---

## 5. Diseño de Interfaz del Frontend (Next.js)

### 5.1 Pantalla de Historial Unificado
Alojada en [frontend/src/app/admin/inventory/documents/page.tsx] (nueva pantalla):
*   Un grid o listado que resume el número de documento (`ING-001`), tipo (`receipt`, `issue`, `transfer`) representado por un badge de color diferente, fecha de creación, almacenes de origen y destino, creador y estado.
*   Filtros dinámicos por almacén, tipo de documento y estado.
*   Botón principal **"+ Nuevo Documento"** que abre un menú de selección de tipo para instanciar el Drawer correspondiente.

### 5.2 Wizards Laterales de Creación y Edición
Drawer dinámico lateral que adapta sus entradas según el tipo elegido:
*   Ingresos ➔ Solicita selección de almacén origen, input para Proveedor, input opcional para Nro. de Factura, y cuadrícula de líneas con campos de artículo, unidad de presentación, cantidad, costo unitario, lote y vencimiento.
*   Egresos ➔ Solicita almacén origen, motivo de salida (ajuste, consumo, merma, venta) y cuadrícula de líneas.
*   Traslados ➔ Solicita almacén origen y almacén destino (excluyendo el origen), notas y cuadrícula de líneas de artículos con cantidades a enviar.

---

## 6. Lista de Control de QA y Éxito

Para dar la tarea por completada, se deben satisfacer los siguientes criterios en el entorno de pruebas:
1.  **Pruebas de Estado:** Crear un documento de ingreso en estado `draft` y confirmar que no altere el stock físico de la base de datos hasta llamar a `/process`.
2.  **Pruebas FIFO de Reversión:** Ejecutar un documento de egreso, verificar los lotes consumidos, cancelarlo y verificar que el stock de esos mismos lotes en `stock_lots` haya retornado a su valor exacto previo a la salida.
3.  **Pruebas de Traslado:** Ejecutar un traslado, verificar que reste stock en el origen y quede como `in_transit`. Luego, llamar a `/receive` y confirmar que sume en el destino. Cancelar el traslado confirmado y validar que tanto el origen como el destino vuelvan a su balance inicial.
4.  **Consistencia de Tipos:** Ejecutar el comando de typecheck del frontend (`npx tsc --noEmit`) y validar que compile sin errores.
