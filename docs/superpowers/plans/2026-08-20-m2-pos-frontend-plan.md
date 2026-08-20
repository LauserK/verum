# Plan de Implementación: Frontend Módulo de Ventas — Milestone 2 (Fase Administrativa)

**Fecha:** 2026-08-20
**Contexto:** Implementación de la Interfaz Administrativa de Ventas (`/admin/sales`) basándonos en el diseño previamente aprobado y siguiendo los requerimientos estrictos de la directiva `verum-spec` (TDD, conexión exclusiva a la DB mediante APIs REST del backend). Por instrucciones del usuario, la implementación de la interfaz dedicada del cajero (`/pos`) queda pospuesta para una iteración futura.

---

## 1. Scaffold de Rutas Administrativas (Next.js App Router)

Se creará la estructura base del enrutador dentro del Dashboard del ERP.

### Rutas Administrativas (`frontend/app/(dashboard)/admin/sales`)
- **`layout.tsx`**: Menú secundario o estructura de navegación para el submódulo de ventas (Facturas, Clientes, Catálogo, Configuración).
- **`invoices/page.tsx`**: Tabla de histórico de facturas.
- **`invoices/new/page.tsx`**: Editor unificado tipo plantilla (document template) para creación manual de facturas B2B.
- **`customers/page.tsx`**: Directorio de clientes con su histórico y límites de crédito.
- **`config/page.tsx`**: Configuración de listas de precios, modificadores y terminales (workstations).

---

## 2. Desarrollo TDD de Estado y Lógica (React Query)

Cumpliendo con el mandato de TDD de `verum-spec`, escribiremos pruebas unitarias para las llamadas a API antes de integrar los componentes visuales.

### Integración API Backend (`frontend/api/sales.ts`)
- *Restricción estricta (`verum-spec`): Ninguna llamada a Supabase directamente desde el cliente. Todo pasa por el API de FastAPI.*
- **Tests (Mock de fetch/axios):** Probar los hooks de consulta para endpoints administrativos:
  - `GET /api/v1/sales/invoices`
  - `POST /api/v1/sales/invoices`
  - CRUD de clientes (`/api/v1/sales/customers`)
  - Configuración del catálogo y listas de precios.
- **Implementación:** Hooks de React Query (`useInvoices`, `useCreateInvoice`, `useCustomers`) para caché, mutaciones y fetching asíncrono.

---

## 3. Implementación de Componentes de UI Administrativos

Desarrollo de las interfaces siguiendo la arquitectura de componentes existente en el dashboard.

### 3.1 Histórico de Facturas (`InvoicesTable`)
- Tabla de datos con filtros por fechas, clientes y estado (Borrador, Confirmada, Anulada).
- Botones de acción rápida: Ver Detalle, Imprimir PDF, Anular.

### 3.2 Editor de Facturas Manual (`UnifiedInvoiceForm`)
- Interfaz tipo "Documento Contable" (ej. Xero / QuickBooks).
- Cabecera: Selector de Cliente, Fecha de Emisión, Términos de Pago.
- Detalle de Ítems: Filas editables para agregar productos del catálogo o líneas libres, con cálculo de cantidad, precio unitario, impuestos y subtotal.
- Pie: Totalización automática con desglose de multitasas y panel lateral para registrar el pago inmediato si aplica.

### 3.3 Directorio de Clientes (`CustomersManager`)
- CRUD estándar utilizando tablas y modales/formularios laterales.
- Manejo de información fiscal (`tax_id`, direcciones) y límites de crédito.

---

## 4. Revisión de Calidad (Code Review)
- [ ] TDD aplicado en hooks de API e integraciones de mutaciones complejas (como el cálculo del total en la factura unificada).
- [ ] No hay llamadas de `supabase.from('...')` en las páginas de ventas; todo se gestiona vía `/api/v1/sales/*`.
- [ ] Correcta integración visual con el Layout existente del ERP (`/admin`).
