"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
import json
import os
from pathlib import Path
import secrets
import time

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
TEACHERS_FILE = current_dir / "teachers.json"

SESSION_COOKIE_NAME = "admin_session"
SESSION_TTL_SECONDS = 60 * 60 * 8  # 8 hours
_sessions = {}


class LoginRequest(BaseModel):
    username: str
    password: str


def _load_teachers() -> dict:
    """Loads teacher credentials from a JSON file.

    Expected format:
    {"teachers": [{"username": "...", "password": "..."}]}
    """
    if not TEACHERS_FILE.exists():
        return {}

    try:
        raw = json.loads(TEACHERS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    teachers = {}
    for entry in raw.get("teachers", []):
        username = str(entry.get("username", "")).strip()
        password = str(entry.get("password", ""))
        if username:
            teachers[username] = password
    return teachers


def _get_teacher_from_session_token(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    session = _sessions.get(token)
    if not session:
        return None
    if time.time() > session.get("expires_at", 0):
        _sessions.pop(token, None)
        return None
    return session.get("username")


def _require_teacher(token: Optional[str]) -> str:
    username = _get_teacher_from_session_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Teacher login required")
    return username


def _set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_SECONDS,
        path="/",
    )


def _clear_auth_cookie(response: Response):
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")

app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.get("/auth/me")
def auth_me(admin_session: Optional[str] = Cookie(default=None)):
    username = _get_teacher_from_session_token(admin_session)
    if not username:
        return {"authenticated": False}
    return {"authenticated": True, "username": username}


@app.post("/auth/login")
def auth_login(payload: LoginRequest, response: Response):
    teachers = _load_teachers()
    expected_password = teachers.get(payload.username)
    if expected_password is None or expected_password != payload.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "username": payload.username,
        "expires_at": time.time() + SESSION_TTL_SECONDS,
    }
    _set_auth_cookie(response, token)
    return {"authenticated": True, "username": payload.username}


@app.post("/auth/logout")
def auth_logout(response: Response, admin_session: Optional[str] = Cookie(default=None)):
    if admin_session:
        _sessions.pop(admin_session, None)
    _clear_auth_cookie(response)
    return {"authenticated": False}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, admin_session: Optional[str] = Cookie(default=None)):
    """Sign up a student for an activity"""
    _require_teacher(admin_session)
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, admin_session: Optional[str] = Cookie(default=None)):
    """Unregister a student from an activity"""
    _require_teacher(admin_session)
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
