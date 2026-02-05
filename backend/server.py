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
    employment_type: str = "permanent"  # permanent, agency
    status: str = "active"  # active, inactive, on_leave
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
    shift_type: str = "regular"  # regular, overtime, on_call
    status: str = "scheduled"  # scheduled, completed, missed, swapped
    notes: Optional[str] = None
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
    """Verify TOTP token with ±1 timestep tolerance"""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=1)

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
            # Increment failed attempts
            await db.employees.update_one(
                {"id": employee["id"]},
                {"$inc": {"failed_attempts": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Check if should lockout (5 attempts)
            if employee.get("failed_attempts", 0) >= 4:
                lockout_time = datetime.now(timezone.utc) + timedelta(minutes=15)
                await db.employees.update_one(
                    {"id": employee["id"]},
                    {"$set": {"lockout_until": lockout_time.isoformat()}}
                )
            
            # Log failed attempt
            await db.auth_events.insert_one(serialize_datetime({
                "id": str(uuid.uuid4()),
                "employee_id": employee["id"],
                "event_type": "totp_failed",
                "timestamp": datetime.now(timezone.utc)
            }))
            
            raise HTTPException(status_code=401, detail="Invalid TOTP token")
        
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
        
        return {"success": True, "action": "clock_out", "timestamp": now.isoformat()}

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

# ============ EMPLOYEE ROUTES ============

@api_router.get("/employees")
async def list_employees(current_user: dict = Depends(get_current_user)):
    """List all employees (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    employees = await db.employees.find(
        {"care_home_id": current_user["care_home_id"]},
        {"_id": 0, "pin_hash": 0, "totp_secret": 0}
    ).to_list(1000)
    
    return {"employees": employees}

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

@api_router.get("/employees/lookup/{employee_code}")
async def lookup_employee(employee_code: str):
    """Public endpoint to lookup employee by code (for demo mode)"""
    employee = await db.employees.find_one(
        {"employee_id": employee_code, "status": "active"},
        {"_id": 0, "pin_hash": 0, "totp_secret": 0}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
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

# ============ LEAVE REQUEST ROUTES ============

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
        {"$set": {"status": "approved", "approved_by": current_user["id"]}}
    )
    
    # Notify employee
    notification = Notification(
        care_home_id=leave_req["care_home_id"],
        recipient_id=leave_req["employee_id"],
        title="Leave Request Approved",
        content=f"Your {leave_req['leave_type']} leave request from {leave_req['start_date']} to {leave_req['end_date']} has been approved",
        notification_type="leave_approved",
        related_id=request_id
    )
    await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
    return {"success": True}

@api_router.put("/leave-requests/{request_id}/reject")
async def reject_leave_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Reject leave request (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    leave_req = await db.leave_requests.find_one({"id": request_id}, {"_id": 0})
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    await db.leave_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "approved_by": current_user["id"]}}
    )
    
    # Notify employee
    notification = Notification(
        care_home_id=leave_req["care_home_id"],
        recipient_id=leave_req["employee_id"],
        title="Leave Request Rejected",
        content=f"Your {leave_req['leave_type']} leave request from {leave_req['start_date']} to {leave_req['end_date']} has been rejected",
        notification_type="leave_rejected",
        related_id=request_id
    )
    await db.notifications.insert_one(serialize_datetime(notification.model_dump()))
    
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
    return {"success": True, "id": new_request.id}

@api_router.put("/day-requests/{request_id}/approve")
async def approve_day_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Approve day request (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.day_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "approved_by": current_user["id"]}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Day request not found")
    
    return {"success": True}

@api_router.put("/day-requests/{request_id}/reject")
async def reject_day_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Reject day request (manager/admin only)"""
    if current_user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.day_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "approved_by": current_user["id"]}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Day request not found")
    
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
