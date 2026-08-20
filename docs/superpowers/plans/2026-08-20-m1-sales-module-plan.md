# Plan de Implementación: Módulo de Ventas — Milestone 1
(Configuración, Catálogo y Componentes)

**Fecha:** 2026-08-20
**Contexto:** Implementación del Milestone 1 del `spec_verum_sales_module.md` respetando la arquitectura actual de Verum y los lineamientos de TDD requeridos por la skill `verum-spec`.

---

## 1. Migraciones de Base de Datos (Supabase SQL)

Se crearán las siguientes migraciones en `backend/migrations/` en orden secuencial. Todas deben incluir las políticas RLS ("Org members full access") especificadas en el SPEC.

### `058_sales_config.sql`
- Crear `tenant_billing_config`
- Crear `payment_methods`
- Crear `workstations`
- RLS Setup.

### `059_sales_catalog.sql`
- Crear `sale_categories`
- Crear `sale_items`
- Crear `sale_item_variants`
- Modificar tabla `items` existente (`is_sellable BOOLEAN DEFAULT FALSE`)
- Modificar tabla `organizations` existente (`default_currency TEXT`)
- RLS Setup.

### `060_sales_components_and_modifiers.sql`
- Crear `sale_item_components` (BOM de venta: `fixed_qty`, `recipe_proportional`)
- Crear `sale_modifier_groups`
- Crear `sale_modifier_options`
- Crear `sale_item_modifier_groups` y `sale_variant_modifier_groups`
- RLS Setup.

### `061_sales_price_lists_and_permissions.sql`
- Crear `sale_price_lists`
- Crear `sale_price_list_items`
- Insertar nuevos permisos de ventas y POS en la tabla `permissions`.
- RLS Setup.

---

## 2. Desarrollo Backend (TDD)

Se estructurará el nuevo módulo dentro de `backend/app/sales/`.

### Paso 2.1: Modelos Pydantic (`backend/app/sales/schemas.py`)
Implementar los esquemas exactos definidos en la Sección 8.3 del SPEC:
- `SaleItemComponentCreate`, `SaleItemComponentOut`
- `SaleItemVariantCreate`, `SaleItemCreate`, `SaleItemOut`
- Modelos básicos de `workstations`, `payment_methods`, y listas de precios (no detallados exhaustivamente en el SPEC pero implícitos para el CRUD).

### Paso 2.2: Configuración de Tests y Fixtures (`backend/tests/`)
Siguiendo las instrucciones estrictas de TDD de la directiva `verum-spec`. Escribir pruebas antes de la lógica:
- **`test_sales_config.py`**: Pruebas para GET/PATCH `config`, CRUD de `payment_methods` y `workstations`. Validación de restricciones RLS u `org_id`.
- **`test_sales_catalog.py`**: Pruebas de CRUD para `sale_items`. Debe testear creación profunda (`components` inline) y asociación de variantes.
- **`test_sales_prices.py`**: Pruebas para gestión de listas de precios y asignación.

### Paso 2.3: Capa de Servicios (`backend/app/sales/service.py`)
Lógica para satisfacer los tests:
- Funciones modulares (menores a 30 líneas por estándar). Extraer la lógica de creación de `sale_item_variants` y `sale_item_components` a helpers como `_create_variants(...)` y `_create_components(...)`.
- Consultas a Supabase usando el mismo patrón existente (ej. `db.table(...).insert(...).execute()`).

### Paso 2.4: Rutas de la API (`backend/app/sales/router.py`)
Registrar y exponer endpoints (descritos en Sección 8.2 del SPEC). Validar permisos con la dependencia `require_permission`.
- `config`: `GET /sales/config`, `PATCH /sales/config`
- `payment-methods` y `workstations`: `GET / POST / PATCH / DELETE`
- `categories` y `items`: `GET / POST / PATCH / DELETE`. Para `items`, el payload de creación maneja inline la configuración profunda.
- `modifier-groups` y `options`
- `price-lists` y sus ítems

### Paso 2.5: Registro del Router (`backend/app/__init__.py`)
Añadir `app.include_router(sales_router)` en `backend/app/__init__.py`.

---

## 3. Revisión de Calidad (Code Review Standards)
Revisión obligatoria del código antes de dar por finalizado el Milestone:
- [ ] Ninguna función en `service.py` mayor a 30 líneas.
- [ ] No usar `any` en los diccionarios insertados/actualizados.
- [ ] Asegurar manejo robusto de excepciones (ej. al tratar de borrar una categoría en uso, fallar con 400 limpio).
