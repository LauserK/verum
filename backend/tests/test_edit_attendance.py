# backend/tests/test_edit_attendance.py
import pytest
from fastapi.testclient import TestClient
from main import app, get_current_user, get_db, get_active_org_id
import main

client = TestClient(app)

def test_edit_attendance_day(monkeypatch):
    # Mocking dependencies
    def mock_get_current_user():
        class User:
            id = "admin_user_id"
            email = "admin@test.com"
        return User()
        
    def mock_get_active_org_id():
        return "test_org_id"

    # Define the mock dependency function
    async def mock_permission_dependency():
        return True

    # We need to find where require_permission("attendance.manage") is stored in the route
    # But it's easier to just override the function itself if possible before app import
    # Or, since we already have the app, we can find the dependency in the route.
    
    for route in app.routes:
        if route.path == "/admin/attendance/edit-day":
            # route.dependant.dependencies is a list of Dependant objects
            for dep in route.dependant.dependencies:
                # We want to find the one that is the result of require_permission
                # This is hard to identify perfectly, so let's just override all 
                # dependencies that aren't get_current_user or get_db
                if dep.call not in [get_current_user, get_db, get_active_org_id]:
                    dep.call = mock_permission_dependency

    class MockQuery:
        def __init__(self, data):
            self._data = data
        def select(self, *args, **kwargs): return self
        def eq(self, *args, **kwargs): return self
        def gte(self, *args, **kwargs): return self
        def lt(self, *args, **kwargs): return self
        def order(self, *args, **kwargs): return self
        def limit(self, *args, **kwargs): return self
        def single(self, *args, **kwargs): return self
        def in_(self, *args, **kwargs): return self
        def neq(self, *args, **kwargs): return self
        def execute(self):
            class Res:
                data = self._data
            return Res()

    class MockTable:
        def __init__(self, table_name, data):
            self.table_name = table_name
            self._data = data
        def select(self, *args, **kwargs):
            return MockQuery(self._data)
        def insert(self, data):
            return MockQuery([data])
        def update(self, data):
            return MockQuery([data])
            
    class MockDB:
        def table(self, name):
            if name == "attendance_logs":
                return MockTable(name, [])
            if name == "employee_shifts":
                return MockTable(name, [])
            return MockTable(name, [])

    def mock_get_db():
        return MockDB()

    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[get_active_org_id] = mock_get_active_org_id
    
    payload = {
        "profile_id": "test_profile_id",
        "venue_id": "test_venue_id",
        "work_date": "2026-04-14",
        "clock_in": "2026-04-14T09:00:00",
        "clock_out": "2026-04-14T18:00:00",
        "reason": "Forgot to clock out"
    }
    
    response = client.post("/admin/attendance/edit-day", json=payload)
    if response.status_code != 200:
        print(response.json())
    # Expected to fail with 404 until implementation
    assert response.status_code == 200
    assert response.json()["ok"] is True
    
    app.dependency_overrides = {}
