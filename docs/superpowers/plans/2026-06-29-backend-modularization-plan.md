# Plan de Implementación: Modularización de Backend VERUM

Este plan describe los pasos exactos y secuenciales para llevar a cabo la modularización del backend sin causar regresiones ni romper los 70 tests del suite.

---

## Criterios de Aceptación y Validación

1. **Suite de Pruebas intacta**: Al finalizar cada fase, la suite completa de 70 tests debe pasar con éxito:
   ```powershell
   .\run_tests.ps1
   ```
2. **Cero imports circulares**: FastAPI no debe fallar al iniciarse debido a imports cruzados.
3. **Preservación de Lógica**: No se altera la lógica de negocio; los handlers se cortan y pegan de forma exacta.
4. **Desacoplamiento de Schemas**: `schemas.py` se vacía e importará directamente desde los sub-módulos para evitar romper llamadas legacy externas (si las hay).

---

## Cronograma y Fases Detalladas

### Fase 0: Esqueleto de Aplicación y Dependencias Comunes
**Objetivo**: Crear la estructura básica de FastAPI en `app/` y extraer las dependencias universales.

1. **Crear carpetas base**:
   - `backend/app/`
   - `backend/app/auth/`, `backend/app/checklists/`, `backend/app/admin/`, `backend/app/superadmin/`, `backend/app/attendance/`, `backend/app/inventory/`, `backend/app/production/`, `backend/app/transfers/`, `backend/app/catering/`.
   - Agregar archivos `__init__.py` vacíos en todas las nuevas carpetas.

2. **Crear `backend/app/deps.py`**:
   - Mover helper `get_active_org_id` (L97–118 de `main.py`).
   - Mover helper `require_permission` (L124–155 de `main.py`).
   - Importar `security`, `get_current_user` desde `auth_deps`.
   - Importar `resolve_permission`, `check_restriction` desde `permissions`.
   - Importar `get_db` desde `database`.

3. **Crear `backend/app/__init__.py`**:
   - Definir función `create_app() -> FastAPI`.
   - Copiar la inicialización de FastAPI y middleware CORS (L58–67 de `main.py`).
   - Dejar el registro de routers vacío o comentado.

4. **Modificar `backend/main.py`**:
   - Cortar L58-67 (inicialización y CORS).
   - Reemplazar la instanciación de `app` con:
     ```python
     from app import create_app
     app = create_app()
     ```
5. **Validación**: Correr `.\run_tests.ps1` para asegurar que el app factory arranca.

---

### Fase 1: Extracción del Módulo `transfers` (Traslados M18)
**Objetivo**: Extraer el módulo más sencillo y autocontenido.

1. **Schemas**:
   - Mover clases `TransferLineCreate`, `TransferCreate`, `TransferLineConfirm`, `ConfirmCountRequest` (o equivalentes de traslados L555–581 de `schemas.py`) a `backend/app/transfers/schemas.py`.
2. **Rutas**:
   - Cortar sección `# ── Traslados (M18) ──` (L4504–4802 de `main.py`) a `backend/app/transfers/router.py`.
   - Configurar `router = APIRouter(prefix="/transfers", tags=["transfers"])`.
3. **Registro**:
   - Importar y registrar el router en `backend/app/__init__.py`.
4. **Validación**: `.\run_tests.ps1` (0 tests específicos de traslados, pero verifica que no hay errores sintácticos o de importación).

---

### Fase 2: Extracción de `recipes` y `catering` (MRP y Producción M19, M20, M22)
**Objetivo**: Modularizar la lógica de recetas, catering y planeación MRP.

1. **Schemas**:
   - Mover schemas de recetas (L583–640), órdenes de producción (L642–691) y catering/MRP (L693–744) de `schemas.py` a `backend/app/catering/schemas.py` (o dividir en `recipes/schemas.py` y `catering/schemas.py` según la Opción 1).
2. **Rutas**:
   - Cortar sección `# ── Production: Recipes ──` (L4803–4962), `# ── Production: Orders ──` (L4963–5332) y `# ── Catering & MRP ──` (L5333–5717) a sus respectivos routers.
3. **Registro**:
   - Importar y registrar en `backend/app/__init__.py`.
4. **Validación**: `pytest tests/test_recipes.py tests/test_production_orders.py tests/test_mrp.py` (deben pasar 14 tests).

---

### Fase 3: Extracción de `superadmin`
**Objetivo**: Extraer la administración global.

1. **Schemas**:
   - Mover clases `SuperAdminUserOrgUpdate` hasta `SuperAdminOrgDetail` (L377–415 de `schemas.py`) a `backend/app/superadmin/schemas.py`.
2. **Rutas**:
   - Cortar sección `# ── Super Admin Global Management ──` (L915–1176 de `main.py`) a `backend/app/superadmin/router.py`.
3. **Registro y Validación**:
   - Registrar router.
   - `pytest tests/test_super_admin_metrics.py tests/test_super_admin_orgs.py tests/test_super_admin_security.py tests/test_super_admin_users.py` (deben pasar 8 tests).

---

### Fase 4: Extracción de `inventory` (Assets, Utensils, Repair Tickets M8–M12)
**Objetivo**: Desacoplar el módulo de activos e incidencias.

1. **Schemas**:
   - Mover schemas de activos, utensilios, tickets y conteos (L181–317 de `schemas.py`) a `backend/app/inventory/schemas.py`.
2. **Rutas**:
   - Cortar secciones de inventarios (L2046–2801, L2893–2947 de `main.py`) a `backend/app/inventory/router.py`.
3. **Registro y Validación**:
   - Registrar router.
   - `pytest tests/test_inventory_endpoints.py` (deben pasar 6 tests).

---

### Fase 5: Extracción de `production` (Warehouses, Items, Stock, Physical Counts M16, M17, M39)
**Objetivo**: Extraer la lógica más pesada de inventarios físicos y bodegas.

1. **Schemas**:
   - Mover schemas de bodegas, stock movements, FIFO/PEPS y ajustes (L417–553, L747–875 de `schemas.py`) a `backend/app/production/schemas.py`.
2. **Rutas**:
   - Cortar secciones de producción, stock e inventarios físicos (L3673–4503, L5718–6237 de `main.py`) a `backend/app/production/router.py`.
3. **Registro y Validación**:
   - Registrar router.
   - `pytest tests/test_physical_inventory.py tests/test_bulk_stock_adjust.py tests/test_m23_valuation.py tests/test_m24_stock_alerts.py tests/test_peps_logic.py` (deben pasar 14 tests).

---

### Fase 6: Extracción de `attendance` (Asistencia y Turnos M13, M14)
**Objetivo**: Modularizar el flujo de marcas de entrada/salida y ausencias.

1. **Schemas**:
   - Mover schemas de asistencia (L319–375 de `schemas.py`) a `backend/app/attendance/schemas.py`.
2. **Rutas e Inline Helpers**:
   - Cortar funciones auxiliares `get_active_shift_for_today`, `calculate_late_minutes`, y `calculate_overtime` (L2982–3025) a `backend/app/attendance/utils.py`.
   - Cortar endpoints de asistencia (L2948–2981, L3026–3672 de `main.py`) a `backend/app/attendance/router.py`.
3. **Registro y Validación**:
   - Registrar router.
   - `pytest tests/test_staff_attendance.py tests/test_edit_attendance.py tests/test_manual_attendance.py` (deben pasar 6 tests).

---

### Fase 7: Extracción de `admin` (CRUD Administrativo)
**Objetivo**: Desacoplar la creación de sedes, turnos, usuarios y permisos.

1. **Schemas**:
   - Mover schemas de administración (L100–179 de `schemas.py`) a `backend/app/admin/schemas.py`.
2. **Rutas**:
   - Cortar secciones CRUD de admin, shifts público, submissions admin y compliance (L1177–1564, L1704–2045, L2802–2892 de `main.py`) a `backend/app/admin/router.py`.
3. **Registro y Validación**:
   - Registrar router.
   - `pytest tests/test_admin_crud.py` (deben pasar 5 tests).

---

### Fase 8: Extracción de `checklists`
**Objetivo**: Mover el core del flujo de auditorías.

1. **Schemas**:
   - Mover schemas de checklist y respuestas (L36–98 de `schemas.py`) a `backend/app/checklists/schemas.py`.
2. **Rutas y Helper**:
   - Mover `get_user_shift_identifier` y `get_current_shift` (L73–96 de `main.py`) a `backend/app/checklists/utils.py`.
   - Cortar sección de checklists y staff history (L158–557 y L558–914 de `main.py` excepto el sync de auth) a `backend/app/checklists/router.py`.
3. **Registro y Validación**:
   - Registrar router.
   - `pytest tests/test_checklist_flow.py` (deben pasar 7 tests).

---

### Fase 9: Extracción de `auth`
**Objetivo**: Modularizar el punto de entrada de sincronización de perfiles.

1. **Schemas**:
   - Mover schemas core (`SyncResponse`, `ProfileResponse`, etc.) a `backend/app/auth/schemas.py`.
2. **Rutas**:
   - Cortar el endpoint `POST /auth/sync` y rutas asociadas a `backend/app/auth/router.py`.
3. **Registro y Validación**:
   - Registrar router.
   - `pytest tests/test_profile_multi_tenant.py` (deben pasar 2 tests).

---

### Fase 10: Limpieza y Re-redirección de Schemas Legacy
**Objetivo**: Eliminar archivos huérfanos y asegurar compatibilidad de importaciones externas.

1. **Vaciar schemas.py y re-exportar**:
   - Borrar el código original de `backend/schemas.py`.
   - Escribir re-exportaciones para evitar romper imports absolutos en tests antiguos o código externo:
     ```python
     # backend/schemas.py
     from app.auth.schemas import *
     from app.checklists.schemas import *
     # ... etc para los 9 módulos
     ```
2. **Verificar `main.py`**:
   - Confirmar que solo contiene la importación y llamada de `create_app()`.
3. **Ejecutar Suite Completa**:
   ```powershell
   .\run_tests.ps1
   ```
4. **Git Commit Final**:
   - Hacer commit de la refactorización completada.
