"""
Phase 3 Feature Tests for CareHome Clocking System
Tests: Notifications, Messages, Monthly Calendar, Team Calendar, Manager Approvals, Shift Swaps
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://shift-rules-mgr.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"


class TestSeedData:
    """Test seeding endpoints"""
    
    def test_seed_endpoint(self):
        """POST /api/seed returns success"""
        response = requests.post(f"{API_URL}/seed")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"Seed result: {data.get('message', 'OK')}")
    
    def test_seed_shifts_endpoint(self):
        """POST /api/seed-shifts returns success"""
        response = requests.post(f"{API_URL}/seed-shifts")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"Seed shifts result: {data.get('message', 'OK')}, shifts: {data.get('shifts_created', 0)}")


class TestDemoLogin:
    """Test demo login flow - Employee lookup and PIN validation"""
    
    def test_staff_demo_lookup(self):
        """GET /api/employees/lookup/NRS001 returns Emma Thompson"""
        response = requests.get(f"{API_URL}/employees/lookup/NRS001")
        assert response.status_code == 200
        data = response.json()
        assert data["employee_id"] == "NRS001"
        assert data["first_name"] == "Emma"
        assert data["role"] == "staff"
        print(f"Staff: {data['first_name']} {data['last_name']} ({data['employee_id']})")
        return data["id"]
    
    def test_manager_demo_lookup(self):
        """GET /api/employees/lookup/MGR001 returns Michael O'Brien"""
        response = requests.get(f"{API_URL}/employees/lookup/MGR001")
        assert response.status_code == 200
        data = response.json()
        assert data["employee_id"] == "MGR001"
        assert data["role"] == "manager"
        print(f"Manager: {data['first_name']} {data['last_name']}")
        return data["id"]
    
    def test_admin_demo_lookup(self):
        """GET /api/employees/lookup/ADM001 returns Sarah Wilson"""
        response = requests.get(f"{API_URL}/employees/lookup/ADM001")
        assert response.status_code == 200
        data = response.json()
        assert data["employee_id"] == "ADM001"
        assert data["role"] == "admin"
        print(f"Admin: {data['first_name']} {data['last_name']}")
        return data["id"]
    
    def test_staff_pin_validation_correct(self):
        """POST /api/auth/validate-pin with correct PIN 1234 returns token"""
        # First lookup the employee
        lookup = requests.get(f"{API_URL}/employees/lookup/NRS001")
        employee_id = lookup.json()["id"]
        
        # Validate PIN
        response = requests.post(f"{API_URL}/auth/validate-pin", json={
            "employee_id": employee_id,
            "pin": "1234"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["employee"]["employee_id"] == "NRS001"
        print(f"Staff login successful, token received")
        return data["token"]
    
    def test_manager_pin_validation_correct(self):
        """POST /api/auth/validate-pin with correct PIN for manager"""
        lookup = requests.get(f"{API_URL}/employees/lookup/MGR001")
        employee_id = lookup.json()["id"]
        
        response = requests.post(f"{API_URL}/auth/validate-pin", json={
            "employee_id": employee_id,
            "pin": "1234"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["employee"]["role"] == "manager"
        print(f"Manager login successful")
        return data["token"]
    
    def test_pin_validation_incorrect(self):
        """POST /api/auth/validate-pin with wrong PIN returns 401"""
        lookup = requests.get(f"{API_URL}/employees/lookup/NRS001")
        employee_id = lookup.json()["id"]
        
        response = requests.post(f"{API_URL}/auth/validate-pin", json={
            "employee_id": employee_id,
            "pin": "9999"
        })
        assert response.status_code == 401
        print("Incorrect PIN correctly rejected")


@pytest.fixture
def staff_token():
    """Get staff authentication token"""
    lookup = requests.get(f"{API_URL}/employees/lookup/NRS001")
    employee_id = lookup.json()["id"]
    response = requests.post(f"{API_URL}/auth/validate-pin", json={
        "employee_id": employee_id,
        "pin": "1234"
    })
    return response.json()["token"]


@pytest.fixture
def manager_token():
    """Get manager authentication token"""
    lookup = requests.get(f"{API_URL}/employees/lookup/MGR001")
    employee_id = lookup.json()["id"]
    response = requests.post(f"{API_URL}/auth/validate-pin", json={
        "employee_id": employee_id,
        "pin": "1234"
    })
    return response.json()["token"]


class TestNotifications:
    """Test notification endpoints"""
    
    def test_get_notifications(self, staff_token):
        """GET /api/notifications returns notifications list"""
        response = requests.get(f"{API_URL}/notifications", 
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        print(f"Notifications: {len(data['notifications'])}, unread: {data['unread_count']}")
    
    def test_notifications_unauthenticated(self):
        """GET /api/notifications without auth returns 401"""
        response = requests.get(f"{API_URL}/notifications")
        assert response.status_code == 401


class TestMessages:
    """Test messaging endpoints"""
    
    def test_get_messages(self, staff_token):
        """GET /api/messages returns messages list"""
        response = requests.get(f"{API_URL}/messages",
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        print(f"Messages: {len(data['messages'])}")
    
    def test_send_message(self, manager_token):
        """POST /api/messages sends a message"""
        # Get colleagues first
        colleagues_response = requests.get(f"{API_URL}/employees",
                                          headers={"Authorization": f"Bearer {manager_token}"})
        colleagues = colleagues_response.json().get("employees", [])
        
        if colleagues:
            recipient = next((c for c in colleagues if c["role"] == "staff"), colleagues[0])
            response = requests.post(f"{API_URL}/messages", 
                                    json={
                                        "recipient_id": recipient["id"],
                                        "subject": "TEST_Message Subject",
                                        "content": "This is a test message content"
                                    },
                                    headers={"Authorization": f"Bearer {manager_token}"})
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            print(f"Message sent successfully to {recipient['first_name']}")
        else:
            pytest.skip("No colleagues found for messaging test")


class TestCalendarAPIs:
    """Test calendar endpoints - Monthly Rota and Team Calendar"""
    
    def test_monthly_rota(self, staff_token):
        """GET /api/calendar/monthly-rota returns shifts and leave data"""
        year = datetime.now().year
        month = datetime.now().month
        response = requests.get(f"{API_URL}/calendar/monthly-rota?year={year}&month={month}",
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "shifts" in data
        assert "leave" in data
        print(f"Monthly rota: {len(data.get('shifts', []))} shifts, {len(data.get('leave', []))} leave entries")
    
    def test_team_availability(self, staff_token):
        """GET /api/calendar/team-availability returns calendar data"""
        response = requests.get(f"{API_URL}/calendar/team-availability",
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "calendar" in data
        print(f"Team availability: {len(data.get('calendar', []))} entries")


class TestManagerApprovals:
    """Test manager approval workflow endpoints"""
    
    def test_pending_approvals(self, manager_token):
        """GET /api/manager/pending-approvals returns pending approvals"""
        response = requests.get(f"{API_URL}/manager/pending-approvals",
                               headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "leave_requests" in data
        assert "day_requests" in data
        assert "swap_requests" in data
        assert "total_pending" in data
        print(f"Pending: {data['total_pending']} total - Leave: {len(data['leave_requests'])}, Day: {len(data['day_requests'])}, Swaps: {len(data['swap_requests'])}")
    
    def test_pending_approvals_staff_forbidden(self, staff_token):
        """GET /api/manager/pending-approvals as staff returns 403"""
        response = requests.get(f"{API_URL}/manager/pending-approvals",
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 403
        print("Staff correctly denied access to pending approvals")


class TestStaffProfile:
    """Test staff profile and related endpoints"""
    
    def test_staff_profile(self, staff_token):
        """GET /api/staff/profile returns comprehensive profile data"""
        response = requests.get(f"{API_URL}/staff/profile",
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "employee" in data
        assert "leave_balance" in data
        assert "pending_counts" in data
        assert data["leave_balance"]["annual_total"] == 28
        print(f"Profile: {data['employee']['first_name']} - Leave: {data['leave_balance']['annual_remaining']}/{data['leave_balance']['annual_total']}")
    
    def test_staff_colleagues(self, staff_token):
        """GET /api/staff/colleagues returns list of colleagues"""
        response = requests.get(f"{API_URL}/staff/colleagues",
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "colleagues" in data
        print(f"Colleagues: {len(data['colleagues'])}")


class TestShiftSwaps:
    """Test shift swap endpoints"""
    
    def test_get_shift_swaps_staff(self, staff_token):
        """GET /api/shift-swaps returns swaps for staff view"""
        response = requests.get(f"{API_URL}/shift-swaps",
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "shift_swaps" in data
        assert "available_swaps" in data
        assert "direct_requests" in data
        assert data.get("view_type") == "staff"
        print(f"Staff swaps: {len(data['shift_swaps'])} own, {len(data['available_swaps'])} available, {len(data['direct_requests'])} direct")
    
    def test_get_shift_swaps_manager(self, manager_token):
        """GET /api/shift-swaps for manager returns approval view"""
        response = requests.get(f"{API_URL}/shift-swaps",
                               headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "shift_swaps" in data
        assert data.get("view_type") == "approval"
        print(f"Manager swap approval view: {len(data['shift_swaps'])} pending")


class TestLeaveRequests:
    """Test leave request endpoints"""
    
    def test_get_leave_requests(self, staff_token):
        """GET /api/leave-requests returns user's leave requests"""
        response = requests.get(f"{API_URL}/leave-requests",
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "leave_requests" in data
        print(f"Leave requests: {len(data['leave_requests'])}")
    
    def test_create_leave_request(self, staff_token):
        """POST /api/leave-requests creates a leave request"""
        response = requests.post(f"{API_URL}/leave-requests",
                                json={
                                    "leave_type": "annual",
                                    "start_date": "2026-02-15",
                                    "end_date": "2026-02-17",
                                    "reason": "TEST_Family event"
                                },
                                headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"Leave request created with ID: {data.get('id', 'N/A')}")
        return data.get("id")


class TestDayRequests:
    """Test day request endpoints"""
    
    def test_get_day_requests(self, staff_token):
        """GET /api/day-requests returns user's day requests"""
        response = requests.get(f"{API_URL}/day-requests",
                               headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "day_requests" in data
        print(f"Day requests: {len(data['day_requests'])}")
    
    def test_create_day_off_request(self, staff_token):
        """POST /api/day-requests creates a day off request"""
        response = requests.post(f"{API_URL}/day-requests",
                                json={
                                    "request_type": "day_off",
                                    "requested_date": "2026-02-20",
                                    "reason": "TEST_Personal appointment"
                                },
                                headers={"Authorization": f"Bearer {staff_token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"Day off request created")


class TestDashboardStats:
    """Test dashboard statistics"""
    
    def test_dashboard_stats(self, manager_token):
        """GET /api/dashboard/stats returns stats"""
        response = requests.get(f"{API_URL}/dashboard/stats",
                               headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "total_employees" in data
        assert "today" in data
        print(f"Stats: {data['total_employees']} employees, {data['today']['clocked_in']} clocked in")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
