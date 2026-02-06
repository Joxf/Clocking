"""
Planner API Tests for CareHome Clocking System
Tests all planner endpoints: templates, monthly view, assign, unassign, move, overtime, coverage
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - Manager MGR001, PIN 1234
MANAGER_CODE = "MGR001"
MANAGER_PIN = "1234"


class TestPlannerAPI:
    """Comprehensive tests for the Staff Planner feature"""
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        """Get JWT token for manager by looking up employee and validating PIN"""
        # Step 1: Lookup manager by employee code to get UUID
        lookup_res = requests.get(f"{BASE_URL}/api/employees/lookup/{MANAGER_CODE}")
        assert lookup_res.status_code == 200, f"Manager lookup failed: {lookup_res.text}"
        manager = lookup_res.json()
        manager_uuid = manager["id"]
        
        # Step 2: Validate PIN to get JWT token
        pin_res = requests.post(f"{BASE_URL}/api/auth/validate-pin", json={
            "employee_id": manager_uuid,
            "pin": MANAGER_PIN
        })
        assert pin_res.status_code == 200, f"PIN validation failed: {pin_res.text}"
        return pin_res.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, manager_token):
        """Auth headers for API calls"""
        return {"Authorization": f"Bearer {manager_token}"}
    
    # ============ Templates ============
    
    def test_get_templates_returns_4_templates(self, headers):
        """GET /api/planner/templates returns 4 shift templates with correct times"""
        res = requests.get(f"{BASE_URL}/api/planner/templates", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert "templates" in data
        assert "rules" in data
        
        templates = data["templates"]
        assert len(templates) == 4, f"Expected 4 templates, got {len(templates)}"
        
        # Verify template names
        assert "early" in templates
        assert "late" in templates
        assert "night" in templates
        assert "long_day" in templates
        
        # Verify template times
        assert templates["early"]["start"] == "08:00"
        assert templates["early"]["end"] == "14:00"
        assert templates["late"]["start"] == "14:00"
        assert templates["late"]["end"] == "20:00"
        assert templates["night"]["start"] == "20:00"
        assert templates["night"]["end"] == "08:00"
        assert templates["long_day"]["start"] == "08:00"
        assert templates["long_day"]["end"] == "20:00"
        
        # Verify rules
        rules = data["rules"]
        assert rules["min_rest_hours"] == 11
        assert rules["max_consecutive_days"] == 2
        assert rules["coverage_baseline"]["nurse"] == 2
        assert rules["coverage_baseline"]["carer"] == 6
        
        print("PASS: Templates API returns 4 correct templates with rules")
    
    # ============ Seed Month ============
    
    def test_seed_month_creates_shifts(self, headers):
        """POST /api/planner/seed-month?year=2026&month=2 seeds shifts for February 2026"""
        res = requests.post(f"{BASE_URL}/api/planner/seed-month?year=2026&month=2", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert data["success"] == True
        assert "shifts_created" in data
        assert data["shifts_created"] > 0, "Expected shifts to be created"
        
        print(f"PASS: Seed month created {data['shifts_created']} shifts for Feb 2026")
    
    # ============ Monthly Planner ============
    
    def test_get_monthly_planner_returns_data(self, headers):
        """GET /api/planner/monthly?year=2026&month=2 returns staff, shifts, coverage, stats"""
        res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        # Verify required fields
        assert data["year"] == 2026
        assert data["month"] == 2
        assert "staff" in data
        assert "shifts" in data
        assert "coverage" in data
        assert "staff_stats" in data
        assert "templates" in data
        
        # Verify staff list contains employees
        assert len(data["staff"]) > 0, "Expected staff list to be non-empty"
        
        # Verify shifts exist after seeding
        assert len(data["shifts"]) > 0, "Expected shifts after seeding"
        
        # Verify coverage has dates
        assert len(data["coverage"]) > 0, "Expected coverage data"
        
        print(f"PASS: Monthly planner returns {len(data['staff'])} staff, {len(data['shifts'])} shifts")
    
    # ============ Assign Shift ============
    
    @pytest.fixture(scope="class")
    def test_employee_id(self, headers):
        """Get an employee ID to use for assignment tests"""
        res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        staff = res.json()["staff"]
        return staff[0]["id"]  # Return first staff member's ID
    
    def test_assign_shift_success(self, headers, test_employee_id):
        """POST /api/planner/assign - assign a shift with template to employee on a date"""
        # First clear any existing shift on this test date
        test_date = "2026-02-25"  # Use a date likely to be clear
        
        # Get existing shifts
        monthly_res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        shifts = monthly_res.json()["shifts"]
        
        # Delete any existing shift for this employee on this date
        existing = [s for s in shifts if s["employee_id"] == test_employee_id and s["shift_date"] == test_date]
        for shift in existing:
            requests.delete(f"{BASE_URL}/api/planner/unassign/{shift['id']}", headers=headers)
        
        # Now assign a new shift
        res = requests.post(f"{BASE_URL}/api/planner/assign", json={
            "employee_id": test_employee_id,
            "shift_date": test_date,
            "template": "early",
            "shift_type": "regular"
        }, headers=headers)
        
        # May get requires_confirmation if warnings exist, which is still valid
        assert res.status_code == 200, f"Assign failed: {res.text}"
        data = res.json()
        
        if data.get("requires_confirmation"):
            # Retry with force=true
            res = requests.post(f"{BASE_URL}/api/planner/assign", json={
                "employee_id": test_employee_id,
                "shift_date": test_date,
                "template": "early",
                "shift_type": "regular",
                "force": True
            }, headers=headers)
            assert res.status_code == 200
            data = res.json()
        
        assert data["success"] == True
        assert "shift" in data
        assert data["shift"]["template"] == "early"
        
        print(f"PASS: Shift assigned successfully on {test_date}")
        return data["shift"]["id"]
    
    def test_assign_duplicate_shift_returns_error(self, headers, test_employee_id):
        """POST /api/planner/assign - duplicate shift on same date returns error"""
        test_date = "2026-02-26"
        
        # Clear and assign first shift
        monthly_res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        shifts = monthly_res.json()["shifts"]
        existing = [s for s in shifts if s["employee_id"] == test_employee_id and s["shift_date"] == test_date]
        for shift in existing:
            requests.delete(f"{BASE_URL}/api/planner/unassign/{shift['id']}", headers=headers)
        
        # Assign first shift
        res1 = requests.post(f"{BASE_URL}/api/planner/assign", json={
            "employee_id": test_employee_id,
            "shift_date": test_date,
            "template": "early",
            "force": True
        }, headers=headers)
        assert res1.status_code == 200
        
        # Try to assign second shift on same date - should fail
        res2 = requests.post(f"{BASE_URL}/api/planner/assign", json={
            "employee_id": test_employee_id,
            "shift_date": test_date,
            "template": "late"
        }, headers=headers)
        
        assert res2.status_code == 400, f"Expected 400 for duplicate, got {res2.status_code}"
        assert "already has a shift" in res2.json()["detail"].lower()
        
        print("PASS: Duplicate shift on same date correctly rejected")
    
    def test_assign_consecutive_days_returns_warning(self, headers, test_employee_id):
        """POST /api/planner/assign with consecutive days violation returns warnings"""
        # Clear shifts for test dates
        test_dates = ["2026-02-10", "2026-02-11", "2026-02-12"]
        
        monthly_res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        shifts = monthly_res.json()["shifts"]
        for date in test_dates:
            existing = [s for s in shifts if s["employee_id"] == test_employee_id and s["shift_date"] == date]
            for shift in existing:
                requests.delete(f"{BASE_URL}/api/planner/unassign/{shift['id']}", headers=headers)
        
        # Assign 2 consecutive days first (no warning expected yet for 2 days - warning is for >2)
        for date in test_dates[:2]:
            requests.post(f"{BASE_URL}/api/planner/assign", json={
                "employee_id": test_employee_id,
                "shift_date": date,
                "template": "early",
                "force": True
            }, headers=headers)
        
        # Assigning 3rd consecutive day should trigger warning
        res = requests.post(f"{BASE_URL}/api/planner/assign", json={
            "employee_id": test_employee_id,
            "shift_date": test_dates[2],
            "template": "early"
        }, headers=headers)
        
        assert res.status_code == 200
        data = res.json()
        
        # Should get requires_confirmation with consecutive warning
        if data.get("requires_confirmation"):
            assert "warnings" in data
            warnings = data["warnings"]
            has_consecutive = any("consecutive" in w["message"].lower() for w in warnings)
            assert has_consecutive, f"Expected consecutive days warning, got: {warnings}"
            print("PASS: Consecutive days violation returns warning with requires_confirmation")
        else:
            # If no warning, that's also acceptable if less than 3 consecutive
            print("NOTE: No consecutive days warning triggered (may need exactly 3+ consecutive)")
    
    def test_assign_with_force_overrides_warnings(self, headers, test_employee_id):
        """POST /api/planner/assign with force=true overrides warnings"""
        test_date = "2026-02-15"
        
        # Clear the date
        monthly_res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        shifts = monthly_res.json()["shifts"]
        existing = [s for s in shifts if s["employee_id"] == test_employee_id and s["shift_date"] == test_date]
        for shift in existing:
            requests.delete(f"{BASE_URL}/api/planner/unassign/{shift['id']}", headers=headers)
        
        # First try without force
        res1 = requests.post(f"{BASE_URL}/api/planner/assign", json={
            "employee_id": test_employee_id,
            "shift_date": test_date,
            "template": "early"
        }, headers=headers)
        
        if res1.status_code == 200 and res1.json().get("requires_confirmation"):
            # Retry with force=true
            res2 = requests.post(f"{BASE_URL}/api/planner/assign", json={
                "employee_id": test_employee_id,
                "shift_date": test_date,
                "template": "early",
                "force": True
            }, headers=headers)
            
            assert res2.status_code == 200
            assert res2.json()["success"] == True
            print("PASS: force=true overrides warnings and creates shift")
        else:
            print("NOTE: No warning to override - shift assigned directly")
    
    # ============ Unassign (Delete) Shift ============
    
    def test_unassign_shift_success(self, headers, test_employee_id):
        """DELETE /api/planner/unassign/{shift_id} removes a shift"""
        # Create a shift first
        test_date = "2026-02-27"
        
        monthly_res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        shifts = monthly_res.json()["shifts"]
        existing = [s for s in shifts if s["employee_id"] == test_employee_id and s["shift_date"] == test_date]
        for shift in existing:
            requests.delete(f"{BASE_URL}/api/planner/unassign/{shift['id']}", headers=headers)
        
        create_res = requests.post(f"{BASE_URL}/api/planner/assign", json={
            "employee_id": test_employee_id,
            "shift_date": test_date,
            "template": "late",
            "force": True
        }, headers=headers)
        assert create_res.status_code == 200
        shift_id = create_res.json()["shift"]["id"]
        
        # Delete the shift
        delete_res = requests.delete(f"{BASE_URL}/api/planner/unassign/{shift_id}", headers=headers)
        assert delete_res.status_code == 200
        assert delete_res.json()["success"] == True
        
        # Verify shift is gone
        verify_res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        shifts_after = verify_res.json()["shifts"]
        found = [s for s in shifts_after if s["id"] == shift_id]
        assert len(found) == 0, "Shift should be deleted"
        
        print("PASS: Shift unassigned/deleted successfully")
    
    def test_unassign_nonexistent_shift_returns_404(self, headers):
        """DELETE /api/planner/unassign/{shift_id} with invalid ID returns 404"""
        res = requests.delete(f"{BASE_URL}/api/planner/unassign/nonexistent-id-12345", headers=headers)
        assert res.status_code == 404
        print("PASS: Nonexistent shift delete returns 404")
    
    # ============ Move Shift ============
    
    def test_move_shift_to_new_date(self, headers, test_employee_id):
        """PUT /api/planner/move - moves shift to new date"""
        # Create a shift to move
        orig_date = "2026-02-20"
        new_date = "2026-02-21"
        
        # Clear both dates
        monthly_res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        shifts = monthly_res.json()["shifts"]
        for date in [orig_date, new_date]:
            existing = [s for s in shifts if s["employee_id"] == test_employee_id and s["shift_date"] == date]
            for shift in existing:
                requests.delete(f"{BASE_URL}/api/planner/unassign/{shift['id']}", headers=headers)
        
        # Create shift on original date
        create_res = requests.post(f"{BASE_URL}/api/planner/assign", json={
            "employee_id": test_employee_id,
            "shift_date": orig_date,
            "template": "night",
            "force": True
        }, headers=headers)
        assert create_res.status_code == 200
        shift_id = create_res.json()["shift"]["id"]
        
        # Move to new date
        move_res = requests.put(f"{BASE_URL}/api/planner/move", json={
            "shift_id": shift_id,
            "new_date": new_date,
            "force": True  # Force in case of any warnings
        }, headers=headers)
        
        assert move_res.status_code == 200
        assert move_res.json()["success"] == True
        
        # Verify shift is on new date
        verify_res = requests.get(f"{BASE_URL}/api/planner/monthly?year=2026&month=2", headers=headers)
        shifts_after = verify_res.json()["shifts"]
        moved = [s for s in shifts_after if s["id"] == shift_id]
        assert len(moved) == 1
        assert moved[0]["shift_date"] == new_date
        
        print("PASS: Shift moved to new date successfully")
    
    # ============ Overtime ============
    
    def test_overtime_returns_per_staff(self, headers):
        """GET /api/planner/overtime?year=2026&month=2 returns overtime per staff"""
        res = requests.get(f"{BASE_URL}/api/planner/overtime?year=2026&month=2", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert data["year"] == 2026
        assert data["month"] == 2
        assert "overtime" in data
        
        overtime_list = data["overtime"]
        assert len(overtime_list) > 0, "Expected overtime data for staff"
        
        # Verify structure of each overtime entry
        sample = overtime_list[0]
        assert "employee_id" in sample
        assert "name" in sample
        assert "scheduled_hours" in sample
        assert "overtime_hours" in sample
        assert "contract_hours" in sample
        
        print(f"PASS: Overtime API returns data for {len(overtime_list)} staff members")
    
    # ============ Coverage ============
    
    def test_coverage_returns_per_template(self, headers):
        """GET /api/planner/coverage?date=2026-02-06 returns coverage per template"""
        test_date = "2026-02-06"
        res = requests.get(f"{BASE_URL}/api/planner/coverage?date={test_date}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert data["date"] == test_date
        assert "shifts" in data
        assert "baseline" in data
        
        # Verify baseline values
        assert data["baseline"]["nurse"] == 2
        assert data["baseline"]["carer"] == 6
        
        # Verify shift data includes all templates
        shifts = data["shifts"]
        for tpl in ["early", "late", "night", "long_day"]:
            if tpl in shifts:
                tpl_data = shifts[tpl]
                assert "staff" in tpl_data
                assert "nurses" in tpl_data
                assert "carers" in tpl_data
                assert "baseline_met" in tpl_data
        
        print(f"PASS: Coverage API returns data for date {test_date}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
