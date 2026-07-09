# Diseño: Exportación de Fichas Técnicas de Recetas a PDF

Este documento define la especificación de diseño para la exportación de recetas de producción a formato PDF (Ficha Técnica individual y Libro de Recetas en lote).

## 1. Objetivos

* **Exportación Individual**: Permitir imprimir o guardar en PDF la receta actualmente abierta en el editor/visor de recetas, incluyendo ingredientes, pasos de preparación, código QR, rendimiento y metadatos básicos.
* **Exportación en Lote (Bundle)**: Permitir descargar un único documento PDF ("Libro de Recetas") con todas las recetas activas del sistema, separadas correctamente por saltos de página.
* **Sin Costos**: La ficha técnica está dirigida al personal de cocina, por lo que **no debe incluir precios, subtotales ni costos**.
* **Código QR**: Incluir un código QR dinámico que permita escanear la ficha física con un dispositivo móvil y abrir directamente la receta correspondiente en la aplicación.

## 2. Tecnologías y Librerías Utilizadas

Dado que las dependencias ya están instaladas en el proyecto, utilizaremos:
* **`react-to-print` (v3.3.0)**: Para clonar el contenido de un componente invisible de React y disparar el diálogo de impresión del navegador ("Guardar como PDF").
* **`qrcode.react` (v4.2.0)**: Para la generación y renderizado dinámico del código QR en base al URL del navegador.
* **Tailwind CSS**: Con reglas `@media print` para ocultar elementos de navegación y optimizar el diseño para impresión.

## 3. Componentes a Implementar

### A. `RecipeTechnicalSheetPrint.tsx`
* **Ubicación**: `frontend/src/components/production/RecipeTechnicalSheetPrint.tsx`
* **Tipo**: Componente funcional React envuelto en `forwardRef` para que pueda ser referenciado por `react-to-print`.
* **Diseño**:
  * Contenedor con padding de impresión (`p-12 text-black bg-white`).
  * Encabezado de dos columnas:
    * Izquierda: Nombre de la receta, código del artículo, categoría.
    * Derecha: Código QR (80x80px) de la URL de la receta y la fecha actual de generación.
  * Sección de rendimiento (rendimiento base y unidad de medida/presentación).
  * Tabla de Ingredientes (sin costos ni totales financieros):
    * Columnas: `Ingrediente` | `Cantidad` | `Unidad`.
  * Lista de Pasos de Preparación ordenados:
    * Columnas: `Paso #` | `Tiempo Estimado` | `Descripción del Procedimiento`.
  * Pie de página con número de página y texto estándar de la organización.

### B. `RecipeBundlePrint.tsx`
* **Ubicación**: `frontend/src/components/production/RecipeBundlePrint.tsx`
* **Tipo**: Componente funcional React envuelto en `forwardRef`.
* **Diseño**:
  * Recibe un listado de objetos `RecipeResponse` completos.
  * Mapea cada receta renderizando un componente `RecipeTechnicalSheetPrint` individual.
  * Cada receta estará separada por un salto de página forzado mediante CSS de impresión:
    ```css
    @media print {
      .print-page-break {
        page-break-after: always;
        break-after: page;
      }
    }
    ```

## 4. Flujo de Trabajo en Interfaces

### A. Editor de Recetas (`RecipeEditor.tsx`)
* Se agregará un botón **"Exportar PDF"** (con el ícono `Printer` o `FileText`) en la sección de acciones del editor.
* Al hacer clic, se activará el hook `useReactToPrint` enlazado a la referencia del componente oculto `RecipeTechnicalSheetPrint`.

### B. Lista de Recetas (`recipes/page.tsx`)
* Se agregará un botón **"Descargar Libro de Recetas"** (ícono `BookOpen`) al lado del botón "Nueva Receta".
* Al hacer clic:
  1. Se muestra un indicador de carga (`loading`).
  2. El frontend realiza solicitudes en paralelo (`Promise.all()`) al backend para descargar los detalles completos (ingredientes y pasos) de todas las recetas activas del listado.
  3. Se montan temporalmente en un contenedor oculto.
  4. Se dispara el diálogo de impresión sobre dicho contenedor.
  5. Se desactiva el indicador de carga.

## 5. Diseño del Código QR

El QR representará el URL absoluto del artículo de receta:
```typescript
const recipeUrl = `${window.location.origin}/admin/production/recipes/${itemId}`;
```
Utilizando `window.location.origin`, el código funcionará dinámicamente en cualquier entorno local (`localhost:3000`) o en la nube (Vercel).

## 6. Seguridad y Permisos
* Ambos botones requerirán el permiso `production.view` (que ya está validado a nivel de ruta y endpoints).
