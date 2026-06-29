"""
VERUM Backend — main.py
-----------------------
This file is the entry point for the FastAPI application.
All domain logic has been extracted into domain packages under app/:

  app/auth/         → /auth/sync, /me
  app/checklists/   → /checklists/*, /submissions/*
  app/admin/        → /admin/*, /roles, /permissions
  app/superadmin/   → /super-admin/*
  app/inventory/    → /inventory/assets, /utensils, /tickets, ...
  app/production/   → /warehouses, /stock, /physical-counts, ...
  app/transfers/    → /inventory/transfers
  app/catering/     → /production/recipes, /production/orders, /catering/*
  app/attendance/   → /employee-shifts, /attendance/*

Shared dependencies are in:
  app/deps.py       → get_active_org_id, require_permission
  app/checklists/utils.py → get_current_shift, get_user_shift_identifier
  app/attendance/utils.py → get_active_shift_for_today, calculate_late_minutes
"""

import pytz
from datetime import datetime, timezone, timedelta

from database import supabase, get_db
from config import settings
from auth_deps import security, get_current_user
from permissions import get_super_admin, resolve_permission, check_restriction
from attendance_utils import is_clocked_in

# Re-export helpers so existing test patches (e.g. mock.patch("main.resolve_permission"))
# continue to work without modifying all 22 test files.
from app.deps import get_active_org_id, require_permission
from app.checklists.utils import get_current_shift, get_user_shift_identifier
from app.attendance.utils import get_active_shift_for_today

CARACAS_TZ = pytz.timezone("America/Caracas")

# Bootstrap the application via the factory
from app import create_app
app = create_app()
