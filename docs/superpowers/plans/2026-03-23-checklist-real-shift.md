# Migración de Checklists a Turnos Operativos Reales

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar la lógica de frecuencia de checklists `shift` para que use el `shift_id` real del perfil del usuario en lugar de bloques horarios estáticos.

**Architecture:** Se eliminará el constraint de base de datos en `submissions`, se creará un helper para determinar el "turno actual" del usuario (basado en DB o fallback horario) y se actualizarán las consultas de checklists y creación de reportes para usar este identificador.

**Tech Stack:** FastAPI (Python), PostgreSQL (Supabase), Next.js (TypeScript).

---

### Task 1: Base de Datos - Eliminar Constraint de Shift

**Files:**
- Create: `backend/migrations/021_drop_submissions_shift_constraint.sql`

- [ ] **Step 1: Crear archivo de migración**

```sql
-- backend/migrations/021_drop_submissions_shift_constraint.sql
-- Elimina la restricción que solo permite 'morning', 'mid', 'closing' para permitir UUIDs de turnos reales.
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_shift_check;
```

- [ ] **Step 2: Aplicar migración (Simulado/Instrucción)**
Ejecutar el SQL en la consola de Supabase o mediante el script de migraciones del proyecto.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/021_drop_submissions_shift_constraint.sql
git commit -m "db: drop shift constraint on submissions"
```

---

### Task 2: Backend - Helper de Turno del Usuario

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Implementar `get_user_shift_identifier`**

```python
# backend/main.py (reemplazar o añadir cerca de get_current_shift)
async def get_user_shift_identifier(user_id: str, db) -> str:
    """
    Retorna el shift_id del usuario si existe. 
    Si no, hace fallback a get_current_shift() (bloque horario).
    """
    res = db.table("profiles").select("shift_id").eq("id", user_id).single().execute()
    if res.data and res.data.get("shift_id"):
        return str(res.data["shift_id"])
    return get_current_shift()
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: add get_user_shift_identifier helper"
```

---

### Task 3: Backend - Actualizar Lógica de Checklists (GET)

**Files:**
- Modify: `backend/main.py:227-370` (aprox)

- [ ] **Step 1: Modificar `get_checklists` para usar el turno del usuario**

```python
@app.get("/checklists/{venue_id}", response_model=list[ChecklistItem])
async def get_checklists(venue_id: str, user=Depends(require_permission("checklists.view"))):
    try:
        db = get_db()
        # CAMBIO: Usar turno real del usuario
        shift = await get_user_shift_identifier(user.id, db)
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
        
        # ... (resto de la lógica de carga de templates)
```

- [ ] **Step 2: Verificar que el filtro de `submissions_map` use el nuevo `shift`**

```python
        # En el loop de submissions_map:
        if freq == "shift":
            if s["shift"] == shift: # Esto ahora comparará UUID o fallback string
                submissions_map[tid] = s
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: update get_checklists to use real user shift"
```

---

### Task 4: Backend - Actualizar Creación de Submissions (POST)

**Files:**
- Modify: `backend/main.py:480-515` (aprox)

- [ ] **Step 1: Modificar `create_submission` para guardar el turno real**

```python
@app.post("/submissions")
async def create_submission(body: CreateSubmissionRequest, user=Depends(require_permission("checklists.execute"))):
    try:
        db = get_db()
        # CAMBIO: Obtener turno real
        shift = await get_user_shift_identifier(user.id, db)
        today = datetime.now(CARACAS_TZ).strftime("%Y-%m-%d")
        
        # ... (lógica de búsqueda de existentes usando el nuevo shift)
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: update create_submission to save real user shift"
```

---

### Task 5: Backend - Historial con Nombres de Turnos

**Files:**
- Modify: `backend/main.py` (endpoints de historial)

- [ ] **Step 1: Actualizar `get_submission_history` para resolver nombres de turnos**

```python
# En el loop de construcción de HistoryItem, si el shift es un UUID, 
# intentar buscarlo en un mapa de nombres de turnos (shifts table).
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: resolve shift names in history"
```
