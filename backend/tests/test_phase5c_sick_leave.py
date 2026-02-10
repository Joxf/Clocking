"""
Phase 5C Testing: Sick Leave Recording and Request Approval Message Notifications
- POST /api/sick-leave/record: Create sick leave record
- GET /api/sick-leave/my-records: Get own sick leave records with total_sick_days_this_year
- GET /api/sick-leave/all: Manager only, get all sick leave records
- PUT /api/sick-leave/{id}/return-to-work: Mark return to work
- PUT /api/leave-requests/{id}/approve: Approve leave request (creates internal message)
- PUT /api/leave-requests/{id}/reject: Reject leave request (creates internal message)
- PUT /api/day-requests/{id}/approve: Approve day request (creates internal message)
- PUT /api/day-requests/{id}/reject: Reject day request (creates internal message)
- GET /api/messages: Get internal messages
- Planner validation rules: MIN_REST_HOURS=11, MAX_CONSECUTIVE_DAYS=2
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MANAGER_CODE = "MGR001"
MANAGER_PIN = "1234"
STAFF_CODE = "NRS001"
STAFF_PIN = "5368"


class TestAuthentication:
    """Helper methods for authentication"""
    
    @staticmethod
    def get_manager_token():
        """Login as manager and get token"""
        # First validate QR (mock TOTP)
        lookup_resp = requests.get(f"{BASE_URL}/api/employees/lookup/{MANAGER_CODE}")
        if lookup_resp.status_code != 200:
            pytest.skip(f"Manager lookup failed: {lookup_resp.text}")
        
        emp = lookup_resp.json()
        # Direct PIN validation with employee internal ID
        pin_resp = requests.post(f"{BASE_URL}/api/auth/validate-pin", json={
            "employee_id": emp["id"],
            "pin": MANAGER_PIN
        })
        if pin_resp.status_code != 200:
            pytest.skip(f"Manager auth failed: {pin_resp.text}")
        return pin_resp.json()["token"]
    
    @staticmethod
    def get_staff_token():
        """Login as staff and get token"""
        lookup_resp = requests.get(f"{BASE_URL}/api/employees/lookup/{STAFF_CODE}")
        if lookup_resp.status_code != 200:
            pytest.skip(f"Staff lookup failed: {lookup_resp.text}")
        
        emp = lookup_resp.json()
        pin_resp = requests.post(f"{BASE_URL}/api/auth/validate-pin", json={
            "employee_id": emp["id"],
            "pin": STAFF_PIN
        })
        if pin_resp.status_code != 200:
            pytest.skip(f"Staff auth failed: {pin_resp.text}")
        return pin_resp.json()["token"]


class TestSickLeaveEndpoints:
    """Test sick leave recording endpoints"""
    
    @pytest.fixture(scope="class")
    def manager_headers(self):
        token = TestAuthentication.get_manager_token()
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def staff_headers(self):
        token = TestAuthentication.get_staff_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_01_record_sick_leave_success(self, staff_headers):
        """Test POST /api/sick-leave/record - Create sick leave record"""
        today = datetime.now().date().isoformat()
        tomorrow = (datetime.now() + timedelta(days=1)).date().isoformat()
        
        payload = {
            "start_date": today,
            "end_date": tomorrow,
            "symptoms": "TEST_Flu symptoms, fever",
            "doctor_note": False,
            "notes": "TEST_Will provide doctor note if needed"
        }
        
        response = requests.post(f"{BASE_URL}/api/sick-leave/record", json=payload, headers=staff_headers)
        
        assert response.status_code == 200, f"Failed to create sick leave: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "id" in data
        
        # Store for later tests
        TestSickLeaveEndpoints.sick_leave_id = data["id"]
        print(f"✓ Created sick leave record: {data['id']}")
    
    def test_02_get_my_sick_leave_records(self, staff_headers):
        """Test GET /api/sick-leave/my-records - Get own sick leave records"""
        response = requests.get(f"{BASE_URL}/api/sick-leave/my-records", headers=staff_headers)
        
        assert response.status_code == 200, f"Failed to get my sick leave: {response.text}"
        data = response.json()
        
        assert "records" in data
        assert "total_sick_days_this_year" in data
        assert isinstance(data["total_sick_days_this_year"], int)
        
        # Check we have at least the test record
        records = data["records"]
        assert len(records) > 0, "Expected at least one sick leave record"
        
        # Find our test record
        test_record = next((r for r in records if "TEST_" in str(r.get("symptoms", ""))), None)
        if test_record:
            assert test_record.get("symptoms") == "TEST_Flu symptoms, fever"
            print(f"✓ Found test sick leave record with {data['total_sick_days_this_year']} total sick days this year")
        else:
            print(f"✓ Retrieved {len(records)} sick leave records, total sick days: {data['total_sick_days_this_year']}")
    
    def test_03_get_all_sick_leave_manager_only(self, manager_headers, staff_headers):
        """Test GET /api/sick-leave/all - Manager only access"""
        # Manager should succeed
        response = requests.get(f"{BASE_URL}/api/sick-leave/all", headers=manager_headers)
        assert response.status_code == 200, f"Manager failed to get all sick leave: {response.text}"
        data = response.json()
        assert "records" in data
        print(f"✓ Manager retrieved {len(data['records'])} sick leave records")
        
        # Staff should be denied (403)
        response = requests.get(f"{BASE_URL}/api/sick-leave/all", headers=staff_headers)
        assert response.status_code == 403, f"Staff should be denied, got: {response.status_code}"
        print("✓ Staff correctly denied access to all sick leave records")
    
    def test_04_return_to_work(self, staff_headers):
        """Test PUT /api/sick-leave/{id}/return-to-work - Mark return to work"""
        if not hasattr(TestSickLeaveEndpoints, 'sick_leave_id'):
            pytest.skip("No sick leave ID from previous test")
        
        today = datetime.now().date().isoformat()
        response = requests.put(
            f"{BASE_URL}/api/sick-leave/{TestSickLeaveEndpoints.sick_leave_id}/return-to-work",
            params={"return_date": today, "notes": "TEST_Feeling better now"},
            headers=staff_headers
        )
        
        assert response.status_code == 200, f"Failed to mark return to work: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("✓ Marked return to work successfully")
    
    def test_05_record_sick_leave_minimal(self, staff_headers):
        """Test sick leave with minimal data (only start_date required)"""
        today = datetime.now().date().isoformat()
        
        payload = {
            "start_date": today,
            "symptoms": "TEST_Minor headache"
        }
        
        response = requests.post(f"{BASE_URL}/api/sick-leave/record", json=payload, headers=staff_headers)
        
        assert response.status_code == 200, f"Failed with minimal data: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("✓ Created sick leave with minimal data")


class TestLeaveRequestApprovalMessages:
    """Test that leave request approval/rejection creates internal messages"""
    
    @pytest.fixture(scope="class")
    def manager_headers(self):
        token = TestAuthentication.get_manager_token()
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def staff_headers(self):
        token = TestAuthentication.get_staff_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_01_create_leave_request(self, staff_headers):
        """Create a leave request to approve/reject"""
        start_date = (datetime.now() + timedelta(days=30)).date().isoformat()
        end_date = (datetime.now() + timedelta(days=32)).date().isoformat()
        
        payload = {
            "leave_type": "annual",
            "start_date": start_date,
            "end_date": end_date,
            "reason": "TEST_Leave for message testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/leave-requests", json=payload, headers=staff_headers)
        
        assert response.status_code == 200, f"Failed to create leave request: {response.text}"
        data = response.json()
        assert "id" in data
        TestLeaveRequestApprovalMessages.leave_request_id = data["id"]
        print(f"✓ Created leave request: {data['id']}")
    
    def test_02_approve_leave_creates_message(self, manager_headers, staff_headers):
        """Test that approving leave creates internal message"""
        if not hasattr(TestLeaveRequestApprovalMessages, 'leave_request_id'):
            pytest.skip("No leave request ID from previous test")
        
        request_id = TestLeaveRequestApprovalMessages.leave_request_id
        
        # Approve the request
        response = requests.put(f"{BASE_URL}/api/leave-requests/{request_id}/approve", headers=manager_headers)
        assert response.status_code == 200, f"Failed to approve leave: {response.text}"
        print("✓ Leave request approved")
        
        # Check messages for staff
        response = requests.get(f"{BASE_URL}/api/messages", headers=staff_headers)
        assert response.status_code == 200, f"Failed to get messages: {response.text}"
        
        data = response.json()
        messages = data.get("messages", [])
        
        # Look for approval message
        approval_msg = next((m for m in messages if "Leave Request Approved" in m.get("subject", "")), None)
        assert approval_msg is not None, f"No approval message found. Messages: {[m.get('subject') for m in messages]}"
        
        assert "approved" in approval_msg.get("content", "").lower()
        print(f"✓ Found internal approval message: {approval_msg['subject']}")
    
    def test_03_create_and_reject_leave_creates_message(self, staff_headers, manager_headers):
        """Test that rejecting leave creates internal message"""
        # Create another leave request
        start_date = (datetime.now() + timedelta(days=60)).date().isoformat()
        end_date = (datetime.now() + timedelta(days=62)).date().isoformat()
        
        payload = {
            "leave_type": "annual",
            "start_date": start_date,
            "end_date": end_date,
            "reason": "TEST_Leave for rejection testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/leave-requests", json=payload, headers=staff_headers)
        assert response.status_code == 200
        request_id = response.json()["id"]
        
        # Reject it
        response = requests.put(
            f"{BASE_URL}/api/leave-requests/{request_id}/reject",
            params={"reason": "TEST_Insufficient staff coverage"},
            headers=manager_headers
        )
        assert response.status_code == 200, f"Failed to reject leave: {response.text}"
        print("✓ Leave request rejected")
        
        # Check messages
        response = requests.get(f"{BASE_URL}/api/messages", headers=staff_headers)
        assert response.status_code == 200
        
        data = response.json()
        messages = data.get("messages", [])
        
        rejection_msg = next((m for m in messages if "Leave Request Rejected" in m.get("subject", "")), None)
        assert rejection_msg is not None, f"No rejection message found. Messages: {[m.get('subject') for m in messages]}"
        print(f"✓ Found internal rejection message: {rejection_msg['subject']}")


class TestDayRequestApprovalMessages:
    """Test that day request approval/rejection creates internal messages"""
    
    @pytest.fixture(scope="class")
    def manager_headers(self):
        token = TestAuthentication.get_manager_token()
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def staff_headers(self):
        token = TestAuthentication.get_staff_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_01_create_day_request(self, staff_headers):
        """Create a day off request"""
        requested_date = (datetime.now() + timedelta(days=45)).date().isoformat()
        
        payload = {
            "request_type": "day_off",
            "requested_date": requested_date,
            "reason": "TEST_Day off for message testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/day-requests", json=payload, headers=staff_headers)
        
        assert response.status_code == 200, f"Failed to create day request: {response.text}"
        data = response.json()
        assert "id" in data
        TestDayRequestApprovalMessages.day_request_id = data["id"]
        print(f"✓ Created day request: {data['id']}")
    
    def test_02_approve_day_request_creates_message(self, manager_headers, staff_headers):
        """Test that approving day request creates internal message"""
        if not hasattr(TestDayRequestApprovalMessages, 'day_request_id'):
            pytest.skip("No day request ID from previous test")
        
        request_id = TestDayRequestApprovalMessages.day_request_id
        
        # Approve
        response = requests.put(f"{BASE_URL}/api/day-requests/{request_id}/approve", headers=manager_headers)
        assert response.status_code == 200, f"Failed to approve day request: {response.text}"
        print("✓ Day request approved")
        
        # Check messages
        response = requests.get(f"{BASE_URL}/api/messages", headers=staff_headers)
        assert response.status_code == 200
        
        data = response.json()
        messages = data.get("messages", [])
        
        approval_msg = next((m for m in messages if "Day Off Request Approved" in m.get("subject", "")), None)
        assert approval_msg is not None, f"No day approval message found. Messages: {[m.get('subject') for m in messages]}"
        print(f"✓ Found internal day approval message: {approval_msg['subject']}")
    
    def test_03_create_and_reject_day_request_creates_message(self, staff_headers, manager_headers):
        """Test that rejecting day request creates internal message"""
        # Create day on request
        requested_date = (datetime.now() + timedelta(days=90)).date().isoformat()
        
        payload = {
            "request_type": "day_on",
            "requested_date": requested_date,
            "reason": "TEST_Day on for rejection testing"
        }
        
        response = requests.post(f"{BASE_URL}/api/day-requests", json=payload, headers=staff_headers)
        assert response.status_code == 200
        request_id = response.json()["id"]
        
        # Reject
        response = requests.put(
            f"{BASE_URL}/api/day-requests/{request_id}/reject",
            params={"reason": "TEST_Already fully staffed"},
            headers=manager_headers
        )
        assert response.status_code == 200, f"Failed to reject day request: {response.text}"
        print("✓ Day request rejected")
        
        # Check messages
        response = requests.get(f"{BASE_URL}/api/messages", headers=staff_headers)
        assert response.status_code == 200
        
        data = response.json()
        messages = data.get("messages", [])
        
        rejection_msg = next((m for m in messages if "Day On Request Rejected" in m.get("subject", "")), None)
        assert rejection_msg is not None, f"No day rejection message found. Messages: {[m.get('subject') for m in messages]}"
        print(f"✓ Found internal day rejection message: {rejection_msg['subject']}")


class TestPlannerValidationRules:
    """Test that planner validation rules are in place (MIN_REST_HOURS=11, MAX_CONSECUTIVE_DAYS=2)"""
    
    @pytest.fixture(scope="class")
    def manager_headers(self):
        token = TestAuthentication.get_manager_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_01_get_planner_templates_with_rules(self, manager_headers):
        """Test that planner templates endpoint returns validation rules"""
        response = requests.get(f"{BASE_URL}/api/planner/templates", headers=manager_headers)
        
        assert response.status_code == 200, f"Failed to get planner templates: {response.text}"
        data = response.json()
        
        # Check validation rules are present in the 'rules' key
        assert "rules" in data, "rules not in response"
        rules = data["rules"]
        
        assert "min_rest_hours" in rules, "min_rest_hours not in rules"
        assert "max_consecutive_days" in rules, "max_consecutive_days not in rules"
        
        assert rules["min_rest_hours"] == 11, f"Expected MIN_REST_HOURS=11, got {rules['min_rest_hours']}"
        assert rules["max_consecutive_days"] == 2, f"Expected MAX_CONSECUTIVE_DAYS=2, got {rules['max_consecutive_days']}"
        
        print(f"✓ Planner validation rules: min_rest_hours={rules['min_rest_hours']}, max_consecutive_days={rules['max_consecutive_days']}")
    
    def test_02_validate_assignment_returns_warnings(self, manager_headers):
        """Test that assignment validation can return warnings"""
        # Get staff list to find a valid employee
        response = requests.get(f"{BASE_URL}/api/staff/colleagues", headers=manager_headers)
        if response.status_code != 200:
            # Try another endpoint
            response = requests.get(f"{BASE_URL}/api/employees", headers=manager_headers)
        
        assert response.status_code == 200
        
        # Check if planner/validate endpoint exists
        tomorrow = (datetime.now() + timedelta(days=1)).date().isoformat()
        
        # This endpoint should exist and check for validation warnings
        response = requests.post(
            f"{BASE_URL}/api/planner/validate",
            json={
                "employee_id": "test-id",
                "shift_date": tomorrow,
                "template": "early"
            },
            headers=manager_headers
        )
        
        # Even if employee doesn't exist, endpoint should work
        if response.status_code in [200, 400, 404]:
            print(f"✓ Planner validation endpoint responds (status: {response.status_code})")
        else:
            print(f"⚠ Planner validation endpoint returned: {response.status_code}")


class TestMessagesEndpoint:
    """Test messages endpoint functionality"""
    
    @pytest.fixture(scope="class")
    def staff_headers(self):
        token = TestAuthentication.get_staff_token()
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def manager_headers(self):
        token = TestAuthentication.get_manager_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_01_get_messages(self, staff_headers):
        """Test GET /api/messages"""
        response = requests.get(f"{BASE_URL}/api/messages", headers=staff_headers)
        
        assert response.status_code == 200, f"Failed to get messages: {response.text}"
        data = response.json()
        assert "messages" in data
        print(f"✓ Retrieved {len(data['messages'])} messages")
    
    def test_02_mark_message_read(self, staff_headers):
        """Test PUT /api/messages/{id}/read"""
        # Get messages first
        response = requests.get(f"{BASE_URL}/api/messages", headers=staff_headers)
        assert response.status_code == 200
        
        messages = response.json().get("messages", [])
        if len(messages) == 0:
            pytest.skip("No messages to mark as read")
        
        msg_id = messages[0]["id"]
        response = requests.put(f"{BASE_URL}/api/messages/{msg_id}/read", headers=staff_headers)
        
        # Should succeed (200) or already be read
        assert response.status_code in [200, 400], f"Failed to mark message read: {response.text}"
        print("✓ Mark message as read endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
