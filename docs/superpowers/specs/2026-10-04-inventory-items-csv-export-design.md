# Design Spec: Exportación a Excel (CSV) de Artículos de Inventario en Servidor

- **Fecha:** 2026-10-04
- **Módulo:** Inventario / Artículos (`/admin/inventory/items`)
- **Estado:** Validado

## 1. Visión General
Proveer una funcionalidad en la vista de administración de artículos de inventario (`/admin/inventory/items`) para exportar a formato CSV compatible con Microsoft Excel el listado de artículos, respetando los filtros activos (búsqueda, categoría, tipo, unidad de medida) y el orden seleccionado, procesado de forma segura y centralizada en el backend.

## 2. Requerimientos

### Funcionales
1. Botón "Exportar Excel" (o "Exportar CSV") visible en la barra de acciones principal de `/admin/inventory/items` con icono representativo (`Download` o `FileSpreadsheet`).
2. La exportación debe procesarse mediante un endpoint dedicado en FastAPI (`GET /inventory/items/export-csv`).
3. El archivo exportado debe reflejar los filtros aplicados en el frontend:
   - Término de búsqueda (`search`)
   - Categoría (`category_id`)
   - Tipo de artículo (`type`)
   - Unidad de medida (`base_uom_id`)
   - Criterio y dirección de ordenamiento (`sort_by`, `sort_order`)
4. El archivo CSV generado debe incluir codificación UTF-8 con BOM (`\ufeff`) para asegurar la visualización correcta de tildes y caracteres especiales al abrirlo en Microsoft Excel.
5. Columnas incluidas en el archivo CSV:
   - **Código** (`code`)
   - **Nombre** (`name`)
   - **Categoría** (nombre de categoría de `item_categories`)
   - **Tipo** (etiqueta legible en español: *Materia Prima*, *Semielaborado*, *Producto Terminado*, *Insumo*, *Empaque*)
   - **Último Costo** (`last_purchase_cost`, formateado numéricamente a 2 decimales o vacío si no tiene costo)
   - **Unidad Base** (código o nombre de `uom_base`)
   - **Stock Mínimo** (`min_stock`, numérico a 2 decimales)
6. Nombre del archivo descargado con formato de fecha: `articulos_YYYY-MM-DD.csv`.

### No Funcionales y Seguridad
1. **Aislamiento Multi-Tenant (Multi-Inquilino):** El endpoint debe verificar obligatoriamente la organización activa (`org_id: str = Depends(get_active_org_id)`) y filtrar únicamente los registros pertenecientes a dicha organización (`eq("org_id", org_id)` y `eq("is_active", True)`).
2. **Control de Acceso:** Requiere el permiso `inventory.view`.
3. **Manejo de Estados y Errores:** Feedback visual durante la descarga (spinner / estado deshabilitado) y captura de errores con el modal de alerta de la vista.

## 3. Arquitectura y Componentes

### 3.1 Backend (FastAPI / Supabase DB)
- **Archivo:** `backend/app/production/router.py`
- **Endpoint:** `GET /inventory/items/export-csv`
- **Parámetros:**
  - `search: Optional[str] = None`
  - `category_id: Optional[str] = None`
  - `type: Optional[str] = None`
  - `base_uom_id: Optional[str] = None`
  - `sort_by: Optional[str] = "name"`
  - `sort_order: Optional[str] = "asc"`
  - `org_id: str = Depends(get_active_org_id)`
  - `db = Depends(get_db)`
  - `_ = Depends(require_permission("inventory.view"))`
- **Proceso:**
  1. Consulta a la tabla `items` con joins a `item_categories(name)` y `uom_base(name, code)`.
  2. Filtrado por `org_id` e `is_active = True`.
  3. Filtrado condicional según los parámetros recibidos (`search`, `category_id`, `type`, `base_uom_id`).
  4. Ordenamiento en memoria o consulta.
  5. Escritura a `io.StringIO` con BOM UTF-8 (`\ufeff`) usando `csv.writer`.
  6. Respuesta mediante `StreamingResponse` con `media_type="text/csv; charset=utf-8"` y cabecera `Content-Disposition`.

### 3.2 Frontend API (`src/lib/api/inventory.ts` & `src/lib/api.ts`)
- Función `exportInventoryItemsCsv`:
  - Recibe objeto de filtros.
  - Realiza `fetch` autenticado a `/inventory/items/export-csv?${queryParams}`.
  - Retorna `Promise<Blob>`.

### 3.3 Frontend Page (`src/app/admin/inventory/items/page.tsx`)
- Estado local `exporting: boolean`.
- Función `handleExportCsv()`:
  - Activa `exporting = true`.
  - Construye parámetros con los filtros activos (`searchTerm`, `filterCategory`, `filterType`, `filterUom`, `sortConfig`).
  - Llama a `adminApi.exportInventoryItemsCsv(params)`.
  - Crea un blob URL (`URL.createObjectURL(blob)`), dispara un click en enlace temporal `<a download="articulos_YYYY-MM-DD.csv">` y revoca el blob.
  - En caso de error, muestra modal de error.
  - Desactiva `exporting`.
- Renderiza el botón "Exportar Excel" junto a "Importar Excel" en el encabezado.

## 4. Pruebas y Criterios de Aceptación
1. **Multi-tenant:** Verificar que solo se descarguen artículos pertenecientes al `org_id` autenticado.
2. **Filtros:** Verificar que al buscar un término o filtrar por una categoría específica, el CSV solo contenga los ítems coincidentes.
3. **Compatibilidad Excel:** Abrir el archivo CSV en Excel para validar que las tildes, caracteres especiales y formato numérico se lean correctamente sin necesidad de asistente de importación.
