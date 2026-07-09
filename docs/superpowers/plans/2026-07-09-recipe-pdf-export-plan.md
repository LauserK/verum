# Plan de Implementación: Exportación de Recetas a PDF

Este documento detalla los pasos para implementar la exportación individual de Fichas Técnicas de Recetas y la descarga del Libro de Recetas completo en lote.

## Fase 1: Creación de Componentes de Impresión

### Paso 1.1: Componente de Ficha Técnica Individual (`RecipeTechnicalSheetPrint.tsx`)
* **Archivo**: `frontend/src/components/production/RecipeTechnicalSheetPrint.tsx`
* **Especificaciones**:
  * Usar `forwardRef` para permitir su referencia en `useReactToPrint`.
  * Diseñar el layout adaptado para papel (colores oscuros en texto, fondo blanco).
  * Renderizar metadatos: Nombre, Código, Categoría y Rendimiento base.
  * Renderizar el componente `<QRCodeCanvas>` de `qrcode.react` dinámicamente:
    * `value = window.location.origin + '/admin/production/recipes/' + item_id`
  * Tabla de ingredientes con columnas: Ingrediente y Cantidad (sin costos).
  * Lista de pasos de preparación.

### Paso 1.2: Componente para Lote/Bundle (`RecipeBundlePrint.tsx`)
* **Archivo**: `frontend/src/components/production/RecipeBundlePrint.tsx`
* **Especificaciones**:
  * Usar `forwardRef`.
  * Recibir un array `recipes` con detalles completos.
  * Iterar sobre las recetas renderizando `<RecipeTechnicalSheetPrint>` para cada una.
  * Añadir un contenedor con la clase CSS para salto de página en impresión:
    ```html
    <div className="print-page-break" />
    ```
  * Agregar los estilos CSS correspondientes al archivo CSS global o en el mismo componente mediante CSS inline/Tailwind para forzar el salto de página:
    `page-break-after: always; break-after: page;`

## Fase 2: Integración en la Interfaz de Usuario

### Paso 2.1: Agregar Exportación en el Editor de Receta (`RecipeEditor.tsx`)
* **Archivo**: `frontend/src/components/production/RecipeEditor.tsx`
* **Acción**:
  * Importar `useReactToPrint` y `RecipeTechnicalSheetPrint`.
  * Configurar `ref` y la función `handlePrint`.
  * Agregar el botón "Exportar PDF" en el panel de acciones.
  * Insertar el componente `<RecipeTechnicalSheetPrint>` oculto en el árbol DOM (usando un wrapper con clase `hidden`).

### Paso 2.2: Agregar Exportación por Lote en el Listado (`recipes/page.tsx`)
* **Archivo**: `frontend/src/app/admin/production/recipes/page.tsx`
* **Acción**:
  * Importar `useReactToPrint` y `RecipeBundlePrint`.
  * Crear un estado `exporting` para controlar el indicador de carga.
  * Implementar la función `handleExportAll`:
    1. Activar `exporting`.
    2. Obtener la lista completa de detalles llamando a `adminApi.getRecipe(itemId)` para cada receta del listado en paralelo mediante `Promise.all()`.
    3. Almacenar los datos de recetas completas en un estado local temporal `bundleRecipes`.
    4. Ejecutar el disparador de impresión de `react-to-print`.
    5. Finalizar `exporting` y limpiar el estado temporal de recetas.
  * Agregar el botón "Descargar Libro (PDF)" en la cabecera de la página.
  * Renderizar el componente `<RecipeBundlePrint>` de forma oculta en el DOM.

## Fase 3: Pruebas y Validación
* Crear una receta de prueba y exportar a PDF para verificar la legibilidad y el correcto renderizado del código QR.
* Probar la exportación de todo el libro de recetas para verificar que cada receta empiece exactamente al inicio de una página nueva (sin cortes por la mitad).
