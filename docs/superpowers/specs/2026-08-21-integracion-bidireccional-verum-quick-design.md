# Spec: Integración Bidireccional VERUM ↔ VerumQuick

**Estado:** Aprobado para planificación
**Propósito:** Definir la arquitectura, el flujo de datos y los componentes necesarios para la integración bidireccional entre VERUM (ERP, FastAPI) y VerumOnlineOrdering/VerumQuick (Menú Digital, Django), funcionando como un POS automático y sincronizador de catálogo.

---

## 1. Objetivo General
Establecer una comunicación asíncrona pero en tiempo real entre VERUM y VerumQuick.
1. **Catálogo:** VERUM actúa como fuente de la verdad para precios y estado (activo/inactivo). Los ítems pueden publicarse desde VERUM hacia VerumQuick.
2. **Pedidos:** VerumQuick actúa como un canal de ventas digital (POS automático), inyectando las órdenes de los clientes directamente en VERUM para su procesamiento en cocina y facturación.
3. **Analítica:** Las órdenes digitales se registran de forma separada de las ventas físicas para mantener métricas claras.

## 2. Fase de Configuración Inicial (Linking / Onboarding)
Cuando un Tenant (Restaurante) activa la integración entre ambos sistemas, se ejecuta un proceso de configuración inicial de una sola vez ("Handshake"):

**En VerumQuick (Django):**
*   Se autogenera una **Categoría por defecto** (ej. "Importados de VERUM"). Los productos exportados desde VERUM aterrizarán aquí hasta que el administrador los reubique manualmente.

**En VERUM (FastAPI):**
*   Se autogenera un **Usuario del Sistema** exclusivo para la integración (ej. "VerumQuick System").
*   Se autogenera un **Workstation (Caja/Punto de Venta)** virtual (ej. "VerumQuick POS").
*   Toda orden inyectada desde Quick se asociará a este Usuario y Workstation para un rastreo y analítica precisa.

## 3. Sincronización de Catálogo (VERUM → Quick)

### 3.1. Alcance
*   **Creación:** Publicar un ítem de venta desde VERUM a Quick (en la categoría y moneda por defecto).
*   **Actualización:** Sincronizar automáticamente cambios de precio base, costo (food_cost) y estado (activo/inactivo).
*   **Mapeo:** Quick utiliza el campo `external_code` en sus modelos de producto para almacenar el ID o código de VERUM.

### 3.2. Arquitectura de Despacho (Patrón Outbox)
*   **Tabla Outbox (`integration_events`):** En Supabase/PostgreSQL de VERUM. Altera ítems en la misma transacción donde se actualiza/crea el producto.
*   **Dispatcher:** Un worker (BackgroundTasks o tarea periódica) lee eventos pendientes y realiza peticiones `POST` firmadas hacia Quick.
*   **Endpoint Receptor en Quick:** Un webhook (`POST /api/integrations/verum/webhook/product`) que recibe la carga útil, valida la firma HMAC y actualiza/crea el producto basándose en el `external_code`.

## 4. Inyección de Pedidos (Quick → VERUM)

### 4.1. Alcance
*   Cuando un cliente realiza un pedido (Dine-in, Takeout, Delivery) en Quick y este se aprueba, se envía a VERUM como una nueva orden/factura.

### 4.2. Arquitectura de Inyección
*   **Trigger en Quick:** Al confirmar la orden en Django, se encola una tarea en background que extrae el detalle de la orden (ítems vinculados por su `external_code`, modificadores, notas, tipo de canal) y hace un `POST` firmado a VERUM.
*   **Endpoint Receptor en VERUM:** Un webhook (`POST /api/integrations/quick/webhook/order`).
*   **Procesamiento:** VERUM mapea la carga útil a su esquema `InvoiceCreate`. Asigna la orden al Workstation y Usuario de integración generados en la fase de Linking. Si la orden incluye mesa, se mapea. Descuenta inventario siguiendo el flujo normal de ventas.

## 5. Seguridad y Robustez

*   **Autenticación HMAC:** Todas las peticiones entre los sistemas deben incluir un header con firma criptográfica (HMAC-SHA256) usando un *Secret Key* compartido a nivel de Tenant/Integración.
*   **Idempotencia:** Ambos webhooks validarán un identificador único por evento (`event_id` o `order_id`). Si un evento ya fue procesado con éxito (por reintentos de red), se devolverá un `200 OK` sin duplicar el efecto.
*   **Manejo de Errores y Reintentos:** En caso de fallas de red (5xx), el sistema emisor aplicará reintentos con backoff exponencial. Fallos de validación (4xx) se marcarán como error de datos sin reintento automático.


## 6. Milestones de Implementaci�n

**Milestone 1: Foundations & Security (Handshake)**
* **VERUM & Quick:** Configuraci�n de variables de entorno para los secrets HMAC de la integraci�n.
* **VerumQuick:** L�gica para garantizar la existencia de la Categor�a Base (ej. 'Importados de VERUM').
* **VERUM:** Script/Endpoint de inicializaci�n para crear el Usuario de Integraci�n ('VerumQuick System') y el Workstation Virtual ('VerumQuick POS').

**Milestone 2: Sincronizaci�n de Cat�logo (VERUM ? Quick)**
* **VERUM (Backend):** Crear tabla \integration_events\. Intervenir los m�todos de creaci�n y actualizaci�n en \sales_svc\ para insertar eventos (Outbox).
* **VerumQuick:** Crear el endpoint Webhook \/api/integrations/verum/webhook/product\ con middleware HMAC, l�gica de resoluci�n por \external_code\ y creaci�n/actualizaci�n de productos.
* **VERUM (Backend):** Implementar el Dispatcher (tarea programada) que consuma eventos pendientes de \integration_events\ y haga el \POST\ a Quick.

**Milestone 3: Inyecci�n de �rdenes (Quick ? VERUM)**
* **VerumQuick:** Crear se�al/tarea as�ncrona tras confirmar una orden (estado pagado/confirmado) que construya un payload est�ndar y lo despache (POST HMAC) a VERUM.
* **VERUM (Backend):** Crear el endpoint Webhook \/api/integrations/quick/webhook/order\.
* **VERUM (Backend):** L�gica del Webhook para parsear la orden entrante, validarla, construir el payload \InvoiceCreate\ forzando el Workstation/User generados en Milestone 1, e insertar en la base de datos (con afectaci�n de inventario).

**Milestone 4: Resiliencia & Monitoreo**
* Implementar reintentos en Dispatchers para errores HTTP 5xx.
* Desactivar reintentos en errores 4xx (problema de datos) y marcarlos como 'failed'.
* (Opcional) Reconciliaci�n nocturna (cron job) para verificar derivas entre cat�logos.

