"""
Test Phase 5B: Offline Support for Kiosk
Tests for:
- POST /api/kiosk/register - Register new kiosk device returns device_id
- POST /api/kiosk/heartbeat - Update device last_seen timestamp
- GET /api/kiosk/offline-bundle - Get offline auth bundle with employees and shifts (manager only)
- POST /api/kiosk/offline-auth - Validate offline authentication credentials
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
MANAGER_CODE = "MGR001"
MANAGER_PIN = "1234"
STAFF_CODE = "NRS001"
STAFF_PIN = "5368"


class TestKioskRegister:
    """Tests for POST /api/kiosk/register endpoint"""
    
    def test_register_kiosk_device(self):
        """Test registering a new kiosk device returns device_id"""
        response = requests.post(
            f"{BASE_URL}/api/kiosk/register",
            params={
                "device_name": "TEST_Kiosk_Reception",
                "location": "Main Reception",
                "setup_pin": "1234"
            }
        )
        print(f"Register kiosk response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") is True
        assert "device_id" in data
        assert len(data["device_id"]) > 0
        assert data.get("device_name") == "TEST_Kiosk_Reception"
        assert "message" in data
        
        # Store device_id for later tests
        TestKioskRegister.device_id = data["device_id"]
        print(f"Registered device_id: {data['device_id']}")
    
    def test_register_kiosk_without_optional_params(self):
        """Test registering kiosk with only required params"""
        response = requests.post(
            f"{BASE_URL}/api/kiosk/register",
            params={"device_name": "TEST_Kiosk_Minimal"}
        )
        print(f"Register minimal kiosk response: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "device_id" in data


class TestKioskHeartbeat:
    """Tests for POST /api/kiosk/heartbeat endpoint"""
    
    def test_heartbeat_with_valid_device(self):
        """Test heartbeat updates last_seen timestamp"""
        # First register a device
        reg_response = requests.post(
            f"{BASE_URL}/api/kiosk/register",
            params={"device_name": "TEST_Kiosk_Heartbeat"}
        )
        device_id = reg_response.json().get("device_id")
        print(f"Device for heartbeat: {device_id}")
        
        # Send heartbeat
        response = requests.post(
            f"{BASE_URL}/api/kiosk/heartbeat",
            params={"device_id": device_id}
        )
        print(f"Heartbeat response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "timestamp" in data
    
    def test_heartbeat_with_invalid_device(self):
        """Test heartbeat with non-existent device returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/kiosk/heartbeat",
            params={"device_id": "non-existent-device-id"}
        )
        print(f"Invalid device heartbeat response: {response.status_code}")
        
        assert response.status_code == 404


class TestOfflineBundle:
    """Tests for GET /api/kiosk/offline-bundle endpoint"""
    
    @pytest.fixture(autouse=True)
    def get_manager_token(self):
        """Get manager authentication token"""
        # Step 1: Lookup employee
        lookup_response = requests.get(f"{BASE_URL}/api/employees/lookup/{MANAGER_CODE}")
        if lookup_response.status_code != 200:
            pytest.skip("Manager employee not found")
        
        employee = lookup_response.json()
        employee_id = employee.get("id")
        
        # Step 2: Validate PIN to get token
        pin_response = requests.post(
            f"{BASE_URL}/api/auth/validate-pin",
            json={"employee_id": employee_id, "pin": MANAGER_PIN}
        )
        
        if pin_response.status_code != 200:
            pytest.skip(f"Manager PIN validation failed: {pin_response.text}")
        
        self.manager_token = pin_response.json().get("token")
        self.manager_headers = {"Authorization": f"Bearer {self.manager_token}"}
    
    @pytest.fixture
    def get_staff_token(self):
        """Get staff authentication token"""
        # Step 1: Lookup employee
        lookup_response = requests.get(f"{BASE_URL}/api/employees/lookup/{STAFF_CODE}")
        if lookup_response.status_code != 200:
            pytest.skip("Staff employee not found")
        
        employee = lookup_response.json()
        employee_id = employee.get("id")
        
        # Step 2: Validate PIN to get token
        pin_response = requests.post(
            f"{BASE_URL}/api/auth/validate-pin",
            json={"employee_id": employee_id, "pin": STAFF_PIN}
        )
        
        if pin_response.status_code != 200:
            pytest.skip(f"Staff PIN validation failed: {pin_response.text}")
        
        return pin_response.json().get("token")
    
    def test_offline_bundle_with_manager(self):
        """Test manager can download offline bundle"""
        response = requests.get(
            f"{BASE_URL}/api/kiosk/offline-bundle",
            headers=self.manager_headers
        )
        print(f"Offline bundle response: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify bundle structure
        assert data.get("success") is True
        assert "employees" in data
        assert isinstance(data["employees"], list)
        assert "shifts" in data
        assert isinstance(data["shifts"], list)
        assert "expires_at" in data
        assert "bundle_version" in data
        assert "care_home_id" in data
        
        print(f"Bundle contains {len(data['employees'])} employees and {len(data['shifts'])} shifts")
        
        # Verify employees have auth data (pin_hash, totp_secret)
        if data["employees"]:
            emp = data["employees"][0]
            assert "employee_id" in emp
            assert "first_name" in emp
            assert "last_name" in emp
            # Auth fields should be present for offline validation
            assert "pin_hash" in emp or "totp_secret" in emp
    
    def test_offline_bundle_without_auth(self):
        """Test offline bundle requires authentication"""
        response = requests.get(f"{BASE_URL}/api/kiosk/offline-bundle")
        print(f"Offline bundle without auth response: {response.status_code}")
        
        assert response.status_code == 401 or response.status_code == 403
    
    def test_offline_bundle_with_staff_denied(self, get_staff_token):
        """Test staff cannot download offline bundle (manager only)"""
        staff_token = get_staff_token
        response = requests.get(
            f"{BASE_URL}/api/kiosk/offline-bundle",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        print(f"Offline bundle with staff token response: {response.status_code}")
        
        assert response.status_code == 403


class TestOfflineAuth:
    """Tests for POST /api/kiosk/offline-auth endpoint"""
    
    def test_offline_auth_valid_credentials(self):
        """Test offline auth validation with valid PIN"""
        response = requests.post(
            f"{BASE_URL}/api/kiosk/offline-auth",
            params={
                "employee_id": STAFF_CODE,
                "pin": STAFF_PIN,
                "device_id": "test-device-123",
                "offline_timestamp": datetime.utcnow().isoformat()
            }
        )
        print(f"Offline auth response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("valid") is True
        assert "employee_id" in data
        assert "employee_code" in data
        assert data.get("employee_code") == STAFF_CODE
        assert "name" in data
        assert "role" in data
    
    def test_offline_auth_invalid_pin(self):
        """Test offline auth with wrong PIN returns invalid"""
        response = requests.post(
            f"{BASE_URL}/api/kiosk/offline-auth",
            params={
                "employee_id": STAFF_CODE,
                "pin": "0000",  # Wrong PIN
                "device_id": "test-device-123"
            }
        )
        print(f"Offline auth invalid PIN response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") is False
        assert "reason" in data
        assert "Invalid PIN" in data.get("reason", "")
    
    def test_offline_auth_invalid_employee(self):
        """Test offline auth with non-existent employee"""
        response = requests.post(
            f"{BASE_URL}/api/kiosk/offline-auth",
            params={
                "employee_id": "NONEXISTENT001",
                "pin": "1234"
            }
        )
        print(f"Offline auth invalid employee response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") is False
        assert "Employee not found" in data.get("reason", "")
    
    def test_offline_auth_manager_credentials(self):
        """Test offline auth with manager credentials"""
        response = requests.post(
            f"{BASE_URL}/api/kiosk/offline-auth",
            params={
                "employee_id": MANAGER_CODE,
                "pin": MANAGER_PIN
            }
        )
        print(f"Offline auth manager response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") is True
        assert data.get("employee_code") == MANAGER_CODE


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
