#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class CareHomeAPITester:
    def __init__(self, base_url="https://shift-rules-mgr.preview.emergentagent.com"):
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

    def test_seed_shifts(self):
        """Test shift seeding for testing"""
        try:
            response = requests.post(f"{self.api_url}/seed-shifts")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Shifts created: {data.get('shifts_created', 'N/A')}"
            self.log_test("Seed Shifts", success, details)
            return success
        except Exception as e:
            self.log_test("Seed Shifts", False, str(e))
            return False

    def test_staff_profile(self):
        """Test staff profile endpoint"""
        if not self.token:
            self.log_test("Staff Profile", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/staff/profile",
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                employee = data.get('employee', {})
                leave_balance = data.get('leave_balance', {})
                details += f", Employee: {employee.get('first_name', 'N/A')}, Leave remaining: {leave_balance.get('annual_remaining', 'N/A')}"
            self.log_test("Staff Profile", success, details)
            return success
        except Exception as e:
            self.log_test("Staff Profile", False, str(e))
            return False

    def test_my_rota(self):
        """Test my rota endpoint"""
        if not self.token:
            self.log_test("My Rota", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/shifts/my-rota",
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                shifts = data.get('shifts', [])
                details += f", Shifts: {len(shifts)}"
            self.log_test("My Rota", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("My Rota", False, str(e))
            return False, {}

    def test_today_shift(self):
        """Test today's shift endpoint"""
        if not self.token:
            self.log_test("Today's Shift", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/shifts/today",
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                has_shift = data.get('has_shift', False)
                can_clock = data.get('can_clock', False)
                details += f", Has shift: {has_shift}, Can clock: {can_clock}"
            self.log_test("Today's Shift", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Today's Shift", False, str(e))
            return False, {}

    def test_shift_swaps_staff_only(self, user_role):
        """Test shift swaps endpoint - should be staff-only"""
        if not self.token:
            self.log_test(f"Shift Swaps ({user_role})", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/shift-swaps",
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                swaps = data.get('shift_swaps', [])
                if user_role in ['manager', 'admin']:
                    # Managers/admins should get empty list with message
                    expected_empty = len(swaps) == 0
                    details += f", Swaps: {len(swaps)} (Expected 0 for {user_role})"
                    success = expected_empty
                else:
                    # Staff can see swaps
                    details += f", Swaps: {len(swaps)}"
            self.log_test(f"Shift Swaps Visibility ({user_role})", success, details)
            return success
        except Exception as e:
            self.log_test(f"Shift Swaps ({user_role})", False, str(e))
            return False

    def test_create_shift_swap(self, shift_id):
        """Test creating a shift swap request"""
        if not self.token or not shift_id:
            self.log_test("Create Shift Swap", False, "No authentication token or shift ID")
            return False
        
        try:
            response = requests.post(f"{self.api_url}/shift-swaps", 
                                   json={
                                       "original_shift_id": shift_id,
                                       "reason": "Test swap request"
                                   },
                                   headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Swap ID: {data.get('id', 'N/A')}"
            self.log_test("Create Shift Swap", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Create Shift Swap", False, str(e))
            return False, {}

    def test_leave_requests(self):
        """Test leave requests endpoint"""
        if not self.token:
            self.log_test("Leave Requests", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/leave-requests",
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                requests_list = data.get('leave_requests', [])
                details += f", Requests: {len(requests_list)}"
            self.log_test("Leave Requests", success, details)
            return success
        except Exception as e:
            self.log_test("Leave Requests", False, str(e))
            return False

    def test_create_leave_request(self):
        """Test creating a leave request"""
        if not self.token:
            self.log_test("Create Leave Request", False, "No authentication token")
            return False
        
        try:
            # Create a leave request for next month
            from datetime import datetime, timedelta
            start_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
            end_date = (datetime.now() + timedelta(days=32)).strftime('%Y-%m-%d')
            
            response = requests.post(f"{self.api_url}/leave-requests",
                                   json={
                                       "leave_type": "annual",
                                       "start_date": start_date,
                                       "end_date": end_date,
                                       "reason": "Test annual leave"
                                   },
                                   headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Request ID: {data.get('id', 'N/A')}"
            self.log_test("Create Leave Request", success, details)
            return success
        except Exception as e:
            self.log_test("Create Leave Request", False, str(e))
            return False

    def test_day_requests(self):
        """Test day requests endpoint"""
        if not self.token:
            self.log_test("Day Requests", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/day-requests",
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                requests_list = data.get('day_requests', [])
                details += f", Requests: {len(requests_list)}"
            self.log_test("Day Requests", success, details)
            return success
        except Exception as e:
            self.log_test("Day Requests", False, str(e))
            return False

    def test_create_day_request(self):
        """Test creating a day request"""
        if not self.token:
            self.log_test("Create Day Request", False, "No authentication token")
            return False
        
        try:
            from datetime import datetime, timedelta
            request_date = (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')
            
            response = requests.post(f"{self.api_url}/day-requests",
                                   json={
                                       "request_type": "day_off",
                                       "requested_date": request_date,
                                       "reason": "Test day off request"
                                   },
                                   headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Request ID: {data.get('id', 'N/A')}"
            self.log_test("Create Day Request", success, details)
            return success
        except Exception as e:
            self.log_test("Create Day Request", False, str(e))
            return False

    def test_colleagues(self):
        """Test colleagues endpoint"""
        if not self.token:
            self.log_test("Colleagues", False, "No authentication token")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/staff/colleagues",
                                  headers={"Authorization": f"Bearer {self.token}"})
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                colleagues = data.get('colleagues', [])
                details += f", Colleagues: {len(colleagues)}"
            self.log_test("Colleagues", success, details)
            return success
        except Exception as e:
            self.log_test("Colleagues", False, str(e))
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

        # Test 3: Seed Shifts for testing
        self.test_seed_shifts()

        # Test 4: Employee Lookups (Demo employees)
        demo_employees = ["ADM001", "MGR001", "NRS001"]
        employee_data = {}
        
        for emp_code in demo_employees:
            success, data = self.test_employee_lookup(emp_code)
            if success:
                employee_data[emp_code] = data

        # Test 5: PIN Validation - Valid PIN (1234) for Staff
        staff_token = None
        if "NRS001" in employee_data:
            staff_id = employee_data["NRS001"]["id"]
            success, auth_data = self.test_pin_validation(staff_id, "1234", True)
            if success:
                staff_token = self.token

        # Test 6: PIN Validation - Invalid PIN
        if "NRS001" in employee_data:
            staff_id = employee_data["NRS001"]["id"]
            self.test_pin_validation(staff_id, "9999", False)

        # Test 7: Staff Profile Features (with staff token)
        if staff_token:
            self.token = staff_token
            self.test_staff_profile()
            
            # Test My Rota
            rota_success, rota_data = self.test_my_rota()
            
            # Test Today's Shift
            shift_success, shift_data = self.test_today_shift()
            
            # Test Shift Swaps (staff should see them)
            self.test_shift_swaps_staff_only("staff")
            
            # Test Create Shift Swap (if we have shifts)
            if rota_success and rota_data.get('shifts'):
                shifts = rota_data['shifts']
                if shifts:
                    first_shift = shifts[0]
                    self.test_create_shift_swap(first_shift['id'])
            
            # Test Leave Requests
            self.test_leave_requests()
            self.test_create_leave_request()
            
            # Test Day Requests
            self.test_day_requests()
            self.test_create_day_request()
            
            # Test Colleagues
            self.test_colleagues()

        # Test 8: Manager/Admin tests - PIN Validation for Admin
        admin_token = None
        if "ADM001" in employee_data:
            admin_id = employee_data["ADM001"]["id"]
            success, auth_data = self.test_pin_validation(admin_id, "1234", True)
            if success:
                admin_token = self.token

        # Test 9: Admin/Manager specific tests
        if admin_token:
            self.token = admin_token
            
            # Dashboard Stats (requires admin/manager token)
            self.test_dashboard_stats()
            
            # Attendance Status
            self.test_attendance_status()
            
            # Today's Attendance (admin/manager only)
            self.test_today_attendance()
            
            # Test Shift Swaps (admin/manager should get empty list)
            self.test_shift_swaps_staff_only("admin")

        # Test 10: Logout
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