# M21-PRD Design Spec: Etiquetado Formato Carta (Stickers)

## 1. Overview
El objetivo del Milestone 21 es permitir la generación de etiquetas físicas para los productos terminados utilizando impresoras convencionales con papel de stickers (Formato Carta o A4). 
Dado que el rendimiento de una producción no siempre genera unidades exactas, el sistema debe permitir configurar un listado dinámico de etiquetas (ej. "8 stickers de 800g" y "1 sticker de 500g").

## 2. Database Changes
- **`production_lots`**: Agregar la columna `label_printed` (boolean, default `false`) para llevar registro de si el lote ya fue etiquetado.

## 3. Backend (FastAPI)
### Endpoints Nuevos
- `PATCH /production/lots/{lot_id}/printed`:
  - Actualiza el flag `label_printed = true` en la base de datos.
- No se requiere endpoint de generación de PDF o ZPL en el backend, ya que el renderizado de la hoja Carta se hará puramente en el Frontend con HTML/CSS.

## 4. Frontend (Next.js)
### Componente de Configuración (LabelConfigModal)
- Un modal que recibe el `lot_id` y los detalles del producto.
- Muestra el rendimiento total producido (ej. 6900g).
- Permite agregar "filas" de configuración: `[ Cantidad de Stickers ] x [ Peso por Sticker ]`.
- Muestra un total calculado y alerta si la suma de los pesos de los stickers no coincide con el total producido (como advertencia, no como bloqueo).

### Componente de Impresión (PrintLayout)
- Un componente oculto en pantalla que se activa mediante la librería `react-to-print` ya instalada en el proyecto.
- Utiliza `@media print` y CSS Grid para organizar las etiquetas en la página (típicamente 2x4 o 3x3 por página dependiendo del tamaño estándar de etiquetas).
- Cada etiqueta (sticker) mostrará:
  - Nombre del Artículo
  - Código QR (generado con `qrcode.react`) que contenga el número de lote.
  - Lote: `LOT-XXXXXXXX`
  - Elaboración: `DD/MM/YYYY`
  - Vencimiento: `DD/MM/YYYY` (Calculado por `shelf_life_days` del item)
  - **Peso/Contenido**: El peso específico configurado para *ese* sticker (ej. `800g` o `500g`).

### Flujos de Usuario
1. **Post-Producción KDS**: Al dar clic en finalizar orden, ofrecer la opción "Configurar e Imprimir Etiquetas".
2. **Historial de Órdenes**: Botón en el detalle de la orden para re-imprimir o generar etiquetas adicionales de un lote anterior.

## 5. Security & Roles
- Permisos estándar (`production.execute` y `production.view`). No se requieren nuevos roles.
