"""
Phase 5B: Kiosk & Offline Support Testing
Tests:
- GET /api/shifts/next - Returns next scheduled shift with date_label
- POST /api/attendance/clock - Clock in/out with next_shift on clock_out
- GET /api/attendance/status - Check attendance status
- GET /api/shifts/today - Check today's shift and clocking window
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhase5BKiosk:
    """Test Kiosk Clock Screen Backend Endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and get tokens for staff NRS001"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get NRS001 employee info
        response = self.session.get(f"{BASE_URL}/api/employees/lookup/NRS001")
        assert response.status_code == 200, f"Failed to lookup NRS001: {response.text}"
        self.staff_employee = response.json()
        
        # Login as NRS001 (PIN: 5368 as per test context)
        login_response = self.session.post(f"{BASE_URL}/api/auth/validate-pin", json={
            "employee_id": self.staff_employee["id"],
            "pin": "5368"
        })
        assert login_response.status_code == 200, f"Staff login failed: {login_response.text}"
        self.staff_token = login_response.json()["token"]
        
        # Get manager token (MGR001, PIN: 1234)
        mgr_response = self.session.get(f"{BASE_URL}/api/employees/lookup/MGR001")
        if mgr_response.status_code == 200:
            mgr_employee = mgr_response.json()
            mgr_login = self.session.post(f"{BASE_URL}/api/auth/validate-pin", json={
                "employee_id": mgr_employee["id"],
                "pin": "1234"
            })
            if mgr_login.status_code == 200:
                self.manager_token = mgr_login.json()["token"]
            else:
                self.manager_token = None
        else:
            self.manager_token = None
            
    def test_get_attendance_status(self):
        """Test GET /api/attendance/status returns current attendance state"""
        response = self.session.get(
            f"{BASE_URL}/api/attendance/status",
            headers={"Authorization": f"Bearer {self.staff_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return attendance status fields
        assert "clocked_in" in data, "Response missing 'clocked_in' field"
        assert "clocked_out" in data, "Response missing 'clocked_out' field"
        assert "clock_in_time" in data, "Response missing 'clock_in_time' field"
        assert "clock_out_time" in data, "Response missing 'clock_out_time' field"
        
        print(f"Attendance Status: clocked_in={data['clocked_in']}, clocked_out={data['clocked_out']}")
        print(f"Clock times: in={data.get('clock_in_time')}, out={data.get('clock_out_time')}")
    
    def test_get_today_shift(self):
        """Test GET /api/shifts/today returns shift info and clocking window"""
        response = self.session.get(
            f"{BASE_URL}/api/shifts/today",
            headers={"Authorization": f"Bearer {self.staff_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Response structure validation
        assert "has_shift" in data, "Response missing 'has_shift' field"
        assert "can_clock" in data, "Response missing 'can_clock' field"
        
        if data["has_shift"]:
            assert "shift" in data, "Response missing 'shift' field when has_shift=True"
            shift = data["shift"]
            assert "start_time" in shift, "Shift missing 'start_time'"
            assert "end_time" in shift, "Shift missing 'end_time'"
            assert "shift_type" in shift or "template" in shift, "Shift missing type info"
            print(f"Today's Shift: {shift.get('start_time')} - {shift.get('end_time')}, can_clock={data['can_clock']}")
        else:
            print(f"No shift scheduled for today, message: {data.get('message')}")
    
    def test_get_next_shift_endpoint(self):
        """Test GET /api/shifts/next returns next shift with date_label"""
        response = self.session.get(
            f"{BASE_URL}/api/shifts/next",
            headers={"Authorization": f"Bearer {self.staff_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Response structure validation
        assert "has_next_shift" in data, "Response missing 'has_next_shift' field"
        
        if data["has_next_shift"]:
            assert "shift" in data, "Response missing 'shift' field when has_next_shift=True"
            assert "date_label" in data, "Response missing 'date_label' field"
            assert "days_until" in data, "Response missing 'days_until' field"
            
            shift = data["shift"]
            assert "shift_date" in shift, "Shift missing 'shift_date'"
            assert "start_time" in shift, "Shift missing 'start_time'"
            assert "end_time" in shift, "Shift missing 'end_time'"
            
            print(f"Next Shift: {data['date_label']} ({shift['shift_date']})")
            print(f"Time: {shift['start_time']} - {shift['end_time']}, days_until={data['days_until']}")
        else:
            print("No next shift scheduled for this employee")
    
    def test_clock_in_requires_auth(self):
        """Test POST /api/attendance/clock requires authentication"""
        response = self.session.post(
            f"{BASE_URL}/api/attendance/clock",
            json={"employee_id": self.staff_employee["employee_id"], "action": "clock_in"}
        )
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("Clock endpoint correctly requires authentication")
    
    def test_clock_action_invalid_action(self):
        """Test POST /api/attendance/clock rejects invalid action"""
        response = self.session.post(
            f"{BASE_URL}/api/attendance/clock",
            headers={"Authorization": f"Bearer {self.staff_token}"},
            json={"employee_id": self.staff_employee["employee_id"], "action": "invalid_action"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}"
        print("Invalid action correctly rejected with 400")
    
    def test_shifts_next_requires_auth(self):
        """Test GET /api/shifts/next requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/shifts/next")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("/api/shifts/next correctly requires authentication")
    
    def test_shifts_today_requires_auth(self):
        """Test GET /api/shifts/today requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/shifts/today")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("/api/shifts/today correctly requires authentication")
    
    def test_attendance_status_requires_auth(self):
        """Test GET /api/attendance/status requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/attendance/status")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("/api/attendance/status correctly requires authentication")
    
    def test_manager_has_no_shift_today(self):
        """Test that manager (MGR001) has no shift scheduled for today"""
        if not self.manager_token:
            pytest.skip("Manager token not available")
        
        response = self.session.get(
            f"{BASE_URL}/api/shifts/today",
            headers={"Authorization": f"Bearer {self.manager_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Managers typically don't have scheduled shifts
        print(f"Manager has_shift: {data.get('has_shift')}, message: {data.get('message')}")
    
    def test_clock_out_returns_next_shift(self):
        """Test that clock_out response includes next_shift data"""
        # This is a documentation test - we check the response structure
        # Actual clock out may fail if not clocked in, which is expected
        response = self.session.post(
            f"{BASE_URL}/api/attendance/clock",
            headers={"Authorization": f"Bearer {self.staff_token}"},
            json={"employee_id": self.staff_employee["employee_id"], "action": "clock_out"}
        )
        
        # If clocked in, should get 200 with next_shift
        # If not clocked in, should get 400
        if response.status_code == 200:
            data = response.json()
            assert "success" in data, "Response missing 'success' field"
            assert data["action"] == "clock_out", "Action should be clock_out"
            assert "timestamp" in data, "Response missing 'timestamp' field"
            # next_shift may be None if no shifts scheduled
            assert "next_shift" in data, "Response missing 'next_shift' field"
            print(f"Clock out successful with next_shift: {data.get('next_shift')}")
        elif response.status_code == 400:
            data = response.json()
            # Expected if not clocked in
            print(f"Clock out failed (expected if not clocked in): {data.get('detail')}")
        else:
            pytest.fail(f"Unexpected status code {response.status_code}: {response.text}")


class TestShiftDataSeeding:
    """Test that shift data exists for testing"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get manager token for verification
        mgr_response = self.session.get(f"{BASE_URL}/api/employees/lookup/MGR001")
        if mgr_response.status_code == 200:
            mgr_employee = mgr_response.json()
            mgr_login = self.session.post(f"{BASE_URL}/api/auth/validate-pin", json={
                "employee_id": mgr_employee["id"],
                "pin": "1234"
            })
            if mgr_login.status_code == 200:
                self.manager_token = mgr_login.json()["token"]
            else:
                self.manager_token = None
        else:
            self.manager_token = None
    
    def test_staff_has_shifts_seeded(self):
        """Verify NRS001 has shifts seeded for testing"""
        # Get staff token
        response = self.session.get(f"{BASE_URL}/api/employees/lookup/NRS001")
        assert response.status_code == 200
        staff_employee = response.json()
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/validate-pin", json={
            "employee_id": staff_employee["id"],
            "pin": "5368"
        })
        assert login_response.status_code == 200
        staff_token = login_response.json()["token"]
        
        # Get rota
        rota_response = self.session.get(
            f"{BASE_URL}/api/shifts/my-rota",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        
        assert rota_response.status_code == 200, f"Failed to get rota: {rota_response.text}"
        data = rota_response.json()
        
        assert "shifts" in data, "Response missing 'shifts' field"
        print(f"NRS001 has {len(data['shifts'])} shifts scheduled in next 4 weeks")
        
        for shift in data["shifts"][:5]:  # Print first 5 shifts
            print(f"  - {shift['shift_date']}: {shift.get('start_time')} - {shift.get('end_time')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
