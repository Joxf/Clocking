from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from enum import Enum
import uuid
from datetime import datetime, timezone, timedelta
import pyotp
import hashlib
import secrets
import jwt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 8

# Create the main app
app = FastAPI(title="CareHome Clocking System")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

class CareHome(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class KioskDevice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    care_home_id: str
    device_name: str
    device_pin_hash: str  # Hashed device setup PIN
    location: Optional[str] = None
    is_active: bool = True
    last_seen: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str  # Human-readable ID like "EMP001"
    care_home_id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str  # staff, manager, admin
    job_title: str  # nurse, senior_carer, carer, activities, kitchen, maintenance
    employment_type: str = "permanent"  # permanent, agency, bank
    status: str = "active"  # active, inactive, on_leave
    contract_hours: float = 36.0  # Weekly contracted hours
    shift_preferences: List[str] = Field(default_factory=list)  # nights_only, weekends_only, weekdays_only, earlies_only, lates_only, no_nights, flexible
    pin_hash: Optional[str] = None  # Hashed 4-digit PIN
    totp_secret: Optional[str] = None  # 32-char TOTP secret
    totp_enrolled: bool = False
    failed_attempts: int = 0
    lockout_until: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OfflineAuthQueue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    kiosk_device_id: Optional[str] = None
    auth_type: str  # clock_in, clock_out
    timestamp: datetime
    synced: bool = False
    synced_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    care_home_id: str
    kiosk_device_id: Optional[str] = None
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    status: str = "present"  # present, late, early_leave, absent
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShiftSwapRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requester_id: str
    requester_name: Optional[str] = None
    target_id: Optional[str] = None  # Specific colleague to swap with
    target_name: Optional[str] = None
    original_shift_id: str
    shift_date: str  # Date string YYYY-MM-DD
    shift_start: str  # Time string HH:MM
    shift_end: str
    reason: Optional[str] = None
    message_to_manager: Optional[str] = None  # Direct message to manager
    swap_type: str = "open"  # open (anyone can accept), direct (specific colleague), manager_request
    status: str = "pending_acceptance"  # pending_acceptance, accepted_pending_approval, approved, rejected, cancelled
    accepted_by: Optional[str] = None
    accepted_by_name: Optional[str] = None
    manager_approved: bool = False
    approved_by: Optional[str] = None  # Manager who approved
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    care_home_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Shift(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    care_home_id: str
    shift_date: str  # Date string YYYY-MM-DD
    start_time: str  # Time string HH:MM
    end_time: str
    template: str = "custom"  # early, late, night, long_day, custom
    shift_type: str = "regular"  # regular, overtime, on_call
    status: str = "scheduled"  # scheduled, completed, missed, swapped
    is_agency_cover: bool = False  # Whether this is agency/bank cover
    notes: Optional[str] = None
    assigned_by: Optional[str] = None  # Manager who assigned
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeaveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    care_home_id: str
    leave_type: str  # annual, sick, unpaid, compassionate, maternity, paternity
    start_date: str  # Date string YYYY-MM-DD
    end_date: str
    reason: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected, cancelled
    approved_by: Optional[str] = None
    sick_note_provided: bool = False
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DayRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    care_home_id: str
    request_type: str  # day_on, day_off
    requested_date: str  # Date string YYYY-MM-DD
    reason: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuthEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    kiosk_device_id: Optional[str] = None
    event_type: str  # login_success, login_failed, logout, pin_failed, totp_failed
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    care_home_id: str
    sender_id: str
    sender_name: str
    recipient_id: Optional[str] = None  # None = broadcast to all
    recipient_role: Optional[str] = None  # Can target by role (staff, manager, admin)
    subject: str
    content: str
    message_type: str = "general"  # general, leave_request, swap_request, day_request, system
    related_id: Optional[str] = None  # Related request ID
    is_read: bool = False
    read_by: List[str] = Field(default_factory=list)  # List of user IDs who read it
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    care_home_id: str
    recipient_id: str
    title: str
    content: str
    notification_type: str  # leave_approved, leave_rejected, swap_request, swap_approved, swap_rejected, message, system
    related_id: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReturnToWork(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    care_home_id: str
    employee_id: str
    employee_name: str
    sick_leave_id: str
    return_date: str  # Date string YYYY-MM-DD
    due_date: str  # When RTW should be completed (usually return_date)
    status: str = "pending"  # pending, in_progress, completed, overdue
    # Manager section responses
    manager_completed: bool = False
    manager_completed_by: Optional[str] = None
    manager_completed_at: Optional[datetime] = None
    mgr_fit_to_return: Optional[bool] = None
    mgr_absence_discussed: Optional[bool] = None
    mgr_affects_safe_working: Optional[bool] = None
    mgr_adjustments_needed: Optional[bool] = None
    mgr_adjustment_types: List[str] = Field(default_factory=list)  # phased_return, reduced_hours, modified_duties, extra_breaks, workstation_change, temp_reassignment
    mgr_occupational_health: Optional[bool] = None
    mgr_work_related: Optional[bool] = None
    mgr_incident_followup: Optional[bool] = None
    mgr_followup_required: Optional[bool] = None
    mgr_followup_timeframe: Optional[str] = None  # 1_week, 2_weeks, 4_weeks
    # Staff section responses
    staff_completed: bool = False
    staff_completed_at: Optional[datetime] = None
    staff_fit_to_return: Optional[bool] = None
    staff_fully_recovered: Optional[bool] = None
    staff_ongoing_symptoms: Optional[bool] = None
    staff_feels_safe: Optional[bool] = None
    staff_needs_adjustments: Optional[bool] = None
    staff_adjustment_types: List[str] = Field(default_factory=list)
    staff_understands_reporting: Optional[bool] = None
    staff_agrees_outcome: Optional[bool] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ REQUEST/RESPONSE MODELS ============

class QRValidateRequest(BaseModel):
    qr_data: str  # Format: employee_id:totp_token

class PINValidateRequest(BaseModel):
    employee_id: str
    pin: str

class EnrollRequest(BaseModel):
    employee_id: str

class SetPINRequest(BaseModel):
    employee_id: str
    pin: str

class ClockActionRequest(BaseModel):
    employee_id: str
    action: str  # clock_in, clock_out

class OfflineSyncRequest(BaseModel):
    events: List[dict]

class TokenResponse(BaseModel):
    token: str
    employee: dict
    expires_at: datetime

class EmployeeCreate(BaseModel):
    employee_id: str
    care_home_id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    job_title: str
    employment_type: str = "permanent"
    status: str = "active"
    contract_hours: float = 36.0
    shift_preferences: List[str] = Field(default_factory=list)

class LeaveRequestCreate(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    reason: Optional[str] = None

class DayRequestCreate(BaseModel):
    request_type: str
    requested_date: str
    reason: Optional[str] = None

class ShiftSwapCreate(BaseModel):
    original_shift_id: str
    reason: Optional[str] = None

class AcceptSwapRequest(BaseModel):
    swap_id: str

class SendMessageRequest(BaseModel):
    recipient_id: Optional[str] = None  # None for broadcast
    recipient_role: Optional[str] = None  # Target by role
    subject: str
    content: str
    message_type: str = "general"
    related_id: Optional[str] = None

class ShiftSwapCreateEnhanced(BaseModel):
    original_shift_id: str
    swap_type: str = "open"  # open, direct, manager_request
    target_id: Optional[str] = None  # For direct swap
    reason: Optional[str] = None
    message_to_manager: Optional[str] = None

class PlannerAssignRequest(BaseModel):
    employee_id: str
    shift_date: str
    template: str  # early, late, night, long_day
    shift_type: str = "regular"  # regular, overtime
    is_agency_cover: bool = False
    notes: Optional[str] = None
    force: bool = False  # Override warnings

class PlannerMoveRequest(BaseModel):
    shift_id: str
    new_date: str
    new_employee_id: Optional[str] = None
    force: bool = False

class PlannerBulkAssignRequest(BaseModel):
    assignments: list  # List of {employee_id, shift_date, template}
    force: bool = False

# ============ SHIFT TEMPLATES ============

SHIFT_TEMPLATES = {
    "early":    {"label": "Early",    "start": "08:00", "end": "14:00", "hours": 6,  "color": "#FBBF24"},
    "late":     {"label": "Late",     "start": "14:00", "end": "20:00", "hours": 6,  "color": "#60A5FA"},
    "night":    {"label": "Night",    "start": "20:00", "end": "08:00", "hours": 12, "color": "#A78BFA"},
    "long_day": {"label": "Long Day", "start": "08:00", "end": "20:00", "hours": 12, "color": "#34D399"},
}

# Default coverage baseline (will be overridden by Control Preferences)
COVERAGE_BASELINE = {
    "nurse": 2,
    "carer": 6,
}

# Default constants (will be overridden by Control Preferences)
MIN_REST_HOURS = 11
MAX_CONSECUTIVE_DAYS = 2
MIN_WEEKLY_HOURS = 36.0

# ============ CONTROL PREFERENCES MODEL ============

class RuleMode(str, Enum):
    hard = "hard"       # Cannot override - blocks action
    soft = "soft"       # Warning with mandatory reason
    disabled = "disabled"  # Rule not enforced

class StaffingRequirement(BaseModel):
    min_total: int = 8
    min_nurses: int = 2
    min_senior_carers: int = 1
    min_carers: int = 4
    min_activities: int = 0
    min_kitchen: int = 1
    min_domestic: int = 0

class ShiftTypeStaffing(BaseModel):
    early: StaffingRequirement = Field(default_factory=StaffingRequirement)
    late: StaffingRequirement = Field(default_factory=StaffingRequirement)
    night: StaffingRequirement = Field(default_factory=lambda: StaffingRequirement(min_total=4, min_nurses=1, min_senior_carers=1, min_carers=2, min_kitchen=0))
    long_day: StaffingRequirement = Field(default_factory=StaffingRequirement)
    weekend_modifier: float = 0.8  # 80% of weekday requirements

class ConsecutiveShiftRules(BaseModel):
    max_consecutive_day_shifts: int = 5
    max_consecutive_night_shifts: int = 3
    mix_shift_types_counts: bool = True
    long_day_counts_as: int = 1  # 1 or 2
    mode: RuleMode = RuleMode.soft

class RestRules(BaseModel):
    min_rest_hours: int = 11
    mode: RuleMode = RuleMode.soft

class WeekendProtection(BaseModel):
    max_consecutive_weekends: int = 2
    weekend_days: List[str] = Field(default_factory=lambda: ["saturday", "sunday"])
    partial_weekend_counts: bool = False  # Does working 1 day count as full weekend?
    mode: RuleMode = RuleMode.soft

class LeaveValidation(BaseModel):
    annual_leave_mode: RuleMode = RuleMode.hard
    sick_leave_mode: RuleMode = RuleMode.hard
    approved_day_off_mode: RuleMode = RuleMode.hard
    pending_day_off_mode: RuleMode = RuleMode.soft

class OvertimeRules(BaseModel):
    max_weekly_hours: int = 48
    max_monthly_hours: int = 192
    soft_overtime_threshold: int = 40  # Warning above this
    hard_overtime_limit: int = 60      # Block above this (per week)
    max_consecutive_overtime_shifts: int = 3
    mode: RuleMode = RuleMode.soft

class AgencyRules(BaseModel):
    enabled: bool = True
    max_agency_per_shift: int = 4
    max_agency_percentage: float = 30.0  # Max 30% of shift covered by agency
    require_manager_approval: bool = True
    require_reason: bool = True
    track_costs: bool = False
    mode: RuleMode = RuleMode.soft

class ShiftPreferenceRules(BaseModel):
    respect_preferences: bool = True
    mode: RuleMode = RuleMode.soft  # soft = warn if violating, hard = block

class ControlPreferences(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    care_home_id: str
    # Staffing Requirements
    staffing: ShiftTypeStaffing = Field(default_factory=ShiftTypeStaffing)
    # Consecutive Shift Limits
    consecutive: ConsecutiveShiftRules = Field(default_factory=ConsecutiveShiftRules)
    # Rest Rules
    rest: RestRules = Field(default_factory=RestRules)
    # Weekend Protection
    weekend: WeekendProtection = Field(default_factory=WeekendProtection)
    # Leave Validation
    leave: LeaveValidation = Field(default_factory=LeaveValidation)
    # Overtime Rules
    overtime: OvertimeRules = Field(default_factory=OvertimeRules)
    # Agency Rules
    agency: AgencyRules = Field(default_factory=AgencyRules)
    # Shift Preferences
    preferences: ShiftPreferenceRules = Field(default_factory=ShiftPreferenceRules)
    # Conflict Detection (always hard)
    conflict_detection_enabled: bool = True
    # Audit Settings
    log_all_overrides: bool = True
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OverrideLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    care_home_id: str
    manager_id: str
    manager_name: str
    rule_type: str  # rest_gap, consecutive, weekend, leave, overtime, preference, agency
    rule_violated: str
    staff_id: str
    staff_name: str
    shift_date: str
    justification: str
    is_agency: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ HELPERS ============

def hash_pin(pin: str) -> str:
    """Hash a PIN with SHA-256"""
    return hashlib.sha256(pin.encode()).hexdigest()

def verify_pin(pin: str, pin_hash: str) -> bool:
    """Verify a PIN against its hash"""
    return hash_pin(pin) == pin_hash

def generate_totp_secret() -> str:
    """Generate a 32-character TOTP secret"""
    return pyotp.random_base32(length=32)

def verify_totp(secret: str, token: str) -> bool:
    """Verify TOTP token with ±2 timestep tolerance (allows ~90s window)"""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=2)

def create_jwt_token(employee: dict) -> str:
    """Create JWT token for authenticated session"""
    payload = {
        "sub": employee["id"],
        "employee_id": employee["employee_id"],
        "role": employee["role"],
        "care_home_id": employee["care_home_id"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    """Decode and verify JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_jwt_token(credentials.credentials)
    employee = await db.employees.find_one({"id": payload["sub"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=401, detail="User not found")
    return employee

def serialize_datetime(doc: dict) -> dict:
    """Convert datetime objects to ISO strings for MongoDB"""
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    return doc

def deserialize_datetime(doc: dict, fields: List[str]) -> dict:
    """Convert ISO strings back to datetime objects"""
    for field in fields:
        if field in doc and isinstance(doc[field], str):
            doc[field] = datetime.fromisoformat(doc[field])
    return doc

# ============ AUTH ROUTES ============

@api_router.post("/auth/validate-qr")
async def validate_qr(request: QRValidateRequest):
    """Step 1: Validate QR code from mobile authenticator"""
    try:
        # Parse QR data: employee_id:totp_token
        parts = request.qr_data.split(":")
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="Invalid QR format")
        
        employee_id, totp_token = parts
        
        # Find employee
        employee = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Check if account is active
        if employee.get("status") != "active":
            raise HTTPException(status_code=403, detail="Account is not active")
        
        # Check lockout
        if employee.get("lockout_until"):
            lockout = datetime.fromisoformat(employee["lockout_until"]) if isinstance(employee["lockout_until"], str) else employee["lockout_until"]
            if lockout > datetime.now(timezone.utc):
                raise HTTPException(status_code=429, detail=f"Account locked. Try again later.")
        
        # Check if enrolled
        if not employee.get("totp_enrolled") or not employee.get("totp_secret"):
            raise HTTPException(status_code=400, detail="Employee not enrolled for TOTP")
        
        # Verify TOTP
        if not verify_totp(employee["totp_secret"], totp_token):
            # Log failed attempt (no lockout for TOTP - timing issues are common)
            await db.auth_events.insert_one(serialize_datetime({
                "id": str(uuid.uuid4()),
                "employee_id": employee["id"],
                "event_type": "totp_failed",
                "timestamp": datetime.now(timezone.utc)
            }))
            
            raise HTTPException(status_code=401, detail="QR code expired. Please scan a fresh code from your phone.")
        
        # Reset failed attempts on success
        await db.employees.update_one(
            {"id": employee["id"]},
            {"$set": {"failed_attempts": 0, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "employee_id": employee["id"],
            "employee_code": employee["employee_id"],
            "name": f"{employee['first_name']} {employee['last_name']}",
            "requires_pin": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"QR validation error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/validate-pin", response_model=TokenResponse)
async def validate_pin(request: PINValidateRequest):
    """Step 2: Validate PIN and create session"""
    try:
        employee = await db.employees.find_one({"id": request.employee_id}, {"_id": 0})
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Check lockout
        if employee.get("lockout_until"):
            lockout = datetime.fromisoformat(employee["lockout_until"]) if isinstance(employee["lockout_until"], str) else employee["lockout_until"]
            if lockout > datetime.now(timezone.utc):
                raise HTTPException(status_code=429, detail="Account locked")
        
        # Verify PIN
        if not employee.get("pin_hash") or not verify_pin(request.pin, employee["pin_hash"]):
            # Increment failed attempts
            await db.employees.update_one(
                {"id": employee["id"]},
                {"$inc": {"failed_attempts": 1}}
            )
            
            if employee.get("failed_attempts", 0) >= 4:
                lockout_time = datetime.now(timezone.utc) + timedelta(minutes=15)
                await db.employees.update_one(
                    {"id": employee["id"]},
                    {"$set": {"lockout_until": lockout_time.isoformat()}}
                )
            
            await db.auth_events.insert_one(serialize_datetime({
                "id": str(uuid.uuid4()),
                "employee_id": employee["id"],
                "event_type": "pin_failed",
                "timestamp": datetime.now(timezone.utc)
            }))
            
            raise HTTPException(status_code=401, detail="Invalid PIN")
        
        # Success - create session
        await db.employees.update_one(
            {"id": employee["id"]},
            {"$set": {"failed_attempts": 0, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Log success
        await db.auth_events.insert_one(serialize_datetime({
            "id": str(uuid.uuid4()),
            "employee_id": employee["id"],
            "event_type": "login_success",
            "timestamp": datetime.now(timezone.utc)
        }))
        
        token = create_jwt_token(employee)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
        
        # Remove sensitive data
        safe_employee = {k: v for k, v in employee.items() if k not in ["pin_hash", "totp_secret"]}
        
        return TokenResponse(token=token, employee=safe_employee, expires_at=expires_at)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PIN validation error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Log out and record event"""
    await db.auth_events.insert_one(serialize_datetime({
        "id": str(uuid.uuid4()),
        "employee_id": current_user["id"],
        "event_type": "logout",
        "timestamp": datetime.now(timezone.utc)
    }))
    return {"success": True, "message": "Logged out successfully"}

# ============ ENROLLMENT ROUTES ============

@api_router.post("/enrollment/generate-secret")
async def generate_enrollment_secret(request: EnrollRequest, current_user: dict = Depends(get_current_user)):
    """Generate TOTP secret for employee (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee = await db.employees.find_one({"employee_id": request.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Generate new TOTP secret
    totp_secret = generate_totp_secret()
    
    # Update employee
    await db.employees.update_one(
        {"id": employee["id"]},
        {"$set": {
            "totp_secret": totp_secret,
            "totp_enrolled": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Generate provisioning URI for mobile app
    totp = pyotp.TOTP(totp_secret)
    provisioning_uri = totp.provisioning_uri(
        name=f"{employee['first_name']} {employee['last_name']}",
        issuer_name="CareHome Clocking"
    )
    
    return {
        "success": True,
        "employee_id": employee["employee_id"],
        "totp_secret": totp_secret,
        "provisioning_uri": provisioning_uri
    }

@api_router.post("/enrollment/set-pin")
async def set_employee_pin(request: SetPINRequest, current_user: dict = Depends(get_current_user)):
    """Set PIN for employee (self or manager/admin)"""
    employee = await db.employees.find_one({"employee_id": request.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check authorization
    if current_user["id"] != employee["id"] and current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate PIN format
    if not request.pin.isdigit() or len(request.pin) != 4:
        raise HTTPException(status_code=400, detail="PIN must be 4 digits")
    
    # Hash and store PIN
    pin_hash = hash_pin(request.pin)
    await db.employees.update_one(
        {"id": employee["id"]},
        {"$set": {"pin_hash": pin_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "PIN set successfully"}

@api_router.post("/enrollment/confirm")
async def confirm_enrollment(request: EnrollRequest, current_user: dict = Depends(get_current_user)):
    """Confirm TOTP enrollment after mobile app setup"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employee = await db.employees.find_one({"employee_id": request.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if not employee.get("totp_secret"):
        raise HTTPException(status_code=400, detail="TOTP secret not generated")
    
    await db.employees.update_one(
        {"id": employee["id"]},
        {"$set": {"totp_enrolled": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Enrollment confirmed"}

# ============ ATTENDANCE ROUTES ============

@api_router.post("/attendance/clock")
async def clock_action(request: ClockActionRequest, current_user: dict = Depends(get_current_user)):
    """Clock in or out"""
    if request.action not in ["clock_in", "clock_out"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Find today's attendance record
    attendance = await db.attendance.find_one({
        "employee_id": current_user["id"],
        "created_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0})
    
    if request.action == "clock_in":
        if attendance and attendance.get("clock_in"):
            raise HTTPException(status_code=400, detail="Already clocked in today")
        
        if attendance:
            await db.attendance.update_one(
                {"id": attendance["id"]},
                {"$set": {"clock_in": now.isoformat()}}
            )
        else:
            new_attendance = {
                "id": str(uuid.uuid4()),
                "employee_id": current_user["id"],
                "care_home_id": current_user["care_home_id"],
                "clock_in": now.isoformat(),
                "status": "present",
                "created_at": now.isoformat()
            }
            await db.attendance.insert_one(new_attendance)
        
        return {"success": True, "action": "clock_in", "timestamp": now.isoformat()}
    
    else:  # clock_out
        if not attendance or not attendance.get("clock_in"):
            raise HTTPException(status_code=400, detail="Not clocked in today")
        
        if attendance.get("clock_out"):
            raise HTTPException(status_code=400, detail="Already clocked out today")
        
        await db.attendance.update_one(
            {"id": attendance["id"]},
            {"$set": {"clock_out": now.isoformat()}}
        )
        
        # Get next shift for the employee
        today = now.date().isoformat()
        next_shift = await db.shifts.find_one({
            "employee_id": current_user["id"],
            "shift_date": {"$gt": today},
            "status": {"$in": ["scheduled", "swapped"]}
        }, {"_id": 0}, sort=[("shift_date", 1)])
        
        return {
            "success": True, 
            "action": "clock_out", 
            "timestamp": now.isoformat(),
            "next_shift": next_shift
        }

@api_router.get("/attendance/status")
async def get_attendance_status(current_user: dict = Depends(get_current_user)):
    """Get current user's attendance status"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    attendance = await db.attendance.find_one({
        "employee_id": current_user["id"],
        "created_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0})
    
    return {
        "clocked_in": attendance is not None and attendance.get("clock_in") is not None,
        "clocked_out": attendance is not None and attendance.get("clock_out") is not None,
        "clock_in_time": attendance.get("clock_in") if attendance else None,
        "clock_out_time": attendance.get("clock_out") if attendance else None
    }

@api_router.get("/attendance/today")
async def get_today_attendance(current_user: dict = Depends(get_current_user)):
    """Get today's attendance for care home (manager/admin)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get all attendance records for today
    attendance_records = await db.attendance.find({
        "care_home_id": current_user["care_home_id"],
        "created_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    # Get all active employees
    employees = await db.employees.find({
        "care_home_id": current_user["care_home_id"],
        "status": "active"
    }, {"_id": 0, "pin_hash": 0, "totp_secret": 0}).to_list(1000)
    
    # Create lookup
    attendance_map = {a["employee_id"]: a for a in attendance_records}
    
    result = []
    for emp in employees:
        att = attendance_map.get(emp["id"])
        result.append({
            "employee": emp,
            "clock_in": att.get("clock_in") if att else None,
            "clock_out": att.get("clock_out") if att else None,
            "status": "present" if att and att.get("clock_in") else "absent"
        })
    
    return {"date": today_start.isoformat(), "records": result}

@api_router.get("/attendance/calendar")
async def get_attendance_calendar(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Get attendance + coverage data for a full month calendar view"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    import calendar as cal_mod
    days_in_month = cal_mod.monthrange(year, month)[1]
    first = f"{year}-{month:02d}-01"
    last = f"{year}-{month:02d}-{days_in_month:02d}"

    care_home_id = current_user["care_home_id"]

    # Shifts for coverage
    shifts = await db.shifts.find({
        "care_home_id": care_home_id,
        "shift_date": {"$gte": first, "$lte": last},
        "status": {"$in": ["scheduled", "completed"]}
    }, {"_id": 0}).to_list(5000)

    # Attendance records
    attendance = await db.attendance.find({
        "care_home_id": care_home_id,
        "date": {"$gte": first, "$lte": last}
    }, {"_id": 0}).to_list(5000)

    # Staff
    staff = await db.employees.find(
        {"care_home_id": care_home_id, "status": "active", "role": "staff"},
        {"_id": 0, "id": 1, "employee_id": 1, "first_name": 1, "last_name": 1, "job_title": 1, "employment_type": 1}
    ).to_list(200)
    job_map = {e["id"]: e["job_title"] for e in staff}

    days = {}
    for day in range(1, days_in_month + 1):
        ds = f"{year}-{month:02d}-{day:02d}"
        day_shifts = [s for s in shifts if s["shift_date"] == ds]
        day_att = [a for a in attendance if a.get("date") == ds]
        att_map = {a["employee_id"]: a for a in day_att}

        # Coverage per template
        cov = {}
        for tpl_key, tpl in SHIFT_TEMPLATES.items():
            tpl_shifts = [s for s in day_shifts if s.get("template") == tpl_key]
            nurse_c = sum(1 for s in tpl_shifts if job_map.get(s["employee_id"]) == "nurse")
            carer_c = sum(1 for s in tpl_shifts if job_map.get(s["employee_id"]) in ("carer", "senior_carer"))
            cov[tpl_key] = {"nurses": nurse_c, "carers": carer_c, "total": len(tpl_shifts)}

        # Late / no-show counts
        scheduled_count = len(set(s["employee_id"] for s in day_shifts))
        clocked_in_ids = set(a["employee_id"] for a in day_att if a.get("clock_in"))
        late_count = 0
        no_show_count = 0
        for s in day_shifts:
            att = att_map.get(s["employee_id"])
            if not att or not att.get("clock_in"):
                # Only flag no-show for past dates
                if ds <= datetime.now(timezone.utc).strftime("%Y-%m-%d"):
                    no_show_count += 1
            else:
                # Check late: clock_in > shift start + 15 min
                try:
                    ci = datetime.fromisoformat(att["clock_in"].replace("Z", "+00:00"))
                    shift_start = datetime.fromisoformat(f"{ds}T{s['start_time']}:00+00:00")
                    if (ci - shift_start).total_seconds() > 900:
                        late_count += 1
                except (ValueError, TypeError):
                    pass

        days[ds] = {
            "scheduled": scheduled_count,
            "clocked_in": len(clocked_in_ids),
            "late": late_count,
            "no_show": no_show_count,
            "coverage": cov
        }

    return {"year": year, "month": month, "days": days}

@api_router.get("/attendance/day-detail")
async def get_day_detail(date: str, current_user: dict = Depends(get_current_user)):
    """Get detailed attendance and staffing for a specific day"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    care_home_id = current_user["care_home_id"]

    shifts = await db.shifts.find({
        "care_home_id": care_home_id, "shift_date": date,
        "status": {"$in": ["scheduled", "completed"]}
    }, {"_id": 0}).to_list(200)

    attendance = await db.attendance.find({
        "care_home_id": care_home_id, "date": date
    }, {"_id": 0}).to_list(200)
    att_map = {a["employee_id"]: a for a in attendance}

    staff_ids = list(set(s["employee_id"] for s in shifts) | set(a["employee_id"] for a in attendance))
    staff = await db.employees.find(
        {"id": {"$in": staff_ids}},
        {"_id": 0, "id": 1, "employee_id": 1, "first_name": 1, "last_name": 1, "job_title": 1, "employment_type": 1}
    ).to_list(200)
    emp_map = {e["id"]: e for e in staff}

    # Build per-shift detail
    shift_groups = {}
    for tpl_key, tpl in SHIFT_TEMPLATES.items():
        tpl_shifts = [s for s in shifts if s.get("template") == tpl_key]
        members = []
        for s in tpl_shifts:
            emp = emp_map.get(s["employee_id"], {})
            att = att_map.get(s["employee_id"])
            clock_in = att.get("clock_in") if att else None
            clock_out = att.get("clock_out") if att else None

            status = "scheduled"
            if clock_in:
                try:
                    ci = datetime.fromisoformat(clock_in.replace("Z", "+00:00"))
                    shift_start = datetime.fromisoformat(f"{date}T{s['start_time']}:00+00:00")
                    status = "late" if (ci - shift_start).total_seconds() > 900 else "present"
                except (ValueError, TypeError):
                    status = "present"
            elif date <= datetime.now(timezone.utc).strftime("%Y-%m-%d"):
                status = "no_show"

            members.append({
                "shift_id": s["id"],
                "internal_id": s["employee_id"],
                "employee_id": emp.get("employee_id", ""),
                "name": f"{emp.get('first_name','')} {emp.get('last_name','')}",
                "job_title": emp.get("job_title", ""),
                "employment_type": emp.get("employment_type", "permanent"),
                "clock_in": clock_in,
                "clock_out": clock_out,
                "status": status,
                "attendance_id": att.get("id") if att else None,
                "is_agency_cover": s.get("is_agency_cover", False)
            })
        nurse_c = sum(1 for m in members if m["job_title"] == "nurse")
        carer_c = sum(1 for m in members if m["job_title"] in ("carer", "senior_carer"))
        baseline_met = nurse_c >= COVERAGE_BASELINE["nurse"] and carer_c >= COVERAGE_BASELINE["carer"]
        overstaffed = nurse_c > COVERAGE_BASELINE["nurse"] + 1 and carer_c > COVERAGE_BASELINE["carer"] + 2

        color = "green" if baseline_met else "red"
        if overstaffed:
            color = "blue"

        shift_groups[tpl_key] = {
            "label": tpl["label"], "start": tpl["start"], "end": tpl["end"],
            "members": members, "total": len(members),
            "nurses": nurse_c, "carers": carer_c,
            "baseline_met": baseline_met, "overstaffed": overstaffed, "color": color
        }

    return {"date": date, "shifts": shift_groups, "baseline": COVERAGE_BASELINE}

@api_router.put("/attendance/adjust")
async def adjust_attendance(
    employee_id: str, date: str, clock_in: str = None, clock_out: str = None, reason: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Manually adjust attendance with audit trail"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    care_home_id = current_user["care_home_id"]
    att = await db.attendance.find_one({"care_home_id": care_home_id, "employee_id": employee_id, "date": date}, {"_id": 0})

    old_clock_in = att.get("clock_in") if att else None
    old_clock_out = att.get("clock_out") if att else None

    if att:
        update_fields = {}
        if clock_in is not None:
            update_fields["clock_in"] = clock_in
        if clock_out is not None:
            update_fields["clock_out"] = clock_out
        if update_fields:
            await db.attendance.update_one({"id": att["id"]}, {"$set": update_fields})
    else:
        att = {
            "id": str(uuid.uuid4()),
            "employee_id": employee_id,
            "care_home_id": care_home_id,
            "date": date,
            "clock_in": clock_in,
            "clock_out": clock_out,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.attendance.insert_one(att)

    # Audit log
    await db.attendance_audit.insert_one({
        "id": str(uuid.uuid4()),
        "attendance_date": date,
        "employee_id": employee_id,
        "adjusted_by": current_user["id"],
        "adjusted_by_name": f"{current_user['first_name']} {current_user['last_name']}",
        "old_clock_in": old_clock_in,
        "new_clock_in": clock_in,
        "old_clock_out": old_clock_out,
        "new_clock_out": clock_out,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return {"success": True}

@api_router.get("/attendance/audit")
async def get_attendance_audit(date: str = None, employee_id: str = None, current_user: dict = Depends(get_current_user)):
    """Get audit trail for attendance adjustments"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    query = {}
    if date:
        query["attendance_date"] = date
    if employee_id:
        query["employee_id"] = employee_id
    audits = await db.attendance_audit.find(query, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return {"audits": audits}

@api_router.get("/attendance/wtd-alerts")
async def get_wtd_alerts(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Working Time Directive alerts: >48h/week or <11h rest gap"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    import calendar as cal_mod
    days_in_month = cal_mod.monthrange(year, month)[1]
    first = f"{year}-{month:02d}-01"
    last = f"{year}-{month:02d}-{days_in_month:02d}"

    staff = await db.employees.find(
        {"care_home_id": current_user["care_home_id"], "status": "active", "role": "staff"},
        {"_id": 0, "id": 1, "employee_id": 1, "first_name": 1, "last_name": 1}
    ).to_list(200)

    shifts = await db.shifts.find({
        "care_home_id": current_user["care_home_id"],
        "shift_date": {"$gte": first, "$lte": last},
        "status": {"$in": ["scheduled", "completed"]}
    }, {"_id": 0}).to_list(5000)

    alerts = []
    for emp in staff:
        emp_shifts = sorted([s for s in shifts if s["employee_id"] == emp["id"]], key=lambda s: s["shift_date"])
        name = f"{emp['first_name']} {emp['last_name']}"

        # Check weekly hours (>48h)
        from collections import defaultdict
        week_hours = defaultdict(float)
        for s in emp_shifts:
            d = datetime.fromisoformat(s["shift_date"])
            week_num = d.isocalendar()[1]
            week_hours[week_num] += SHIFT_TEMPLATES.get(s.get("template", ""), {}).get("hours", 0)
        for wk, hrs in week_hours.items():
            if hrs > 48:
                alerts.append({"type": "weekly_hours", "employee": name, "employee_id": emp["employee_id"], "message": f"Week {wk}: {hrs}h scheduled (max 48h)", "severity": "high"})

        # Check rest gaps (<11h)
        for i in range(1, len(emp_shifts)):
            try:
                prev_end_str = emp_shifts[i-1]["end_time"]
                prev_date = emp_shifts[i-1]["shift_date"]
                curr_start_str = emp_shifts[i]["start_time"]
                curr_date = emp_shifts[i]["shift_date"]
                _, prev_end = parse_shift_times(emp_shifts[i-1])
                curr_start, _ = parse_shift_times(emp_shifts[i])
                gap = (curr_start - prev_end).total_seconds() / 3600
                if 0 < gap < MIN_REST_HOURS:
                    alerts.append({"type": "rest_gap", "employee": name, "employee_id": emp["employee_id"],
                        "message": f"{gap:.0f}h rest between {prev_date} and {curr_date} (min {MIN_REST_HOURS}h)", "severity": "high"})
            except (ValueError, TypeError):
                pass

    return {"year": year, "month": month, "alerts": alerts}

# ============ EMPLOYEE ROUTES ============

@api_router.get("/employees")
async def list_employees_basic(current_user: dict = Depends(get_current_user)):
    """List all employees (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employees = await db.employees.find(
        {"care_home_id": current_user["care_home_id"]},
        {"_id": 0, "pin_hash": 0, "totp_secret": 0}
    ).to_list(1000)
    
    return {"employees": employees}

@api_router.get("/employees/list")
async def list_employees_full(current_user: dict = Depends(get_current_user)):
    """List all employees with full details for management"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")
    employees = await db.employees.find(
        {"care_home_id": current_user["care_home_id"]},
        {"_id": 0, "pin_hash": 0, "totp_secret": 0}
    ).to_list(500)
    return {"employees": employees}

@api_router.get("/employees/lookup/{employee_code}")
async def lookup_employee_code(employee_code: str):
    """Public endpoint to lookup employee by code (for demo mode)"""
    employee = await db.employees.find_one(
        {"employee_id": employee_code, "status": "active"},
        {"_id": 0, "pin_hash": 0, "totp_secret": 0}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return employee

@api_router.get("/employees/{employee_id}")
async def get_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get employee details"""
    employee = await db.employees.find_one(
        {"employee_id": employee_id},
        {"_id": 0, "pin_hash": 0, "totp_secret": 0}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check authorization
    if current_user["role"] not in ["manager", "admin"] and current_user["id"] != employee["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return employee

@api_router.post("/employees")
async def create_employee(employee: EmployeeCreate, current_user: dict = Depends(get_current_user)):
    """Create new employee (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if employee_id already exists
    existing = await db.employees.find_one({"employee_id": employee.employee_id})
    if existing:
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    
    new_employee = Employee(
        employee_id=employee.employee_id,
        care_home_id=employee.care_home_id,
        first_name=employee.first_name,
        last_name=employee.last_name,
        email=employee.email,
        phone=employee.phone,
        role=employee.role,
        job_title=employee.job_title,
        employment_type=employee.employment_type,
        status=employee.status
    )
    
    await db.employees.insert_one(serialize_datetime(new_employee.model_dump()))
    
    return {"success": True, "employee_id": new_employee.employee_id}

@api_router.put("/employees/{employee_id}/status")
async def update_employee_status(employee_id: str, status: str, current_user: dict = Depends(get_current_user)):
    """Update employee status (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if status not in ["active", "inactive", "on_leave"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"success": True, "message": f"Status updated to {status}"}

# ============ CARE HOME ROUTES ============

@api_router.get("/care-homes")
async def list_care_homes(current_user: dict = Depends(get_current_user)):
    """List care homes (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    care_homes = await db.care_homes.find({}, {"_id": 0}).to_list(100)
    return {"care_homes": care_homes}

@api_router.get("/care-homes/{care_home_id}")
async def get_care_home(care_home_id: str, current_user: dict = Depends(get_current_user)):
    """Get care home details"""
    care_home = await db.care_homes.find_one({"id": care_home_id}, {"_id": 0})
    if not care_home:
        raise HTTPException(status_code=404, detail="Care home not found")
    return care_home

# ============ KIOSK DEVICE ROUTES ============

@api_router.get("/kiosk-devices")
async def list_kiosk_devices(current_user: dict = Depends(get_current_user)):
    """List kiosk devices (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    devices = await db.kiosk_devices.find(
        {"care_home_id": current_user["care_home_id"]},
        {"_id": 0, "device_pin_hash": 0}
    ).to_list(100)
    return {"devices": devices}

# ============ OFFLINE SYNC ROUTES ============

@api_router.post("/kiosk/register")
async def register_kiosk_device(
    device_name: str,
    location: str = None,
    setup_pin: str = "1234"
):
    """Register a new kiosk device - returns device_id for offline use"""
    # Get default care home
    care_home = await db.care_homes.find_one({}, {"_id": 0})
    if not care_home:
        raise HTTPException(status_code=400, detail="No care home configured")
    
    device_id = str(uuid.uuid4())
    device = KioskDevice(
        id=device_id,
        care_home_id=care_home["id"],
        device_name=device_name,
        device_pin_hash=hash_pin(setup_pin),
        location=location,
        last_seen=datetime.now(timezone.utc)
    )
    await db.kiosk_devices.insert_one(serialize_datetime(device.model_dump()))
    
    return {
        "success": True,
        "device_id": device_id,
        "device_name": device_name,
        "message": "Device registered. Store device_id for offline operations."
    }

@api_router.post("/kiosk/heartbeat")
async def kiosk_heartbeat(device_id: str):
    """Update kiosk last_seen timestamp"""
    result = await db.kiosk_devices.update_one(
        {"id": device_id},
        {"$set": {"last_seen": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"success": True, "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/kiosk/offline-bundle")
async def get_offline_bundle(current_user: dict = Depends(get_current_user)):
    """Get offline authentication bundle for local validation.
    Contains encrypted PIN hashes and TOTP secrets for authorized employees.
    This should be refreshed periodically when online."""
    
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required to download offline bundle")
    
    care_home_id = current_user["care_home_id"]
    
    # Get all active employees with their auth data
    employees = await db.employees.find(
        {"care_home_id": care_home_id, "status": "active"},
        {"_id": 0, "id": 1, "employee_id": 1, "first_name": 1, "last_name": 1,
         "role": 1, "job_title": 1, "pin_hash": 1, "totp_secret": 1, "totp_enrolled": 1}
    ).to_list(500)
    
    # Get today's and tomorrow's shifts for offline display
    today = datetime.now(timezone.utc).date()
    tomorrow = today + timedelta(days=1)
    
    shifts = await db.shifts.find({
        "care_home_id": care_home_id,
        "shift_date": {"$in": [today.isoformat(), tomorrow.isoformat()]},
        "status": {"$in": ["scheduled", "swapped"]}
    }, {"_id": 0}).to_list(500)
    
    # Bundle creation timestamp for staleness check
    bundle_created = datetime.now(timezone.utc)
    
    return {
        "success": True,
        "bundle_version": bundle_created.isoformat(),
        "care_home_id": care_home_id,
        "employees": employees,
        "shifts": shifts,
        "expires_at": (bundle_created + timedelta(hours=24)).isoformat(),
        "note": "Store securely. Bundle expires in 24 hours."
    }

@api_router.post("/kiosk/offline-auth")
async def validate_offline_auth(
    employee_id: str,
    pin: str,
    totp_token: str = None,
    device_id: str = None,
    offline_timestamp: str = None
):
    """Validate authentication that was performed offline.
    Called when kiosk comes back online to verify the offline auth was valid."""
    
    employee = await db.employees.find_one(
        {"employee_id": employee_id},
        {"_id": 0}
    )
    
    if not employee:
        return {"valid": False, "reason": "Employee not found"}
    
    # Verify PIN
    if not employee.get("pin_hash") or not verify_pin(pin, employee["pin_hash"]):
        return {"valid": False, "reason": "Invalid PIN"}
    
    # Verify TOTP if provided
    if totp_token and employee.get("totp_secret"):
        totp = pyotp.TOTP(employee["totp_secret"])
        # Use wider tolerance for offline validation (5 minutes)
        if not totp.verify(totp_token, valid_window=10):
            return {"valid": False, "reason": "Invalid TOTP"}
    
    # Log the offline auth verification
    await db.auth_events.insert_one(serialize_datetime({
        "id": str(uuid.uuid4()),
        "employee_id": employee["id"],
        "event_type": "offline_auth_verified",
        "kiosk_device_id": device_id,
        "offline_timestamp": offline_timestamp,
        "verified_at": datetime.now(timezone.utc),
        "timestamp": datetime.now(timezone.utc)
    }))
    
    return {
        "valid": True,
        "employee_id": employee["id"],
        "employee_code": employee["employee_id"],
        "name": f"{employee['first_name']} {employee['last_name']}",
        "role": employee["role"]
    }

@api_router.post("/sync/offline-events")
async def sync_offline_events(request: OfflineSyncRequest, current_user: dict = Depends(get_current_user)):
    """Sync offline authentication events"""
    synced_count = 0
    
    for event in request.events:
        # Check for duplicate (idempotency)
        existing = await db.offline_queue.find_one({"id": event.get("id")})
        if existing and existing.get("synced"):
            continue
        
        # Store event
        event["synced"] = True
        event["synced_at"] = datetime.now(timezone.utc).isoformat()
        
        if existing:
            await db.offline_queue.update_one({"id": event["id"]}, {"$set": event})
        else:
            await db.offline_queue.insert_one(event)
        
        # Create corresponding attendance record
        if event.get("auth_type") in ["clock_in", "clock_out"]:
            emp = await db.employees.find_one({"employee_id": event.get("employee_id")})
            if emp:
                event_time = datetime.fromisoformat(event["timestamp"]) if isinstance(event["timestamp"], str) else event["timestamp"]
                day_start = event_time.replace(hour=0, minute=0, second=0, microsecond=0)
                
                att = await db.attendance.find_one({
                    "employee_id": emp["id"],
                    "created_at": {"$gte": day_start.isoformat()}
                })
                
                if event["auth_type"] == "clock_in":
                    if att:
                        await db.attendance.update_one(
                            {"id": att["id"]},
                            {"$set": {"clock_in": event["timestamp"]}}
                        )
                    else:
                        await db.attendance.insert_one({
                            "id": str(uuid.uuid4()),
                            "employee_id": emp["id"],
                            "care_home_id": emp["care_home_id"],
                            "clock_in": event["timestamp"],
                            "status": "present",
                            "created_at": day_start.isoformat()
                        })
                elif event["auth_type"] == "clock_out" and att:
                    await db.attendance.update_one(
                        {"id": att["id"]},
                        {"$set": {"clock_out": event["timestamp"]}}
                    )
        
        synced_count += 1
    
    return {"success": True, "synced_count": synced_count}

# ============ DASHBOARD STATS ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    care_home_id = current_user["care_home_id"]
    
    # Count employees by status
    total_employees = await db.employees.count_documents({"care_home_id": care_home_id})
    active_employees = await db.employees.count_documents({"care_home_id": care_home_id, "status": "active"})
    on_leave = await db.employees.count_documents({"care_home_id": care_home_id, "status": "on_leave"})
    
    # Today's attendance
    today_attendance = await db.attendance.find({
        "care_home_id": care_home_id,
        "created_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    clocked_in = len([a for a in today_attendance if a.get("clock_in") and not a.get("clock_out")])
    clocked_out = len([a for a in today_attendance if a.get("clock_out")])
    not_arrived = active_employees - len(today_attendance)
    
    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "on_leave": on_leave,
        "today": {
            "clocked_in": clocked_in,
            "clocked_out": clocked_out,
            "not_arrived": max(0, not_arrived)
        }
    }

# ============ SHIFT SWAP ROUTES ============

@api_router.get("/shift-swaps")
async def list_shift_swaps(current_user: dict = Depends(get_current_user)):
    """List shift swap requests - Staff see swaps to accept, Managers see swaps to approve"""
    
    if current_user["role"] in ["manager", "admin"]:
        # Managers see swaps pending approval
        swaps = await db.shift_swaps.find({
            "care_home_id": current_user["care_home_id"],
            "status": "accepted_pending_approval"
        }, {"_id": 0}).sort("created_at", -1).to_list(100)
        return {"shift_swaps": swaps, "view_type": "approval"}
    
    # Staff can see open swaps from their care home (excluding their own)
    open_swaps = await db.shift_swaps.find({
        "care_home_id": current_user["care_home_id"],
        "status": "pending_acceptance",
        "requester_id": {"$ne": current_user["id"]},
        "$or": [
            {"swap_type": "open"},
            {"target_id": current_user["id"]}  # Direct requests to them
        ]
    }, {"_id": 0}).to_list(100)
    
    # Also get their own swaps (any status)
    my_swaps = await db.shift_swaps.find({
        "requester_id": current_user["id"]
    }, {"_id": 0}).to_list(100)
    
    # Get direct requests sent to them
    direct_to_me = await db.shift_swaps.find({
        "target_id": current_user["id"],
        "status": "pending_acceptance"
    }, {"_id": 0}).to_list(100)
    
    return {
        "shift_swaps": my_swaps,
        "available_swaps": open_swaps,
        "direct_requests": direct_to_me,
        "view_type": "staff"
    }

@api_router.post("/shift-swaps")
async def create_shift_swap(request: ShiftSwapCreateEnhanced, current_user: dict = Depends(get_current_user)):
    """Create shift swap request with enhanced options"""
    if current_user["role"] in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Managers/admins cannot create shift swaps")
    
    # Get the shift
    shift = await db.shifts.find_one({"id": request.original_shift_id}, {"_id": 0})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    if shift["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only swap your own shifts")
    
    target_name = None
    if request.target_id:
        target_emp = await db.employees.find_one({"id": request.target_id}, {"_id": 0})
        if target_emp:
            target_name = f"{target_emp['first_name']} {target_emp['last_name']}"
    
    new_swap = ShiftSwapRequest(
        requester_id=current_user["id"],
        requester_name=f"{current_user['first_name']} {current_user['last_name']}",
        target_id=request.target_id,
        target_name=target_name,
        original_shift_id=request.original_shift_id,
        shift_date=shift["shift_date"],
        shift_start=shift["start_time"],
        shift_end=shift["end_time"],
        reason=request.reason,
        message_to_manager=request.message_to_manager,
        swap_type=request.swap_type,
        status="pending_acceptance" if request.swap_type != "manager_request" else "accepted_pending_approval",
        care_home_id=current_user["care_home_id"]
    )
    await db.shift_swaps.insert_one(serialize_datetime(new_swap.model_dump()))
    
    # Create notification for target or managers
    if request.swap_type == "direct" and request.target_id:
        # Notify the specific colleague
        notification = Notification(
            care_home_id=current_user["care_home_id"],
            recipient_id=request.target_id,
            title="Shift Swap Request",
            content=f"{current_user['first_name']} {current_user['last_name']} wants to swap their {shift['shift_date']} shift with you",
            notification_type="swap_request",
            related_id=new_swap.id
        )
        await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    if request.swap_type == "manager_request" or request.message_to_manager:
        # Notify managers
        managers = await db.employees.find({
            "care_home_id": current_user["care_home_id"],
            "role": {"$in": ["manager", "admin"]},
            "status": "active"
        }, {"_id": 0}).to_list(100)
        
        for mgr in managers:
            notification = Notification(
                care_home_id=current_user["care_home_id"],
                recipient_id=mgr["id"],
                title="Shift Swap Request Needs Attention",
                content=f"{current_user['first_name']} {current_user['last_name']} requests manager help with shift swap on {shift['shift_date']}. Message: {request.message_to_manager or 'No message'}",
                notification_type="swap_request",
                related_id=new_swap.id
            )
            await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    return {"success": True, "id": new_swap.id}

@api_router.post("/shift-swaps/{swap_id}/accept")
async def accept_shift_swap(swap_id: str, current_user: dict = Depends(get_current_user)):
    """Accept a shift swap (staff only) - still needs manager approval"""
    if current_user["role"] in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Use approve endpoint for manager approval")
    
    swap = await db.shift_swaps.find_one({"id": swap_id}, {"_id": 0})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap["status"] != "pending_acceptance":
        raise HTTPException(status_code=400, detail="Swap is no longer available for acceptance")
    
    if swap["requester_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot accept your own swap request")
    
    # If it's a direct swap, only the target can accept
    if swap.get("swap_type") == "direct" and swap.get("target_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="This swap request is for a specific person")
    
    # Update swap status to pending manager approval
    await db.shift_swaps.update_one(
        {"id": swap_id},
        {"$set": {
            "status": "accepted_pending_approval",
            "accepted_by": current_user["id"],
            "accepted_by_name": f"{current_user['first_name']} {current_user['last_name']}"
        }}
    )
    
    # Notify requester
    notification = Notification(
        care_home_id=swap["care_home_id"],
        recipient_id=swap["requester_id"],
        title="Swap Request Accepted",
        content=f"{current_user['first_name']} {current_user['last_name']} accepted your swap request. Awaiting manager approval.",
        notification_type="swap_request",
        related_id=swap_id
    )
    await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    # Notify managers for approval
    managers = await db.employees.find({
        "care_home_id": swap["care_home_id"],
        "role": {"$in": ["manager", "admin"]},
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    for mgr in managers:
        notification = Notification(
            care_home_id=swap["care_home_id"],
            recipient_id=mgr["id"],
            title="Shift Swap Needs Approval",
            content=f"Swap between {swap['requester_name']} and {current_user['first_name']} {current_user['last_name']} for {swap['shift_date']} needs approval",
            notification_type="swap_request",
            related_id=swap_id
        )
        await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    return {"success": True, "message": "Swap accepted, pending manager approval"}

@api_router.post("/shift-swaps/{swap_id}/approve")
async def approve_shift_swap(swap_id: str, current_user: dict = Depends(get_current_user)):
    """Approve a shift swap (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Only managers can approve swaps")
    
    swap = await db.shift_swaps.find_one({"id": swap_id}, {"_id": 0})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap["status"] != "accepted_pending_approval":
        raise HTTPException(status_code=400, detail="Swap is not pending approval")
    
    # Update swap status
    await db.shift_swaps.update_one(
        {"id": swap_id},
        {"$set": {
            "status": "approved",
            "manager_approved": True,
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update the shift assignment
    await db.shifts.update_one(
        {"id": swap["original_shift_id"]},
        {"$set": {
            "employee_id": swap["accepted_by"],
            "status": "swapped",
            "notes": f"Swapped from {swap['requester_name']} to {swap['accepted_by_name']} - Approved by manager"
        }}
    )
    
    # Notify both parties
    for recipient_id in [swap["requester_id"], swap["accepted_by"]]:
        notification = Notification(
            care_home_id=swap["care_home_id"],
            recipient_id=recipient_id,
            title="Shift Swap Approved",
            content=f"Your shift swap for {swap['shift_date']} has been approved by management",
            notification_type="swap_approved",
            related_id=swap_id
        )
        await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    return {"success": True, "message": "Shift swap approved"}

@api_router.post("/shift-swaps/{swap_id}/reject")
async def reject_shift_swap(swap_id: str, reason: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Reject a shift swap (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Only managers can reject swaps")
    
    swap = await db.shift_swaps.find_one({"id": swap_id}, {"_id": 0})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    await db.shift_swaps.update_one(
        {"id": swap_id},
        {"$set": {
            "status": "rejected",
            "approved_by": current_user["id"],
            "rejection_reason": reason
        }}
    )
    
    # Notify both parties
    recipients = [swap["requester_id"]]
    if swap.get("accepted_by"):
        recipients.append(swap["accepted_by"])
    
    for recipient_id in recipients:
        notification = Notification(
            care_home_id=swap["care_home_id"],
            recipient_id=recipient_id,
            title="Shift Swap Rejected",
            content=f"Your shift swap for {swap['shift_date']} has been rejected. Reason: {reason or 'Not specified'}",
            notification_type="swap_rejected",
            related_id=swap_id
        )
        await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    return {"success": True}

@api_router.post("/shift-swaps/{swap_id}/cancel")
async def cancel_shift_swap(swap_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel own shift swap request"""
    swap = await db.shift_swaps.find_one({"id": swap_id}, {"_id": 0})
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    
    if swap["requester_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only cancel your own requests")
    
    if swap["status"] not in ["pending_acceptance", "accepted_pending_approval"]:
        raise HTTPException(status_code=400, detail="Cannot cancel - swap already finalized")
    
    await db.shift_swaps.update_one(
        {"id": swap_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"success": True}

# ============ SHIFT/ROTA ROUTES ============

@api_router.get("/shifts/my-rota")
async def get_my_rota(current_user: dict = Depends(get_current_user)):
    """Get current user's shifts for the next 4 weeks"""
    today = datetime.now(timezone.utc).date()
    end_date = today + timedelta(days=28)
    
    shifts = await db.shifts.find({
        "employee_id": current_user["id"],
        "shift_date": {
            "$gte": today.isoformat(),
            "$lte": end_date.isoformat()
        }
    }, {"_id": 0}).sort("shift_date", 1).to_list(100)
    
    return {"shifts": shifts}

@api_router.get("/shifts/today")
async def get_today_shift(current_user: dict = Depends(get_current_user)):
    """Check if user has a shift today and if within clocking window"""
    today = datetime.now(timezone.utc).date().isoformat()
    now = datetime.now(timezone.utc)
    
    shift = await db.shifts.find_one({
        "employee_id": current_user["id"],
        "shift_date": today,
        "status": {"$in": ["scheduled", "swapped"]}
    }, {"_id": 0})
    
    if not shift:
        return {
            "has_shift": False,
            "can_clock": False,
            "shift": None,
            "message": "No shift scheduled for today"
        }
    
    # Parse shift times
    shift_start = datetime.strptime(f"{shift['shift_date']} {shift['start_time']}", "%Y-%m-%d %H:%M")
    shift_end = datetime.strptime(f"{shift['shift_date']} {shift['end_time']}", "%Y-%m-%d %H:%M")
    
    # Make timezone aware
    shift_start = shift_start.replace(tzinfo=timezone.utc)
    shift_end = shift_end.replace(tzinfo=timezone.utc)
    
    # Allow clocking 30 minutes before shift start and up to 2 hours after shift end
    clock_window_start = shift_start - timedelta(minutes=30)
    clock_window_end = shift_end + timedelta(hours=2)
    
    can_clock = clock_window_start <= now <= clock_window_end
    
    return {
        "has_shift": True,
        "can_clock": can_clock,
        "shift": shift,
        "clock_window": {
            "start": clock_window_start.isoformat(),
            "end": clock_window_end.isoformat()
        },
        "message": "Within clocking window" if can_clock else "Outside clocking window"
    }

@api_router.get("/shifts/next")
async def get_next_shift(current_user: dict = Depends(get_current_user)):
    """Get the next scheduled shift for the current user"""
    today = datetime.now(timezone.utc).date().isoformat()
    
    next_shift = await db.shifts.find_one({
        "employee_id": current_user["id"],
        "shift_date": {"$gt": today},
        "status": {"$in": ["scheduled", "swapped"]}
    }, {"_id": 0}, sort=[("shift_date", 1)])
    
    if not next_shift:
        return {"has_next_shift": False, "shift": None}
    
    # Calculate days until shift
    shift_date = datetime.strptime(next_shift["shift_date"], "%Y-%m-%d").date()
    today_date = datetime.now(timezone.utc).date()
    days_until = (shift_date - today_date).days
    
    # Friendly label
    if days_until == 1:
        date_label = "Tomorrow"
    elif days_until == 0:
        date_label = "Today"
    else:
        date_label = shift_date.strftime("%A, %d %b")
    
    return {
        "has_next_shift": True,
        "shift": next_shift,
        "days_until": days_until,
        "date_label": date_label
    }

# ============ LEAVE REQUEST ROUTES ============

class SickLeaveRecord(BaseModel):
    start_date: str
    end_date: str = None
    symptoms: str = None
    doctor_note: bool = False
    notes: str = None

@api_router.post("/sick-leave/record")
async def record_sick_leave(record: SickLeaveRecord, current_user: dict = Depends(get_current_user)):
    """Record sick leave - staff can self-report when they're ill"""
    end_date = record.end_date or record.start_date
    
    # Create the sick leave record
    sick_leave = {
        "id": str(uuid.uuid4()),
        "care_home_id": current_user["care_home_id"],
        "employee_id": current_user["id"],
        "employee_name": f"{current_user['first_name']} {current_user['last_name']}",
        "start_date": record.start_date,
        "end_date": end_date,
        "symptoms": record.symptoms,
        "doctor_note": record.doctor_note,
        "notes": record.notes,
        "status": "recorded",  # recorded, return_to_work, closed
        "return_date": None,
        "return_to_work_meeting": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.sick_leave.insert_one(serialize_datetime(sick_leave))
    
    # Also create a leave request for tracking
    leave_request = LeaveRequest(
        care_home_id=current_user["care_home_id"],
        employee_id=current_user["id"],
        leave_type="sick",
        start_date=record.start_date,
        end_date=end_date,
        reason=record.symptoms or "Sick leave",
        status="approved"  # Sick leave is auto-approved
    )
    await db.leave_requests.insert_one(serialize_datetime(leave_request.model_dump()))
    
    # Notify managers
    managers = await db.employees.find({
        "care_home_id": current_user["care_home_id"],
        "role": "manager",
        "status": "active"
    }, {"_id": 0, "id": 1, "first_name": 1, "last_name": 1}).to_list(10)
    
    for mgr in managers:
        notification = Notification(
            care_home_id=current_user["care_home_id"],
            recipient_id=mgr["id"],
            title="Sick Leave Reported",
            content=f"{current_user['first_name']} {current_user['last_name']} has reported sick for {record.start_date}" + (f" to {end_date}" if end_date != record.start_date else ""),
            notification_type="sick_leave",
            related_id=sick_leave["id"]
        )
        await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    return {"success": True, "id": sick_leave["id"]}

@api_router.get("/sick-leave/my-records")
async def get_my_sick_leave(current_user: dict = Depends(get_current_user)):
    """Get own sick leave records"""
    records = await db.sick_leave.find(
        {"employee_id": current_user["id"]},
        {"_id": 0}
    ).sort("start_date", -1).to_list(50)
    
    # Calculate total sick days this year
    current_year = datetime.now(timezone.utc).year
    total_days = 0
    for r in records:
        if r["start_date"].startswith(str(current_year)):
            start = datetime.strptime(r["start_date"], "%Y-%m-%d").date()
            end = datetime.strptime(r["end_date"], "%Y-%m-%d").date()
            total_days += (end - start).days + 1
    
    return {
        "records": records,
        "total_sick_days_this_year": total_days
    }

@api_router.get("/sick-leave/all")
async def get_all_sick_leave(current_user: dict = Depends(get_current_user)):
    """Get all sick leave records (manager only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    
    records = await db.sick_leave.find(
        {"care_home_id": current_user["care_home_id"]},
        {"_id": 0}
    ).sort("start_date", -1).to_list(200)
    
    return {"records": records}

@api_router.put("/sick-leave/{record_id}/return-to-work")
async def mark_return_to_work(record_id: str, return_date: str = None, notes: str = None, current_user: dict = Depends(get_current_user)):
    """Mark employee as returned to work after sick leave"""
    record = await db.sick_leave.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Sick leave record not found")
    
    # Staff can update own, managers can update any
    if record["employee_id"] != current_user["id"] and current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    actual_return = return_date or datetime.now(timezone.utc).date().isoformat()
    
    await db.sick_leave.update_one(
        {"id": record_id},
        {"$set": {
            "status": "return_to_work",
            "return_date": actual_return,
            "return_notes": notes
        }}
    )
    
    # Create RTW form when return date is set
    rtw = ReturnToWork(
        care_home_id=record["care_home_id"],
        employee_id=record["employee_id"],
        employee_name=record.get("employee_name", "Staff Member"),
        sick_leave_id=record_id,
        return_date=actual_return,
        due_date=actual_return
    )
    await db.rtw_forms.insert_one(serialize_datetime(rtw.model_dump()))
    
    return {"success": True, "rtw_id": rtw.id}

# ============ RETURN TO WORK (RTW) ENDPOINTS ============

class RTWManagerUpdate(BaseModel):
    fit_to_return: bool
    absence_discussed: bool
    affects_safe_working: bool
    adjustments_needed: bool
    adjustment_types: List[str] = []
    occupational_health: bool
    work_related: bool
    incident_followup: bool = False
    followup_required: bool
    followup_timeframe: Optional[str] = None

class RTWStaffUpdate(BaseModel):
    fit_to_return: bool
    fully_recovered: bool
    ongoing_symptoms: bool
    feels_safe: bool
    needs_adjustments: bool
    adjustment_types: List[str] = []
    understands_reporting: bool
    agrees_outcome: bool

@api_router.get("/rtw")
async def get_rtw_forms(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get RTW forms - filtered by status or employee"""
    query = {"care_home_id": current_user["care_home_id"]}
    
    if status:
        query["status"] = status
    if employee_id:
        query["employee_id"] = employee_id
    
    # Staff can only see their own
    if current_user["role"] not in ["manager", "admin"]:
        query["employee_id"] = current_user["id"]
    
    forms = await db.rtw_forms.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Check for overdue forms and update status
    today = datetime.now(timezone.utc).date().isoformat()
    for form in forms:
        if form["status"] == "pending" and form["due_date"] < today:
            await db.rtw_forms.update_one(
                {"id": form["id"]},
                {"$set": {"status": "overdue"}}
            )
            form["status"] = "overdue"
    
    return {"rtw_forms": forms}

@api_router.get("/rtw/pending-count")
async def get_rtw_pending_count(current_user: dict = Depends(get_current_user)):
    """Get count of pending/overdue RTW forms for dashboard"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Managers only")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    pending = await db.rtw_forms.count_documents({
        "care_home_id": current_user["care_home_id"],
        "status": {"$in": ["pending", "in_progress"]}
    })
    
    overdue = await db.rtw_forms.count_documents({
        "care_home_id": current_user["care_home_id"],
        "status": "pending",
        "due_date": {"$lt": today}
    })
    
    return {"pending": pending, "overdue": overdue, "total": pending}

@api_router.get("/rtw/my-pending")
async def get_my_pending_rtw(current_user: dict = Depends(get_current_user)):
    """Get pending RTW forms for current user"""
    forms = await db.rtw_forms.find({
        "employee_id": current_user["id"],
        "status": {"$in": ["pending", "in_progress", "overdue"]}
    }, {"_id": 0}).to_list(10)
    
    return {"rtw_forms": forms}

@api_router.get("/rtw/{rtw_id}")
async def get_rtw_form(rtw_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific RTW form"""
    form = await db.rtw_forms.find_one({"id": rtw_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="RTW form not found")
    
    # Staff can only view their own
    if current_user["role"] not in ["manager", "admin"] and form["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get linked sick leave record
    sick_leave = await db.sick_leave.find_one({"id": form["sick_leave_id"]}, {"_id": 0})
    
    return {"rtw_form": form, "sick_leave": sick_leave}

@api_router.put("/rtw/{rtw_id}/manager")
async def update_rtw_manager_section(
    rtw_id: str,
    data: RTWManagerUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Manager completes their section of the RTW form"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Managers only")
    
    form = await db.rtw_forms.find_one({"id": rtw_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="RTW form not found")
    
    # Determine new status
    new_status = "in_progress"
    if form.get("staff_completed"):
        new_status = "completed"
    
    await db.rtw_forms.update_one(
        {"id": rtw_id},
        {"$set": {
            "manager_completed": True,
            "manager_completed_by": current_user["id"],
            "manager_completed_at": datetime.now(timezone.utc),
            "mgr_fit_to_return": data.fit_to_return,
            "mgr_absence_discussed": data.absence_discussed,
            "mgr_affects_safe_working": data.affects_safe_working,
            "mgr_adjustments_needed": data.adjustments_needed,
            "mgr_adjustment_types": data.adjustment_types,
            "mgr_occupational_health": data.occupational_health,
            "mgr_work_related": data.work_related,
            "mgr_incident_followup": data.incident_followup,
            "mgr_followup_required": data.followup_required,
            "mgr_followup_timeframe": data.followup_timeframe,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"success": True, "status": new_status}

@api_router.put("/rtw/{rtw_id}/staff")
async def update_rtw_staff_section(
    rtw_id: str,
    data: RTWStaffUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Staff member completes their section of the RTW form"""
    form = await db.rtw_forms.find_one({"id": rtw_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="RTW form not found")
    
    # Staff can only complete their own form
    if form["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only complete your own RTW form")
    
    # Determine new status
    new_status = "in_progress"
    if form.get("manager_completed"):
        new_status = "completed"
    
    await db.rtw_forms.update_one(
        {"id": rtw_id},
        {"$set": {
            "staff_completed": True,
            "staff_completed_at": datetime.now(timezone.utc),
            "staff_fit_to_return": data.fit_to_return,
            "staff_fully_recovered": data.fully_recovered,
            "staff_ongoing_symptoms": data.ongoing_symptoms,
            "staff_feels_safe": data.feels_safe,
            "staff_needs_adjustments": data.needs_adjustments,
            "staff_adjustment_types": data.adjustment_types,
            "staff_understands_reporting": data.understands_reporting,
            "staff_agrees_outcome": data.agrees_outcome,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"success": True, "status": new_status}

@api_router.get("/staff/{employee_id}/rtw-status")
async def get_staff_rtw_status(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get RTW status for a specific staff member - for triggers"""
    pending_rtw = await db.rtw_forms.find_one({
        "employee_id": employee_id,
        "status": {"$in": ["pending", "in_progress", "overdue"]}
    }, {"_id": 0})
    
    return {"has_pending_rtw": pending_rtw is not None, "rtw_form": pending_rtw}

@api_router.get("/leave-requests")
async def get_leave_requests(current_user: dict = Depends(get_current_user)):
    """Get leave requests - own requests for staff, all for managers"""
    if current_user["role"] in ["manager", "admin"]:
        requests = await db.leave_requests.find({
            "care_home_id": current_user["care_home_id"]
        }, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        requests = await db.leave_requests.find({
            "employee_id": current_user["id"]
        }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"leave_requests": requests}

@api_router.post("/leave-requests")
async def create_leave_request(request: LeaveRequestCreate, current_user: dict = Depends(get_current_user)):
    """Create a new leave request"""
    new_request = LeaveRequest(
        employee_id=current_user["id"],
        care_home_id=current_user["care_home_id"],
        leave_type=request.leave_type,
        start_date=request.start_date,
        end_date=request.end_date,
        reason=request.reason
    )
    await db.leave_requests.insert_one(serialize_datetime(new_request.model_dump()))
    
    # Notify managers
    managers = await db.employees.find({
        "care_home_id": current_user["care_home_id"],
        "role": {"$in": ["manager", "admin"]},
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    for mgr in managers:
        notification = Notification(
            care_home_id=current_user["care_home_id"],
            recipient_id=mgr["id"],
            title="New Leave Request",
            content=f"{current_user['first_name']} {current_user['last_name']} requested {request.leave_type} leave from {request.start_date} to {request.end_date}",
            notification_type="leave_request",
            related_id=new_request.id
        )
        await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    return {"success": True, "id": new_request.id}

@api_router.put("/leave-requests/{request_id}/approve")
async def approve_leave_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Approve leave request (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    leave_req = await db.leave_requests.find_one({"id": request_id}, {"_id": 0})
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    await db.leave_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "approved_by": current_user["id"], "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify employee via notification bell
    notification = Notification(
        care_home_id=leave_req["care_home_id"],
        recipient_id=leave_req["employee_id"],
        title="Leave Request Approved",
        content=f"Your {leave_req['leave_type']} leave request from {leave_req['start_date']} to {leave_req['end_date']} has been approved",
        notification_type="leave_approved",
        related_id=request_id
    )
    await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    # Also send internal message
    message = {
        "id": str(uuid.uuid4()),
        "care_home_id": leave_req["care_home_id"],
        "sender_id": current_user["id"],
        "sender_name": f"{current_user['first_name']} {current_user['last_name']}",
        "recipient_id": leave_req["employee_id"],
        "subject": "Leave Request Approved",
        "content": f"Good news! Your {leave_req['leave_type']} leave request for {leave_req['start_date']} to {leave_req['end_date']} has been approved.\n\nApproved by: {current_user['first_name']} {current_user['last_name']}",
        "message_type": "request_approval",
        "related_id": request_id,
        "read_by": [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.messages.insert_one(serialize_datetime(message))
    
    return {"success": True}

@api_router.put("/leave-requests/{request_id}/reject")
async def reject_leave_request(request_id: str, reason: str = None, current_user: dict = Depends(get_current_user)):
    """Reject leave request (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    leave_req = await db.leave_requests.find_one({"id": request_id}, {"_id": 0})
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    await db.leave_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "approved_by": current_user["id"], "rejection_reason": reason, "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify employee via notification bell
    notification = Notification(
        care_home_id=leave_req["care_home_id"],
        recipient_id=leave_req["employee_id"],
        title="Leave Request Rejected",
        content=f"Your {leave_req['leave_type']} leave request from {leave_req['start_date']} to {leave_req['end_date']} has been rejected",
        notification_type="leave_rejected",
        related_id=request_id
    )
    await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    # Also send internal message
    reason_text = f"\n\nReason: {reason}" if reason else ""
    message = {
        "id": str(uuid.uuid4()),
        "care_home_id": leave_req["care_home_id"],
        "sender_id": current_user["id"],
        "sender_name": f"{current_user['first_name']} {current_user['last_name']}",
        "recipient_id": leave_req["employee_id"],
        "subject": "Leave Request Rejected",
        "content": f"Unfortunately, your {leave_req['leave_type']} leave request for {leave_req['start_date']} to {leave_req['end_date']} has been rejected.{reason_text}\n\nPlease speak with your manager if you have any questions.",
        "message_type": "request_rejection",
        "related_id": request_id,
        "read_by": [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.messages.insert_one(serialize_datetime(message))
    
    return {"success": True}

@api_router.delete("/leave-requests/{request_id}")
async def cancel_leave_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel own leave request"""
    leave_req = await db.leave_requests.find_one({"id": request_id}, {"_id": 0})
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave_req["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only cancel your own requests")
    
    if leave_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cannot cancel - already processed")
    
    await db.leave_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"success": True}

# ============ DAY REQUEST ROUTES ============

@api_router.get("/day-requests")
async def get_day_requests(current_user: dict = Depends(get_current_user)):
    """Get day on/off requests"""
    if current_user["role"] in ["manager", "admin"]:
        requests = await db.day_requests.find({
            "care_home_id": current_user["care_home_id"]
        }, {"_id": 0}).sort("created_at", -1).to_list(100)
    else:
        requests = await db.day_requests.find({
            "employee_id": current_user["id"]
        }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"day_requests": requests}

@api_router.post("/day-requests")
async def create_day_request(request: DayRequestCreate, current_user: dict = Depends(get_current_user)):
    """Create a day on/off request"""
    new_request = DayRequest(
        employee_id=current_user["id"],
        care_home_id=current_user["care_home_id"],
        request_type=request.request_type,
        requested_date=request.requested_date,
        reason=request.reason
    )
    await db.day_requests.insert_one(serialize_datetime(new_request.model_dump()))
    
    # Notify managers
    managers = await db.employees.find({
        "care_home_id": current_user["care_home_id"],
        "role": {"$in": ["manager", "admin"]},
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    req_type_display = "Day On" if request.request_type == "day_on" else "Day Off"
    for mgr in managers:
        notification = Notification(
            care_home_id=current_user["care_home_id"],
            recipient_id=mgr["id"],
            title=f"New {req_type_display} Request",
            content=f"{current_user['first_name']} {current_user['last_name']} requested {req_type_display.lower()} for {request.requested_date}",
            notification_type="day_request",
            related_id=new_request.id
        )
        await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    return {"success": True, "id": new_request.id}

@api_router.put("/day-requests/{request_id}/approve")
async def approve_day_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Approve day request (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    day_req = await db.day_requests.find_one({"id": request_id}, {"_id": 0})
    if not day_req:
        raise HTTPException(status_code=404, detail="Day request not found")
    
    await db.day_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "approved_by": current_user["id"], "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify employee via notification bell
    req_type_display = "Day On" if day_req["request_type"] == "day_on" else "Day Off"
    notification = Notification(
        care_home_id=day_req["care_home_id"],
        recipient_id=day_req["employee_id"],
        title=f"{req_type_display} Request Approved",
        content=f"Your {req_type_display.lower()} request for {day_req['requested_date']} has been approved",
        notification_type="day_approved",
        related_id=request_id
    )
    await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    # Also send internal message
    message = {
        "id": str(uuid.uuid4()),
        "care_home_id": day_req["care_home_id"],
        "sender_id": current_user["id"],
        "sender_name": f"{current_user['first_name']} {current_user['last_name']}",
        "recipient_id": day_req["employee_id"],
        "subject": f"{req_type_display} Request Approved",
        "content": f"Good news! Your {req_type_display.lower()} request for {day_req['requested_date']} has been approved.\n\nApproved by: {current_user['first_name']} {current_user['last_name']}",
        "message_type": "request_approval",
        "related_id": request_id,
        "read_by": [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.messages.insert_one(serialize_datetime(message))
    
    return {"success": True}

@api_router.put("/day-requests/{request_id}/reject")
async def reject_day_request(request_id: str, reason: str = None, current_user: dict = Depends(get_current_user)):
    """Reject day request (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    day_req = await db.day_requests.find_one({"id": request_id}, {"_id": 0})
    if not day_req:
        raise HTTPException(status_code=404, detail="Day request not found")
    
    await db.day_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "approved_by": current_user["id"], "rejection_reason": reason, "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify employee via notification bell
    req_type_display = "Day On" if day_req["request_type"] == "day_on" else "Day Off"
    notification = Notification(
        care_home_id=day_req["care_home_id"],
        recipient_id=day_req["employee_id"],
        title=f"{req_type_display} Request Rejected",
        content=f"Your {req_type_display.lower()} request for {day_req['requested_date']} has been rejected",
        notification_type="day_rejected",
        related_id=request_id
    )
    await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    # Also send internal message
    reason_text = f"\n\nReason: {reason}" if reason else ""
    message = {
        "id": str(uuid.uuid4()),
        "care_home_id": day_req["care_home_id"],
        "sender_id": current_user["id"],
        "sender_name": f"{current_user['first_name']} {current_user['last_name']}",
        "recipient_id": day_req["employee_id"],
        "subject": f"{req_type_display} Request Rejected",
        "content": f"Unfortunately, your {req_type_display.lower()} request for {day_req['requested_date']} has been rejected.{reason_text}\n\nPlease speak with your manager if you have any questions.",
        "message_type": "request_rejection",
        "related_id": request_id,
        "read_by": [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.messages.insert_one(serialize_datetime(message))
    
    return {"success": True}

# ============ STAFF PROFILE ROUTES ============

@api_router.get("/staff/profile")
async def get_staff_profile(current_user: dict = Depends(get_current_user)):
    """Get comprehensive staff profile data"""
    today = datetime.now(timezone.utc).date()
    
    # Get leave balance (simplified - 28 days annual leave standard)
    used_leave = await db.leave_requests.count_documents({
        "employee_id": current_user["id"],
        "leave_type": "annual",
        "status": "approved"
    })
    
    # Get pending requests counts
    pending_leave = await db.leave_requests.count_documents({
        "employee_id": current_user["id"],
        "status": "pending"
    })
    
    pending_day_requests = await db.day_requests.count_documents({
        "employee_id": current_user["id"],
        "status": "pending"
    })
    
    open_swaps = await db.shift_swaps.count_documents({
        "requester_id": current_user["id"],
        "status": "open"
    })
    
    # Get upcoming shifts count
    upcoming_shifts = await db.shifts.count_documents({
        "employee_id": current_user["id"],
        "shift_date": {"$gte": today.isoformat()},
        "status": {"$in": ["scheduled", "swapped"]}
    })
    
    return {
        "employee": {
            "id": current_user["id"],
            "employee_id": current_user["employee_id"],
            "first_name": current_user["first_name"],
            "last_name": current_user["last_name"],
            "job_title": current_user["job_title"],
            "employment_type": current_user["employment_type"],
            "email": current_user.get("email"),
            "phone": current_user.get("phone")
        },
        "leave_balance": {
            "annual_total": 28,
            "annual_used": used_leave,
            "annual_remaining": max(0, 28 - used_leave)
        },
        "pending_counts": {
            "leave_requests": pending_leave,
            "day_requests": pending_day_requests,
            "open_swaps": open_swaps
        },
        "upcoming_shifts": upcoming_shifts
    }

@api_router.get("/staff/colleagues")
async def get_colleagues(current_user: dict = Depends(get_current_user)):
    """Get list of colleagues for shift swap targeting"""
    colleagues = await db.employees.find({
        "care_home_id": current_user["care_home_id"],
        "status": "active",
        "role": "staff",
        "id": {"$ne": current_user["id"]}
    }, {"_id": 0, "pin_hash": 0, "totp_secret": 0}).to_list(100)
    
    return {"colleagues": colleagues}

# ============ MESSAGING ROUTES ============

@api_router.get("/messages")
async def get_messages(current_user: dict = Depends(get_current_user)):
    """Get messages for current user"""
    # Get direct messages to user
    direct = await db.messages.find({
        "care_home_id": current_user["care_home_id"],
        "$or": [
            {"recipient_id": current_user["id"]},
            {"sender_id": current_user["id"]},
            {"recipient_id": None}  # Broadcasts
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"messages": direct}

@api_router.post("/messages")
async def send_message(request: SendMessageRequest, current_user: dict = Depends(get_current_user)):
    """Send a message to another user or broadcast"""
    message = Message(
        care_home_id=current_user["care_home_id"],
        sender_id=current_user["id"],
        sender_name=f"{current_user['first_name']} {current_user['last_name']}",
        recipient_id=request.recipient_id,
        recipient_role=request.recipient_role,
        subject=request.subject,
        content=request.content,
        message_type=request.message_type,
        related_id=request.related_id
    )
    await db.messages.insert_one(serialize_datetime(message.model_dump()))
    
    # Create notification for recipient(s)
    if request.recipient_id:
        notification = Notification(
            care_home_id=current_user["care_home_id"],
            recipient_id=request.recipient_id,
            title=f"Message from {current_user['first_name']} {current_user['last_name']}",
            content=request.subject,
            notification_type="message",
            related_id=message.id
        )
        await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    elif request.recipient_role:
        # Send to all users with that role
        recipients = await db.employees.find({
            "care_home_id": current_user["care_home_id"],
            "role": request.recipient_role,
            "status": "active"
        }, {"_id": 0}).to_list(100)
        
        for recipient in recipients:
            if recipient["id"] != current_user["id"]:
                notification = Notification(
                    care_home_id=current_user["care_home_id"],
                    recipient_id=recipient["id"],
                    title=f"Message from {current_user['first_name']} {current_user['last_name']}",
                    content=request.subject,
                    notification_type="message",
                    related_id=message.id
                )
                await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    return {"success": True, "id": message.id}

@api_router.put("/messages/{message_id}/read")
async def mark_message_read(message_id: str, current_user: dict = Depends(get_current_user)):
    """Mark message as read"""
    await db.messages.update_one(
        {"id": message_id},
        {"$addToSet": {"read_by": current_user["id"]}}
    )
    return {"success": True}

# ============ NOTIFICATION ROUTES ============

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Get notifications for current user"""
    notifications = await db.notifications.find({
        "recipient_id": current_user["id"]
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    unread_count = await db.notifications.count_documents({
        "recipient_id": current_user["id"],
        "is_read": False
    })
    
    return {"notifications": notifications, "unread_count": unread_count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark notification as read"""
    await db.notifications.update_one(
        {"id": notification_id, "recipient_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    return {"success": True}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"recipient_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"success": True}

# ============ TEAM CALENDAR ROUTES ============

@api_router.get("/calendar/team-availability")
async def get_team_availability(current_user: dict = Depends(get_current_user)):
    """Get team availability calendar - shows approved leave"""
    today = datetime.now(timezone.utc).date()
    # Show 3 months ahead
    end_date = today + timedelta(days=90)
    
    # Get all approved leave for the care home
    leave_requests = await db.leave_requests.find({
        "care_home_id": current_user["care_home_id"],
        "status": "approved",
        "start_date": {"$lte": end_date.isoformat()},
        "end_date": {"$gte": today.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    # Get employee names
    employee_ids = list(set([l["employee_id"] for l in leave_requests]))
    employees = await db.employees.find(
        {"id": {"$in": employee_ids}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "job_title": 1}
    ).to_list(100)
    emp_map = {e["id"]: e for e in employees}
    
    # Build calendar data
    calendar_data = []
    for leave in leave_requests:
        emp = emp_map.get(leave["employee_id"], {})
        calendar_data.append({
            "id": leave["id"],
            "employee_id": leave["employee_id"],
            "employee_name": f"{emp.get('first_name', '')} {emp.get('last_name', '')}",
            "job_title": emp.get("job_title", ""),
            "start_date": leave["start_date"],
            "end_date": leave["end_date"],
            "leave_type": leave["leave_type"]
        })
    
    return {"calendar": calendar_data, "start_date": today.isoformat(), "end_date": end_date.isoformat()}

@api_router.get("/calendar/monthly-rota")
async def get_monthly_rota(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Get monthly rota calendar view"""
    from calendar import monthrange
    
    # Calculate month boundaries
    first_day = datetime(year, month, 1).date()
    last_day = datetime(year, month, monthrange(year, month)[1]).date()
    
    # Get shifts for the month
    shifts = await db.shifts.find({
        "employee_id": current_user["id"],
        "shift_date": {
            "$gte": first_day.isoformat(),
            "$lte": last_day.isoformat()
        }
    }, {"_id": 0}).to_list(100)
    
    # Get leave for the month
    leave = await db.leave_requests.find({
        "employee_id": current_user["id"],
        "status": "approved",
        "start_date": {"$lte": last_day.isoformat()},
        "end_date": {"$gte": first_day.isoformat()}
    }, {"_id": 0}).to_list(50)
    
    return {
        "year": year,
        "month": month,
        "shifts": shifts,
        "leave": leave,
        "first_day": first_day.isoformat(),
        "last_day": last_day.isoformat()
    }

@api_router.get("/calendar/team-rota")
async def get_team_rota(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Get team rota for managers to see all staff shifts"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    from calendar import monthrange
    
    first_day = datetime(year, month, 1).date()
    last_day = datetime(year, month, monthrange(year, month)[1]).date()
    
    # Get all shifts for care home
    shifts = await db.shifts.find({
        "care_home_id": current_user["care_home_id"],
        "shift_date": {
            "$gte": first_day.isoformat(),
            "$lte": last_day.isoformat()
        }
    }, {"_id": 0}).to_list(1000)
    
    # Get employees
    employees = await db.employees.find({
        "care_home_id": current_user["care_home_id"],
        "status": "active"
    }, {"_id": 0, "pin_hash": 0, "totp_secret": 0}).to_list(100)
    
    emp_map = {e["id"]: e for e in employees}
    
    # Enrich shifts with employee info
    for shift in shifts:
        emp = emp_map.get(shift["employee_id"], {})
        shift["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}"
        shift["job_title"] = emp.get("job_title", "")
    
    return {
        "year": year,
        "month": month,
        "shifts": shifts,
        "employees": employees
    }

# ============ MANAGER APPROVAL DASHBOARD ============

@api_router.get("/manager/pending-approvals")
async def get_pending_approvals(current_user: dict = Depends(get_current_user)):
    """Get all pending items for manager approval"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Pending leave requests
    leave_requests = await db.leave_requests.find({
        "care_home_id": current_user["care_home_id"],
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # Pending day requests
    day_requests = await db.day_requests.find({
        "care_home_id": current_user["care_home_id"],
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # Pending swap approvals
    swap_requests = await db.shift_swaps.find({
        "care_home_id": current_user["care_home_id"],
        "status": "accepted_pending_approval"
    }, {"_id": 0}).to_list(100)
    
    # Get employee info
    all_emp_ids = set()
    for req in leave_requests + day_requests:
        all_emp_ids.add(req["employee_id"])
    for swap in swap_requests:
        all_emp_ids.add(swap["requester_id"])
        if swap.get("accepted_by"):
            all_emp_ids.add(swap["accepted_by"])
    
    employees = await db.employees.find(
        {"id": {"$in": list(all_emp_ids)}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "job_title": 1}
    ).to_list(100)
    emp_map = {e["id"]: e for e in employees}
    
    # Enrich with employee names
    for req in leave_requests:
        emp = emp_map.get(req["employee_id"], {})
        req["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}"
        req["job_title"] = emp.get("job_title", "")
    
    for req in day_requests:
        emp = emp_map.get(req["employee_id"], {})
        req["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}"
        req["job_title"] = emp.get("job_title", "")
    
    return {
        "leave_requests": leave_requests,
        "day_requests": day_requests,
        "swap_requests": swap_requests,
        "total_pending": len(leave_requests) + len(day_requests) + len(swap_requests)
    }

# ============ SEED DATA ============

@api_router.post("/seed")
async def seed_database():
    """Seed database with initial data"""
    # Check if already seeded
    existing_home = await db.care_homes.find_one({"name": "Comber Home"})
    if existing_home:
        return {"success": True, "message": "Already seeded"}
    
    # Create Care Home
    care_home = CareHome(name="Comber Home", address="123 Care Street, Comber, BT23 5AA", phone="+44 28 9187 1234")
    await db.care_homes.insert_one(serialize_datetime(care_home.model_dump()))
    
    # Create Kiosk Device
    kiosk = KioskDevice(
        care_home_id=care_home.id,
        device_name="Main Reception Kiosk",
        device_pin_hash=hash_pin("1234"),
        location="Reception"
    )
    await db.kiosk_devices.insert_one(serialize_datetime(kiosk.model_dump()))
    
    # Employee data
    employees_data = [
        # Super Admin
        {"employee_id": "ADM001", "first_name": "Sarah", "last_name": "Wilson", "role": "admin", "job_title": "administrator", "status": "active"},
        # Manager
        {"employee_id": "MGR001", "first_name": "Michael", "last_name": "O'Brien", "role": "manager", "job_title": "care_manager", "status": "active"},
        # Staff - Nurses
        {"employee_id": "NRS001", "first_name": "Emma", "last_name": "Thompson", "role": "staff", "job_title": "nurse", "status": "active"},
        {"employee_id": "NRS002", "first_name": "David", "last_name": "Chen", "role": "staff", "job_title": "nurse", "status": "active"},
        # Senior Carers
        {"employee_id": "SCR001", "first_name": "Lisa", "last_name": "Murphy", "role": "staff", "job_title": "senior_carer", "status": "active"},
        {"employee_id": "SCR002", "first_name": "James", "last_name": "Kelly", "role": "staff", "job_title": "senior_carer", "status": "active"},
        # Carers
        {"employee_id": "CAR001", "first_name": "Sophie", "last_name": "Brown", "role": "staff", "job_title": "carer", "status": "active"},
        {"employee_id": "CAR002", "first_name": "Tom", "last_name": "Walsh", "role": "staff", "job_title": "carer", "status": "active"},
        {"employee_id": "CAR003", "first_name": "Amy", "last_name": "Ryan", "role": "staff", "job_title": "carer", "status": "active"},
        # Activities
        {"employee_id": "ACT001", "first_name": "Rachel", "last_name": "Green", "role": "staff", "job_title": "activities", "status": "active"},
        # Kitchen
        {"employee_id": "KIT001", "first_name": "Patrick", "last_name": "Byrne", "role": "staff", "job_title": "kitchen", "status": "active"},
        # Maintenance
        {"employee_id": "MNT001", "first_name": "Sean", "last_name": "Fitzgerald", "role": "staff", "job_title": "maintenance", "status": "active"},
        # Agency Staff
        {"employee_id": "AGY001", "first_name": "Kate", "last_name": "Collins", "role": "staff", "job_title": "carer", "status": "active", "employment_type": "agency"},
        {"employee_id": "AGY002", "first_name": "Mark", "last_name": "Hughes", "role": "staff", "job_title": "nurse", "status": "active", "employment_type": "agency"},
        # Leavers (inactive)
        {"employee_id": "EX001", "first_name": "John", "last_name": "Smith", "role": "staff", "job_title": "carer", "status": "inactive"},
        {"employee_id": "EX002", "first_name": "Mary", "last_name": "Johnson", "role": "staff", "job_title": "nurse", "status": "inactive"},
        # On Leave
        {"employee_id": "LVE001", "first_name": "Claire", "last_name": "Doyle", "role": "staff", "job_title": "senior_carer", "status": "on_leave"},
        {"employee_id": "LVE002", "first_name": "Brian", "last_name": "McCarthy", "role": "staff", "job_title": "carer", "status": "on_leave"},
    ]
    
    # Default PIN: 1234, Default TOTP secret for testing
    default_pin_hash = hash_pin("1234")
    
    for emp_data in employees_data:
        totp_secret = generate_totp_secret()
        employee = Employee(
            employee_id=emp_data["employee_id"],
            care_home_id=care_home.id,
            first_name=emp_data["first_name"],
            last_name=emp_data["last_name"],
            email=f"{emp_data['first_name'].lower()}.{emp_data['last_name'].lower()}@comberhome.com",
            role=emp_data["role"],
            job_title=emp_data["job_title"],
            employment_type=emp_data.get("employment_type", "permanent"),
            status=emp_data["status"],
            pin_hash=default_pin_hash,
            totp_secret=totp_secret,
            totp_enrolled=True if emp_data["status"] == "active" else False
        )
        await db.employees.insert_one(serialize_datetime(employee.model_dump()))
    
    return {
        "success": True,
        "message": "Database seeded successfully",
        "care_home_id": care_home.id,
        "employees_created": len(employees_data),
        "default_pin": "1234"
    }

@api_router.post("/seed-shifts")
async def seed_shifts():
    """Seed sample shifts for testing"""
    # Get active staff employees
    employees = await db.employees.find({
        "status": "active",
        "role": "staff"
    }, {"_id": 0}).to_list(100)
    
    if not employees:
        return {"success": False, "message": "No employees found. Run /api/seed first."}
    
    care_home = await db.care_homes.find_one({}, {"_id": 0})
    if not care_home:
        return {"success": False, "message": "No care home found"}
    
    # Clear existing shifts
    await db.shifts.delete_many({})
    
    today = datetime.now(timezone.utc).date()
    shifts_created = 0
    
    # Create shifts for the next 14 days
    shift_patterns = [
        ("07:00", "15:00"),  # Early
        ("15:00", "23:00"),  # Late
        ("23:00", "07:00"),  # Night
    ]
    
    for day_offset in range(-3, 15):  # Past 3 days and next 14 days
        shift_date = (today + timedelta(days=day_offset)).isoformat()
        
        # Assign shifts to different employees
        for i, emp in enumerate(employees[:10]):  # First 10 staff
            pattern_idx = (i + day_offset) % 3
            
            # Skip some days to simulate days off
            if (i + day_offset) % 5 == 0:
                continue
            
            start_time, end_time = shift_patterns[pattern_idx]
            
            shift = Shift(
                employee_id=emp["id"],
                care_home_id=care_home["id"],
                shift_date=shift_date,
                start_time=start_time,
                end_time=end_time,
                shift_type="regular",
                status="scheduled" if day_offset >= 0 else "completed"
            )
            await db.shifts.insert_one(serialize_datetime(shift.model_dump()))
            shifts_created += 1
    
    # Create a sample swap request
    if employees:
        emp = employees[0]
        today_shift = await db.shifts.find_one({
            "employee_id": emp["id"],
            "shift_date": today.isoformat()
        }, {"_id": 0})
        
        if today_shift:
            sample_swap = ShiftSwapRequest(
                requester_id=emp["id"],
                requester_name=f"{emp['first_name']} {emp['last_name']}",
                original_shift_id=today_shift["id"],
                shift_date=today_shift["shift_date"],
                shift_start=today_shift["start_time"],
                shift_end=today_shift["end_time"],
                reason="Family commitment",
                care_home_id=care_home["id"]
            )
            await db.shift_swaps.insert_one(serialize_datetime(sample_swap.model_dump()))
    
    return {
        "success": True,
        "shifts_created": shifts_created,
        "message": "Shifts seeded successfully"
    }

@api_router.get("/auth/mobile-token/{employee_code}")
async def get_mobile_token(employee_code: str):
    """Generate current TOTP token for mobile authenticator simulation.
    In production, this logic lives inside the mobile app, not the server."""
    employee = await db.employees.find_one(
        {"employee_id": employee_code},
        {"_id": 0, "pin_hash": 0}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not employee.get("totp_enrolled") or not employee.get("totp_secret"):
        raise HTTPException(status_code=400, detail="Employee not enrolled for TOTP")

    totp = pyotp.TOTP(employee["totp_secret"])
    current_token = totp.now()
    remaining = totp.interval - (datetime.now(timezone.utc).timestamp() % totp.interval)

    return {
        "employee_code": employee["employee_id"],
        "employee_name": f"{employee['first_name']} {employee['last_name']}",
        "role": employee["role"],
        "token": current_token,
        "qr_data": f"{employee['employee_id']}:{current_token}",
        "remaining_seconds": int(remaining)
    }

@api_router.get("/auth/mobile-employees")
async def list_mobile_employees():
    """List active enrolled employees for mobile auth selection."""
    employees = await db.employees.find(
        {"status": "active", "totp_enrolled": True},
        {"_id": 0, "employee_id": 1, "first_name": 1, "last_name": 1, "role": 1, "job_title": 1}
    ).to_list(100)
    return {"employees": employees}

# ============ PLANNER ENDPOINTS ============

def get_shift_hours(template_key):
    t = SHIFT_TEMPLATES.get(template_key)
    return t["hours"] if t else 0

def parse_shift_times(shift):
    """Get start/end as datetime objects for rest gap calculation"""
    d = shift["shift_date"]
    s = shift["start_time"]
    e = shift["end_time"]
    start_dt = datetime.fromisoformat(f"{d}T{s}:00")
    if e < s:  # Night shift crosses midnight
        end_date = (datetime.fromisoformat(d) + timedelta(days=1)).strftime("%Y-%m-%d")
        end_dt = datetime.fromisoformat(f"{end_date}T{e}:00")
    else:
        end_dt = datetime.fromisoformat(f"{d}T{e}:00")
    return start_dt, end_dt

async def validate_assignment(employee_id, shift_date, template, care_home_id, exclude_shift_id=None):
    """Validate a shift assignment against planner rules. Returns list of warnings."""
    warnings = []
    tpl = SHIFT_TEMPLATES.get(template)
    if not tpl:
        return [{"type": "error", "message": f"Unknown template: {template}"}]

    new_start_str = tpl["start"]
    new_end_str = tpl["end"]
    new_start, new_end = parse_shift_times({"shift_date": shift_date, "start_time": new_start_str, "end_time": new_end_str})

    # Get existing shifts for this employee in a ±5 day window
    date_obj = datetime.fromisoformat(shift_date).date()
    window_start = (date_obj - timedelta(days=5)).isoformat()
    window_end = (date_obj + timedelta(days=5)).isoformat()

    query = {
        "employee_id": employee_id,
        "shift_date": {"$gte": window_start, "$lte": window_end},
        "status": {"$in": ["scheduled", "completed"]}
    }
    if exclude_shift_id:
        query["id"] = {"$ne": exclude_shift_id}

    existing = await db.shifts.find(query, {"_id": 0}).to_list(100)

    # Check duplicate: already has a shift on this date
    same_day = [s for s in existing if s["shift_date"] == shift_date]
    if same_day:
        warnings.append({"type": "error", "message": f"Employee already has a shift on {shift_date}"})
        return warnings

    # Check 11-hour rest gap
    for s in existing:
        ex_start, ex_end = parse_shift_times(s)
        gap_before = (new_start - ex_end).total_seconds() / 3600
        gap_after = (ex_start - new_end).total_seconds() / 3600
        if 0 < gap_before < MIN_REST_HOURS:
            warnings.append({
                "type": "rest_gap",
                "message": f"Only {gap_before:.1f}h rest after shift on {s['shift_date']} ({s['start_time']}-{s['end_time']}). Minimum is {MIN_REST_HOURS}h."
            })
        if 0 < gap_after < MIN_REST_HOURS:
            warnings.append({
                "type": "rest_gap",
                "message": f"Only {gap_after:.1f}h rest before shift on {s['shift_date']} ({s['start_time']}-{s['end_time']}). Minimum is {MIN_REST_HOURS}h."
            })

    # Check consecutive days
    shift_dates = sorted(set([s["shift_date"] for s in existing] + [shift_date]))
    max_consecutive = 1
    current_streak = 1
    for i in range(1, len(shift_dates)):
        d1 = datetime.fromisoformat(shift_dates[i - 1]).date()
        d2 = datetime.fromisoformat(shift_dates[i]).date()
        if (d2 - d1).days == 1:
            current_streak += 1
            max_consecutive = max(max_consecutive, current_streak)
        else:
            current_streak = 1
    if max_consecutive > MAX_CONSECUTIVE_DAYS:
        warnings.append({
            "type": "consecutive",
            "message": f"This creates {max_consecutive} consecutive working days. Maximum recommended is {MAX_CONSECUTIVE_DAYS}."
        })

    return warnings

async def check_coverage(care_home_id, shift_date, template):
    """Check if coverage baseline is met for a given shift on a date"""
    tpl = SHIFT_TEMPLATES.get(template)
    if not tpl:
        return []

    shifts_on_date = await db.shifts.find({
        "care_home_id": care_home_id,
        "shift_date": shift_date,
        "start_time": tpl["start"],
        "status": {"$in": ["scheduled", "completed"]}
    }, {"_id": 0}).to_list(200)

    emp_ids = [s["employee_id"] for s in shifts_on_date]
    employees = await db.employees.find(
        {"id": {"$in": emp_ids}},
        {"_id": 0, "id": 1, "job_title": 1}
    ).to_list(200)
    job_map = {e["id"]: e["job_title"] for e in employees}

    nurse_count = sum(1 for eid in emp_ids if job_map.get(eid) == "nurse")
    carer_count = sum(1 for eid in emp_ids if job_map.get(eid) in ("carer", "senior_carer"))

    alerts = []
    if nurse_count < COVERAGE_BASELINE["nurse"]:
        alerts.append({"type": "coverage", "message": f"{template} shift on {shift_date}: {nurse_count}/{COVERAGE_BASELINE['nurse']} nurses"})
    if carer_count < COVERAGE_BASELINE["carer"]:
        alerts.append({"type": "coverage", "message": f"{template} shift on {shift_date}: {carer_count}/{COVERAGE_BASELINE['carer']} care assistants"})
    return alerts

@api_router.get("/planner/templates")
async def get_shift_templates():
    return {"templates": SHIFT_TEMPLATES, "rules": {
        "min_rest_hours": MIN_REST_HOURS,
        "max_consecutive_days": MAX_CONSECUTIVE_DAYS,
        "min_weekly_hours": MIN_WEEKLY_HOURS,
        "coverage_baseline": COVERAGE_BASELINE
    }}

# ============ CONTROL PREFERENCES ENDPOINTS ============

async def get_control_preferences(care_home_id: str) -> dict:
    """Get control preferences for a care home, creating defaults if not exists"""
    prefs = await db.control_preferences.find_one({"care_home_id": care_home_id}, {"_id": 0})
    if not prefs:
        # Create default preferences
        default_prefs = ControlPreferences(care_home_id=care_home_id)
        await db.control_preferences.insert_one(serialize_datetime(default_prefs.model_dump()))
        prefs = default_prefs.model_dump()
    return prefs

@api_router.get("/control-preferences")
async def get_preferences(current_user: dict = Depends(get_current_user)):
    """Get control preferences for current care home"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    
    care_home = await db.care_homes.find_one({"id": current_user["care_home_id"]}, {"_id": 0})
    if not care_home:
        raise HTTPException(status_code=404, detail="Care home not found")
    
    prefs = await get_control_preferences(care_home["id"])
    return {"preferences": prefs}

@api_router.put("/control-preferences")
async def update_preferences(prefs: dict, current_user: dict = Depends(get_current_user)):
    """Update control preferences"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    
    care_home = await db.care_homes.find_one({"id": current_user["care_home_id"]}, {"_id": 0})
    if not care_home:
        raise HTTPException(status_code=404, detail="Care home not found")
    
    # Update or create preferences
    prefs["care_home_id"] = care_home["id"]
    prefs["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    existing = await db.control_preferences.find_one({"care_home_id": care_home["id"]})
    if existing:
        await db.control_preferences.update_one(
            {"care_home_id": care_home["id"]},
            {"$set": prefs}
        )
    else:
        prefs["id"] = str(uuid.uuid4())
        prefs["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.control_preferences.insert_one(prefs)
    
    return {"success": True}

@api_router.get("/control-preferences/staffing-requirements/{shift_type}")
async def get_staffing_requirements(shift_type: str, current_user: dict = Depends(get_current_user)):
    """Get staffing requirements for a specific shift type"""
    prefs = await get_control_preferences(current_user["care_home_id"])
    staffing = prefs.get("staffing", {})
    requirements = staffing.get(shift_type, {})
    return {"requirements": requirements, "weekend_modifier": staffing.get("weekend_modifier", 0.8)}

@api_router.post("/control-preferences/override-log")
async def log_override(
    rule_type: str,
    rule_violated: str,
    staff_id: str,
    staff_name: str,
    shift_date: str,
    justification: str,
    is_agency: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Log a rule override for audit purposes"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    
    log_entry = OverrideLog(
        care_home_id=current_user["care_home_id"],
        manager_id=current_user["id"],
        manager_name=f"{current_user['first_name']} {current_user['last_name']}",
        rule_type=rule_type,
        rule_violated=rule_violated,
        staff_id=staff_id,
        staff_name=staff_name,
        shift_date=shift_date,
        justification=justification,
        is_agency=is_agency
    )
    await db.override_logs.insert_one(serialize_datetime(log_entry.model_dump()))
    return {"success": True, "log_id": log_entry.id}

@api_router.get("/control-preferences/override-logs")
async def get_override_logs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    rule_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get override audit logs"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    
    query = {"care_home_id": current_user["care_home_id"]}
    if start_date and end_date:
        query["shift_date"] = {"$gte": start_date, "$lte": end_date}
    if rule_type:
        query["rule_type"] = rule_type
    
    logs = await db.override_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"logs": logs}

@api_router.get("/planner/monthly")
async def get_monthly_planner(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Get full monthly planner data: staff × days grid"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    care_home = await db.care_homes.find_one({}, {"_id": 0})
    if not care_home:
        raise HTTPException(status_code=404, detail="No care home configured")

    # Date range for the month
    first_day = f"{year}-{month:02d}-01"
    if month == 12:
        last_day = f"{year + 1}-01-01"
    else:
        last_day = f"{year}-{month + 1:02d}-01"
    last_date = (datetime.fromisoformat(last_day) - timedelta(days=1)).strftime("%Y-%m-%d")

    # Get all active staff
    staff = await db.employees.find(
        {"status": {"$in": ["active", "on_leave"]}, "role": "staff"},
        {"_id": 0, "pin_hash": 0, "totp_secret": 0}
    ).to_list(200)

    # Get all shifts for the month
    shifts = await db.shifts.find({
        "care_home_id": care_home["id"],
        "shift_date": {"$gte": first_day, "$lte": last_date},
        "status": {"$in": ["scheduled", "completed"]}
    }, {"_id": 0}).to_list(5000)

    # Get approved leave for the month
    leave = await db.leave_requests.find({
        "care_home_id": care_home["id"],
        "status": "approved",
        "start_date": {"$lte": last_date},
        "end_date": {"$gte": first_day}
    }, {"_id": 0}).to_list(500)

    # Calculate weekly hours and overtime for each staff member
    staff_stats = {}
    for emp in staff:
        emp_shifts = [s for s in shifts if s["employee_id"] == emp["id"]]
        total_hours = sum(get_shift_hours(s.get("template", "custom")) for s in emp_shifts)
        contract = emp.get("contract_hours", 36.0)
        # Weeks in month (approximate)
        import calendar
        days_in_month = calendar.monthrange(year, month)[1]
        weeks = days_in_month / 7
        expected_hours = contract * weeks
        overtime = max(0, total_hours - expected_hours)
        staff_stats[emp["id"]] = {
            "total_hours": total_hours,
            "expected_hours": round(expected_hours, 1),
            "overtime_hours": round(overtime, 1),
            "shift_count": len(emp_shifts)
        }

    # Coverage per day per template
    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    coverage = {}
    emp_job_map = {e["id"]: e["job_title"] for e in staff}
    for day in range(1, days_in_month + 1):
        date_str = f"{year}-{month:02d}-{day:02d}"
        day_shifts = [s for s in shifts if s["shift_date"] == date_str]
        day_coverage = {}
        for tpl_key in SHIFT_TEMPLATES:
            tpl = SHIFT_TEMPLATES[tpl_key]
            tpl_shifts = [s for s in day_shifts if s.get("template") == tpl_key]
            nurse_c = sum(1 for s in tpl_shifts if emp_job_map.get(s["employee_id"]) == "nurse")
            carer_c = sum(1 for s in tpl_shifts if emp_job_map.get(s["employee_id"]) in ("carer", "senior_carer"))
            total = len(tpl_shifts)
            day_coverage[tpl_key] = {
                "nurses": nurse_c, "carers": carer_c, "total": total,
                "nurse_ok": nurse_c >= COVERAGE_BASELINE["nurse"],
                "carer_ok": carer_c >= COVERAGE_BASELINE["carer"]
            }
        coverage[date_str] = day_coverage

    return {
        "year": year, "month": month,
        "staff": staff,
        "shifts": shifts,
        "leave": leave,
        "staff_stats": staff_stats,
        "coverage": coverage,
        "templates": SHIFT_TEMPLATES
    }

@api_router.post("/planner/assign")
async def assign_shift(req: PlannerAssignRequest, current_user: dict = Depends(get_current_user)):
    """Assign a shift to an employee with rule validation"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    care_home = await db.care_homes.find_one({}, {"_id": 0})
    if not care_home:
        raise HTTPException(status_code=404, detail="No care home configured")

    tpl = SHIFT_TEMPLATES.get(req.template)
    if not tpl:
        raise HTTPException(status_code=400, detail=f"Unknown template: {req.template}")

    # Validate assignment rules
    warnings = await validate_assignment(req.employee_id, req.shift_date, req.template, care_home["id"])
    errors = [w for w in warnings if w["type"] == "error"]
    if errors:
        raise HTTPException(status_code=400, detail=errors[0]["message"])

    rule_warnings = [w for w in warnings if w["type"] != "error"]
    if rule_warnings and not req.force:
        return {"success": False, "warnings": rule_warnings, "requires_confirmation": True}

    # Create the shift
    shift = Shift(
        employee_id=req.employee_id,
        care_home_id=care_home["id"],
        shift_date=req.shift_date,
        start_time=tpl["start"],
        end_time=tpl["end"],
        template=req.template,
        shift_type=req.shift_type,
        is_agency_cover=req.is_agency_cover,
        notes=req.notes,
        assigned_by=current_user["id"]
    )
    await db.shifts.insert_one(serialize_datetime(shift.model_dump()))

    # Check coverage after assignment
    cov_alerts = await check_coverage(care_home["id"], req.shift_date, req.template)

    return {
        "success": True,
        "shift": {k: v for k, v in shift.model_dump().items() if k != "care_home_id"},
        "coverage_alerts": cov_alerts,
        "warnings_overridden": rule_warnings if req.force else []
    }

@api_router.delete("/planner/unassign/{shift_id}")
async def unassign_shift(shift_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a shift assignment"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    result = await db.shifts.delete_one({"id": shift_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shift not found")
    return {"success": True}

@api_router.put("/planner/move")
async def move_shift(req: PlannerMoveRequest, current_user: dict = Depends(get_current_user)):
    """Move a shift to a new date or employee (drag and drop)"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    shift = await db.shifts.find_one({"id": req.shift_id}, {"_id": 0})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    target_emp = req.new_employee_id or shift["employee_id"]
    template = shift.get("template", "custom")

    # Validate the move
    warnings = await validate_assignment(target_emp, req.new_date, template, shift["care_home_id"], exclude_shift_id=req.shift_id)
    errors = [w for w in warnings if w["type"] == "error"]
    if errors:
        raise HTTPException(status_code=400, detail=errors[0]["message"])

    rule_warnings = [w for w in warnings if w["type"] != "error"]
    if rule_warnings and not req.force:
        return {"success": False, "warnings": rule_warnings, "requires_confirmation": True}

    update = {"shift_date": req.new_date}
    if req.new_employee_id:
        update["employee_id"] = req.new_employee_id
    await db.shifts.update_one({"id": req.shift_id}, {"$set": update})

    return {"success": True, "warnings_overridden": rule_warnings if req.force else []}

@api_router.get("/planner/overtime")
async def get_overtime(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Get overtime report for all staff"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    first_day = f"{year}-{month:02d}-01"
    last_day = f"{year}-{month:02d}-{days_in_month:02d}"

    staff = await db.employees.find(
        {"status": "active", "role": "staff"},
        {"_id": 0, "id": 1, "employee_id": 1, "first_name": 1, "last_name": 1, "job_title": 1, "employment_type": 1, "contract_hours": 1}
    ).to_list(200)

    shifts = await db.shifts.find({
        "shift_date": {"$gte": first_day, "$lte": last_day},
        "status": {"$in": ["scheduled", "completed"]}
    }, {"_id": 0}).to_list(5000)

    weeks = days_in_month / 7
    result = []
    for emp in staff:
        emp_shifts = [s for s in shifts if s["employee_id"] == emp["id"]]
        total = sum(get_shift_hours(s.get("template", "custom")) for s in emp_shifts)
        contract = emp.get("contract_hours", 36.0)
        expected = contract * weeks
        result.append({
            "employee_id": emp["employee_id"],
            "name": f"{emp['first_name']} {emp['last_name']}",
            "job_title": emp["job_title"],
            "employment_type": emp.get("employment_type", "permanent"),
            "contract_hours": contract,
            "scheduled_hours": total,
            "expected_hours": round(expected, 1),
            "overtime_hours": round(max(0, total - expected), 1),
            "shift_count": len(emp_shifts)
        })

    return {"year": year, "month": month, "overtime": result}

@api_router.post("/planner/validate")
async def validate_shift_assignment(req: PlannerAssignRequest, current_user: dict = Depends(get_current_user)):
    """Validate a proposed shift assignment without creating it"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    care_home = await db.care_homes.find_one({}, {"_id": 0})
    warnings = await validate_assignment(req.employee_id, req.shift_date, req.template, care_home["id"] if care_home else "")
    return {"warnings": warnings, "valid": len([w for w in warnings if w["type"] == "error"]) == 0}

@api_router.get("/planner/coverage")
async def get_coverage_report(date: str, current_user: dict = Depends(get_current_user)):
    """Get detailed coverage for a specific date"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    care_home = await db.care_homes.find_one({}, {"_id": 0})
    if not care_home:
        return {"date": date, "shifts": {}}

    shifts = await db.shifts.find({
        "care_home_id": care_home["id"],
        "shift_date": date,
        "status": {"$in": ["scheduled", "completed"]}
    }, {"_id": 0}).to_list(200)

    emp_ids = list(set(s["employee_id"] for s in shifts))
    employees = await db.employees.find(
        {"id": {"$in": emp_ids}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "job_title": 1, "employment_type": 1, "employee_id": 1}
    ).to_list(200)
    emp_map = {e["id"]: e for e in employees}

    result = {}
    for tpl_key, tpl in SHIFT_TEMPLATES.items():
        tpl_shifts = [s for s in shifts if s.get("template") == tpl_key]
        staff_list = []
        for s in tpl_shifts:
            emp = emp_map.get(s["employee_id"], {})
            staff_list.append({
                "shift_id": s["id"],
                "employee_id": emp.get("employee_id", ""),
                "name": f"{emp.get('first_name','')} {emp.get('last_name','')}",
                "job_title": emp.get("job_title", ""),
                "employment_type": emp.get("employment_type", "permanent"),
                "is_agency_cover": s.get("is_agency_cover", False)
            })
        nurse_c = sum(1 for st in staff_list if st["job_title"] == "nurse")
        carer_c = sum(1 for st in staff_list if st["job_title"] in ("carer", "senior_carer"))
        baseline_met = nurse_c >= COVERAGE_BASELINE["nurse"] and carer_c >= COVERAGE_BASELINE["carer"]
        overstaffed = nurse_c > COVERAGE_BASELINE["nurse"] + 1 and carer_c > COVERAGE_BASELINE["carer"] + 2
        result[tpl_key] = {
            "label": tpl["label"], "start": tpl["start"], "end": tpl["end"],
            "staff": staff_list, "total": len(staff_list),
            "nurses": nurse_c, "carers": carer_c,
            "baseline_met": baseline_met, "overstaffed": overstaffed
        }

    return {"date": date, "shifts": result, "baseline": COVERAGE_BASELINE}

@api_router.post("/planner/seed-month")
async def seed_planner_month(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Seed a month with sample shift assignments for testing"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    care_home = await db.care_homes.find_one({}, {"_id": 0})
    if not care_home:
        raise HTTPException(status_code=404, detail="No care home configured")

    import calendar
    days_in_month = calendar.monthrange(year, month)[1]

    staff = await db.employees.find(
        {"status": "active", "role": "staff", "care_home_id": care_home["id"]},
        {"_id": 0}
    ).to_list(200)
    if not staff:
        return {"success": False, "message": "No active staff found"}

    # Clear existing shifts for this month
    first_day = f"{year}-{month:02d}-01"
    last_day = f"{year}-{month:02d}-{days_in_month:02d}"
    await db.shifts.delete_many({"care_home_id": care_home["id"], "shift_date": {"$gte": first_day, "$lte": last_day}})

    templates_list = ["early", "late", "night", "long_day"]
    created = 0

    for emp_idx, emp in enumerate(staff):
        for day in range(1, days_in_month + 1):
            # Give each staff 4-5 shifts per week (skip ~2 days)
            if (day + emp_idx) % 7 in (0, 6):
                continue
            date_str = f"{year}-{month:02d}-{day:02d}"
            tpl_key = templates_list[(emp_idx + day) % len(templates_list)]
            tpl = SHIFT_TEMPLATES[tpl_key]
            shift = Shift(
                employee_id=emp["id"],
                care_home_id=care_home["id"],
                shift_date=date_str,
                start_time=tpl["start"],
                end_time=tpl["end"],
                template=tpl_key,
                shift_type="regular",
                is_agency_cover=emp.get("employment_type") == "agency",
                assigned_by=current_user["id"]
            )
            await db.shifts.insert_one(serialize_datetime(shift.model_dump()))
            created += 1

    return {"success": True, "shifts_created": created}

# ============ PHASE 5A: STAFF MANAGEMENT ============

class CreateEmployeeRequest(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str = "staff"
    job_title: str
    employment_type: str = "permanent"
    contract_hours: float = 36.0
    shift_preferences: List[str] = Field(default_factory=list)

class UpdateEmployeeRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    employment_type: Optional[str] = None
    contract_hours: Optional[float] = None
    shift_preferences: Optional[List[str]] = None

def generate_employee_id(job_title, existing_ids):
    """Generate a sequential employee ID like NRS003, CAR005"""
    prefix_map = {
        "nurse": "NRS", "senior_carer": "SCR", "carer": "CAR",
        "activities": "ACT", "kitchen": "KIT", "maintenance": "MNT",
        "care_manager": "MGR", "administrator": "ADM"
    }
    prefix = prefix_map.get(job_title, "EMP")
    nums = [int(eid.replace(prefix, "")) for eid in existing_ids if eid.startswith(prefix) and eid.replace(prefix, "").isdigit()]
    next_num = max(nums, default=0) + 1
    return f"{prefix}{next_num:03d}"

def generate_pin():
    """Generate random 4-digit PIN"""
    import random
    return f"{random.randint(1000, 9999)}"

@api_router.post("/employees/create")
async def create_employee(req: CreateEmployeeRequest, current_user: dict = Depends(get_current_user)):
    """Create a new employee with auto-generated ID, PIN, and TOTP secret"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    care_home = await db.care_homes.find_one({}, {"_id": 0})
    if not care_home:
        raise HTTPException(status_code=404, detail="No care home configured")

    existing_ids = [e["employee_id"] for e in await db.employees.find({}, {"_id": 0, "employee_id": 1}).to_list(500)]
    employee_id = generate_employee_id(req.job_title, existing_ids)
    pin = generate_pin()
    totp_secret = generate_totp_secret()

    emp = Employee(
        employee_id=employee_id,
        care_home_id=care_home["id"],
        first_name=req.first_name,
        last_name=req.last_name,
        email=req.email,
        phone=req.phone,
        role=req.role,
        job_title=req.job_title,
        employment_type=req.employment_type,
        contract_hours=req.contract_hours,
        shift_preferences=req.shift_preferences,
        pin_hash=hash_pin(pin),
        totp_secret=totp_secret,
        totp_enrolled=True,
        status="active"
    )
    await db.employees.insert_one(serialize_datetime(emp.model_dump()))

    # Audit log
    await db.staff_audit.insert_one({
        "id": str(uuid.uuid4()),
        "employee_id": emp.id,
        "action": "created",
        "performed_by": current_user["id"],
        "performed_by_name": f"{current_user['first_name']} {current_user['last_name']}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return {
        "success": True,
        "employee_id": employee_id,
        "pin": pin,
        "name": f"{req.first_name} {req.last_name}",
        "totp_secret": totp_secret
    }

@api_router.put("/employees/{emp_id}/update")
async def update_employee(emp_id: str, req: UpdateEmployeeRequest, current_user: dict = Depends(get_current_user)):
    """Update employee details"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    update = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.employees.update_one({"id": emp_id}, {"$set": update})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")

    await db.staff_audit.insert_one({
        "id": str(uuid.uuid4()), "employee_id": emp_id, "action": "updated",
        "details": str(update), "performed_by": current_user["id"],
        "performed_by_name": f"{current_user['first_name']} {current_user['last_name']}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True}

@api_router.put("/employees/{emp_id}/reset-pin")
async def reset_pin(emp_id: str, current_user: dict = Depends(get_current_user)):
    """Reset employee PIN — returns new PIN for manager to hand-copy"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    new_pin = generate_pin()
    result = await db.employees.update_one(
        {"id": emp_id},
        {"$set": {"pin_hash": hash_pin(new_pin), "failed_attempts": 0, "lockout_until": None, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0, "first_name": 1, "last_name": 1, "employee_id": 1})

    await db.staff_audit.insert_one({
        "id": str(uuid.uuid4()), "employee_id": emp_id, "action": "pin_reset",
        "performed_by": current_user["id"],
        "performed_by_name": f"{current_user['first_name']} {current_user['last_name']}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return {
        "success": True,
        "new_pin": new_pin,
        "employee_id": emp["employee_id"] if emp else "",
        "name": f"{emp['first_name']} {emp['last_name']}" if emp else ""
    }

@api_router.put("/employees/{emp_id}/reset-totp")
async def reset_totp(emp_id: str, current_user: dict = Depends(get_current_user)):
    """Reset TOTP secret — requires re-enrollment on mobile app"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    new_secret = generate_totp_secret()
    result = await db.employees.update_one(
        {"id": emp_id},
        {"$set": {"totp_secret": new_secret, "totp_enrolled": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")

    await db.staff_audit.insert_one({
        "id": str(uuid.uuid4()), "employee_id": emp_id, "action": "totp_reset",
        "performed_by": current_user["id"],
        "performed_by_name": f"{current_user['first_name']} {current_user['last_name']}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "message": "TOTP secret reset. Staff member must re-enroll on mobile app."}

@api_router.put("/employees/{emp_id}/deactivate")
async def deactivate_employee(emp_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")
    result = await db.employees.update_one({"id": emp_id}, {"$set": {"status": "inactive", "updated_at": datetime.now(timezone.utc).isoformat()}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.staff_audit.insert_one({
        "id": str(uuid.uuid4()), "employee_id": emp_id, "action": "deactivated",
        "performed_by": current_user["id"],
        "performed_by_name": f"{current_user['first_name']} {current_user['last_name']}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True}

@api_router.put("/employees/{emp_id}/activate")
async def activate_employee(emp_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")
    result = await db.employees.update_one({"id": emp_id}, {"$set": {"status": "active", "updated_at": datetime.now(timezone.utc).isoformat()}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.staff_audit.insert_one({
        "id": str(uuid.uuid4()), "employee_id": emp_id, "action": "activated",
        "performed_by": current_user["id"],
        "performed_by_name": f"{current_user['first_name']} {current_user['last_name']}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True}

# ============ PHASE 4C: LEAVE & AVAILABILITY ============

@api_router.get("/leave/overview")
async def get_leave_overview(year: int = None, current_user: dict = Depends(get_current_user)):
    """Manager view: all staff leave balances, approved vs pending, sickness trends"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    care_home_id = current_user["care_home_id"]
    yr = year or datetime.now(timezone.utc).year

    staff = await db.employees.find(
        {"care_home_id": care_home_id, "status": {"$in": ["active", "on_leave"]}, "role": "staff"},
        {"_id": 0, "id": 1, "employee_id": 1, "first_name": 1, "last_name": 1, "job_title": 1, "employment_type": 1}
    ).to_list(200)

    all_leave = await db.leave_requests.find(
        {"care_home_id": care_home_id, "start_date": {"$gte": f"{yr}-01-01", "$lte": f"{yr}-12-31"}},
        {"_id": 0}
    ).to_list(5000)

    ANNUAL_ENTITLEMENT = 28
    staff_data = []
    for emp in staff:
        emp_leave = [l for l in all_leave if l["employee_id"] == emp["id"]]

        # Count actual days used (approved annual)
        annual_used = 0
        for l in emp_leave:
            if l["leave_type"] == "annual" and l["status"] == "approved":
                d1 = datetime.fromisoformat(l["start_date"]).date()
                d2 = datetime.fromisoformat(l["end_date"]).date()
                annual_used += (d2 - d1).days + 1

        # Pending requests
        pending = [l for l in emp_leave if l["status"] == "pending"]

        # Sick leave stats
        sick_episodes = [l for l in emp_leave if l["leave_type"] == "sick"]
        sick_approved = [l for l in sick_episodes if l["status"] == "approved"]
        sick_days = 0
        for l in sick_approved:
            d1 = datetime.fromisoformat(l["start_date"]).date()
            d2 = datetime.fromisoformat(l["end_date"]).date()
            sick_days += (d2 - d1).days + 1

        # Return-to-work flag: has a recent sick leave that ended within last 7 days
        rtw_needed = False
        today = datetime.now(timezone.utc).date()
        for l in sick_approved:
            end = datetime.fromisoformat(l["end_date"]).date()
            if 0 <= (today - end).days <= 7:
                rtw_needed = True
                break

        staff_data.append({
            "employee_id": emp["employee_id"],
            "internal_id": emp["id"],
            "name": f"{emp['first_name']} {emp['last_name']}",
            "job_title": emp["job_title"],
            "employment_type": emp.get("employment_type", "permanent"),
            "annual_entitlement": ANNUAL_ENTITLEMENT,
            "annual_used": annual_used,
            "annual_remaining": max(0, ANNUAL_ENTITLEMENT - annual_used),
            "pending_requests": len(pending),
            "sick_episodes": len(sick_approved),
            "sick_days": sick_days,
            "rtw_needed": rtw_needed,
            "leave_requests": emp_leave
        })

    return {"year": yr, "staff": staff_data}

@api_router.get("/leave/sickness-trends/{employee_id}")
async def get_sickness_trends(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get sickness frequency and pattern for a staff member"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    sick_leave = await db.leave_requests.find(
        {"employee_id": employee_id, "leave_type": "sick", "status": "approved"},
        {"_id": 0}
    ).sort("start_date", -1).to_list(100)

    episodes = []
    total_days = 0
    monthly_counts = {}
    for l in sick_leave:
        d1 = datetime.fromisoformat(l["start_date"]).date()
        d2 = datetime.fromisoformat(l["end_date"]).date()
        days = (d2 - d1).days + 1
        total_days += days
        month_key = d1.strftime("%Y-%m")
        monthly_counts[month_key] = monthly_counts.get(month_key, 0) + days
        episodes.append({
            "id": l["id"],
            "start_date": l["start_date"],
            "end_date": l["end_date"],
            "days": days,
            "reason": l.get("reason", ""),
            "sick_note": l.get("sick_note_provided", False),
            "rtw_completed": l.get("rtw_completed", False)
        })

    # Bradford factor: S^2 * D where S=episodes, D=total days
    bradford = len(episodes) ** 2 * total_days if episodes else 0

    return {
        "employee_id": employee_id,
        "total_episodes": len(episodes),
        "total_days": total_days,
        "bradford_factor": bradford,
        "monthly_breakdown": monthly_counts,
        "episodes": episodes
    }

@api_router.put("/leave/mark-rtw/{leave_id}")
async def mark_leave_rtw_complete(leave_id: str, notes: str = "", current_user: dict = Depends(get_current_user)):
    """Mark a sick leave episode as return-to-work completed"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")
    result = await db.leave_requests.update_one(
        {"id": leave_id},
        {"$set": {"rtw_completed": True, "rtw_notes": notes, "rtw_by": current_user["id"], "rtw_date": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Leave request not found")
    return {"success": True}

# ============ PHASE 4D: PERFORMANCE & OPERATIONAL ============

@api_router.get("/manager/notes/{employee_id}")
async def get_manager_notes(employee_id: str, current_user: dict = Depends(get_current_user)):
    """Get private manager notes for a staff member"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")
    notes = await db.manager_notes.find(
        {"employee_id": employee_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"notes": notes}

@api_router.post("/manager/notes/{employee_id}")
async def add_manager_note(employee_id: str, content: str, current_user: dict = Depends(get_current_user)):
    """Add a private manager note for a staff member"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")
    note = {
        "id": str(uuid.uuid4()),
        "employee_id": employee_id,
        "content": content,
        "created_by": current_user["id"],
        "created_by_name": f"{current_user['first_name']} {current_user['last_name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.manager_notes.insert_one(note)
    note.pop("_id", None)
    return {"success": True, "note": note}

@api_router.delete("/manager/notes/{note_id}")
async def delete_manager_note(note_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")
    result = await db.manager_notes.delete_one({"id": note_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True}

@api_router.get("/operational/heatmap")
async def get_staffing_heatmap(year: int, month: int, current_user: dict = Depends(get_current_user)):
    """Staffing heatmap: total staff per day per shift for the month"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    import calendar as cal_mod
    days_in_month = cal_mod.monthrange(year, month)[1]
    first = f"{year}-{month:02d}-01"
    last = f"{year}-{month:02d}-{days_in_month:02d}"

    care_home_id = current_user["care_home_id"]
    shifts = await db.shifts.find({
        "care_home_id": care_home_id,
        "shift_date": {"$gte": first, "$lte": last},
        "status": {"$in": ["scheduled", "completed"]}
    }, {"_id": 0}).to_list(5000)

    staff = await db.employees.find(
        {"care_home_id": care_home_id, "status": "active", "role": "staff"},
        {"_id": 0, "id": 1, "job_title": 1}
    ).to_list(200)
    job_map = {e["id"]: e["job_title"] for e in staff}

    heatmap = {}
    for day in range(1, days_in_month + 1):
        ds = f"{year}-{month:02d}-{day:02d}"
        day_shifts = [s for s in shifts if s["shift_date"] == ds]
        day_data = {"total": len(day_shifts)}
        for tpl_key in SHIFT_TEMPLATES:
            tpl_s = [s for s in day_shifts if s.get("template") == tpl_key]
            n = sum(1 for s in tpl_s if job_map.get(s["employee_id"]) == "nurse")
            c = sum(1 for s in tpl_s if job_map.get(s["employee_id"]) in ("carer", "senior_carer"))
            baseline_met = n >= COVERAGE_BASELINE["nurse"] and c >= COVERAGE_BASELINE["carer"]
            day_data[tpl_key] = {"total": len(tpl_s), "nurses": n, "carers": c, "baseline_met": baseline_met}
        heatmap[ds] = day_data

    return {"year": year, "month": month, "heatmap": heatmap}

@api_router.get("/operational/under-coverage")
async def get_under_coverage_alerts(current_user: dict = Depends(get_current_user)):
    """Get future dates with shifts below baseline coverage"""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    care_home_id = current_user["care_home_id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    future_end = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")

    shifts = await db.shifts.find({
        "care_home_id": care_home_id,
        "shift_date": {"$gte": today, "$lte": future_end},
        "status": "scheduled"
    }, {"_id": 0}).to_list(5000)

    staff = await db.employees.find(
        {"care_home_id": care_home_id, "status": "active", "role": "staff"},
        {"_id": 0, "id": 1, "job_title": 1}
    ).to_list(200)
    job_map = {e["id"]: e["job_title"] for e in staff}

    alerts = []
    dates_checked = set()
    for s in shifts:
        ds = s["shift_date"]
        tpl = s.get("template", "")
        key = f"{ds}_{tpl}"
        if key in dates_checked:
            continue
        dates_checked.add(key)

        tpl_shifts = [x for x in shifts if x["shift_date"] == ds and x.get("template") == tpl]
        n = sum(1 for x in tpl_shifts if job_map.get(x["employee_id"]) == "nurse")
        c = sum(1 for x in tpl_shifts if job_map.get(x["employee_id"]) in ("carer", "senior_carer"))
        tpl_info = SHIFT_TEMPLATES.get(tpl, {})

        if n < COVERAGE_BASELINE["nurse"] or c < COVERAGE_BASELINE["carer"]:
            alerts.append({
                "date": ds,
                "shift": tpl_info.get("label", tpl),
                "time": f"{tpl_info.get('start','')}-{tpl_info.get('end','')}",
                "nurses": n, "nurses_needed": COVERAGE_BASELINE["nurse"],
                "carers": c, "carers_needed": COVERAGE_BASELINE["carer"]
            })

    alerts.sort(key=lambda a: (a["date"], a["shift"]))
    return {"alerts": alerts[:50]}

@api_router.get("/")
async def root():
    return {"message": "CareHome Clocking System API", "version": "1.0.0"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
