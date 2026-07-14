# Especificación de Diseño: Generación de PDF de PO e Inicio de Flujo Manual de Envío (M27-SRM)

Este documento de diseño especifica los cambios requeridos en el backend y el frontend de VERUM para permitir la visualización e impresión física (o guardado como PDF) de las Órdenes de Compra (PO) en el navegador del usuario utilizando `react-to-print`, así como la transición manual del estado de la orden a "Enviada" (`sent`).

---

## 1. Contexto y Requerimientos

- **Visualización y PDF:** El usuario necesita descargar el documento PDF de la Orden de Compra para enviarlo manualmente a sus proveedores (vía correo o WhatsApp). Seguiremos el estándar de VERUM de generación client-side usando `react-to-print` y Tailwind CSS, garantizando homogeneidad visual.
- **Flujo de Estados:** Una vez aprobada (`approved`), la orden de compra se debe poder marcar como "Enviada" (`sent`) manualmente por el usuario. Esto registra la fecha del envío y quién realizó la acción en el backend.

---

## 2. Diseño del Backend (FastAPI)

### 2.1 Endpoint de Envío (`POST /purchase-orders/{id}/send`)
- **Ruta:** `POST /purchase-orders/{id}/send`
- **Permiso requerido:** `purchasing.send`
- **Transición de Estado:**
  - El estado actual de la PO debe ser estrictamente `approved`.
  - Cambia el estado a `sent`.
  - Establece `sent_at = datetime.now()`.
  - Establece `sent_by = current_user.id`.
  - Establece `sent_to_email = supplier.email` (correo de contacto principal del proveedor).
- **Historial de Auditoría:** Opcionalmente registra un evento de auditoría en la tabla `po_approvals` (o registra el cambio de estado directamente en el ciclo de vida de la orden).
- **Retorno:** Devuelve el objeto `PurchaseOrderResponse` totalmente hidratado.

---

## 3. Diseño del Frontend (Next.js)

### 3.1 Plantilla de Impresión (`frontend/src/components/purchasing/PurchaseOrderPrintTemplate.tsx`)
- Un nuevo componente funcional de React optimizado para impresión en formato Carta/A4.
- Mostrará la información estructurada de la orden:
  - **Organización:** Nombre, RIF/Tax ID, Email, Teléfono.
  - **Proveedor:** Razón social, RIF/Tax ID, Contacto, Correo, Teléfono, Dirección.
  - **Orden de Compra:** Número de PO, Estado, Moneda, Términos de Crédito, Fecha Requerida, Fecha Prometida, Almacén de Destino.
  - **Líneas (Tabla):** Código, Artículo, Cantidad (`display_qty`), Unidad (`uom_name`), Costo Unitario (`display_unit_cost`) y Subtotal.
  - **Totales:** Subtotal, IVA (16%), Total General de la Orden.
  - **Notas:** Comentarios/Notas del borrador.

### 3.2 Cliente API (`frontend/src/lib/api/purchasing.ts`)
- Registrar el método `sendPurchaseOrder(id: string)` que llama a `POST /purchase-orders/${id}/send`.

### 3.3 Página de Detalle (`frontend/src/app/admin/purchasing/orders/[id]/page.tsx`)
- Integrar la librería `react-to-print` importando `useReactToPrint`.
- Añadir el componente `<PurchaseOrderPrintTemplate />` en un contenedor con clase `hidden print:block`.
- **Botón "Imprimir / Guardar PDF":** Disponible siempre (o cuando el estado sea mayor a Borrador), dispara la ventana de impresión nativa con la plantilla cargada.
- **Botón "Marcar como Enviada":** Disponible en la barra lateral de acciones únicamente si el estado actual es `approved` y el usuario tiene el permiso de envío. Dispara la llamada de API, actualiza el estado local del documento y refresca la vista.

---

## 4. Plan de Pruebas

1.  **Backend Tests (`tests/test_purchase_orders.py`):**
    - Escribir una prueba unitaria para verificar que el endpoint `POST /purchase-orders/{id}/send` cambia el estado de `approved` a `sent` y almacena `sent_at`, `sent_by`, y `sent_to_email` correctamente.
    - Comprobar que si la orden no está en estado `approved`, el endpoint arroje un error 400.
2.  **Verificación de Tipos y Compilación:**
    - Correr `npx tsc --noEmit` en el frontend para validar compatibilidad.
