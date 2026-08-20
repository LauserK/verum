# Análisis de Funcionalidades ERP/MRP Faltantes en Verum

**Fecha:** 2026-07-10
**Contexto:** Verum actualmente abarca Control Operativo (Checklists), Asistencia, Inventario (Activos/Utensilios) y Producción/MRP. Para evolucionar hacia un ERP (Enterprise Resource Planning) completo e integral, se requiere la adición de los siguientes módulos, estructurados por fases de madurez.

---

## Fase 1: Compras y Proveedores (SRM - Supplier Relationship Management)

*Evolución natural del actual módulo de MRP. El MRP actual genera la "Lista de Compras", pero el ERP debe gestionar cómo se ejecuta esa compra financiera y operativamente.*

### Funcionalidades a implementar:
*   **Gestión de Órdenes de Compra (PO):**
    *   Generación automática o manual de PO (Purchase Orders) basadas en los requerimientos del MRP.
    *   Flujos de aprobación de órdenes de compra según monto o departamento.
    *   Envío automatizado de POs al proveedor (PDF/Email).
*   **Gestión del Ciclo de Vida del Proveedor:**
    *   Portal o directorio de proveedores con condiciones de pago (ej. 30, 60, 90 días).
    *   Gestión de catálogos de listas de precios negociados por proveedor y vigencias.
    *   Evaluación de proveedores (calidad de entrega, puntualidad, devoluciones).
*   **Recepción y Cuentas por Pagar (CXP) Preliminar:**
    *   Conteo en recepción contra la Orden de Compra (Three-way matching: PO vs. Remisión vs. Factura).
    *   Gestión de devoluciones y notas de crédito de proveedores.
    *   Provisión de cuentas por pagar para tesorería.

---

## Fase 2: Expansión Comercial (Ventas, POS y CRM)

*Para que el inventario se descuente automáticamente y se mida la rentabilidad, es necesario cerrar el ciclo de la cadena de suministro conectando el origen de la demanda (las ventas).*

### Funcionalidades a implementar:
*   **Gestión de Punto de Venta (POS) / Integración Omnicanal:**
    *   Módulo de facturación rápida o API de integración bidireccional con POS externos (Square, Toast, etc.).
    *   Descarga de inventario en tiempo real basada en explosión de materiales (BOM) por cada venta registrada.
    *   Cierre de caja y declaración de propinas/efectivo.
*   **CRM y Ventas B2B (Catering y Eventos):**
    *   Gestión de cartera de clientes comerciales.
    *   Generación de cotizaciones y propuestas formales.
    *   Conversión de cotizaciones aprobadas a "Órdenes de Trabajo / Producción" directamente conectadas al módulo MRP actual.
*   **Precios y Promociones:**
    *   Gestión de listas de precios múltiples (precio retail, precio mayorista, precio evento).
    *   Motor de reglas para descuentos y promociones.

---

## Fase 3: Logística y Mantenimiento de Flota (FMS / CMMS)

*Expansión del submódulo actual de "Activos" para soportar operaciones de transporte, distribución (ej. Food Trucks o reparto a sucursales) y mantenimiento vehicular.*

### Funcionalidades a implementar:
*   **Gestión del Ciclo de Vida Vehicular:**
    *   Registro de flota (placas, modelos, seguros, vigencias de licencias).
    *   Gestión del consumo de combustible (rendimiento km/litro o registro de cargas).
    *   Asignación de vehículos a choferes por turno.
*   **Mantenimiento (CMMS de Flota):**
    *   Alertas automáticas por kilometraje o tiempo (ej. Cambio de aceite cada 10,000 km).
    *   Órdenes de Trabajo de Mantenimiento para talleres internos o externos.
    *   Historial de reparaciones y costos asociados al vehículo (TCO - Total Cost of Ownership).
*   **Despacho y Logística:**
    *   Planificación de rutas de reparto (Catering, insumos a sucursales).
    *   Checklists pre-viaje (inspección de llantas, luces) conectados al módulo actual de Checklists.

---

## Fase 4: Gestión Integral del Talento (HCM - Human Capital Management)

*Evolución del módulo actual de Asistencia (que solo mide entradas y salidas) hacia un ecosistema completo de Recursos Humanos.*

### Funcionalidades a implementar:
*   **Cálculo de Nómina (Payroll Engine):**
    *   Cálculo automático de horas normales, horas extras, nocturnas y feriados a partir del módulo de asistencia.
    *   Gestión de deducciones, bonos y préstamos a empleados.
    *   Generación de prenómina y recibos de pago digitales.
*   **Administración del Personal:**
    *   Gestión de vacaciones (cálculo de días acumulados, flujo de solicitud y aprobación).
    *   Gestión de incapacidades y ausencias justificadas/injustificadas.
    *   Expedientes digitales (contratos firmados, documentos de identidad, certificaciones de salud).
*   **Desarrollo Organizacional:**
    *   Evaluaciones de desempeño.
    *   Registro de amonestaciones, advertencias o felicitaciones.

---

## Fase 5: Consolidación Financiera (FICO - Finance and Controlling)

*La capa final que unifica toda la operación matemática del sistema en asientos contables, proporcionando la visión estratégica del negocio.*

### Funcionalidades a implementar:
*   **Contabilidad General (General Ledger):**
    *   Catálogo de cuentas contables automatizado.
    *   Generación automática de pólizas (asientos contables) por cada movimiento de inventario, compra, nómina o venta.
    *   Gestión de periodos fiscales (cierre de mes, año).
*   **Tesorería y Flujo de Caja:**
    *   Cuentas por Cobrar (CXC) - Seguimiento de facturas emitidas a clientes B2B.
    *   Cuentas por Pagar (CXP) - Calendario de pagos a proveedores según vencimientos.
    *   Conciliación bancaria (matching de estado de cuenta bancario con transacciones del sistema).
*   **Fiscal e Impuestos:**
    *   Integración con Facturación Electrónica gubernamental (según el país de operación).
    *   Reportes de impuestos retenidos y trasladados (IVA, ISR, etc.).
*   **Reportes Financieros Estratégicos:**
    *   Estado de Resultados (P&L - Profit & Loss) en tiempo real.
    *   Balance General.
    *   Análisis de rentabilidad por centro de costos (Sede, Food Truck, Línea de producto).

---

## Conclusión de Arquitectura
Al implementar estas 5 fases, Verum pasaría de ser un sistema de "Gestión Operativa y de Inventario" a un "ERP Específico de Nicho" capaz de gobernar todos los recursos (materiales, humanos, técnicos y financieros) de una operación gastronómica compleja.
