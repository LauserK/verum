# Spec: Impresión Masiva de Códigos QR de Inventario

Permitir a los administradores imprimir múltiples códigos QR de activos filtrados en una sola hoja tamaño Carta, con opciones de configuración de rejilla (2x2, 3x3, etc.) para optimizar el uso del papel.

## 1. Contexto y Objetivos
Actualmente, el sistema solo permite imprimir códigos QR de uno en uno, lo que resulta ineficiente para el etiquetado masivo de activos. El objetivo es proporcionar una herramienta que tome los resultados actuales de los filtros de la tabla de activos y los organice en una rejilla imprimible.

## 2. Requisitos de Usuario
- **Botón de Impresión Masiva:** Visible en la página de activos de inventario.
- **Respetar Filtros:** Solo se imprimirán los activos que el usuario ve actualmente en la tabla.
- **Configuración de Rejilla:** El usuario debe poder elegir cuántos QRs caben por página (mínimo 4, con opciones como 2x2, 3x3, etc.).
- **Tamaño de Hoja:** Optimizado para tamaño Carta (Letter).
- **Consistencia Visual:** Las etiquetas impresas deben mantener el diseño actual del componente `QRCodePrint`.

## 3. Diseño Técnico

### 3.1 Interfaz de Usuario (Frontend)
- **`AssetsPage` (`frontend/src/app/admin/inventory/assets/page.tsx`):**
    - Nuevo estado `showPrintConfig` para el modal.
    - Nuevo estado `gridConfig` (ej. `{ rows: 2, cols: 2 }`).
    - Botón "Imprimir QRs filtrados" en la cabecera o cerca de los filtros.
- **Componente `PrintConfigModal`:**
    - Diálogo que permite seleccionar la distribución (2x2, 3x3, 4x4).
    - Muestra el total de activos a imprimir.
    - Botón "Confirmar e Imprimir" que activa el proceso de impresión de `react-to-print`.

### 3.2 Componente de Impresión (`BulkQRCodePrint`)
- Un nuevo componente que renderiza una lista de activos.
- Utilizará CSS Grid para la distribución:
  ```css
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: 10px;
  ```
- Cada item usará el componente `QRCodePrint` existente, pero envolviéndolo en un contenedor que aplique `transform: scale()` o ajustando sus dimensiones internas para que quepan proporcionalmente en la rejilla.
- **CSS de Impresión:**
  ```css
  @media print {
    @page {
      size: letter;
      margin: 10mm;
    }
    .print-page-break {
      page-break-after: always;
    }
  }
  ```

### 3.3 Flujo de Trabajo
1. El usuario filtra los activos en la tabla.
2. Hace clic en "Imprimir QRs filtrados".
3. Se abre el modal, elige "3x3" (9 por página).
4. Al confirmar, se renderiza un contenedor oculto con todos los QRs.
5. `react-to-print` abre el diálogo nativo del navegador para imprimir o guardar como PDF.

## 4. Consideraciones de Rendimiento
- Para listas muy grandes (ej. +100 activos), el renderizado de muchos QRs simultáneos en el DOM puede ser pesado. Se recomienda limitar o advertir al usuario si la selección es excesiva, aunque para inventarios típicos de ~50 items no debería haber problema.

## 5. Plan de Pruebas
- Verificar que solo se impriman los activos filtrados.
- Verificar que el salto de página funcione correctamente al llenar una hoja Carta.
- Verificar que los QRs sean legibles (tamaño mínimo) en la configuración 4x4.
