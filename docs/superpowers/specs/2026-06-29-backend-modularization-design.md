# Diseño: Modularización del Backend VERUM

**Fecha:** 2026-06-29  
**Estado:** Aprobado  
**Autor:** Antigravity + Daniel

---

## Contexto y Problema

El backend de VERUM tiene toda su lógica concentrada en dos archivos monolíticos:

- `main.py`: **6,237 líneas / 270 KB** — contiene 30 secciones con todas las rutas y lógica de negocio.
- `schemas.py`: **875 líneas / 25 KB** — contiene 117 clases Pydantic para todos los dominios.

Esto genera:
- Dificultad para hacer code review (imposible revisar un archivo de 6K líneas).
- Alto riesgo de merge conflicts si hay más de un desarrollador.
- Lentitud para localizar y modificar endpoints específicos.
- Tests acoplados al monolito.

El tamaño recomendado por archivo en proyectos FastAPI profesionales es de 300-500 líneas.

---

## Decisiones de Diseño

| Decisión | Elección | Alternativa descartada |
|----------|----------|----------------------|
| Estilo de arquitectura | **Feature-based** (por dominio) | Layer-based (por capa técnica) |
| Capa de servicios | **No por ahora** — lógica se mantiene en handlers | Service layer con clases de negocio |
| Granularidad | **9 módulos** independientes | 7 módulos consolidados |
| Estrategia de migración | **Incremental** por dominio, un commit por fase | Big bang (todo de una vez) |

---

## Arquitectura Propuesta

### Estructura de Carpetas

```
backend/
├── app/
│   ├── __init__.py              ← create_app() factory + include_router()
│   ├── deps.py                  ← get_active_org_id, require_permission
│   │
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── router.py            ← POST /auth/sync, GET /profile, GET /me/venues
│   │   └── schemas.py           ← SyncResponse, ProfileResponse, VenueInfo, OrgInfo (4 clases)
│   │
│   ├── checklists/
│   │   ├── __init__.py
│   │   ├── router.py            ← GET /checklists, POST /submissions, PUT /answers, history
│   │   ├── schemas.py           ← ChecklistItem, BulkAnswersRequest... (7 clases)
│   │   └── utils.py             ← get_current_shift, get_user_shift_identifier
│   │
│   ├── admin/
│   │   ├── __init__.py
│   │   ├── router.py            ← CRUD venues/templates/questions/users/shifts, compliance, permisos, dashboard
│   │   └── schemas.py           ← CreateVenueRequest, RoleCreate... (13 clases)
│   │
│   ├── superadmin/
│   │   ├── __init__.py
│   │   ├── router.py            ← Global management: orgs, users, metrics
│   │   └── schemas.py           ← SuperAdminUserDetail, SuperAdminOrgDetail... (6 clases)
│   │
│   ├── attendance/
│   │   ├── __init__.py
│   │   ├── router.py            ← Shifts, marking, absences, admin views, reports
│   │   ├── schemas.py           ← MarkAttendanceRequest, AbsenceRequest... (8 clases)
│   │   └── utils.py             ← is_clocked_in, calculate_late_minutes, get_active_shift_for_today, calculate_overtime
│   │
│   ├── inventory/
│   │   ├── __init__.py
│   │   ├── router.py            ← Assets, utensils, repair tickets, movements, counts, schedules, dashboard
│   │   └── schemas.py           ← CreateAssetRequest, UtensilMovementRequest... (24 clases)
│   │
│   ├── production/
│   │   ├── __init__.py
│   │   ├── router.py            ← Warehouses, items, stock movements, physical counts, valuation, adjustments
│   │   └── schemas.py           ← WarehouseCreate, ItemCreate, PhysicalInventoryCreate... (33 clases)
│   │
│   ├── transfers/
│   │   ├── __init__.py
│   │   ├── router.py            ← Transfer documents CRUD
│   │   └── schemas.py           ← TransferCreate, TransferConfirm... (5 clases)
│   │
│   └── catering/
│       ├── __init__.py
│       ├── router.py            ← Catering requests, MRP planning, production orders
│       └── schemas.py           ← CateringRequestCreate, MRPPlanRequest, ProductionOrderCreate... (14 clases)
│
├── main.py                      ← Punto de entrada (~15 líneas): from app import create_app; app = create_app()
├── database.py                  ← Sin cambios
├── config.py                    ← Sin cambios
├── auth_deps.py                 ← Sin cambios (get_current_user, security)
├── permissions.py               ← Sin cambios (resolve_permission, check_restriction, get_super_admin)
└── tests/                       ← Sin cambios en estructura, solo actualización de imports al final
```

### Archivos Clave

#### `main.py` (nuevo — ~15 líneas)

```python
from app import create_app

app = create_app()
```

#### `app/__init__.py` (factory)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

def create_app() -> FastAPI:
    app = FastAPI(title="VERUM API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3001", "https://verum-eta.vercel.app"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.auth.router import router as auth_router
    from app.checklists.router import router as checklists_router
    from app.admin.router import router as admin_router
    from app.superadmin.router import router as superadmin_router
    from app.attendance.router import router as attendance_router
    from app.inventory.router import router as inventory_router
    from app.production.router import router as production_router
    from app.transfers.router import router as transfers_router
    from app.catering.router import router as catering_router

    app.include_router(auth_router)
    app.include_router(checklists_router)
    app.include_router(admin_router)
    app.include_router(superadmin_router)
    app.include_router(attendance_router)
    app.include_router(inventory_router)
    app.include_router(production_router)
    app.include_router(transfers_router)
    app.include_router(catering_router)

    return app
```

#### `app/deps.py` (dependencias universales)

Contiene las dos dependencias que todos los routers necesitan:
- `get_active_org_id()` — resuelve el org_id activo del header X-Org-ID o fallback.
- `require_permission(permission_key)` — dependency factory que valida permisos y restricciones.

Estas funciones se extraen tal cual de las líneas 97-155 del main.py actual.

#### Cada `router.py` (ejemplo patrón)

```python
from fastapi import APIRouter, Depends, HTTPException
from app.deps import require_permission, get_active_org_id
from app.<dominio>.schemas import <SchemaClases>
from database import get_db

router = APIRouter(tags=["<dominio>"])

@router.get("/ruta")
async def endpoint_name(user=Depends(require_permission("dominio.accion"))):
    db = get_db()
    # ... lógica tal cual está hoy en main.py ...
```

---

## Flujo de Dependencias

```
main.py
  └── app/__init__.py (create_app)
        ├── app/deps.py ← get_active_org_id, require_permission
        │     ├── auth_deps.py ← get_current_user
        │     ├── permissions.py ← resolve_permission, check_restriction
        │     └── database.py ← get_db
        │
        ├── app/auth/router.py
        ├── app/checklists/router.py
        │     └── app/checklists/utils.py ← get_user_shift_identifier
        ├── app/admin/router.py
        ├── app/superadmin/router.py
        │     └── permissions.py ← get_super_admin
        ├── app/attendance/router.py
        │     └── app/attendance/utils.py ← calculate_late_minutes, etc.
        ├── app/inventory/router.py
        ├── app/production/router.py
        ├── app/transfers/router.py
        └── app/catering/router.py
```

**Regla de dependencia:** Las flechas van siempre hacia abajo (router → deps → infraestructura). Un router nunca importa de otro router. Si dos dominios comparten algo, ese algo sube a `app/deps.py`.

---

## Mapeo de Secciones → Módulos

### main.py actual → módulo destino

| Sección en main.py | Rango de Líneas | Líneas | Módulo Destino |
|---------------------|----------------|--------|----------------|
| Imports & App Setup | L1–70 | 70 | `app/__init__.py` |
| Helpers | L71–157 | 87 | `app/deps.py` + `app/checklists/utils.py` |
| Routes (Auth/Profile/Checklists) | L158–557 | 400 | `app/auth/router.py` + `app/checklists/router.py` |
| Staff History | L558–914 | 357 | `app/checklists/router.py` |
| Super Admin Global Management | L915–1176 | 262 | `app/superadmin/router.py` |
| Admin CRUD Routes | L1177–1295 | 119 | `app/admin/router.py` |
| Admin Users CRUD | L1296–1516 | 221 | `app/admin/router.py` |
| Admin Shifts CRUD | L1517–1564 | 48 | `app/admin/router.py` |
| Public: Shifts for a venue | L1565–1703 | 139 | `app/checklists/router.py` |
| Admin Submissions List | L1704–1757 | 54 | `app/admin/router.py` |
| Admin Compliance Report | L1758–1966 | 209 | `app/admin/router.py` |
| Permissions & Roles Endpoints | L1967–2045 | 79 | `app/admin/router.py` |
| Inventory: Assets (M8) | L2046–2155 | 110 | `app/inventory/router.py` |
| Inventory: Utensils (M10) | L2156–2200 | 45 | `app/inventory/router.py` |
| Inventory: Repair Tickets (M9) | L2201–2490 | 290 | `app/inventory/router.py` |
| Inventory: Utensil Movements (M11) | L2491–2672 | 182 | `app/inventory/router.py` |
| Inventory: Count Schedules (M11.2) | L2673–2801 | 129 | `app/inventory/router.py` |
| Admin: General Summary (Dashboard) | L2802–2892 | 91 | `app/admin/router.py` |
| Inventory: Dashboard (M10/M12) | L2893–2947 | 55 | `app/inventory/router.py` |
| Attendance: Shifts (M13) | L2948–2979 | 32 | `app/attendance/router.py` |
| Attendance: Marking (M13) | L2980–3176 | 197 | `app/attendance/router.py` |
| Attendance: Absences & Admin (M13) | L3177–3560 | 384 | `app/attendance/router.py` |
| Attendance: History & Reports (M14) | L3561–3672 | 112 | `app/attendance/router.py` |
| Production & Inventory (M16) | L3673–4008 | 336 | `app/production/router.py` |
| Production & Inventory (M17) | L4009–4503 | 495 | `app/production/router.py` |
| Traslados (M18) | L4504–4802 | 299 | `app/transfers/router.py` |
| Production: Recipes (M19) | L4803–4962 | 160 | `app/catering/router.py` |
| Production: Orders (M20) | L4963–5332 | 370 | `app/catering/router.py` |
| Catering & MRP (M22) | L5333–5717 | 385 | `app/catering/router.py` |
| Physical Counts (M39) | L5718–6237 | 520 | `app/production/router.py` |

### schemas.py actual → módulo destino

| Dominio | Clases | Módulo Destino |
|---------|--------|----------------|
| Core/Auth (4 clases) | SyncResponse, ProfileResponse, VenueInfo, OrgInfo | `app/auth/schemas.py` |
| Checklists (7 clases) | ChecklistItem, CreateSubmissionRequest, BulkAnswersRequest... | `app/checklists/schemas.py` |
| Admin (13 clases) | CreateOrgRequest, CreateVenueRequest, RoleCreate... | `app/admin/schemas.py` |
| Super Admin (6 clases) | SuperAdminUserDetail, SuperAdminOrgDetail... | `app/superadmin/schemas.py` |
| Attendance (8 clases) | MarkAttendanceRequest, AbsenceRequest... | `app/attendance/schemas.py` |
| Inventory (24 clases) | CreateAssetRequest, UtensilMovementRequest... | `app/inventory/schemas.py` |
| Production (33 clases) | WarehouseCreate, ItemCreate, PhysicalInventoryCreate... | `app/production/schemas.py` |
| Transfers (5 clases) | TransferCreate, TransferConfirm... | `app/transfers/schemas.py` |
| Catering (14 clases) | CateringRequestCreate, MRPPlanRequest, ProductionOrderCreate... | `app/catering/schemas.py` |

---

## Estrategia de Migración

### Principio: Zero Downtime en Tests

Los 70 tests actuales importan `from main import app`. Para mantener compatibilidad:

```python
# main.py (durante y después de la migración)
from app import create_app
app = create_app()
```

Este import sigue funcionando idénticamente. Los tests no necesitan cambiar hasta que la migración esté completa.

### Orden de Extracción (menor a mayor riesgo)

| Fase | Módulo | Líneas | Tests Afectados | Riesgo |
|------|--------|--------|-----------------|--------|
| 0 | Infraestructura (`app/__init__.py`, `app/deps.py`) | ~80 | 0 (skeleton) | Bajo |
| 1 | transfers | 299 | 0 | Bajo |
| 2 | recipes → catering | 160 + 385 + 370 | 7 (MRP) + 5 (orders) + 2 (recipes) | Bajo |
| 3 | superadmin | 262 | 8 | Bajo |
| 4 | inventory | 811 | 6 | Medio |
| 5 | production | 1,351 | 14 | Medio |
| 6 | attendance | 725 | 4 | Medio |
| 7 | admin | 820 | 5 | Medio |
| 8 | checklists | 1,159 | 7 | Alto |
| 9 | auth | ~200 | 7 | Alto |
| 10 | Limpieza final | — | 70 (todos) | Bajo |

### Mecánica por Fase

```
Para cada módulo:
  1. Crear app/<dominio>/__init__.py, router.py, schemas.py
  2. Mover schemas de schemas.py → app/<dominio>/schemas.py
  3. Mover rutas de main.py → app/<dominio>/router.py
  4. Actualizar imports en el router (deps, schemas, database)
  5. Registrar router en app/__init__.py
  6. Ejecutar .\run_tests.ps1
  7. Si 70 tests pasan → git commit
  8. Si fallan → corregir imports y repetir paso 6
```

### Fase 10: Limpieza Final

Una vez todos los módulos extraídos:
1. Eliminar `schemas.py` raíz (ya distribuido en los 9 módulos).
2. Verificar que `main.py` solo tiene `from app import create_app; app = create_app()`.
3. Actualizar imports de tests opcionalmente (`from main import app` → `from app import create_app`).
4. Ejecutar suite completa una última vez.
5. Commit final.

---

## Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Archivo más grande | 6,237 líneas | ~500 líneas |
| `main.py` | 6,237 líneas | ~15 líneas |
| `schemas.py` | 875 líneas (monolito) | Eliminado, distribuido |
| Módulos independientes | 0 | 9 |
| Tests pasando | 70 | 70 (sin regresión) |
| Tiempo de ejecución de tests | ~3.5s | ~3.5s (sin cambio) |

---

## Consideraciones Futuras (fuera de scope)

- **Service Layer**: Separar la lógica de negocio de los handlers en archivos `service.py` por dominio. Se puede hacer gradualmente después de esta modularización.
- **Tests por dominio**: Mover tests dentro de cada módulo (`app/attendance/tests/`). No es necesario ahora.
- **Alembic migrations**: La carpeta `migrations/` no se ve afectada por esta modularización.
