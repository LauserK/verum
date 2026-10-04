# Plan de Implementación: Exportación a Excel (CSV) de Artículos de Inventario en Servidor

Este documento detalla los pasos para implementar el endpoint de backend y la integración en frontend del botón de exportación CSV de artículos en `/admin/inventory/items`.

---

## Fase 1: Backend - Endpoint de Exportación CSV (`FastAPI`)

### Paso 1.1: Agregar Endpoint `GET /inventory/items/export-csv` en `backend/app/production/router.py`
* **Archivo**: `backend/app/production/router.py`
* **Acción**:
  * Definir la ruta `@router.get("/inventory/items/export-csv", tags=["Inventory"])`.
  * Inyectar dependencias:
    * `org_id: str = Depends(get_active_org_id)` (Aislamiento multi-tenant obligatorio)
    * `db = Depends(get_db)`
    * `_ = Depends(require_permission("inventory.view"))`
  * Recibir parámetros opcionales de query:
    * `search: Optional[str] = None`
    * `category_id: Optional[str] = None`
    * `type: Optional[str] = None`
    * `base_uom_id: Optional[str] = None`
    * `sort_by: Optional[str] = "name"`
    * `sort_order: Optional[str] = "asc"`
  * Realizar consulta a `items` con joins a `item_categories(name)` y `uom_base(name, code)` filtrado por `org_id` e `is_active = True`.
  * Aplicar filtros en memoria o query para coincidencia en `search`, `category_id`, `type`, `base_uom_id`.
  * Ordenar los resultados según `sort_by` y `sort_order`.
  * Generar el CSV con `csv.writer`, cabeceras:
    `["Código", "Nombre", "Categoría", "Tipo", "Último Costo", "Unidad Base", "Stock Mínimo"]`
  * Traducir los tipos (`raw_material` -> Materia Prima, `semi_finished` -> Semielaborado, `finished` -> Producto Terminado, `supply` -> Insumo, `packaging` -> Empaque).
  * Formatear valores numéricos (`last_purchase_cost`, `min_stock`) con 2 decimales.
  * Anteponer el BOM UTF-8 `\ufeff` a la salida del CSV.
  * Retornar `StreamingResponse` con `media_type="text/csv; charset=utf-8"` y encabezado `Content-Disposition: attachment; filename="articulos_YYYY-MM-DD.csv"`.

---

## Fase 2: Frontend - Cliente API y Vista

### Paso 2.1: Agregar método de exportación en el cliente API de inventario
* **Archivo**: `frontend/src/lib/api/inventory.ts`
* **Acción**:
  * Agregar método `exportInventoryItemsCsv`:
    ```typescript
    exportInventoryItemsCsv: async (params?: {
      search?: string;
      category_id?: string;
      type?: string;
      base_uom_id?: string;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
    }): Promise<Blob> => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.category_id) searchParams.set('category_id', params.category_id);
      if (params?.type) searchParams.set('type', params.type);
      if (params?.base_uom_id) searchParams.set('base_uom_id', params.base_uom_id);
      if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
      if (params?.sort_order) searchParams.set('sort_order', params.sort_order);

      const queryString = searchParams.toString();
      const endpoint = `/inventory/items/export-csv${queryString ? `?${queryString}` : ''}`;

      return fetchBlobWithAuth(endpoint); // o fetchWithAuth adaptado para Blob
    }
    ```
  * Asegurar que `adminApi` y `inventoryApi` expongan la función.

### Paso 2.2: Integrar el Botón de Exportación en `/admin/inventory/items/page.tsx`
* **Archivo**: `frontend/src/app/admin/inventory/items/page.tsx`
* **Acción**:
  * Importar `Download` de `lucide-react`.
  * Agregar estado `const [exporting, setExporting] = useState(false)`.
  * Implementar `handleExportCsv`:
    * Activar `exporting = true`.
    * Invocar `adminApi.exportInventoryItemsCsv` enviando `searchTerm`, `filterCategory`, `filterType`, `filterUom`, `sortConfig.key`, `sortConfig.direction`.
    * Crear `URL.createObjectURL(blob)` y descargar el archivo temporalmente vía un `<a download="articulos_YYYY-MM-DD.csv">`.
    * Limpiar con `URL.revokeObjectURL(url)`.
    * Manejar errores con `setErrorModal`.
    * Resetear `exporting = false`.
  * Añadir el botón en la barra superior de acciones junto a *"Importar Excel"*.

---

## Fase 3: Validación y Pruebas
1. **Prueba de Endpoint y Multi-tenancy**: Ejecutar prueba con usuario autenticado verificando que no se expongan registros de otra organización.
2. **Prueba de Filtros**: Probar combinación de filtros (categoría + tipo + búsqueda) y verificar que el CSV descargado coincida con los datos mostrados en pantalla.
3. **Prueba de Formato Excel**: Abrir el archivo CSV en Microsoft Excel verificando que caracteres con tildes/ñ y columnas numéricas se visualicen sin necesidad de importar texto delimitado manualmente.
