from main import get_current_shift, get_active_shift_for_today, CARACAS_TZ
from datetime import datetime
from unittest.mock import patch, MagicMock
import pytz

def test_get_current_shift_morning():
    # Mock datetime para que sean las 8 AM en Caracas
    with patch("main.datetime") as mock_date:
        mock_date.now.return_value = datetime(2024, 1, 1, 8, 0, tzinfo=CARACAS_TZ)
        assert get_current_shift() == "morning"

def test_get_current_shift_mid():
    with patch("main.datetime") as mock_date:
        mock_date.now.return_value = datetime(2024, 1, 1, 15, 0, tzinfo=CARACAS_TZ)
        assert get_current_shift() == "mid"

def test_get_active_shift_flexible():
    mock_db = MagicMock()
    # Simular que el usuario tiene un turno flexible activo
    mock_db.table().select().eq().eq().eq().execute.return_value.data = [{
        "id": "shift-123",
        "modality": "flexible",
        "is_active": True
    }]
    
    res = get_active_shift_for_today("user-1", "venue-1", mock_db)
    assert res["id"] == "shift-123"
    assert res["expected_start"] is None

def test_get_active_shift_fixed_valid_day():
    mock_db = MagicMock()
    # Lunes 1 de Enero 2024 es iso_weekday 1
    with patch("main.datetime") as mock_date:
        mock_date.now.return_value = datetime(2024, 1, 1, 10, 0, tzinfo=CARACAS_TZ)
        
        mock_db.table().select().eq().eq().eq().execute.return_value.data = [{
            "id": "shift-fixed",
            "modality": "fixed",
            "weekdays": [1, 2, 3, 4, 5], # Lun-Vie
            "start_time": "08:00:00",
            "end_time": "17:00:00"
        }]
        
        res = get_active_shift_for_today("user-1", "venue-1", mock_db)
        assert res["id"] == "shift-fixed"
        assert res["expected_start"] == "08:00:00"

def test_get_active_shift_fixed_invalid_day():
    mock_db = MagicMock()
    # Domingo 7 de Enero 2024 es iso_weekday 7
    with patch("main.datetime") as mock_date:
        mock_date.now.return_value = datetime(2024, 1, 7, 10, 0, tzinfo=CARACAS_TZ)
        
        mock_db.table().select().eq().eq().eq().execute.return_value.data = [{
            "id": "shift-fixed",
            "modality": "fixed",
            "weekdays": [1, 2, 3, 4, 5],
            "is_active": True
        }]
        
        res = get_active_shift_for_today("user-1", "venue-1", mock_db)
        assert res is None
