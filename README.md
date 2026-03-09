# VERUM - Sistema de Control Operativo

VERUM es una plataforma de gestión operativa diseñada para digitalizar procesos manuales mediante checklists dinámicos, captura de evidencia (fotos) y monitoreo en tiempo real. 

Ideal para restaurantes y empresas de servicios que buscan optimizar la ejecución de tareas críticas (temperaturas, limpieza, inventarios) y obtener visibilidad total de la operación.

## 🚀 Principales Funciones

- **Checklists Dinámicos:** Ejecución rápida desde dispositivos móviles (PWA).
- **Captura de Evidencia:** Registro fotográfico por estación o tarea.
- **Monitoreo RT:** Dashboard administrativo con métricas de cumplimiento y alertas de fallas críticas.
- **Auto-Save:** Guardado automático estilo Google Forms para no perder progreso.
- **Modo Oscuro nativo:** Optimizado para entornos de trabajo diversos.

## 🛠️ Stack Tecnológico

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), Tailwind CSS, Lucide Icons.
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+), Pydantic v2.
- **Base de Datos & Auth:** [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage).
- **Infraestructura:** Vercel (Frontend), Render (Backend).

## 📂 Estructura del Proyecto

```text
Verum/
├── frontend/     # Aplicación Next.js (Dashboard y PWA)
├── backend/      # API FastAPI (Servicios y lógica de negocio)
├── .agents/      # Configuración de asistentes de IA y especificaciones
└── VERUM.md      # Especificación completa del proyecto (Source of Truth)
```

## ⚙️ Configuración del Entorno

### Requisitos Previos

- Node.js 18+
- Python 3.11+
- Cuenta en Supabase

### Backend (FastAPI)

1. Navega a la carpeta backend: `cd backend`
2. Crea un entorno virtual: `python -m venv venv`
3. Activa el entorno: 
   - Windows: `.\venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Instala dependencias: `pip install -r requirements.txt`
5. Configura el archivo `.env` basado en `.env.example`:
   ```env
   SUPABASE_URL=tu_url_de_supabase
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```
6. Corre el servidor: `fastapi dev main.py`

### Frontend (Next.js)

1. Navega a la carpeta frontend: `cd frontend`
2. Instala dependencias: `npm install`
3. Configura el archivo `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key_anonima
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
4. Corre el entorno de desarrollo: `npm run dev`