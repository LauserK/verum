# Especificación de Diseño: Módulo POS (Point of Sale)

## 1. Visión General y Alcance
El módulo de Ventas y POS de Verum debe soportar operaciones de alta velocidad en mostrador (Quick Service) y gestión continua de cuentas en piso (Full Service / Mesas). Está diseñado con un enfoque responsivo "touch-first" para tablets y pantallas táctiles, adaptándose también a monitores de escritorio y teléfonos móviles.

## 2. Arquitectura de Interfaz y Modos de Venta

### 2.1 Modos de Venta Configurables
El sistema operará bajo "Modos de Venta" (Ej. *Mesas, Para Llevar, Delivery, Pick-up, Barra*).
- **Configurabilidad:** Los modos disponibles se configuran a nivel del negocio (Tenant) y a nivel de la estación de trabajo (Workstation). Por ejemplo, una caja específica puede estar configurada solo para "Delivery" y "Pick-up".

### 2.2 Layout Principal (Tablet / Desktop)
El layout sigue el modelo de "Pantalla Dividida / Panel Fijo" para minimizar los clics del operador:
- **Header Global:** Contiene los selectores de Modos de Venta, información del cajero, y un centro de notificaciones para el estado de la cola de impresión.
- **Área Principal (Izquierda - 70%):**
  - **En modo "Mesas":** Muestra un mapa interactivo (Plano de Planta) a pantalla completa.
  - **En modos rápidos (Barra, Llevar):** Muestra directamente el Catálogo de Productos filtrable por categorías.
- **Minuta / Carrito (Derecha - 30%):** Panel fijo que muestra los items del ticket actual, totales y botones de acción principal (`Enviar a Cocina`, `Cobrar`).
- **Responsive (Móvil):** En teléfonos, se usará navegación de pantalla completa por tareas, con el carrito oculto en un *Bottom Sheet* desplegable, y el mapa de mesas puede cambiar a una vista de lista si el espacio es muy reducido.

## 3. Flujo de Órdenes y Gestión de Estado

### 3.1 Estados de la Minuta
- **Borrador (Draft):** Items agregados localmente. Pueden modificarse o eliminarse libremente.
- **Enviado (Sent/Locked):** Al presionar `Enviar a Cocina`, los items se bloquean. Su eliminación requerirá permisos especiales y generará un registro de merma/auditoría.

### 3.2 Asignación de Clientes (CRM)
- **Configuración Dinámica:** El requerimiento de asignar un cliente a una comanda será configurable (Obligatorio, Opcional, Desactivado) según las reglas del negocio.
- **Flujo:** Al abrir una mesa, crear un Delivery o iniciar una orden, el sistema permite buscar en la base de datos de clientes o registrar uno nuevo en el instante.

### 3.3 Asientos y División de Cuentas (Seats)
- **Servicio de Mesa:** El mesero puede agrupar pedidos por "Asientos" (Seats), pudiendo nombrar cada asiento (Ej. "Asiento 1 - Pedro").
- **Flujo de Pago:** Esta estructura permite cobrar por asientos de forma automática en el checkout.
- **Cuentas Abiertas:** En modos como Delivery o Pick-up, el sistema permite emitir el ticket y dejar la orden en estado "Pendiente/Abierta" hasta que se reciba el pago en mostrador.

## 4. Checkout Multimoneda

El flujo de cobro está optimizado para minimizar errores y simplificar la contabilidad en economías bimonetarias.

### 4.1 Pantalla de Decisión de Pago
Al presionar `Cobrar`, se presenta el saldo pendiente y tres opciones rápidas:
1. **Pago Completo:** Se cobra la totalidad usando un único método de pago.
2. **Pago Mixto:** Abre la calculadora avanzada.
3. **CXC (Cuentas por Cobrar):** Transfiere la deuda al módulo de cuentas por cobrar para clientes recurrentes/corporativos.

### 4.2 Calculadora de Pago Mixto
- **Visualización Dual:** Siempre se mostrarán los montos (Total, Pagado, Restante, Vuelto) tanto en la Moneda Base como en la Secundaria simultáneamente.
- **Monedas Base por Método:** Cada método (Efectivo, Zelle, Pago Móvil) tiene una moneda nativa predefinida.
- **Conversión Automática:** El teclado numérico en pantalla incluye un Switch de Moneda. Si un cliente paga un monto parcial en una moneda distinta a la nativa del método, el cajero puede ingresarlo, alternar el switch, y el sistema calculará automáticamente la conversión según la tasa de cambio del día, descontándolo del saldo.
- **Vueltos (Change):** El sistema calcula el dinero a devolver y permite registrar en qué moneda/método se entregó el vuelto para el cuadre de caja.

## 5. Impresión y Spooler

El POS está desacoplado del hardware físico de impresión para evitar bloqueos en el navegador.

### 5.1 Flujo de Impresión
- **Decisión de Documento:** Al finalizar un pago, dependiendo de la configuración de la estación, el usuario puede seleccionar "Imprimir Factura Fiscal", "Imprimir Nota de Entrega" o "Continuar sin Imprimir" (o se ejecutará automáticamente si está así configurado).
- **El Spooler:** El POS inserta el trabajo en una tabla de base de datos o hace un request a un servicio Spooler local. El Spooler maneja la conexión con el hardware de la impresora fiscal o térmica.
- **Sincronización:** Una vez que la impresora fiscal devuelve el comprobante, el Spooler actualiza la factura en la base de datos con el número de control fiscal.

### 5.2 Manejo de Errores
- Si la impresora falla (sin papel, apagada), el trabajo se marca como fallido.
- El POS muestra una notificación de alerta al cajero, permitiendo solucionar el problema físico y "Reintentar", o cambiar el tipo de documento a "Nota de Entrega" si la máquina se dañó permanentemente.
