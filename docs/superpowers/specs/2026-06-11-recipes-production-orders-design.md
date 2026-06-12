# Spec: M19-PRD — Recetas (BOM) y Orden de Producción Reactiva

**Fecha:** 2026-06-11  
**Estado:** En Revisión  
**Milestone:** M19-PRD  

## 1. Visión General
Este milestone implementa la base de la producción gastronómica en VERUM. Permite definir cómo se preparan los productos (Recetas) y gestionar la creación de órdenes de producción (OP) con un escalador inteligente que valida stock y unidades de medida en tiempo real.

## 2. Requerimientos Funcionales

### 2.1 Módulo de Recetas (Configuración)
*   **Independencia:** Las recetas se gestionan en un módulo separado del catálogo de artículos.
*   **BOM (Bill of Materials):** Definición de ingredientes con cantidad y presentación específica.
*   **Pasos de Preparación:** Lista numerada de pasos con descripción y tiempo estimado (minutos).
*   **Rendimiento Base:** Cantidad total que produce la receta original (ej: 10 kg).

### 2.2 Nueva Orden de Producción (Operación)
*   **Selección de Sede:** El usuario selecciona el Centro de Producción, lo que determina el almacén de stock.
*   **Buscador Inteligente:** Autocomplete para encontrar el artículo a producir.
*   **Escalador Reactivo:**
    *   Al seleccionar el producto, se carga la receta y se muestra la cantidad objetivo inicial (rendimiento base).
    *   **Soporte Multi-UOM:** El usuario puede cambiar la unidad de medida de la producción (ej: de g a kg). El sistema realiza la conversión usando los factores definidos en `uom_presentations`.
    *   **Cálculo de Insumos:** Al cambiar la cantidad u unidad objetivo, el sistema recalcula inmediatamente la necesidad de cada ingrediente.
    *   **Validación de Stock:** Compara el `qty_base` necesario contra el `qty_available` (Físico - Reservado) del almacén seleccionado.
    *   **Indicadores Visuales:** Verde si hay stock suficiente, Rojo con el déficit si falta.

## 3. Arquitectura de Datos

### 3.1 Nuevas Tablas SQL
```sql
-- Cabecera de Receta
create table recipes (
  id              uuid default uuid_generate_v4() primary key,
  org_id          uuid references organizations(id) on delete cascade,
  item_id         uuid references items(id) unique, -- Un artículo = Una receta
  yield_qty_base  numeric(18, 6) not null,           -- En unidad base del artículo
  yield_presentation_id uuid references uom_presentations(id), -- Presentación x defecto
  is_active       boolean default true,
  created_at      timestamp with time zone default now()
);

-- Ingredientes
create table recipe_ingredients (
  id              uuid default uuid_generate_v4() primary key,
  recipe_id       uuid references recipes(id) on delete cascade,
  item_id         uuid references items(id),
  qty_base        numeric(18, 6) not null,           -- Cantidad necesaria en unidad base
  presentation_id uuid references uom_presentations(id), -- Presentación visual (ej: "1 saco")
  order_index     integer not null
);

-- Pasos de Preparación
create table recipe_steps (
  id              uuid default uuid_generate_v4() primary key,
  recipe_id       uuid references recipes(id) on delete cascade,
  order_index     integer not null,
  description     text not null,
  estimated_time_minutes integer default 0
);
```

### 3.2 Modificaciones a Tablas Existentes
*   `production_orders`: Se utilizará para persistir la orden tras la validación reactiva.

## 4. Lógica de Negocio (Backend/API)

### 4.1 Cálculo del Factor de Escala
1.  `input_qty`: Cantidad ingresada por el usuario.
2.  `input_uom`: Unidad seleccionada por el usuario.
3.  `target_qty_base = input_qty * input_uom.conversion_factor`.
4.  `factor = target_qty_base / recipe.yield_qty_base`.

### 4.2 Validación de Disponibilidad
Para cada ingrediente en la receta:
`necesario_base = ingrediente.qty_base * factor`.
`disponible_base = stock.qty_base - stock.qty_reserved`.
Si `necesario_base > disponible_base` -> **Déficit detectado**.

## 5. Diseño de Interfaz (Frontend)

### 5.1 Estructura de Navegación
Se creará un nuevo menú principal de primer nivel llamado **"Producción"**, que servirá como hub para todas las operaciones de cocina:
*   **Producción > Dashboard:** Vista general con métricas de órdenes activas y estado de cocina (futuro).
*   **Producción > Recetas:** Catálogo independiente para la configuración de recetas (BOM + Pasos).
*   **Producción > Órdenes:** Gestión de Órdenes de Producción (Lista y Nueva OP reactiva).
*   **Producción > KDS:** Pantalla optimizada para tablet (futuro).

### 5.2 Componentes Clave
*   **`RecipeEditor`**: Formulario con drag-and-drop para reordenar pasos e ingredientes.
*   **`ProductionOrderForm`**:
    *   Selector de Sede.
    *   Autocomplete de Ítem.
    *   `ScalerPanel`: Componente reactivo que escucha cambios en cantidad/UOM y dispara la validación de stock.
    *   **Precisión Decimal:** Todos los cálculos internos se mantienen en `numeric` para evitar pérdida de precisión al escalar.

## 6. Plan de Pruebas (TDD)
1.  **Unit Test (Backend):** Verificar que el escalado de una receta de 10kg a 50kg multiplique correctamente los ingredientes.
2.  **Unit Test (Backend):** Validar conversiones entre UOMs (ej: producir en 'Caja 24und' partiendo de una receta en 'unit').
3.  **Integration Test:** Intentar crear una OP en un almacén sin stock y verificar que el sistema reporte el déficit exacto.
4.  **Frontend Test:** Verificar que el cambio de UOM en el select dispare el recálculo de los indicadores de stock.
