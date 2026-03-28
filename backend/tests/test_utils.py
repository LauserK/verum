import pytz
from datetime import datetime
from unittest.mock import patch
from main import get_current_shift

CARACAS_TZ = pytz.timezone("America/Caracas")

def test_get_current_shift_morning():
    # Mock datetime para que sean las 8 AM en Caracas
    with patch("main.datetime") as mock_date:
        mock_date.now.return_value = datetime(2024, 1, 1, 8, 0, tzinfo=CARACAS_TZ)
        assert get_current_shift() == "morning"

def test_get_current_shift_mid():
    with patch("main.datetime") as mock_date:
        mock_date.now.return_value = datetime(2024, 1, 1, 15, 0, tzinfo=CARACAS_TZ)
        assert get_current_shift() == "mid"

def test_get_current_shift_closing():
    with patch("main.datetime") as mock_date:
        # 10 PM
        mock_date.now.return_value = datetime(2024, 1, 1, 22, 0, tzinfo=CARACAS_TZ)
        assert get_current_shift() == "closing"

    with patch("main.datetime") as mock_date:
        # 4 AM
        mock_date.now.return_value = datetime(2024, 1, 1, 4, 0, tzinfo=CARACAS_TZ)
        assert get_current_shift() == "closing"
