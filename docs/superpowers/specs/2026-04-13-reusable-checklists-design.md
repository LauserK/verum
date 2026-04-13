# Reusable Checklists (On-Demand) Design Spec

## Goal
Permitir a los usuarios crear e iniciar múltiples instancias de "Checklists Reusables" (ej. "Catering Pizza") desde una librería, asignándoles un nombre personalizado y con la opción de marcarlos como privados. Estos checklists vivirán en el feed principal hasta ser completados, sin importar si cambian de día o de turno.

## Architecture & Data Model

**1. Nuevos campos en Base de Datos:**
- `checklist_templates`
  - Se utilizará el campo existente `frequency` con un nuevo valor: `'on_demand'`.
- `submissions` (Las instancias de checklists)
  - `custom_title` (text, nullable): Nombre/Referencia para la instancia (ej. "Cumpleaños Carlos").
  - `is_private` (boolean, default false): Indica si la instancia solo es visible para el usuario que la inició.

**2. Backend API (`backend/main.py` y schemas):**
- Modificar los modelos Pydantic (`CreateTemplateRequest`, `SubmissionDetail`, `HistoryItem`, etc.) para soportar `custom_title` e `is_private`.
- Actualizar `get_checklists`:
  - **Librería:** Proveer un endpoint separado o devolver los templates `on_demand` sin submissions activos para la "Librería".
  - **Feed:** El feed diario actual debe retornar todas las `submissions` que sean de templates `on_demand` y cuyo status sea distinto a `completed` (ej. `in_progress`, `draft`). Estas submissions se añaden a la lista de tareas pendientes del día.
  - **Lógica de Privacidad:** Al listar las submissions `on_demand`, si `is_private` es `true`, solo se retornará si el usuario autenticado (`user.id`) es el creador.
- Actualizar el endpoint `CreateSubmission` (`POST /submissions`) para aceptar `custom_title` y `is_private`.

## UI / Frontend

**1. El botón de Librería (Feed Principal):**
- Se agregará un botón tipo ícono (para no ocupar espacio, ej. un ícono de "Libro" o "Plus" dentro de un círculo) en la cabecera o sección superior de la pantalla actual de Tareas Pendientes (`frontend/src/app/attendance/page.tsx` o `checklist/page.tsx` dependiendo de dónde esté el feed de tareas, según el contexto es `frontend/src/app/dashboard/page.tsx` o `frontend/src/app/inventory/...` - lo integraremos en el feed principal de checklists de staff).

**2. Modal de "Librería de Checklists":**
- Al presionar el ícono, se abre un modal inferior o lateral con la lista de `ChecklistTemplates` que tengan `frequency == 'on_demand'`.
- Al hacer clic en un template, se abre una confirmación que pide:
  - **Nombre/Referencia:** Un input de texto opcional (ej. "Boda Pérez"). Si se deja vacío, puede usar la fecha y hora por defecto.
  - **Privado:** Un toggle/switch con la etiqueta "Solo visible para mí".
- Un botón para "Iniciar".

**3. Visualización en el Feed:**
- Los checklists iniciados aparecerán en el feed normal. 
- En lugar del título genérico ("Catering Pizza"), mostrarán: "Catering Pizza - Cumpleaños Carlos" (usando el `custom_title`).
- Un indicador visual (ej. un candado) si el checklist es privado.
- **Persistencia:** Seguirán apareciendo todos los días mientras no estén completados.

## Testing Strategy
- **Backend:** Añadir tests unitarios (`pytest`) para probar la creación de templates `on_demand`, la creación de submissions con `custom_title` e `is_private`, y verificar que `get_checklists` los retorna correctamente (incluyendo la lógica de visibilidad privada).
- **Frontend:** Añadir tests o validaciones manuales para abrir el modal, llenar el form y verificar que aparece en el feed correctamente persistido al recargar.