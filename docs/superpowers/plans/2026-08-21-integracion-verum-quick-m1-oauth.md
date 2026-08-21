# Integración Verum-Quick Milestone 1 (OAuth & Handshake UI) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the interactive OAuth-like Popup Handshake flow between VERUM (Next.js + FastAPI) and VerumQuick (Django), allowing tenants to link both systems with a single button click in the UI.

**Architecture:** A popup window opens from VERUM to VerumQuick consent screen. Upon authorization, VerumQuick creates the base category, generates a shared secret, and redirects back to VERUM callback. VERUM generates the system user and virtual workstation, then postMessage closes the popup and refreshes UI.

**Tech Stack:** Next.js (React/Tailwind), FastAPI, Supabase, Django, Python.

---

### Task 1: VerumQuick - Integration App & Consent View

**Files:**
- Create: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\integrations\__init__.py`
- Create: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\integrations\models.py`
- Create: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\integrations\views.py`
- Create: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\integrations\urls.py`
- Create: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\apps\integrations\templates\integrations\authorize.html`
- Modify: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\core\settings.py` (add `apps.integrations`)
- Modify: `C:\Users\dmj-travel\proyectos\VerumOnlineOrdering\core\urls.py` (include integrations urls)

- [ ] **Step 1: Create `apps/integrations/models.py`**

Define `VerumIntegration` storing `company`, `verum_org_id`, `shared_secret`, `is_active`, and `created_at`.

- [ ] **Step 2: Create `apps/integrations/views.py`**

Implement `authorize_verum_view`:
1. Requires login (redirects to login if anonymous, passing next URL).
2. Displays company confirmation card.
3. On POST:
   - Ensures Category `'Importados de VERUM'` exists for that company.
   - Generates a cryptographically random `shared_secret`.
   - Saves/Updates `VerumIntegration`.
   - Redirects to `redirect_uri` with query params `?company_id=...&secret=...&status=success`.

- [ ] **Step 3: Create template `authorize.html`**

Clean OAuth modal with app logos, permissions list ("Sincronizar catálogo", "Inyectar pedidos"), `[Cancelar]` and `[Autorizar y Conectar]` buttons.

- [ ] **Step 4: Register in `settings.py` and `urls.py`**

Add `'apps.integrations'` to `INSTALLED_APPS` and include `path('integrations/', include('apps.integrations.urls'))`.

- [ ] **Step 5: Run migrations & commit**

```bash
cd C:\Users\dmj-travel\proyectos\VerumOnlineOrdering
python manage.py makemigrations integrations
python manage.py migrate
git add apps/integrations core/settings.py core/urls.py
git commit -m "feat(integrations): add VerumQuick OAuth consent screen and VerumIntegration model"
```

---

### Task 2: VERUM (FastAPI) - Integration Handshake Endpoints

**Files:**
- Create: `C:\Users\dmj-travel\proyectos\verum\backend\app\integrations\__init__.py`
- Create: `C:\Users\dmj-travel\proyectos\verum\backend\app\integrations\router.py`
- Create: `C:\Users\dmj-travel\proyectos\verum\backend\app\integrations\service.py`
- Modify: `C:\Users\dmj-travel\proyectos\verum\backend\main.py`

- [ ] **Step 1: Implement `app/integrations/service.py`**

1. `get_integration_status(org_id, db)`: Checks if a connection exists for `org_id`.
2. `complete_handshake(org_id, company_id, secret, db)`:
   - Saves/Updates connection record in `tenant_billing_config` or dedicated table.
   - Ensures user `'VerumQuick System'` exists in `profiles`.
   - Ensures workstation `'VerumQuick POS'` exists in `workstations`.
3. `disconnect_integration(org_id, db)`: Deactivates integration.

- [ ] **Step 2: Implement `app/integrations/router.py`**

- `GET /api/integrations/quick/status`: Returns `{ is_connected: bool, company_id: Optional[str] }`.
- `POST /api/integrations/quick/handshake`: Receives `{ company_id, secret }` and executes `complete_handshake`.
- `POST /api/integrations/quick/disconnect`: Executes `disconnect_integration`.
- `GET /api/integrations/quick/callback`: HTML response rendered inside the popup that runs:
  ```html
  <script>
    window.opener.postMessage({ type: 'VERUM_QUICK_LINKED', company_id: '{{company_id}}' }, '*');
    window.close();
  </script>
  ```

- [ ] **Step 3: Include router in `backend/main.py`**

- [ ] **Step 4: Commit**

```bash
cd C:\Users\dmj-travel\proyectos\verum
git add backend/app/integrations backend/main.py
git commit -m "feat(backend): add VerumQuick integration handshake endpoints"
```

---

### Task 3: VERUM (Next.js) - Integrations Settings UI & Popup Hook

**Files:**
- Create/Modify: `C:\Users\dmj-travel\proyectos\verum\frontend\src\app\admin\settings\integrations\page.tsx`
- Create: `C:\Users\dmj-travel\proyectos\verum\frontend\src\components\integrations\VerumQuickCard.tsx`

- [ ] **Step 1: Build `VerumQuickCard.tsx`**

Component that:
1. Fetches current status from `/api/integrations/quick/status`.
2. If disconnected:
   - Shows "VerumQuick - Menú Digital y Pedidos Online" card.
   - Input for Quick Base URL (defaults to `http://localhost:8000` in dev or env variable).
   - Button `[ 🔗 Conectar con VerumQuick ]`.
   - On click: opens `window.open(quickAuthUrl, 'verum_quick_oauth', 'width=520,height=650')`.
   - Listens for `window.addEventListener('message', ...)` with event `VERUM_QUICK_LINKED`.
3. If connected:
   - Shows green badge 🟢 "Conectado".
   - Displays linked Company ID and Workstation name.
   - Button `[ Desconectar ]`.

- [ ] **Step 2: Add to Integrations / Admin Navigation**

Embed `VerumQuickCard` in the settings/integrations page.

- [ ] **Step 3: Test and Commit**

```bash
cd C:\Users\dmj-travel\proyectos\verum
git add frontend/
git commit -m "feat(frontend): add VerumQuick OAuth popup integration card"
```
