"""
OpenClaw Service
Runtime bridge to an OpenClaw gateway for agentic task execution.

Follows the same contract as the Agent Zero (main.py) and Crew AI (crew_main.py)
runtimes: JWT-authenticated /api/execute + /health. Tasks are forwarded to a
configured OpenClaw gateway over HTTP; with no gateway configured the service
fails loud (503) instead of pretending to execute. The gateway execute path and
payload contract are env-configurable because OpenClaw's control API is
version-dependent.
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import logging
from datetime import datetime
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

NODE_ENV = os.getenv("NODE_ENV", "development")
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "https://www.gpexts.com,http://localhost:7503,http://localhost:5173").split(",")

app = FastAPI(title="OpenClaw Service", version="1.0.0")

# CORS middleware - not wildcard with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_jwt_secret() -> str:
    """Resolve the JWT signing secret, failing loud rather than defaulting.

    A baked-in default secret is a signing-key forgery backdoor: anyone who knows it
    can mint tokens for any user. Production requires a strong, provisioned secret.
    """
    secret = os.getenv("JWT_SECRET", "").strip()
    if secret:
        if NODE_ENV == "production" and len(secret) < 32:
            raise RuntimeError("JWT_SECRET must be at least 32 characters in production")
        return secret
    if NODE_ENV == "production":
        raise RuntimeError("JWT_SECRET is required in production; refusing to start with a default")
    logger.warning(
        "JWT_SECRET not set — generating an ephemeral development secret (tokens are invalidated on restart)"
    )
    return os.urandom(48).hex()


JWT_SECRET = _resolve_jwt_secret()

# OpenClaw gateway configuration. The gateway is the only execution backend: with no
# URL configured, /api/execute fails loud instead of fabricating a result.
OPENCLAW_GATEWAY_URL = os.getenv("OPENCLAW_GATEWAY_URL", "").strip().rstrip("/")
OPENCLAW_GATEWAY_TOKEN = os.getenv("OPENCLAW_GATEWAY_TOKEN", "")
# OpenClaw's control API shape is version-dependent: the execute endpoint and payload
# contract are configurable so the bridge can track the deployed gateway version.
OPENCLAW_GATEWAY_EXECUTE_PATH = os.getenv("OPENCLAW_GATEWAY_EXECUTE_PATH", "/api/execute")
OPENCLAW_TIMEOUT_S = int(os.getenv("OPENCLAW_TIMEOUT_S", "30"))


async def verify_token(authorization: Optional[str] = Header(None)):
    """Verify JWT token from Authorization header (same contract as main.py)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="Empty token")

    # SECURITY: the dev-token shortcut is development-only AND must be explicitly
    # enabled (same gate as the Agent Zero runtime).
    if token == "dev-token":
        if NODE_ENV != "development" or os.getenv("ALLOW_DEV_TOKEN", "false").strip().lower() != "true":
            logger.warning("Rejected dev-token: dev-token login is disabled (set ALLOW_DEV_TOKEN=true for local dev)")
            raise HTTPException(status_code=401, detail="dev-token is not accepted")
        logger.warning("dev-token accepted: development mode with ALLOW_DEV_TOKEN=true")
        return {"user_id": "dev-user", "role": "admin"}

    try:
        import jwt
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


class TaskType(str, Enum):
    OUTREACH = "outreach"
    ANALYSIS = "analysis"
    REPORT = "report"
    STEALTH_SCRAPE = "stealth_scrape"


class TaskRequest(BaseModel):
    task_type: TaskType
    parameters: Dict[str, Any]
    callback: Optional[str] = None


def _require_gateway() -> str:
    """Return the configured gateway base URL, or fail loud if none is set."""
    if not OPENCLAW_GATEWAY_URL:
        raise HTTPException(
            status_code=503,
            detail="OpenClaw gateway is not configured (set OPENCLAW_GATEWAY_URL); the service refuses to fake execution",
        )
    return OPENCLAW_GATEWAY_URL


@app.get("/health")
async def health_check():
    """Health check endpoint — reports the real gateway state, never a fake healthy."""
    return {
        "status": "healthy",
        "service": "openclaw",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": {
            "gateway": "configured" if OPENCLAW_GATEWAY_URL else "not_configured",
        },
    }


@app.post("/api/execute")
async def execute_task(request: TaskRequest, current_user: dict = Depends(verify_token)):
    """Execute a task by forwarding it to the configured OpenClaw gateway."""
    task_id = f"task-{datetime.utcnow().timestamp():.0f}-openclaw-{request.task_type.value}"
    gateway_url = _require_gateway()
    logger.info(f"Executing task {task_id} via OpenClaw gateway for user: {current_user.get('user_id')}")

    import httpx

    headers = {"Content-Type": "application/json"}
    if OPENCLAW_GATEWAY_TOKEN:
        headers["Authorization"] = f"Bearer {OPENCLAW_GATEWAY_TOKEN}"

    payload = {
        "task_type": request.task_type.value,
        "parameters": request.parameters,
        # Attribution: the gateway can log which platform user requested the task.
        "requested_by": current_user.get("user_id"),
    }

    try:
        async with httpx.AsyncClient(timeout=OPENCLAW_TIMEOUT_S) as client:
            response = await client.post(
                f"{gateway_url}{OPENCLAW_GATEWAY_EXECUTE_PATH}",
                json=payload,
                headers=headers,
            )
        if response.status_code >= 400:
            detail = (response.text or "")[:300]
            raise HTTPException(
                status_code=502,
                detail=f"OpenClaw gateway returned {response.status_code}: {detail}",
            )
        result = response.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OpenClaw gateway task execution failed: {e}")
        raise HTTPException(status_code=502, detail=f"OpenClaw gateway unreachable: {e}")

    serialized = result if isinstance(result, dict) else {"result": result}

    if request.callback:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    request.callback,
                    json={"task_id": task_id, "status": "completed", "result": serialized},
                )
        except Exception as cb_err:
            logger.warning(f"Callback POST to {request.callback} failed: {cb_err}")

    return serialized
