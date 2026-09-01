"""
Agent Zero Service
Autonomous AI agent for farmer outreach, data analysis, and report generation.
Production-ready implementation with database integration and authentication.
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import json
import logging
import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
import redis.asyncio as redis

# Import Stealth Scraper
from tools.cloakbrowser.cloak_scanner import CloakBrowserScanner
from tools.slop_cleaner import clean_slop

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

NODE_ENV = os.getenv("NODE_ENV", "development")
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "https://www.gpexts.com,http://localhost:7503,http://localhost:5173").split(",")

app = FastAPI(title="Agent Zero Service", version="2.0.0")

# CORS middleware - not wildcard with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables with validation
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
SESSION_TTL = int(os.getenv("SESSION_TTL_SECONDS", "86400"))  # 24h default

if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY not configured - AI features will be limited")

# ----------------------------------------------------------------
# Redis Session Manager — enables state survival across restarts
# ----------------------------------------------------------------

class RedisSessionManager:
    """Redis-backed session persistence for agent tasks and results.
    
    Stores task history, analysis results, outreach records, and report
    data so that agent state survives container restarts.  Each session
    is keyed by task ID with a configurable TTL.
    """

    def __init__(self, redis_url: str, ttl: int = 86400):
        self._redis_url = redis_url
        self._ttl = ttl
        self._client: Optional[redis.Redis] = None

    @property
    def connected(self) -> bool:
        return self._client is not None

    async def connect(self) -> bool:
        """Establish Redis connection. Returns True on success."""
        try:
            self._client = redis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
            )
            await self._client.ping()
            logger.info("Redis session store connected")
            return True
        except Exception as e:
            logger.warning(f"Redis unavailable — sessions will be ephemeral: {e}")
            self._client = None
            return False

    async def disconnect(self):
        """Gracefully close the Redis connection."""
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("Redis session store disconnected")

    async def save_session(self, task_id: str, data: dict) -> bool:
        """Persist a task result to Redis."""
        if not self._client:
            return False
        try:
            key = f"agent:session:{task_id}"
            payload = json.dumps(data, default=str)
            async with self._client.pipeline(transaction=True) as pipe:
                pipe.setex(key, self._ttl, payload)
                score = datetime.utcnow().timestamp()
                pipe.zadd("agent:sessions:index", {key: score})
                # Keep index bounded — retain last 1000 sessions
                pipe.zremrangebyrank("agent:sessions:index", 0, -1001)
                await pipe.execute()
            logger.debug(f"Session {task_id} saved to Redis")
            return True
        except Exception as e:
            logger.error(f"Failed to save session {task_id}: {e}")
            return False

    async def load_session(self, task_id: str) -> Optional[dict]:
        """Retrieve a previously persisted session."""
        if not self._client:
            return None
        try:
            key = f"agent:session:{task_id}"
            raw = await self._client.get(key)
            return json.loads(raw) if raw else None
        except Exception as e:
            logger.error(f"Failed to load session {task_id}: {e}")
            return None

    async def list_sessions(self, limit: int = 20) -> list[dict]:
        """Return recent sessions ordered by timestamp (newest first)."""
        if not self._client:
            return []
        try:
            keys = await self._client.zrevrange("agent:sessions:index", 0, limit - 1)
            if not keys:
                return []
            pipeline = self._client.pipeline()
            for k in keys:
                pipeline.get(k)
            results = await pipeline.execute()
            return [json.loads(r) for r in results if r]
        except Exception as e:
            logger.error(f"Failed to list sessions: {e}")
            return []

    async def delete_session(self, task_id: str) -> bool:
        """Remove a session from Redis."""
        if not self._client:
            return False
        try:
            key = f"agent:session:{task_id}"
            await self._client.delete(key)
            await self._client.zrem("agent:sessions:index", key)
            return True
        except Exception as e:
            logger.error(f"Failed to delete session {task_id}: {e}")
            return False

redis_sessions = RedisSessionManager(REDIS_URL, SESSION_TTL)

# Import OpenAI for real AI processing (async client)
try:
    from openai import AsyncOpenAI
    async_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
except ImportError:
    async_client = None
    logger.warning("OpenAI library not installed - AI features unavailable")


# Authentication dependency
async def verify_token(authorization: Optional[str] = Header(None)):
    """Verify JWT token from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ")[1]

    # SECURITY: Only accept dev-token in development
    if token == "dev-token":
        if NODE_ENV == "production":
            raise HTTPException(status_code=401, detail="dev-token not accepted in production")
        return {"user_id": "dev-user", "role": "admin"}

    if not token:
        raise HTTPException(status_code=401, detail="Empty token")

    try:
        import jwt
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# Database connection pool (thread-safe)
class DatabaseManager:
    """Thread-safe database manager using connection pool"""

    def __init__(self):
        self.pool = None

    def connect(self):
        """Establish database connection pool"""
        if not DATABASE_URL:
            logger.warning("DATABASE_URL not configured")
            return None

        try:
            import psycopg2.pool
            self.pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=DATABASE_URL
            )
            logger.info("Database connection pool established")
            return self.pool
        except ImportError:
            logger.warning("psycopg2 not installed - database features unavailable")
            return None
        except Exception as e:
            logger.error(f"Database connection pool failed: {e}")
            return None

    def execute_query(self, query: str, params: tuple = None):
        """Execute a database query using a pooled connection"""
        if not self.pool:
            self.connect()

        if not self.pool:
            return None

        conn = self.pool.getconn()
        try:
            cursor = conn.cursor()
            cursor.execute(query, params)
            # Only fetch results for SELECT queries
            if cursor.description:
                result = cursor.fetchall()
            else:
                conn.commit()
                result = None
            return result
        except Exception as e:
            conn.rollback()
            logger.error(f"Query execution failed: {e}")
            return None
        finally:
            self.pool.putconn(conn)

    def close(self):
        """Close all pool connections"""
        if self.pool:
            self.pool.closeall()
            self.pool = None

db = DatabaseManager()


# Request/Response models
class TaskType(str, Enum):
    OUTREACH = "outreach"
    ANALYSIS = "analysis"
    REPORT = "report"
    STEALTH_SCRAPE = "stealth_scrape"


class TaskRequest(BaseModel):
    task_type: TaskType
    parameters: Dict[str, Any]
    callback: Optional[str] = None


class OutreachRequest(BaseModel):
    farmers: List[Dict[str, Any]]
    message: str
    channel: str = "sms"  # sms, email, whatsapp
    priority: str = "normal"  # low, normal, high, urgent


class AnalysisRequest(BaseModel):
    region: str
    data_type: str  # weather, crops, market, soil
    time_period: str = "7d"
    include_recommendations: bool = True


class ReportRequest(BaseModel):
    region: str
    period: str  # daily, weekly, monthly
    include_charts: bool = True
    sections: Optional[List[str]] = None


class AnalysisResult(BaseModel):
    region: str
    data_type: str
    time_period: str
    summary: Dict[str, Any]
    recommendations: List[str]
    risk_level: str
    confidence: float
    generated_at: str
    data_sources: List[str]


# AI Processing Service
class AIProcessingService:
    """Service for AI-powered analysis and generation"""

    @staticmethod
    async def analyze_data(region: str, data_type: str, time_period: str) -> AnalysisResult:
        """Perform real AI-powered data analysis"""

        context = f"""
        Analyze agricultural conditions for {region} focusing on {data_type} over the last {time_period}.
        Consider weather patterns, crop conditions, market trends, and soil health.
        Provide actionable insights and recommendations for farmers.
        """

        if async_client:
            try:
                # Use async client — does not block event loop
                response = await async_client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are an expert agricultural analyst providing insights for farmers."},
                        {"role": "user", "content": context}
                    ],
                    temperature=0.3,
                    max_tokens=1500
                )

                analysis_text = clean_slop(response.choices[0].message.content)

                return AIProcessingService._parse_analysis_response(
                    region, data_type, time_period, analysis_text
                )

            except Exception as e:
                logger.error(f"AI analysis failed: {e}")
                return AIProcessingService._get_fallback_analysis(region, data_type, time_period)
        else:
            return AIProcessingService._get_fallback_analysis(region, data_type, time_period)

    @staticmethod
    def _parse_analysis_response(region: str, data_type: str, time_period: str, text: str) -> AnalysisResult:
        """Parse AI text response into structured AnalysisResult"""

        risk_level = "medium"
        if "high risk" in text.lower() or "critical" in text.lower():
            risk_level = "high"
        elif "low risk" in text.lower() or "minimal" in text.lower():
            risk_level = "low"

        recommendations = []
        for line in text.split('\n'):
            line = line.strip()
            if line and any(keyword in line.lower() for keyword in ['recommend', 'suggest', 'consider', 'should']):
                recommendations.append(line)

        if not recommendations:
            recommendations = [
                "Monitor weather conditions regularly",
                "Check soil moisture levels",
                "Review market prices before selling"
            ]

        return AnalysisResult(
            region=region,
            data_type=data_type,
            time_period=time_period,
            summary={
                "analysis": text[:500] + "..." if len(text) > 500 else text,
            },
            recommendations=recommendations[:5],
            risk_level=risk_level,
            confidence=None,
            generated_at=datetime.utcnow().isoformat(),
            data_sources=["ai_interpretation"]
        )

    @staticmethod
    def _get_fallback_analysis(region: str, data_type: str, time_period: str) -> AnalysisResult:
        """Fallback analysis when AI is unavailable — clearly marked as fallback"""
        return AnalysisResult(
            region=region,
            data_type=data_type,
            time_period=time_period,
            summary={
                "analysis": f"[FALLBACK] Analysis for {region} focusing on {data_type} over {time_period}. AI provider unavailable.",
                "total_farmers": 0,
                "avg_yield": "N/A",
                "weather_impact": "unknown"
            },
            recommendations=[
                "Monitor local weather forecasts",
                "Check soil conditions regularly",
                "Review current market prices",
                "Plan for upcoming planting season",
                "Consider crop rotation strategies"
            ],
            risk_level="unknown",
            confidence=0.0,
            generated_at=datetime.utcnow().isoformat(),
            data_sources=["fallback_stub"]
        )


# Outreach Service
class OutreachService:
    """Service for managing farmer outreach"""

    @staticmethod
    async def send_outreach(farmers: List[Dict], message: str, channel: str, priority: str) -> Dict:
        """Send outreach messages to farmers"""

        results = []
        failed = []

        for farmer in farmers:
            try:
                result = {
                    "farmer_id": farmer.get("id"),
                    "farmer_name": f"{farmer.get('first_name', '')} {farmer.get('last_name', '')}",
                    "contact": farmer.get("phone") or farmer.get("email"),
                    "status": "queued",
                    "channel": channel,
                    "message": message,
                    "priority": priority,
                    "timestamp": datetime.utcnow().isoformat()
                }

                # Persist the channel-appropriate contact so the consumer
                # worker can deliver without re-resolving producer-only fields
                # (e.g. email, which the farmers table does not store).
                recipient = farmer.get("email") if channel == "email" else farmer.get("phone")

                # Log to database if available
                db.execute_query(
                    """INSERT INTO outreach_messages
                       (farmer_id, message, channel, status, priority, recipient, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, NOW())""",
                    (farmer.get("id"), message, channel, "queued", priority, recipient)
                )

                results.append(result)

            except Exception as e:
                logger.error(f"Failed to queue outreach for farmer {farmer.get('id')}: {e}")
                failed.append({
                    "farmer_id": farmer.get("id"),
                    "error": str(e)
                })

        return {
            "success": True,
            "total": len(farmers),
            "queued": len(results),
            "failed": len(failed),
            "results": results,
            "failures": failed
        }


# Report Generation Service
class ReportService:
    """Service for generating agricultural reports"""

    @staticmethod
    async def generate_report(region: str, period: str, sections: List[str]) -> Dict:
        """Generate comprehensive agricultural report"""

        if not sections:
            sections = ["Executive Summary", "Weather Overview", "Crop Status", "Market Prices", "Recommendations"]

        report_sections = []
        fallback_used = False

        for section in sections:
            section_content, is_fallback = await ReportService._generate_section(region, period, section)
            if is_fallback:
                fallback_used = True
            report_sections.append({
                "title": section,
                "content": section_content
            })

        report = {
            "id": f"report-{datetime.utcnow().timestamp()}",
            "region": region,
            "period": period,
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": "agent-zero",
            "sections": report_sections,
            "status": "generated_without_live_data" if fallback_used else "completed",
            "data_status": "partial" if fallback_used else "live"
        }

        # Store in database if available
        db.execute_query(
            """INSERT INTO reports
               (type, title, content, status, created_at, updated_at)
               VALUES (%s, %s, %s, %s, NOW(), NOW())""",
            ("automated", f"{period} Report - {region}", json.dumps(report), report["status"])
        )

        return report

    @staticmethod
    async def _generate_section(region: str, period: str, section: str):
        """Generate content for a specific report section. Returns (content, is_fallback)."""

        if async_client:
            try:
                response = await async_client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are an expert agricultural report writer."},
                        {"role": "user", "content": f"Write the '{section}' section for a {period} agricultural report for {region}."}
                    ],
                    temperature=0.3,
                    max_tokens=1000
                )
                return clean_slop(response.choices[0].message.content), False
            except Exception as e:
                logger.error(f"AI section generation failed: {e}")

        return ReportService._get_fallback_section_content(region, period, section), True

    @staticmethod
    def _get_fallback_section_content(region: str, period: str, section: str) -> str:
        """Fallback section content when AI is unavailable — clearly marked"""

        content_map = {
            "Executive Summary": f"[UNAVAILABLE] Live data for {region} is currently unavailable. This is a placeholder summary based on regional norms.",
            "Weather Overview": f"[UNAVAILABLE] Live weather data for {region} is currently unavailable. Seasonal norms suggest moderate conditions.",
            "Crop Status": f"[UNAVAILABLE] Live crop status for {region} is currently unavailable. Crop progress may vary from seasonal norms.",
            "Market Prices": f"[UNAVAILABLE] Live market data for {region} is currently unavailable. Check local markets for current prices.",
            "Recommendations": f"[UNAVAILABLE] Without live data, specific recommendations for {region} cannot be generated. Consult your local extension officer."
        }

        return content_map.get(section, f"[UNAVAILABLE] Content for {section} is unavailable. Please retry when live data is accessible.")


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "agent-zero",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": {
            "openai": "configured" if async_client else "not_configured",
            "database": "connected" if db.pool else "not_connected",
            "redis": "connected" if redis_sessions.connected else "not_connected"
        }
    }


@app.post("/api/execute")
async def execute_task(request: TaskRequest, current_user: dict = Depends(verify_token)):
    """Execute a general task using Agent Zero"""
    task_id = f"task-{datetime.utcnow().timestamp():.0f}-{request.task_type.value}"
    logger.info(f"Executing task {task_id}: {request.task_type} for user: {current_user.get('user_id')}")

    try:
        task_type = request.task_type

        if task_type == TaskType.OUTREACH:
            result = await handle_outreach(request.parameters)
        elif task_type == TaskType.ANALYSIS:
            result = await handle_analysis(request.parameters)
        elif task_type == TaskType.REPORT:
            result = await handle_report(request.parameters)
        elif task_type == TaskType.STEALTH_SCRAPE:
            result = await handle_stealth_scrape(request.parameters)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown task type: {task_type}")

        # Normalise result to JSON-serializable dict
        if hasattr(result, 'model_dump'):
            serialized = result.model_dump()
        elif hasattr(result, 'dict'):
            serialized = result.dict()
        elif isinstance(result, dict):
            serialized = result
        else:
            serialized = str(result)

        # Persist session for recovery across restarts
        session = {
            "task_id": task_id,
            "task_type": request.task_type.value,
            "user_id": current_user.get("user_id"),
            "parameters": request.parameters,
            "result": serialized,
            "status": "completed",
            "created_at": datetime.utcnow().isoformat(),
        }
        await redis_sessions.save_session(task_id, session)
        # Webhook callback when caller supplied callback URL
        if request.callback:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post(request.callback, json={"task_id": task_id, "status": "completed", "result": serialized})
            except Exception as cb_err:
                logger.warn(f"Callback POST to {request.callback} failed: {cb_err}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Task execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions")
async def list_sessions(limit: int = 20, current_user: dict = Depends(verify_token)):
    """Retrieve recent agent session history (survives restarts)."""
    sessions = await redis_sessions.list_sessions(limit)
    return {"success": True, "data": sessions, "count": len(sessions)}


@app.get("/api/sessions/{task_id}")
async def get_session(task_id: str, current_user: dict = Depends(verify_token)):
    """Retrieve a specific agent session by task ID."""
    session = await redis_sessions.load_session(task_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "data": session}


@app.post("/api/outreach")
async def schedule_outreach(request: OutreachRequest, current_user: dict = Depends(verify_token)):
    """Schedule automated farmer outreach"""
    logger.info(f"Scheduling outreach for {len(request.farmers)} farmers via {request.channel}")

    try:
        result = await OutreachService.send_outreach(
            request.farmers,
            request.message,
            request.channel,
            request.priority
        )
        # Persist outreach session
        task_id = f"outreach-{datetime.utcnow().timestamp():.0f}"
        await redis_sessions.save_session(task_id, {
            "task_id": task_id, "task_type": "outreach",
            "user_id": current_user.get("user_id"),
            "channel": request.channel, "farmers_count": len(request.farmers),
            "result": result, "status": "completed",
            "created_at": datetime.utcnow().isoformat(),
        })
        return result
    except Exception as e:
        logger.error(f"Outreach scheduling failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis")
async def run_analysis(request: AnalysisRequest, current_user: dict = Depends(verify_token)):
    """Run data analysis for a region"""
    logger.info(f"Running {request.data_type} analysis for {request.region}")

    try:
        result = await AIProcessingService.analyze_data(
            request.region,
            request.data_type,
            request.time_period
        )

        return result.dict()
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/report")
async def generate_report(request: ReportRequest, current_user: dict = Depends(verify_token)):
    """Generate automated reports"""
    logger.info(f"Generating {request.period} report for {request.region}")

    try:
        report = await ReportService.generate_report(
            request.region,
            request.period,
            request.sections
        )

        return report
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Task handlers
async def handle_outreach(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle outreach task"""
    farmers = params.get("farmers", [])
    message = params.get("message", "")
    channel = params.get("channel", "sms")
    priority = params.get("priority", "normal")

    return await OutreachService.send_outreach(farmers, message, channel, priority)


async def handle_analysis(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle analysis task"""
    return await AIProcessingService.analyze_data(
        params.get("region", "unknown"),
        params.get("data_type", "general"),
        params.get("time_period", "7d")
    )


async def handle_report(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle report generation task"""
    return await ReportService.generate_report(
        params.get("region", "unknown"),
        params.get("period", "weekly"),
        params.get("sections")
    )


async def handle_stealth_scrape(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle stealth scraping task for tropical data retrieval"""
    platform = params.get("platform", "facebook")
    niche = params.get("niche", "agriculture")
    region = params.get("region", "Kenya")

    try:
        scanner = CloakBrowserScanner(platform=platform)
        results = await scanner.scan_trends(niche=niche, region=region)
        return {
            "success": True,
            "platform": platform,
            "niche": niche,
            "region": region,
            "results": results,
            "count": len(results) if isinstance(results, list) else 0
        }
    except Exception as e:
        logger.error(f"Stealth scrape failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "platform": platform,
            "niche": niche
        }

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting Agent Zero Service v2.0.0")
    db.connect()
    await redis_sessions.connect()


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down Agent Zero Service")
    db.close()
    await redis_sessions.disconnect()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
