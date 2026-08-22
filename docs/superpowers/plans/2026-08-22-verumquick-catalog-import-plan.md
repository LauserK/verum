# Implementation Plan: Importación de Catálogo desde VerumQuick a VERUM (TDD)

**Fecha:** 2026-08-22  
**Spec de referencia:** `docs/superpowers/specs/2026-08-22-verumquick-catalog-import-design.md`  
**Metodología:** Test-Driven Development (TDD)

---

## Tareas de Implementación

### Fase 1: Backend & Modelos de Importación (TDD)
- [ ] **Tarea 1.1: Schemas y Modelos Pydantic**
  - Archivo: `backend/app/integrations/schemas.py`
  - Definir `QuickCatalogPreviewResponse`, `QuickCatalogImportRequest`, `QuickCatalogImportResponse`.
- [ ] **Tarea 1.2: Tests Unitarios de Importación**
  - Archivo: `backend/tests/test_quick_import.py`
  - Casos de prueba:
    - Preview de catálogo con mock de VerumQuick.
    - Importación de categorías, grupos de modificadores y opciones.
    - Importación de productos de venta, variantes y vinculación `sale_item_modifier_groups`.
    - Fusión / match de productos ya existentes (evitar duplicación).
    - Invalidación de caché (`invalidate_sales_catalog`).
- [ ] **Tarea 1.3: Servicio de Importación de Catálogo**
  - Archivo: `backend/app/integrations/service.py`
  - Implementar funciones `fetch_quick_catalog_preview(org_id, db)` y `execute_quick_catalog_import(org_id, payload, db)`.
- [ ] **Tarea 1.4: Endpoints en FastAPI**
  - Archivo: `backend/app/integrations/router.py`
  - Exponer:
    - `GET /integrations/quick/preview-catalog`
    - `POST /integrations/quick/import-catalog`

---

### Fase 2: Frontend & Wizard de Importación
- [ ] **Tarea 2.1: Cliente API de Integración**
  - Archivo: `frontend/src/lib/api/integrations.ts` (o `base.ts`)
  - Métodos `previewQuickCatalog()` e `importQuickCatalog()`.
- [ ] **Tarea 2.2: Componente Modal Wizard (`QuickCatalogImportModal.tsx`)**
  - Archivo: `frontend/src/components/integrations/QuickCatalogImportModal.tsx`
  - Pasos:
    1. Vista previa de datos detectados en VerumQuick.
    2. Configuración de opciones (sobrescribir precios, vincular existentes).
    3. Progreso visual de importación y confirmación.
- [ ] **Tarea 2.3: Integración en la UI de Ajustes**
  - Archivo: `frontend/src/components/integrations/VerumQuickCard.tsx`
  - Agregar botón "Importar Catálogo desde VerumQuick" con trigger al modal.

---

### Fase 3: Validación y Verificación
- [ ] **Tarea 3.1: Ejecución de Tests del Backend**
  - Validar paso de tests con mock de respuesta de VerumQuick.
- [ ] **Tarea 3.2: Verificación de Build en Frontend**
  - Ejecutar `next build` en `frontend/` para garantizar consistencia de tipos TypeScript.
