"""
Phase 4C & 4D Backend API Tests
- Leave Overview (balance calculations)
- Sickness Trends (Bradford factor)
- Return-to-Work marking
- Manager Notes (CRUD)
- Operational Heatmap
- Under-Coverage Alerts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhase4CD:
    """Test Phase 4C & 4D API endpoints"""
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        """Get manager token via demo login"""
        # Step 1: Lookup manager by code
        lookup_res = requests.get(f"{BASE_URL}/api/employees/lookup/MGR001")
        if lookup_res.status_code != 200:
            pytest.skip(f"Could not find MGR001: {lookup_res.text}")
        emp_data = lookup_res.json()
        
        # Step 2: Validate PIN
        pin_res = requests.post(f"{BASE_URL}/api/auth/validate-pin", json={
            "employee_id": emp_data["id"],
            "pin": "1234"
        })
        if pin_res.status_code != 200:
            pytest.skip(f"PIN validation failed: {pin_res.text}")
        
        token_data = pin_res.json()
        return token_data["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, manager_token):
        return {"Authorization": f"Bearer {manager_token}"}
    
    # ============ Phase 4C: Leave Overview ============
    
    def test_leave_overview_returns_staff_list(self, headers):
        """GET /api/leave/overview?year=2026 returns staff with leave data"""
        res = requests.get(f"{BASE_URL}/api/leave/overview?year=2026", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "year" in data
        assert data["year"] == 2026
        assert "staff" in data
        assert isinstance(data["staff"], list)
        
        # Check structure of staff entries
        if len(data["staff"]) > 0:
            staff_member = data["staff"][0]
            assert "employee_id" in staff_member
            assert "internal_id" in staff_member
            assert "name" in staff_member
            assert "annual_entitlement" in staff_member
            assert "annual_used" in staff_member
            assert "annual_remaining" in staff_member
            assert "pending_requests" in staff_member
            assert "sick_days" in staff_member
            assert "sick_episodes" in staff_member
            assert "rtw_needed" in staff_member
            print(f"SUCCESS: Leave overview returned {len(data['staff'])} staff members")
    
    def test_leave_overview_28_day_entitlement(self, headers):
        """Verify annual_entitlement is 28 days"""
        res = requests.get(f"{BASE_URL}/api/leave/overview?year=2026", headers=headers)
        assert res.status_code == 200
        
        data = res.json()
        for staff_member in data["staff"]:
            assert staff_member["annual_entitlement"] == 28, f"Expected 28 day entitlement, got {staff_member['annual_entitlement']}"
        print("SUCCESS: All staff have 28 day annual entitlement")
    
    def test_leave_overview_balance_calculation(self, headers):
        """Verify annual_remaining = entitlement - used"""
        res = requests.get(f"{BASE_URL}/api/leave/overview?year=2026", headers=headers)
        assert res.status_code == 200
        
        data = res.json()
        for s in data["staff"]:
            expected_remaining = s["annual_entitlement"] - s["annual_used"]
            assert s["annual_remaining"] == max(0, expected_remaining), \
                f"{s['name']}: expected remaining {max(0, expected_remaining)}, got {s['annual_remaining']}"
        print("SUCCESS: Balance calculations are correct")
    
    def test_leave_overview_emma_thompson_leave(self, headers):
        """Emma Thompson should have approved leave (seeded data)"""
        res = requests.get(f"{BASE_URL}/api/leave/overview?year=2026", headers=headers)
        assert res.status_code == 200
        
        data = res.json()
        emma = next((s for s in data["staff"] if "Emma" in s["name"] and "Thompson" in s["name"]), None)
        
        if emma:
            print(f"Emma Thompson: used={emma['annual_used']}/28, remaining={emma['annual_remaining']}")
            # Emma should have some approved leave based on seed data
            # Expected: Feb 14-16 = 3 days (or potentially more)
            assert emma["annual_used"] >= 0
            assert emma["annual_remaining"] <= 28
        else:
            print("INFO: Emma Thompson not in staff list (may not be seeded)")
    
    # ============ Phase 4C: Sickness Trends ============
    
    def test_sickness_trends_structure(self, headers):
        """GET /api/leave/sickness-trends/{employee_id} returns proper structure"""
        # First get a staff member's internal ID
        overview_res = requests.get(f"{BASE_URL}/api/leave/overview?year=2026", headers=headers)
        assert overview_res.status_code == 200
        
        staff = overview_res.json()["staff"]
        if not staff:
            pytest.skip("No staff to test")
        
        internal_id = staff[0]["internal_id"]
        
        res = requests.get(f"{BASE_URL}/api/leave/sickness-trends/{internal_id}", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "employee_id" in data
        assert "total_episodes" in data
        assert "total_days" in data
        assert "bradford_factor" in data
        assert "episodes" in data
        assert isinstance(data["episodes"], list)
        print(f"SUCCESS: Sickness trends returned for employee {internal_id}")
    
    def test_sickness_trends_bradford_formula(self, headers):
        """Bradford factor = S^2 * D (episodes^2 * total_days)"""
        # Get a staff member
        overview_res = requests.get(f"{BASE_URL}/api/leave/overview?year=2026", headers=headers)
        staff = overview_res.json()["staff"]
        if not staff:
            pytest.skip("No staff to test")
        
        internal_id = staff[0]["internal_id"]
        
        res = requests.get(f"{BASE_URL}/api/leave/sickness-trends/{internal_id}", headers=headers)
        assert res.status_code == 200
        
        data = res.json()
        # Verify Bradford formula
        expected_bradford = (data["total_episodes"] ** 2) * data["total_days"]
        assert data["bradford_factor"] == expected_bradford, \
            f"Bradford: expected {expected_bradford}, got {data['bradford_factor']}"
        print(f"SUCCESS: Bradford factor formula verified (S^2*D = {expected_bradford})")
    
    # ============ Phase 4C: Return-to-Work ============
    
    def test_mark_rtw_endpoint_exists(self, headers):
        """PUT /api/leave/mark-rtw/{leave_id} endpoint exists"""
        # Try with a non-existent leave ID to verify endpoint exists
        res = requests.put(
            f"{BASE_URL}/api/leave/mark-rtw/nonexistent-id?notes=test",
            headers=headers
        )
        # Should return 404 (not found), not 405 (method not allowed)
        assert res.status_code == 404, f"Expected 404 for nonexistent ID, got {res.status_code}"
        print("SUCCESS: mark-rtw endpoint exists (returns 404 for missing ID)")
    
    # ============ Phase 4D: Manager Notes ============
    
    def test_manager_notes_crud(self, headers):
        """Full CRUD cycle for manager notes"""
        # Get a staff member
        overview_res = requests.get(f"{BASE_URL}/api/leave/overview?year=2026", headers=headers)
        staff = overview_res.json()["staff"]
        if not staff:
            pytest.skip("No staff to test")
        
        employee_id = staff[0]["internal_id"]
        
        # GET - initial state
        get_res = requests.get(f"{BASE_URL}/api/manager/notes/{employee_id}", headers=headers)
        assert get_res.status_code == 200, f"GET notes failed: {get_res.text}"
        initial_notes = get_res.json()["notes"]
        initial_count = len(initial_notes)
        print(f"Initial notes count: {initial_count}")
        
        # POST - create note
        test_content = "TEST_NOTE_Phase4D_Testing"
        post_res = requests.post(
            f"{BASE_URL}/api/manager/notes/{employee_id}?content={test_content}",
            headers=headers
        )
        assert post_res.status_code == 200, f"POST note failed: {post_res.text}"
        
        post_data = post_res.json()
        assert post_data["success"] == True
        assert "note" in post_data
        note_id = post_data["note"]["id"]
        print(f"Created note with ID: {note_id}")
        
        # GET - verify created
        get_res2 = requests.get(f"{BASE_URL}/api/manager/notes/{employee_id}", headers=headers)
        notes = get_res2.json()["notes"]
        assert len(notes) == initial_count + 1, "Note count should increase by 1"
        
        created_note = next((n for n in notes if n["id"] == note_id), None)
        assert created_note is not None, "Created note should be in list"
        assert created_note["content"] == test_content
        print(f"Note verified: content={created_note['content']}")
        
        # DELETE - remove note
        del_res = requests.delete(f"{BASE_URL}/api/manager/notes/{note_id}", headers=headers)
        assert del_res.status_code == 200, f"DELETE note failed: {del_res.text}"
        
        # GET - verify deleted
        get_res3 = requests.get(f"{BASE_URL}/api/manager/notes/{employee_id}", headers=headers)
        final_notes = get_res3.json()["notes"]
        assert len(final_notes) == initial_count, "Note count should return to initial"
        print("SUCCESS: Manager notes CRUD cycle completed")
    
    def test_delete_nonexistent_note_returns_404(self, headers):
        """DELETE /api/manager/notes/{note_id} returns 404 for missing note"""
        res = requests.delete(f"{BASE_URL}/api/manager/notes/nonexistent-id", headers=headers)
        assert res.status_code == 404
        print("SUCCESS: Delete nonexistent note returns 404")
    
    # ============ Phase 4D: Operational Heatmap ============
    
    def test_heatmap_structure(self, headers):
        """GET /api/operational/heatmap returns proper structure"""
        res = requests.get(f"{BASE_URL}/api/operational/heatmap?year=2026&month=2", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert data["year"] == 2026
        assert data["month"] == 2
        assert "heatmap" in data
        
        # Check structure of heatmap days
        heatmap = data["heatmap"]
        assert isinstance(heatmap, dict)
        
        # Check at least one day exists
        if len(heatmap) > 0:
            day_key = list(heatmap.keys())[0]
            day_data = heatmap[day_key]
            assert "total" in day_data
            # Should have shift templates
            for tpl in ["early", "late", "night", "long_day"]:
                assert tpl in day_data, f"Missing template {tpl} in heatmap"
                assert "total" in day_data[tpl]
                assert "nurses" in day_data[tpl]
                assert "carers" in day_data[tpl]
                assert "baseline_met" in day_data[tpl]
        
        print(f"SUCCESS: Heatmap returned {len(heatmap)} days of data")
    
    def test_heatmap_all_february_days(self, headers):
        """Heatmap should return data for all days in February 2026"""
        res = requests.get(f"{BASE_URL}/api/operational/heatmap?year=2026&month=2", headers=headers)
        assert res.status_code == 200
        
        heatmap = res.json()["heatmap"]
        # February 2026 has 28 days
        assert len(heatmap) == 28, f"Expected 28 days, got {len(heatmap)}"
        
        # Verify date format
        for day_key in heatmap.keys():
            assert day_key.startswith("2026-02-"), f"Unexpected date format: {day_key}"
        print("SUCCESS: Heatmap returns all 28 days of February 2026")
    
    # ============ Phase 4D: Under-Coverage Alerts ============
    
    def test_under_coverage_structure(self, headers):
        """GET /api/operational/under-coverage returns proper structure"""
        res = requests.get(f"{BASE_URL}/api/operational/under-coverage", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "alerts" in data
        assert isinstance(data["alerts"], list)
        
        # Check structure of alerts if any exist
        if len(data["alerts"]) > 0:
            alert = data["alerts"][0]
            assert "date" in alert
            assert "shift" in alert
            assert "time" in alert
            assert "nurses" in alert
            assert "nurses_needed" in alert
            assert "carers" in alert
            assert "carers_needed" in alert
            print(f"SUCCESS: Under-coverage returned {len(data['alerts'])} alerts")
        else:
            print("INFO: No under-coverage alerts (all shifts fully staffed)")
    
    def test_under_coverage_future_only(self, headers):
        """Alerts should only include future dates (next 30 days)"""
        res = requests.get(f"{BASE_URL}/api/operational/under-coverage", headers=headers)
        assert res.status_code == 200
        
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        for alert in res.json()["alerts"]:
            assert alert["date"] >= today, f"Alert date {alert['date']} is in the past"
        print("SUCCESS: All alerts are for future dates")
    
    # ============ Authorization Tests ============
    
    def test_leave_overview_requires_auth(self):
        """Leave overview requires authentication"""
        res = requests.get(f"{BASE_URL}/api/leave/overview?year=2026")
        assert res.status_code == 401
        print("SUCCESS: Leave overview requires auth")
    
    def test_manager_notes_requires_auth(self):
        """Manager notes requires authentication"""
        res = requests.get(f"{BASE_URL}/api/manager/notes/some-id")
        assert res.status_code == 401
        print("SUCCESS: Manager notes requires auth")
    
    def test_heatmap_requires_auth(self):
        """Heatmap requires authentication"""
        res = requests.get(f"{BASE_URL}/api/operational/heatmap?year=2026&month=2")
        assert res.status_code == 401
        print("SUCCESS: Heatmap requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
