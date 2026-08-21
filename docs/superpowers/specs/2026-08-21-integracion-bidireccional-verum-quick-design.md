# Spec: Integración Bidireccional VERUM ↔ VerumQuick

**Estado:** Aprobado para planificación
**Propósito:** Definir la arquitectura, el flujo de datos y los componentes necesarios para la integración bidireccional entre VERUM (ERP, FastAPI) y VerumOnlineOrdering/VerumQuick (Menú Digital, Django), funcionando como un POS automático y sincronizador de catálogo.

---

## 1. Objetivo General
Establecer una comunicación asíncrona pero en tiempo real entre VERUM y VerumQuick.
1. **Catálogo:** VERUM actúa como fuente de la verdad para precios y estado (activo/inactivo). Los ítems pueden publicarse desde VERUM hacia VerumQuick.
2. **Pedidos:** VerumQuick actúa como un canal de ventas digital (POS automático), inyectando las órdenes de los clientes directamente en VERUM para su procesamiento en cocina y facturación.
3. **Analítica:** Las órdenes digitales se registran de forma separada de las ventas físicas para mantener métricas claras.

## 2. Fase de Configuración Inicial (OAuth Popup & Handshake)
La vinculación se realiza mediante una experiencia interactiva sin tocar consolas (estilo OAuth / App Authorization):

1. **Botón en VERUM (Panel ERP / Next.js):**
   * En **Configuración > Integraciones > VerumQuick**, el administrador presiona `[ Conectar con VerumQuick ]`.
   * Se abre un Popup apuntando a la pantalla de autorización de VerumQuick (`/integrations/verum/authorize/?org_id=...`).

2. **Consent Screen en VerumQuick (Django):**
   * Si no está autenticado, solicita login.
   * Muestra la pantalla de consentimiento: *"VERUM ERP solicita vincularse con tu empresa [Nombre Empresa]"*.
   * Al hacer clic en `[ Autorizar y Conectar ]`:
     - Quick valida los permisos de Company Admin.
     - Quick garantiza la existencia de la **Categoría por defecto** (*"Importados de VERUM"*).
     - Quick genera un par de credenciales (`secret_key` compartido) y guarda el enlace con `verum_org_id`.
     - Redirige al callback de VERUM (`/api/integrations/quick/callback?code=...`).

3. **Finalización en VERUM (FastAPI + Next.js):**
   * VERUM valida el código, almacena el `company_id` y `secret_key` para ese `org_id`.
   * VERUM autogenera el **Usuario del Sistema** (*"VerumQuick System"*) y el **Workstation** (*"VerumQuick POS"*).
   * La ventana popup emite un mensaje `postMessage` al panel principal y se cierra automáticamente.
   * El panel de VERUM se actualiza a estado **"Conectado"**.

## 3. Sincronización de Catálogo (VERUM → Quick)

### 3.1. Alcance
* **Creación:** Publicar un ítem de venta desde VERUM a Quick (en la categoría y moneda por defecto).
* **Actualización:** Sincronizar automáticamente cambios de precio base, costo (food_cost) y estado (activo/inactivo).
* **Mapeo:** Quick utiliza el campo `external_code` en sus modelos de producto para almacenar el ID o código de VERUM.

### 3.2. Arquitectura de Despacho (Patrón Outbox)
* **Tabla Outbox (`integration_events`):** En Supabase/PostgreSQL de VERUM. Inserta eventos en la misma transacción del catálogo.
* **Dispatcher:** Un worker que lee eventos pendientes y realiza peticiones `POST` firmadas con HMAC hacia Quick.
* **Endpoint Receptor en Quick:** Webhook (`POST /api/integrations/verum/webhook/product`) que recibe el payload, valida la firma HMAC y actualiza/crea el producto basándose en el `external_code`.

## 4. Inyección de Pedidos (Quick → VERUM)

### 4.1. Alcance
* Cuando un cliente realiza un pedido en Quick y este se aprueba/paga, se envía a VERUM como una nueva orden/factura.

### 4.2. Arquitectura de Inyección
* **Trigger en Quick:** Al confirmar la orden en Django, se encola una tarea en background que extrae el detalle de la orden y hace un `POST` firmado a VERUM.
* **Endpoint Receptor en VERUM:** Webhook (`POST /api/integrations/quick/webhook/order`).
* **Procesamiento:** VERUM mapea la carga útil a su esquema `InvoiceCreate`. Asigna la orden al Workstation *"VerumQuick POS"* y Usuario *"VerumQuick System"*. Descuenta inventario siguiendo el flujo estándar.

## 5. Seguridad y Robustez

* **Autenticación HMAC:** Todas las peticiones entre los sistemas llevan header de firma HMAC-SHA256 con el secret generado en el Handshake.
* **Idempotencia:** Identificadores únicos (`event_id` / `order_id`) para evitar duplicados en reintentos.
* **Manejo de Errores y Reintentos:** Reintentos exponenciales en 5xx; sin reintento en 4xx.

## 6. Milestones de Implementación

**Milestone 1: Handshake & OAuth Authorization UI (VERUM ↔ Quick)**
* **VerumQuick (Django):** Modelo `VerumIntegration` + Vista de consentimiento HTML `/integrations/verum/authorize/` que crea la categoría base y genera el token/secret de vinculación.
* **VERUM (FastAPI Backend):** Endpoints para iniciar el flujo y recibir el callback (`/api/integrations/quick/callback`), creando el Usuario y Workstation virtual.
* **VERUM (Next.js Frontend):** Pantalla de Integración con botón popup y listener de `postMessage`.

**Milestone 2: Sincronización de Catálogo (VERUM → Quick)**
* **VERUM:** Tabla outbox `integration_events` + hook en `sales` + Dispatcher worker.
* **VerumQuick:** Endpoint Webhook `/api/integrations/verum/webhook/product` con validación HMAC y upsert por `external_code`.

**Milestone 3: Inyección de Órdenes (Quick → VERUM)**
* **VerumQuick:** Signal/Tarea de orden confirmada para despacho HMAC a VERUM.
* **VERUM:** Endpoint Webhook `/api/integrations/quick/webhook/order` con mapeo a `InvoiceCreate`.

**Milestone 4: Resiliencia & Monitoreo**
* Reintentos automáticos, manejo de errores y reconciliación periódica.
