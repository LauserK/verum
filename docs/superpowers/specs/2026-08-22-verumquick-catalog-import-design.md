# Design Spec: Importación de Catálogo desde VerumQuick a VERUM

**Fecha:** 2026-08-22  
**Estado:** Aprobado para Plan de Implementación  
**Módulo:** Integraciones / Ventas (`app/integrations`, `app/sales`)

---

## 1. Contexto y Problema

Cuando un cliente que ya operaba en **VerumQuick POS** comienza a utilizar **VERUM ERP**, todo su catálogo (categorías, grupos de modificadores, modificadores y productos) reside en VerumQuick. 

Actualmente, VERUM solo soporta el flujo hacia adelante (`VERUM -> VerumQuick`). Si el usuario edita o crea un producto en VERUM sin haber creado antes los modificadores idénticos en VERUM, el webhook `product.updated` envía un payload sin `modifier_group_ids`, lo que provoca que VerumQuick desvincule los modificadores del producto en el POS.

### Objetivo
Permitir a los clientes de VerumQuick importar todo su catálogo existente (Categorías, Grupos de Modificadores con sus Opciones, Productos y Variantes) hacia VERUM de forma guiada, vinculando entidades existentes y dejando el catálogo sincronizado y listo para crear recetas (BOM) sin romper las relaciones en el POS.

---

## 2. Arquitectura de Datos y Entidades Mapeadas

```
VerumQuick POS                          VERUM ERP
───────────────                          ─────────
Categories          ───────────────►    sale_categories
Modifier Groups     ───────────────►    sale_modifier_groups
Modifier Items      ───────────────►    sale_modifier_options
Products            ───────────────►    sale_items
Variants            ───────────────►    sale_item_variants
Product-Modifiers   ───────────────►    sale_item_modifier_groups
```

### Reglas de Mapeo:
1. **Categorías:** Se busca por `name` dentro de la misma organización (`org_id`). Si no existe, se inserta una nueva en `sale_categories`.
2. **Grupos de Modificadores:** Se busca por `name` dentro de la organización.
   - Si no existe: se crea en `sale_modifier_groups` con sus propiedades (`min_select`, `max_select`, `is_required`).
   - Se insertan sus opciones en `sale_modifier_options` (`name`, `price_delta`, `is_default`, `position`).
3. **Productos:** Se busca por `code` o `name` en `sale_items`.
   - Si existe: se actualizan precios/descripción y se asocian los `modifier_group_ids` importados.
   - Si no existe: se crea el producto en `sale_items`.
4. **Variantes:** Se importan y registran en `sale_item_variants` vinculadas al `sale_item_id`.
5. **Insumos / BOM:** Los productos de venta importados se dejan **sin insumos vinculados** (`sale_item_components` vacío) para que el chef/administrador configure los escandallos posteriormente en VERUM.

---

## 3. Endpoints del Backend

### 1. `GET /api/integrations/quick/preview-catalog`
- **Seguridad:** Requiere autenticación y rol de administrador en la organización activa.
- **Flujo:**
  1. Obtiene las credenciales y secret de `quick_integrations`.
  2. Llama a la API de VerumQuick (`/api/verum/export-catalog`) con firma HMAC.
  3. Compara en memoria con el catálogo actual de VERUM (`sale_categories`, `sale_modifier_groups`, `sale_items`).
  4. Retorna el resumen previo con conteo de elementos nuevos vs existentes.

### 2. `POST /api/integrations/quick/import-catalog`
- **Parámetros:** `{ "overwrite_existing_prices": true, "match_by": "name_or_code" }`
- **Flujo:**
  1. Ejecuta la transacción de inserción/actualización en el orden estricto de dependencias:
     - 1º Categorías
     - 2º Grupos de Modificadores y Opciones
     - 3º Productos de Venta
     - 4º Variantes
     - 5º Vinculación Producto-Modificadores (`sale_item_modifier_groups`)
  2. Llama a `invalidate_sales_catalog(org_id)` para limpiar la caché de Redis.
  3. Retorna estadísticas finales del proceso completado.

---

## 4. Diseño de la Interfaz (Frontend)

Ubicación: `frontend/src/components/integrations/VerumQuickCard.tsx`

1. **Acción Principal en la Tarjeta de Integración:**
   - Botón *"Importar Catálogo desde VerumQuick"* visible cuando la integración está conectada.
   - Badge distintivo: *"Configuración Inicial / Clientes Existentes"*.

2. **Wizard Modal (3 Pasos):**
   - **Paso 1: Vista Previa:** Tarjetas con conteo de elementos detectados (Categorías, Grupos de Modificadores, Productos).
   - **Paso 2: Opciones de Importación:**
     - Checkbox: *Vincular y actualizar productos que ya existan por nombre o código*.
     - Checkbox: *Actualizar precios de venta con los de VerumQuick*.
   - **Paso 3: Ejecución y Feedback:** Barra de progreso animada por etapas (1. Categorías -> 2. Modificadores -> 3. Productos y Enlaces) con reporte final de éxito.

---

## 5. Prevención de Errores y Casos Límite

- **Conexión caída con VerumQuick:** Manejo de timeout con mensaje descriptivo sin corromper el catálogo de VERUM.
- **Nombres duplicados de modificadores:** Se deduplican por nombre de grupo dentro de la misma organización.
- **Desvinculación en webhooks:** Dado que los productos en VERUM guardarán los IDs de los modificadores importados, los futuros webhooks `product.updated` mantendrán intactas las vinculaciones en VerumQuick.

---

## 6. Verificación y Testing

1. **Tests unitarios en backend (`backend/tests/test_quick_import.py`):**
   - Test de importación con catálogo vacío en VERUM.
   - Test de importación con productos y categorías existentes (merge sin duplicados).
   - Test de vinculación correcta de modificadores a productos importados.
2. **Verificación en Frontend:**
   - Test de flujo del wizard en `VerumQuickCard.tsx` y validación de tipos con `npm run build`.
