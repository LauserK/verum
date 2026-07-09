# Dashboard Performance Optimization — Design Spec

**Fecha**: 2026-07-09  
**Estado**: Draft  
**Alcance**: Frontend + Backend ligero  

---

## Problema

La ruta `/dashboard` tarda ~3.3-5s en cargar después del login. Las causas raíz son:

1. `getProfile()` se llama **dos veces en secuencia** (VenueContext + Dashboard page)
2. El endpoint `/me` hace 5-6 queries secuenciales al DB (dos de ellas duplicadas sobre `profile_organizations`)
3. El endpoint `/checklists/{venue_id}` hace ~15 queries secuenciales (la cadena de permisos repite consultas)
4. No hay cache ni deduplicación de datos en el frontend

**Objetivo**: Reducir el tiempo de carga del dashboard de ~3.3-5s a ~1.2-1.5s.

---

## Solución

### Enfoque seleccionado

**React Query + reducción de queries backend** (riesgo medio, impacto alto ~60% reducción).

---

## 1. Frontend: React Query Integration

### 1.1 Dependencia nueva

Agregar `@tanstack/react-query` (y opcionalmente `@tanstack/react-query-devtools` como devDependency).

### 1.2 Nuevo archivo: `src/lib/queryClient.ts`

Configuración central del QueryClient:

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

### 1.3 Nuevo hook: `src/hooks/useProfile.ts`

Reemplaza las llamadas directas a `getProfile()` con un hook que deduplica y cachea:

```typescript
import { useQuery } from '@tanstack/react-query'
import { getProfile, type Profile } from '@/lib/api'

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 30_000,   // 30s — el perfil no cambia frecuentemente
    gcTime: 5 * 60_000,  // 5min garbage collection
  })
}
```

### 1.4 Modificar: `src/app/layout.tsx`

Agregar `QueryClientProvider` en la jerarquía de providers:

```
ThemeProvider
  → I18nProvider
    → QueryClientProvider        ← NUEVO (debe estar antes de VenueProvider)
      → VenueProvider
        → AttendanceGuard
          → {children}
```

### 1.5 Refactorizar: `src/components/VenueContext.tsx`

**Cambios**:
- Reemplazar la llamada manual a `getProfile()` en el `useEffect` por `useProfile()`
- Eliminar la dependencia circular del `useEffect` en `[activeOrgIdState, selectedVenueIdState]`
- Usar `data` y `isLoading` de React Query en vez de estado manual
- Mantener la lógica de localStorage para persistir venue/org selection
- El efecto que procesa el profile solo depende de `profile` (data de React Query) para derivar orgs y venues

**Lógica preservada**:
- Determinar org activa desde localStorage o primera org
- Filtrar venues por org activa
- Guardar selección en localStorage

### 1.6 Refactorizar: `src/app/dashboard/page.tsx`

**Cambios**:
- Usar `useProfile()` (cache hit instantáneo, 0ms) en vez de llamar `getProfile()` otra vez
- Reemplazar el `useEffect` de carga (líneas 205-244) por `useQuery` para checklists:
  ```typescript
  const { data: checklists = [], isLoading: checklistsLoading, error: checklistsError } = useQuery({
    queryKey: ['checklists', selectedVenueId],
    queryFn: () => getChecklists(selectedVenueId!),
    enabled: !!selectedVenueId && !isVenueLoading,
    staleTime: 10_000, // 10s — checklists pueden cambiar entre turnos
  })
  ```
- Eliminar estados manuales: `loading`, `error`, `profile` (ya vienen de los hooks)
- Mantener `pendingChecklist` y `showLibrary` como estado local (son UI state, no server state)
- La función `refreshChecklists` pasa a ser `queryClient.invalidateQueries({ queryKey: ['checklists'] })`

**Error handling preservado**:
- `no_shift_assigned` → se detecta desde `checklistsError.message` igual que antes
- `CLOCK_IN_REQUIRED` → `fetchWithAuth` sigue disparando el evento `attendance-required`, independiente de React Query

---

## 2. Backend: Reducción de queries

### 2.1 Nuevo helper: `get_user_permission_context()` en `permissions.py`

Función que carga el contexto de permisos del usuario en **2 queries** (en vez de repetirlo 3 veces):

```python
async def get_user_permission_context(profile_id: str, db, org_id: str = None) -> dict:
    """
    Fetches user's permission context in minimal queries.
    Returns: { is_superadmin: bool, role_id: str|None, is_admin: bool }
    """
    # Query 1: profile.is_superadmin
    profile_res = db.table('profiles').select('is_superadmin').eq('id', profile_id).execute()
    is_superadmin = profile_res.data[0].get('is_superadmin', False) if profile_res.data else False

    if is_superadmin:
        return {"is_superadmin": True, "role_id": None, "is_admin": True}

    # Query 2: organization role
    role_id = None
    is_admin = False

    if org_id:
        po_res = db.table('profile_organizations') \
            .select('role_id, custom_roles(is_admin)') \
            .eq('profile_id', profile_id) \
            .eq('organization_id', org_id) \
            .execute()
        if po_res.data:
            role_id = po_res.data[0].get('role_id')
            is_admin = po_res.data[0].get('custom_roles', {}).get('is_admin') is True

    # Fallback to legacy profile_roles
    if not role_id:
        role_res = db.table('profile_roles').select('role_id, custom_roles(is_admin)') \
            .eq('profile_id', profile_id).execute()
        if role_res.data:
            role_id = role_res.data[0].get('role_id')
            is_admin = role_res.data[0].get('custom_roles', {}).get('is_admin') is True

    return {"is_superadmin": False, "role_id": role_id, "is_admin": is_admin}
```

### 2.2 Refactorizar: `resolve_permission()` y `check_restriction()` en `permissions.py`

Agregar un parámetro opcional `perm_context` a ambas funciones. Si se pasa, se usa en vez de hacer las queries de nuevo:

```python
async def resolve_permission(profile_id, permission_key, db, org_id=None, perm_context=None) -> bool:
    if perm_context is None:
        perm_context = await get_user_permission_context(profile_id, db, org_id)
    
    if perm_context["is_superadmin"] or perm_context["is_admin"]:
        return True

    # Solo queda buscar el permiso específico (1-2 queries)
    perm_res = db.table('permissions').select('id').eq('key', permission_key).execute()
    if not perm_res.data:
        return False
    perm_id = perm_res.data[0]['id']

    # Check override, then role_permissions...
    # (misma lógica actual, pero sin re-fetchear profile/role)
```

Mismo patrón para `check_restriction()`.

### 2.3 Refactorizar: `require_permission()` en `deps.py`

Cargar el contexto **una sola vez** y pasarlo a ambas funciones:

```python
async def _check(...):
    perm_context = await get_user_permission_context(current_user.id, db, org_id)
    
    # Clock-in check (usa perm_context, no re-fetcha)
    if not is_attendance_action and not is_admin_action:
        force_check = await check_restriction_fn(profile_id, "attendance.force_clock_in", db, 
                                                  org_id=org_id, perm_context=perm_context)
        ...
    
    # Permission check (usa perm_context, no re-fetcha)
    has_perm = await resolve_permission_fn(profile_id, permission_key, db, 
                                           org_id=org_id, perm_context=perm_context)
```

**Resultado**: La cadena de permisos pasa de ~8 queries a ~4 queries.

### 2.3.1 Nota: `get_checklists` en `checklists/router.py`

La función `get_checklists` en L67 hace su propia llamada a `resolve_permission("admin.view_dashboard")`. Esta llamada debe recibir el `perm_context` que ya cargó `require_permission` en el dependency injection. Para esto, el `perm_context` se almacena como atributo del request o se pasa desde el endpoint. La forma más limpia: `require_permission` retorna el `perm_context` junto al user (como un tuple o dataclass), y el endpoint lo desestructura.

### 2.4 Refactorizar: `/me` endpoint en `auth/router.py`

Combinar las dos consultas a `profile_organizations` (L81-85 y L100-102) en una sola:

```python
# ANTES: 2 queries separadas
po_role = db.table("profile_organizations").select("role_id, custom_roles(...)").eq(...).eq(org_id)
po_orgs = db.table("profile_organizations").select("org_id, organizations(...)").eq(...)

# DESPUÉS: 1 query que trae todo
po_all = db.table("profile_organizations") \
    .select("organization_id, role_id, custom_roles(name, is_admin), organizations!profile_organizations_organization_id_fkey(name, is_active)") \
    .eq("profile_id", user.id) \
    .execute()

# Luego en Python: filtrar el rol del org activo y construir la lista de orgs
```

**Resultado**: `/me` pasa de 5-6 queries a 3 queries.

---

## 3. Archivos impactados

| Archivo | Cambio |
|---|---|
| `frontend/package.json` | Agregar `@tanstack/react-query` |
| `frontend/src/lib/queryClient.ts` | **Nuevo** — configuración QueryClient |
| `frontend/src/hooks/useProfile.ts` | **Nuevo** — hook compartido para profile |
| `frontend/src/app/layout.tsx` | Agregar `QueryClientProvider` |
| `frontend/src/components/VenueContext.tsx` | Refactorizar a `useProfile()`, eliminar effect loop |
| `frontend/src/app/dashboard/page.tsx` | Refactorizar a React Query, eliminar estados manuales |
| `backend/permissions.py` | Agregar `get_user_permission_context()`, parametrizar `resolve_permission` y `check_restriction` |
| `backend/app/deps.py` | Refactorizar `require_permission` para reutilizar contexto |
| `backend/app/auth/router.py` | Combinar queries duplicadas en `/me` |

## 4. Archivos NO impactados

- `frontend/src/lib/api.ts` — `fetchWithAuth()` no cambia
- `frontend/src/middleware.ts` — sin cambios
- `frontend/src/components/AttendanceGuard.tsx` — sigue escuchando el evento `attendance-required`
- `frontend/src/components/ChecklistCard.tsx` — sin cambios
- `frontend/src/components/BottomNav.tsx` — sin cambios
- Ningún otro endpoint del backend

## 5. Compatibilidad hacia atrás

- **API contracts**: Los schemas de respuesta de `/me` y `/checklists/{venue_id}` NO cambian
- **Funciones de permisos**: `resolve_permission` y `check_restriction` mantienen la misma firma (el nuevo `perm_context` es opcional con default `None`)
- **Tests existentes**: `test_endpoints.py` y `test_checklist_flow.py` deben pasar sin modificación

## 6. Métricas de éxito

| Métrica | Antes | Objetivo |
|---|---|---|
| Tiempo total de carga del dashboard | ~3.3-5s | ~1.2-1.5s |
| Llamadas a `getProfile()` por carga de dashboard | 2 | 1 (cache hit la segunda) |
| Queries DB en `/me` | 5-6 | 3 |
| Queries DB en `/checklists/{id}` | ~15 | ~9 |

## 7. Orden de implementación

1. Instalar `@tanstack/react-query`
2. Crear `queryClient.ts` y `useProfile.ts`
3. Agregar `QueryClientProvider` al layout
4. Backend: crear `get_user_permission_context()`
5. Backend: refactorizar `require_permission` para usar contexto
6. Backend: combinar queries en `/me`
7. Correr tests de backend
8. Frontend: migrar `VenueContext` a `useProfile()`
9. Frontend: migrar `dashboard/page.tsx` a React Query
10. Verificación end-to-end
