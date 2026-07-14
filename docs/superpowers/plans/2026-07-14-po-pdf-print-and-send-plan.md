# Plan de Implementación: Generación de PDF de PO e Inicio de Flujo Manual de Envío (M27-SRM)

Este plan describe las tareas de desarrollo por fases para habilitar la descarga/impresión de Órdenes de Compra (PO) y la transición de estado manual a "Enviada" (`sent`).

---

## Fase 1: Backend (FastAPI)

1.  **Implementar Endpoint de Envío (`backend/app/purchasing/router.py`):**
    - [ ] Crear la ruta `POST /purchase-orders/{id}/send`.
    - [ ] Validar que la PO exista y que su estado actual sea `approved` (arrojar error 400 si no es así).
    - [ ] Buscar la dirección de correo electrónico del proveedor asociado para registrarla en `sent_to_email`.
    - [ ] Actualizar el registro de la PO: `status = "sent"`, `sent_at = datetime.now()`, `sent_by = current_user.id`, `sent_to_email = supplier_email`.
    - [ ] Devolver la orden hidratada utilizando `get_purchase_order_by_id_internal`.
    - [ ] Agregar el permiso `purchasing.send` en la dependencia `require_permission`.

---

## Fase 2: Frontend (Next.js - Cliente API)

1.  **Actualizar Cliente de Compras (`frontend/src/lib/api/purchasing.ts`):**
    - [ ] Agregar el método `sendPurchaseOrder(id: string): Promise<PurchaseOrderResponse>` llamando al nuevo endpoint con método `POST`.

---

## Fase 3: Frontend (Next.js - Componente de Impresión)

1.  **Crear Componente Imprimible (`frontend/src/components/purchasing/PurchaseOrderPrintTemplate.tsx`):**
    - [ ] Crear un archivo e implementar el diseño premium de hoja de orden de compra utilizando CSS de impresión de Tailwind CSS (`print:`).
    - [ ] Mapear todos los metadatos comerciales: Organización, Proveedor, Fechas, Almacén, Moneda, Crédito y Notas.
    - [ ] Mapear la tabla de líneas con la columna de código, descripción del artículo, cantidad (`display_qty`), unidad (`uom_name`), costo unitario (`display_unit_cost`) y subtotal.
    - [ ] Mapear la sección de subtotales, IVA y total general de la orden.

---

## Fase 4: Frontend (Next.js - Vista de Detalle)

1.  **Integrar Impresión y Acciones (`frontend/src/app/admin/purchasing/orders/[id]/page.tsx`):**
    - [ ] Importar `useReactToPrint` de `react-to-print` e instanciar la referencia del componente de impresión.
    - [ ] Renderizar el componente `<PurchaseOrderPrintTemplate po={po} />` de forma oculta en pantalla (`hidden print:block`).
    - [ ] Actualizar la barra lateral de acciones:
        - [ ] Reemplazar el botón de alerta "Despachar (Enviar PDF)" por un botón "Imprimir / Guardar PDF" que dispare la impresión client-side.
        - [ ] Añadir el botón "Marcar como Enviada" visible únicamente si el estado de la PO es `approved`. Al pulsarlo, debe llamar al cliente API, actualizar el estado local a `sent` y refrescar el historial.

---

## Criterios de Aceptación y Pruebas

1.  **Prueba de Flujo de Estados:**
    - Crear y aprobar una PO. El botón "Marcar como Enviada" debe aparecer.
    - Al pulsarlo, el estado en el timeline superior debe cambiar a "Enviada" y registrar la auditoría de envío correctamente en el historial. El botón de marcar envío debe ocultarse.
2.  **Prueba de Impresión:**
    - Al pulsar "Imprimir / Guardar PDF", se debe abrir el cuadro de impresión nativo del navegador mostrando el documento perfectamente alineado y formateado, listo para descargarse como PDF.
3.  **Pruebas de Backend:**
    - Escribir una prueba unitaria en `tests/test_purchase_orders.py` que valide el endpoint `POST /purchase-orders/{id}/send` en estados correctos e incorrectos.
4.  **Compilación Limpia:**
    - `npx tsc --noEmit` en el frontend y `pytest` en el backend deben pasar al 100%.
