# VERUM - Plataforma Integral de Gestión y Control Operativo

VERUM es una plataforma modular y multi-tenant diseñada para empresas gastronómicas, cocinas centrales, dark kitchens, catering y servicios que requieren estandarización, control de calidad, trazabilidad de inventarios y gestión integral de sus operaciones diarias.

---

## 🚀 Módulos y Capacidades Principales

1. **📋 Checklists & Auditorías Operativas:**
   - Ejecución móvil en 2 pasos (Check → Review) con auto-guardado en tiempo real (*Google Forms style*).
   - Control de puntos críticos, captura y compresión de evidencias fotográficas etiquetadas.
   - Bloqueo por prerequisitos, programación por turnos y plantillas reusables.

2. **📦 Inventario, Activos & Utensilios:**
   - Activos fijos con trazabilidad QR y sistema de tickets de mantenimiento/reparación multi-visita.
   - Control de pérdidas hormiga de utensilios con cronogramas y flujo de verificación staff/supervisor.
   - Documentos de inventario unificados (ingresos, egresos, mermas), traslados entre sedes y Kardex valorizado PEPS.
   - Tomas de inventario físico general con bloqueo y soporte para hojas de cálculo Excel.

3. **👨‍🍳 Producción, Recetas & MRP:**
   - Catálogo de insumos (materia prima, semielaborados, producto terminado).
   - Fichas técnicas/recetas con costeo automático en cascada, mermas y rendimientos.
   - Órdenes de producción con deducción automática de insumos.
   - Tablero táctil KDS (*Kitchen Display System*) en tiempo real para cocina.
   - Planificación de requerimientos (MRP/Catering) e impresión de etiquetas Zebra ZPL.

4. **⏱️ Control de Asistencia & Personal:**
   - Marcación de entrada, pausas de descanso/almuerzo y salida desde app móvil.
   - Detección automática de tardanzas y cálculo de horas extras trabajadas.
   - Matriz de turnos/horarios y gestión de solicitudes de permisos y ausencias.
   - Política de marcaje obligatorio (`attendance.force_clock_in`) para operar el sistema.

5. **🛒 Compras y Proveedores (SRM):**
   - Directorio de proveedores con listas de precios y condiciones de pago.
   - Órdenes de compra (PO) formales en PDF con flujos de aprobación.
   - *Three-Way Matching* (Conciliación PO vs. Recepción física de Almacén vs. Factura).
   - Gestión de devoluciones a proveedores con ajuste de saldos.

6. **🛍️ Ventas, Facturación & POS:**
   - Catálogo de productos para la venta vinculado a recetas BOM para deducción de stock.
   - Emisión de facturas y recibos con desglose fiscal, correlativos y pagos multimoneda.
   - Gestión de tasas de cambio diarias oficiales y paralelas.
   - Terminal Punto de Venta (POS) para apertura/cierre de turnos y comandas rápidas.

7. **🔌 Integraciones Bidireccionales (VerumQuick):**
   - Handshake OAuth 2.0 y sincronización automática vía *Outbox Pattern* con menú digital y pedidos externos.

---

## 🛠️ Stack Tecnológico

- **Frontend:** [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), `@tanstack/react-query`, `@dnd-kit`, `next-intl` (i18n), Lucide Icons.
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+), Pydantic v2, Uvicorn, Pytest, Pytest-Asyncio, HTTPX.
- **Base de Datos & Auth:** [Supabase](https://supabase.com/) (PostgreSQL 15+, Row Level Security - RLS, Supabase Auth, Storage).
- **Caché & Workers:** Redis (opcional), `orjson`, Async Outbox Worker Loop.
- **Infraestructura:** Vercel (Frontend), Render (Backend), Supabase Cloud.

---

## 📂 Estructura del Proyecto

```text
verum/
├── backend/                  # API FastAPI (Servicios modulares y lógica de negocio)
│   ├── app/
│   │   ├── admin/            # Gestión de usuarios, roles, sedes y permisos
│   │   ├── attendance/       # Marcajes, turnos, horas extra y ausencias
│   │   ├── checklists/       # Plantillas, preguntas, auto-save y auditorías
│   │   ├── inventory/        # Activos, QR, tickets de reparación y utensilios
│   │   ├── production/       # Almacenes, insumos, recetas, KDS, MRP y Kardex
│   │   ├── purchasing/       # Proveedores, órdenes de compra (PO) y facturas
│   │   ├── sales/            # Catálogo de venta, POS, facturación y monedas
│   │   ├── integrations/     # OAuth y eventos outbox con VerumQuick
│   │   └── superadmin/       # Consola de administración multi-tenant
│   ├── migrations/           # 70+ scripts SQL y esquemas de base de datos
│   └── tests/                # Suite de pruebas automatizadas (TDD)
├── frontend/                 # Aplicación Next.js 16 (PWA y Panel de Administración)
│   ├── src/app/              # Rutas App Router (admin, attendance, checklist, pos, kds...)
│   ├── src/components/       # UI Components, Temas (Dark/Light), Contextos y Selectores
│   └── src/lib/              # Clientes API y utilidades
├── docs/                     # PRDs detallados, planes y especificaciones de arquitectura
└── VERUM.md                  # Documento maestro y fuente de verdad del sistema
```

---

## ⚙️ Configuración del Entorno

### Requisitos Previos
- Node.js 20+ y `npm`
- Python 3.11+ y gestor de entornos virtuales `venv`
- Proyecto activo en Supabase

### Backend (FastAPI)

1. Navega a la carpeta backend:
   ```bash
   cd backend
   ```
2. Crea y activa el entorno virtual:
   - Windows: `python -m venv .venv` y luego `.\.venv\Scripts\Activate.ps1`
   - Linux/Mac: `python -m venv .venv` y luego `source .venv/bin/activate`
3. Instala dependencias:
   ```bash
   pip install -r requirements.txt
   ```
4. Configura el archivo `.env`:
   ```env
   SUPABASE_URL=https://<tu-proyecto>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
   REDIS_URL=redis://localhost:6379/0 # Opcional
   VERUM_QUICK_URL=https://app.verumquick.com
   VERUM_QUICK_HMAC_SECRET=<tu-hmac-secret>
   VERUM_QUICK_WEBHOOK_URL=http://localhost:8000/api/integrations/quick/webhook
   ```
5. Inicia el servidor de desarrollo:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Frontend (Next.js)

1. Navega a la carpeta frontend:
   ```bash
   cd frontend
   ```
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Configura el archivo `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_VERUM_QUICK_URL=https://app.verumquick.com
   ```
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev -- --port 3000
   ```

---

## 🧪 Pruebas Automatizadas (TDD)

```bash
# Ejecución de pruebas backend con Pytest
cd backend
pytest

# O mediante los scripts automáticos de la raíz
.\run_tests.ps1  # Windows PowerShell
./run_tests.sh   # Linux / macOS
```