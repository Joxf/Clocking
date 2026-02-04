#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class CareHomeAPITester:
    def __init__(self, base_url="https://carehome-clock.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Message: {data.get('message', 'N/A')}"
            self.log_test("API Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("API Root Endpoint", False, str(e))
            return False

    def test_seed_database(self):
        """Test database seeding"""
        try:
            response = requests.post(f"{self.api_url}/seed")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Employees created: {data.get('employees_created', 'N/A')}"
            self.log_test("Database Seeding", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Database Seeding", False, str(e))
            return False, {}

    def test_employee_lookup(self, employee_code):
        """Test employee lookup endpoint"""
        try:
            response = requests.get(f"{self.api_url}/employees/lookup/{employee_code}")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                name = f"{data.get('first_name', '')} {data.get('last_name', '')}"
                details += f", Employee: {name} ({data.get('role', 'N/A')})"
            self.log_test(f"Employee Lookup - {employee_code}", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test(f"Employee Lookup - {employee_code}", False, str(e))
            return False, {}

    def test_pin_validation(self, employee_id, pin, expected_success=True):
        """Test PIN validation"""
        try:
            response = requests.post(f"{self.api_url}/auth/validate-pin", json={
                "employee_id": employee_id,
                "pin": pin
            })
            
            if expected_success:
                success = response.status_code == 200
                details = f"Status: {response.status_code}"
                if success:
                    data = response.json()
                    self.token = data.get('token')
                    employee = data.get('employee', {})
                    details += f", Role: {employee.get('role', 'N/A')}"
            else:
                success = response.status_code == 401
                details = f"Status: {response.status_code} (Expected 401 for invalid PIN)"
            
            test_name = f"PIN Validation - {pin} ({'Valid' if expected_success else 'Invalid'})"
            self.log_test(test_name, success, details)
            return success, response.json() if response.status_code == 200 else {}
        except Exception as e:
            test_name = f"PIN Validation - {pin}"
            self.log_test(test_name, False, str(e))
            return False, {}

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        if not self.token:
            self.log_test("Dashboard Stats", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/dashboard/stats", 
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Total Staff: {data.get('total_employees', 'N/A')}"
            self.log_test("Dashboard Stats", success, details)
            return success
        except Exception as e:
            self.log_test("Dashboard Stats", False, str(e))
            return False

    def test_attendance_status(self):
        """Test attendance status endpoint"""
        if not self.token:
            self.log_test("Attendance Status", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/attendance/status",
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Clocked In: {data.get('clocked_in', 'N/A')}"
            self.log_test("Attendance Status", success, details)
            return success
        except Exception as e:
            self.log_test("Attendance Status", False, str(e))
            return False

    def test_today_attendance(self):
        """Test today's attendance endpoint (manager/admin only)"""
        if not self.token:
            self.log_test("Today's Attendance", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/attendance/today",
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                records = data.get('records', [])
                details += f", Records: {len(records)}"
            self.log_test("Today's Attendance", success, details)
            return success
        except Exception as e:
            self.log_test("Today's Attendance", False, str(e))
            return False

    def test_logout(self):
        """Test logout endpoint"""
        if not self.token:
            self.log_test("Logout", False, "No authentication token")
            return False
        
        try:
            response = requests.post(f"{self.api_url}/auth/logout",
                                   headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            self.log_test("Logout", success, details)
            return success
        except Exception as e:
            self.log_test("Logout", False, str(e))
            return False

    def run_comprehensive_test(self):
        """Run all backend tests"""
        print("🚀 Starting CareHome Clocking System Backend Tests")
        print(f"📍 Testing API: {self.api_url}")
        print("=" * 60)

        # Test 1: API Root
        self.test_api_root()

        # Test 2: Database Seeding
        seed_success, seed_data = self.test_seed_database()

        # Test 3: Employee Lookups (Demo employees)
        demo_employees = ["ADM001", "MGR001", "NRS001"]
        employee_data = {}
        
        for emp_code in demo_employees:
            success, data = self.test_employee_lookup(emp_code)
            if success:
                employee_data[emp_code] = data

        # Test 4: PIN Validation - Valid PIN (1234)
        if "ADM001" in employee_data:
            admin_id = employee_data["ADM001"]["id"]
            success, auth_data = self.test_pin_validation(admin_id, "1234", True)

        # Test 5: PIN Validation - Invalid PIN
        if "ADM001" in employee_data:
            admin_id = employee_data["ADM001"]["id"]
            self.test_pin_validation(admin_id, "9999", False)

        # Test 6: Dashboard Stats (requires admin/manager token)
        self.test_dashboard_stats()

        # Test 7: Attendance Status
        self.test_attendance_status()

        # Test 8: Today's Attendance (admin/manager only)
        self.test_today_attendance()

        # Test 9: Logout
        self.test_logout()

        # Print Summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return True
        else:
            print("⚠️  Some backend tests failed")
            return False

def main():
    tester = CareHomeAPITester()
    success = tester.run_comprehensive_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())