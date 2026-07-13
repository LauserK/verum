# Plan de Implementación: M25-SRM — Directorio de Proveedores y Catálogos de Precios

**Enfoque:** TDD (Test Driven Development)
**Stack Tecnológico:** FastAPI, Pydantic, Supabase Python Client (Backend), Next.js (Frontend).
**Regla Estricta:** El frontend NO se comunica directamente con Supabase; todas las consultas y mutaciones de datos pasan por la API de FastAPI.

---

## Fase 1: Base de Datos y Esquemas Pydantic

**Objetivo:** Preparar la infraestructura de PostgreSQL en Supabase y los validadores de datos.

1. **Migración SQL nativa (`backend/migrations/045_srm_suppliers.sql`):**
   - Crear tablas: `suppliers`, `supplier_contacts`, `supplier_items`, `supplier_price_lists`, `supplier_price_list_items`, `po_approval_config`, `po_approval_limits`.
2. **Esquemas Pydantic (`backend/schemas.py`):**
   - Modelos base y de respuesta: `SupplierBase`, `SupplierResponse`, `SupplierContactResponse`, etc.
   - Modelos de creación: `SupplierCreate` (incluyendo validación de límite de crédito y días de pago), `SupplierPriceListCreate`.

---

## Fase 2: Backend (Desarrollo Guiado por Pruebas - TDD)

**Objetivo:** Implementar los endpoints de FastAPI y la interacción directa con Supabase mediante el cliente de Python.

1. **Escribir Pruebas (`backend/tests/test_suppliers.py`) (🔴 RED):**
   - Utilizar `pytest` y `httpx.AsyncClient` para simular peticiones.
   - `test_create_supplier`: Enviar payload a `POST /api/suppliers` y verificar `201 Created`.
   - `test_create_price_list_overlap`: Crear un catálogo para un proveedor, intentar crear un segundo catálogo con fechas entrelazadas, y validar que arroje `400 Bad Request`.
   - `test_po_approval_limits_owner`: Validar `PUT /api/po-approval-limits` forzando que el rol dueño mantenga `max_amount=null`.
   - *(Mocking del cliente supabase-py usando `pytest-mock` o BDD local).*

2. **Implementación de Rutas (`backend/app/routers/suppliers.py`) (🟢 GREEN):**
   - Crear rutas de FastAPI (`@router.post("/suppliers")`, `@router.get("/suppliers")`, etc.).
   - Integrar lógica usando el cliente de Supabase:
     `supabase.table("suppliers").insert(data).execute()`
   - Incluir validación de solapamiento de fechas del tarifario consultando previamente la base de datos.
   - Agregar el router en `backend/main.py`.

3. **Optimización (🔵 REFACTOR):**
   - Inyectar correctamente la autenticación (`Depends(require_auth)`) definida en `auth_deps.py`.
   - Normalizar el formateo de errores que provienen de `supabase-py`.

---

## Fase 3: Frontend (React / Next.js - Enfoque TDD)

**Objetivo:** Construir la interfaz de usuario asegurando que se consume la API del backend.

1. **Escribir Pruebas Unitarias (🔴 RED):**
   - Escribir tests para el directorio `frontend/src/app/suppliers`.
   - Comprobar que el componente formulario no permita "Submit" si faltan campos obligatorios.
   - Testear el cambio entre pestañas en el detalle del proveedor.

2. **Implementación UI (🟢 GREEN):**
   - Construir página `/suppliers` (Dashboard tipo lista de proveedores).
   - Construir vista completa de `/suppliers/new` y `/suppliers/[id]`.
   - Construir pestañas: Información, Contactos, Ítems y Catálogo de Precios.
   - Crear página administrativa `/admin/settings/purchasing/page.tsx` para límites de aprobación.
   - Consumir los endpoints de FastAPI mediante el cliente API del frontend.

3. **Optimización (🔵 REFACTOR):**
   - Extraer lógica hacia Custom Hooks (ej. `useSuppliers`).
   - Mejorar feedback visual (spinners de carga, notificaciones toast en errores o éxitos).

---

## Fase 4: Criterio de Éxito y Validación (E2E)

1. El admin entra y crea al proveedor **"Distribuidora XYZ"** (condiciones 30 días).
2. Se le vincula el artículo interno **"Harina 00"** como ítem preferido.
3. Se le carga un catálogo de precios vigente **hasta Dic 2024**.
4. Fin de M25-SRM, preparando el sistema para M26-SRM (Órdenes de Compra automatizadas).
