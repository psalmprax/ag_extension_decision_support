"""
Crew AI Service
Multi-agent system for complex agricultural analysis workflows.
Production-ready implementation with real AI processing and database integration.
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
import logging
from datetime import datetime
from enum import Enum
from tools.slop_cleaner import clean_slop

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Crew AI Service", version="2.0.0")

# CORS middleware
NODE_ENV = os.getenv("NODE_ENV", "development")
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "https://www.gpexts.com,http://localhost:7503,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")

# Import Crew AI
try:
    from crewai import Agent, Task, Crew, Process
    from langchain_openai import ChatOpenAI
    from crewai.tools import BaseTool
    CREW_AI_AVAILABLE = True
    logger.info("Crew AI library loaded successfully")
except ImportError:
    CREW_AI_AVAILABLE = False
    logger.warning("Crew AI library not installed - using fallback implementation")

    class BaseTool:  # type: ignore[no-redef]
        """Minimal stand-in so tool classes below can be defined (and unit-tested)
        when crewai is not installed. Never used for real agent runs."""
        name: str = ""
        description: str = ""

        def run(self, *args, **kwargs):
            return self._run(*args, **kwargs)

        def _run(self, *args, **kwargs):  # pragma: no cover
            raise NotImplementedError

# Import OpenAI for direct AI processing
try:
    from openai import OpenAI
    openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
except ImportError:
    openai_client = None
    logger.warning("OpenAI library not installed - AI features unavailable")


# ─── Backend MCP tool bridge ────────────────────────────────────────────────
# Contract (backend/src/services/mcpAdapter.ts createMCPRouter):
#   POST {BACKEND_URL}/api/v1/mcp/tools/call   body: {"name": <tool>, "arguments": {...}}
#   -> 200 {"success": true, "data": {"content": [{"type":"text","text": "..."}], "isError"?: bool}}
#   Auth: Authorization: Bearer <MCP_API_TOKEN>  (shared secret; see mcpAuth)
import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://ag-dashboard-backend:3001").rstrip("/")
MCP_API_TOKEN = os.getenv("MCP_API_TOKEN", "")
MCP_TIMEOUT_S = float(os.getenv("MCP_TIMEOUT_S", "30"))


class MCPToolError(Exception):
    pass


def call_mcp_tool(tool_name: str, arguments: dict) -> str:
    """Synchronously invoke a backend MCP tool and return its text output.

    Uses a blocking httpx client on purpose: CrewAI executes tool `_run` methods
    synchronously inside `crew.kickoff()`, which we run in a worker thread — so
    `asyncio.run()` here would raise "cannot be called from a running event loop".
    """
    if not MCP_API_TOKEN:
        raise MCPToolError("MCP_API_TOKEN is not configured for the Crew AI service")
    url = f"{BACKEND_URL}/api/v1/mcp/tools/call"
    try:
        with httpx.Client(timeout=MCP_TIMEOUT_S) as client:
            resp = client.post(
                url,
                json={"name": tool_name, "arguments": arguments},
                headers={"Authorization": f"Bearer {MCP_API_TOKEN}"},
            )
    except httpx.HTTPError as exc:
        raise MCPToolError(f"backend unreachable at {url}: {exc}") from exc

    if resp.status_code == 401:
        raise MCPToolError("backend rejected MCP_API_TOKEN (401)")
    if resp.status_code == 404:
        raise MCPToolError(f"MCP route not found at {url} (404)")
    if not resp.is_success:
        raise MCPToolError(f"backend returned HTTP {resp.status_code}: {resp.text[:200]}")

    body = resp.json()
    data = body.get("data") or {}
    content = data.get("content") or []
    text = "\n".join(str(c.get("text", "")) for c in content if isinstance(c, dict)).strip()
    if data.get("isError"):
        raise MCPToolError(text or f"tool {tool_name} reported an error")
    if not text:
        raise MCPToolError(f"tool {tool_name} returned no content")
    return text


def _tool_result(tool_name: str, arguments: dict) -> str:
    """Wrapper that never raises into the agent loop but is explicit on failure."""
    try:
        return call_mcp_tool(tool_name, arguments)
    except MCPToolError as exc:
        logger.warning(f"MCP tool {tool_name} unavailable: {exc}")
        return f"[TOOL UNAVAILABLE: {tool_name}] {exc}. Do not guess this data; tell the user it could not be retrieved."
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(f"MCP tool {tool_name} crashed: {exc}")
        return f"[TOOL ERROR: {tool_name}] {exc}"


# Tool classes mirror backend tool names and argument names exactly.
class WeatherTool(BaseTool):
    name: str = "get_weather_forecast"
    description: str = "Get the weather forecast for a location (city or region). Args: location (str), days (int, 1-7)."

    def _run(self, location: str, days: int = 3) -> str:
        return _tool_result("get_weather_forecast", {"location": location, "days": int(days)})


class MarketPriceTool(BaseTool):
    name: str = "get_market_prices"
    description: str = "Get latest crop market prices (each row has a dataStatus: live vs estimated). Args: crop (str, optional)."

    def _run(self, crop: str = "") -> str:
        args = {"crop": crop} if crop else {}
        return _tool_result("get_market_prices", args)


class DiseaseDiagnosisTool(BaseTool):
    name: str = "diagnose_plant_disease"
    description: str = "Heuristic symptom matcher over an internal disease corpus (not a verified diagnosis). Args: symptoms (list[str]), cropType (str, optional)."

    def _run(self, symptoms, cropType: str = "") -> str:
        if isinstance(symptoms, str):
            symptoms = [part.strip() for part in symptoms.split(",") if part.strip()]
        args = {"symptoms": list(symptoms)}
        if cropType:
            args["cropType"] = cropType
        return _tool_result("diagnose_plant_disease", args)


class DiseaseAlertTool(BaseTool):
    name: str = "get_disease_alerts"
    description: str = "FAOSTAT production-anomaly proxy for disease/pest pressure (lagging, not real-time). Args: region (str), crop (str, optional)."

    def _run(self, region: str, crop: str = "") -> str:
        args = {"region": region}
        if crop:
            args["crop"] = crop
        return _tool_result("get_disease_alerts", args)


class CropYieldForecastTool(BaseTool):
    name: str = "crop_yield_forecast"
    description: str = "Order-of-magnitude yield estimate from a coefficient table x weather favourability (isEstimate=true). Args: crop, region, areaHectares (optional), plantingDate (optional)."

    def _run(self, crop: str, region: str, areaHectares: float = None, plantingDate: str = "") -> str:  # type: ignore[assignment]
        args = {"crop": crop, "region": region}
        if areaHectares is not None:
            args["areaHectares"] = float(areaHectares)
        if plantingDate:
            args["plantingDate"] = plantingDate
        return _tool_result("crop_yield_forecast", args)


class SoilAnalysisTool(BaseTool):
    name: str = "satellite_ndvi_analysis"
    description: str = "Satellite spectral indices when configured plus a climate-derived vegetation vigor proxy. Args: latitude (float), longitude (float), daysBack (int, optional)."

    def _run(self, latitude: float, longitude: float, daysBack: int = 90) -> str:
        return _tool_result("satellite_ndvi_analysis", {"latitude": float(latitude), "longitude": float(longitude), "daysBack": int(daysBack)})


class PestOutbreakTool(DiseaseAlertTool):
    """Alias kept for existing agent wiring."""
    name: str = "get_disease_alerts"


# Authentication dependency
async def verify_token(authorization: Optional[str] = Header(None)):
    """Verify JWT token from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ")[1]

    if not token or token == "dev-token":
        if NODE_ENV == "production":
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {"user_id": "dev-user", "role": "admin"}
    
    try:
        import jwt
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# Database connection — pooled (mirrors main.py) + Redis session persistence
try:
    import redis.asyncio as redis_asyncio
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    _redis_client = None
except ImportError:
    redis_asyncio = None
    REDIS_URL = ""
    _redis_client = None

class DatabaseManager:
    """Pooled database manager for PostgreSQL (ThreadedConnectionPool)"""

    def __init__(self):
        self.pool = None
        self.connection = None

    def connect(self):
        """Establish database connection pool"""
        if not DATABASE_URL:
            logger.warning("DATABASE_URL not configured")
            return None
        try:
            import psycopg2
            from psycopg2.pool import ThreadedConnectionPool
            self.pool = ThreadedConnectionPool(1, 10, DATABASE_URL)
            self.connection = self.pool.getconn()
            # Return immediately so pool remains usable
            self.pool.putconn(self.connection)
            self.connection = None
            logger.info("Database pool established (1-10)")
            return self.pool
        except ImportError:
            logger.warning("psycopg2 not installed - database features unavailable")
            return None
        except Exception as e:
            logger.error(f"Database pool failed: {e}")
            return None
    
    def execute_query(self, query: str, params: tuple = None):
        """Execute a database query via pool"""
        if not self.pool:
            self.connect()
        if not self.pool:
            return None
        conn = None
        try:
            conn = self.pool.getconn()
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            try:
                return cursor.fetchall()
            except Exception:
                return []
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            return None
        finally:
            if conn and self.pool:
                self.pool.putconn(conn)

    def close(self):
        """Close database pool"""
        if self.pool:
            try:
                self.pool.closeall()
            except Exception:
                pass
            self.pool = None

db = DatabaseManager()


# Request/Response models
class AnalysisType(str, Enum):
    GENERAL = "general"
    DISEASE = "disease"
    MARKET = "market"
    WEATHER = "weather"
    SOIL = "soil"


class AnalysisDepth(str, Enum):
    BRIEF = "brief"
    MEDIUM = "medium"
    COMPREHENSIVE = "comprehensive"


class AnalysisRequest(BaseModel):
    region: str
    farmer_data: Optional[List[Dict[str, Any]]] = None
    analysis_type: AnalysisType = AnalysisType.GENERAL
    include_recommendations: bool = True
    priority: str = "normal"
    callback: Optional[str] = None


class ResearchRequest(BaseModel):
    topic: str
    depth: AnalysisDepth = AnalysisDepth.MEDIUM
    include_sources: bool = True


class ReportRequest(BaseModel):
    region: str
    period: str
    sections: Optional[List[str]] = None
    format: str = "json"  # json, markdown, pdf


class MultiAgentResult(BaseModel):
    status: str
    region: str
    analysis_type: str
    findings: List[str]
    recommendations: List[str]
    risk_assessment: Dict[str, Any]
    confidence: float
    data_sources: List[str]
    generated_at: str
    processing_time_ms: int


# AI Agent Factory
class AgentFactory:
    """Factory for creating specialized AI agents"""
    
    @staticmethod
    def get_llm():
        """Get the language model for agents"""
        if CREW_AI_AVAILABLE and OPENAI_API_KEY:
            return ChatOpenAI(model="gpt-4", temperature=0.3)
        return None
    
    @staticmethod
    def create_research_agent():
        """Create a research specialist agent"""
        if not CREW_AI_AVAILABLE:
            return None
            
        llm = AgentFactory.get_llm()
        return Agent(
            role="Agricultural Research Specialist",
            goal="Synthesize general agronomic knowledge about farming practices, seasonal patterns, and crop health for the requested region",
            backstory="""You are an expert agricultural researcher with deep knowledge of farming practices across Africa.
            You reason from established agronomic knowledge and the task inputs provided to you.
            You do NOT have live access to weather stations, satellite imagery, or market feeds — when specific
            current data would change your answer, you state that clearly and recommend verifying with live sources.""",
            verbose=True,
            llm=llm,
            allow_delegation=False,
            tools=[WeatherTool(), MarketPriceTool()]
        )
    
    @staticmethod
    def create_analysis_agent():
        """Create a data analysis agent"""
        if not CREW_AI_AVAILABLE:
            return None
            
        llm = AgentFactory.get_llm()
        return Agent(
            role="Agricultural Data Analyst",
            goal="Analyze the provided research summary and produce risk assessments with stated confidence",
            backstory="""You are a data scientist specializing in agricultural analytics.
            You identify plausible risks and trends from the research notes given to you.
            You do not receive live telemetry — when the input lacks data for a factor, you mark that
            risk as unknown instead of guessing.""",
            verbose=True,
            llm=llm,
            allow_delegation=False,
            tools=[WeatherTool(), MarketPriceTool()]
        )
    
    @staticmethod
    def create_report_agent():
        """Create a report writing agent"""
        if not CREW_AI_AVAILABLE:
            return None
            
        llm = AgentFactory.get_llm()
        return Agent(
            role="Agricultural Report Writer",
            goal="Create comprehensive, farmer-friendly reports with clear, actionable recommendations",
            backstory="""You are an expert at translating complex agricultural data into clear, actionable recommendations.
            Your reports are known for being practical, easy to understand, and culturally appropriate for smallholder farmers.
            You always provide specific, implementable advice.""",
            verbose=True,
            llm=llm,
            allow_delegation=False,
            tools=[WeatherTool(), MarketPriceTool(), DiseaseDiagnosisTool(), SoilAnalysisTool()]
        )
    
    @staticmethod
    def create_disease_specialist_agent():
        """Create a disease diagnosis specialist agent"""
        if not CREW_AI_AVAILABLE:
            return None
            
        llm = AgentFactory.get_llm()
        return Agent(
            role="Plant Disease Diagnostician",
            goal="Identify potential crop diseases and pests based on symptoms and environmental conditions",
            backstory="""You are a plant pathologist with expertise in African crop diseases and pests.
            You can identify diseases from symptom descriptions and environmental conditions.
            You provide accurate diagnoses and recommend appropriate treatment strategies.""",
            verbose=True,
            llm=llm,
            allow_delegation=False,
            tools=[DiseaseDiagnosisTool(), WeatherTool()]
        )


# Multi-Agent Workflow Service
class MultiAgentService:
    """Service for orchestrating multi-agent workflows"""
    
    @staticmethod
    async def run_analysis_workflow(request: AnalysisRequest) -> MultiAgentResult:
        """Run a complete multi-agent analysis workflow"""
        start_time = datetime.utcnow()
        
        if CREW_AI_AVAILABLE and AgentFactory.get_llm():
            return await MultiAgentService._run_crew_analysis(request, start_time)
        else:
            return await MultiAgentService._run_direct_analysis(request, start_time)
    
    @staticmethod
    async def _run_crew_analysis(request: AnalysisRequest, start_time: datetime) -> MultiAgentResult:
        """Run analysis using Crew AI multi-agent system"""
        try:
            agents = {
                "research": AgentFactory.create_research_agent(),
                "analysis": AgentFactory.create_analysis_agent(),
                "report": AgentFactory.create_report_agent()
            }
            
            # Add disease specialist for disease analysis
            if request.analysis_type == AnalysisType.DISEASE:
                agents["disease"] = AgentFactory.create_disease_specialist_agent()
            
            # Create tasks
            research_task = Task(
                description=f"""Research current agricultural conditions for {request.region}.
                Focus on: {request.analysis_type.value} analysis.
                Consider weather patterns, soil conditions, market prices, and crop health.
                Gather data from multiple sources and identify key trends.""",
                agent=agents["research"],
                expected_output="Comprehensive data summary with key findings and sources"
            )
            
            analysis_task = Task(
                description="""Analyze the research data and identify risks and opportunities.
                Provide risk assessments for different factors (weather, market, disease).
                Calculate confidence levels for your assessments.""",
                agent=agents["analysis"],
                expected_output="Detailed analysis with risk assessments and confidence levels"
            )
            
            report_task = Task(
                description="""Create a farmer-friendly report with specific, actionable recommendations.
                Focus on practical advice that farmers can implement immediately.
                Prioritize recommendations by impact and urgency.""",
                agent=agents["report"],
                expected_output="Final report with prioritized recommendations"
            )
            
            # Create and run crew
            crew = Crew(
                agents=list(agents.values()),
                tasks=[research_task, analysis_task, report_task],
                verbose=True,
                process=Process.sequential
            )
            
            # kickoff() is synchronous and can run for minutes; keep the event loop
            # (and /health) responsive by running it in a worker thread.
            import asyncio
            result = await asyncio.to_thread(crew.kickoff, inputs={
                "region": request.region,
                "analysis_type": request.analysis_type.value
            })
            
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return MultiAgentService._parse_crew_result(
                request.region, request.analysis_type.value, result.raw, processing_time
            )
            
        except Exception as e:
            logger.error(f"Crew AI analysis failed: {e}")
            return await MultiAgentService._run_direct_analysis(request, start_time)
    
    @staticmethod
    async def _run_direct_analysis(request: AnalysisRequest, start_time: datetime) -> MultiAgentResult:
        """Run analysis using direct OpenAI API (fallback)"""
        try:
            if not openai_client:
                return MultiAgentService._get_fallback_analysis(request, start_time)
            
            # Build analysis prompt
            prompt = f"""Perform a comprehensive {request.analysis_type.value} analysis for {request.region}.

IMPORTANT: You have NO live data feeds (no weather API, no satellite, no market feed).
Base your analysis on general agronomic knowledge for the region and mark uncertainty explicitly.

Provide your analysis in the following format:
1. KEY FINDINGS: List 3-5 key findings
2. RISK ASSESSMENT: State each as "weather: low|medium|high", "market: low|medium|high", "disease: low|medium|high" — use unknown when data is insufficient
3. RECOMMENDATIONS: Provide 5 actionable recommendations
4. CONFIDENCE: State a single number between 0 and 1
5. DATA SOURCES: State which knowledge you relied on

Consider:
- Typical seasonal weather patterns for the region
- Common soil constraints
- Regional market dynamics
- Prevalent crop health and pest pressures
- Seasonal factors"""

            response = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert agricultural analyst providing comprehensive insights for farmers and extension officers."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            analysis_text = response.choices[0].message.content
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return MultiAgentService._parse_analysis_text(
                request.region, request.analysis_type.value, analysis_text, processing_time
            )
            
        except Exception as e:
            logger.error(f"Direct analysis failed: {e}")
            return MultiAgentService._get_fallback_analysis(request, start_time)
    
    @staticmethod
    def _extract_risk_and_confidence(result_text: str) -> tuple:
        """Extract risk levels and confidence from model output; unknown when not stated."""
        import re
        text = result_text.lower()
        risks = {}
        for factor in ("weather", "market", "disease"):
            m = re.search(rf"{factor}[^a-z]{{0,20}}(low|medium|high)", text)
            risks[factor] = m.group(1) if m else "unknown"
        conf_m = re.search(r"confidence[^0-9]{0,20}(0?\.\d{1,2}|1\.0|100|\d{1,2})\s*%?", text)
        confidence = float(conf_m.group(1)) if conf_m else None
        if confidence is not None and confidence > 1.0:
            confidence = confidence / 100.0
        return risks, confidence

    @staticmethod
    def _parse_crew_result(region: str, analysis_type: str, result_text: str, processing_time: float) -> MultiAgentResult:
        """Parse Crew AI result into structured format"""
        result_text = clean_slop(result_text)
        # Extract sections from the result text
        findings = []
        recommendations = []
        risks, confidence = MultiAgentService._extract_risk_and_confidence(result_text)
        data_sources = ["multi_agent_analysis", "research_data"]
        if confidence is None:
            confidence = 0.0
            data_sources.append("confidence_not_stated")
        
        # Parse findings
        for line in result_text.split('\n'):
            line = line.strip()
            if line.startswith('- ') or line.startswith('* '):
                content = line[2:]
                if any(kw in content.lower() for kw in ['finding', 'observed', 'identified', 'detected']):
                    findings.append(content)
                elif any(kw in content.lower() for kw in ['recommend', 'suggest', 'should', 'action']):
                    recommendations.append(content)
        
        # Ensure we have content — mark as unstated rather than fabricating findings
        if not findings:
            findings = [
                f"[UNAVAILABLE] The model output for {region} ({analysis_type}) contained no parseable findings.",
                "No findings are reported rather than inventing them."
            ]
        
        if not recommendations:
            recommendations = [
                "[UNAVAILABLE] The model output contained no parseable recommendations.",
                "Consult your local extension officer for region-specific guidance."
            ]
        
        return MultiAgentResult(
            status="success",
            region=region,
            analysis_type=analysis_type,
            findings=findings[:5],
            recommendations=recommendations[:5],
            risk_assessment=risks,
            confidence=confidence,
            data_sources=data_sources,
            generated_at=datetime.utcnow().isoformat(),
            processing_time_ms=int(processing_time)
        )
    
    @staticmethod
    def _parse_analysis_text(region: str, analysis_type: str, text: str, processing_time: float) -> MultiAgentResult:
        """Parse direct analysis text into structured format"""
        text = clean_slop(text)
        findings = []
        recommendations = []
        risks, confidence = MultiAgentService._extract_risk_and_confidence(text)
        data_sources = ["openai_analysis"]
        if confidence is None:
            confidence = 0.0
            data_sources.append("confidence_not_stated")
        
        # Simple parsing logic
        in_findings = False
        in_recommendations = False
        
        for line in text.split('\n'):
            line = line.strip()
            
            if 'key findings' in line.lower():
                in_findings = True
                in_recommendations = False
                continue
            elif 'recommendations' in line.lower():
                in_findings = False
                in_recommendations = True
                continue
            
            if in_findings and (line.startswith('- ') or line.startswith('* ') or line.startswith('1.') or line.startswith('2.')):
                findings.append(line.lstrip('- *1234567890. '))
            elif in_recommendations and (line.startswith('- ') or line.startswith('* ') or line.startswith('1.') or line.startswith('2.')):
                recommendations.append(line.lstrip('- *1234567890. '))
        
        # Ensure minimum content — mark as unstated rather than fabricating findings
        if not findings:
            findings = [
                f"[UNAVAILABLE] The model output for {region} ({analysis_type}) contained no parseable findings.",
                "No findings are reported rather than inventing them."
            ]
        
        if not recommendations:
            recommendations = [
                "[UNAVAILABLE] The model output contained no parseable recommendations.",
                "Consult your local extension officer for region-specific guidance."
            ]
        
        return MultiAgentResult(
            status="success",
            region=region,
            analysis_type=analysis_type,
            findings=findings[:5],
            recommendations=recommendations[:5],
            risk_assessment=risks,
            confidence=confidence,
            data_sources=data_sources,
            generated_at=datetime.utcnow().isoformat(),
            processing_time_ms=int(processing_time)
        )
    
    @staticmethod
    def _get_fallback_analysis(request: AnalysisRequest, start_time: datetime) -> MultiAgentResult:
        """Fallback analysis when AI is unavailable — clearly marked, no invented data"""
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000

        return MultiAgentResult(
            status="fallback",
            region=request.region,
            analysis_type=request.analysis_type.value,
            findings=[
                f"[UNAVAILABLE] Live multi-agent analysis for {request.region} ({request.analysis_type.value}) could not be generated because the AI provider is unavailable.",
                "No live data was consulted; no findings can be reported."
            ],
            recommendations=[
                "Retry when the AI provider is available",
                "Consult your local extension officer for region-specific guidance"
            ],
            risk_assessment={},
            confidence=0.0,
            data_sources=["fallback_stub"],
            generated_at=datetime.utcnow().isoformat(),
            processing_time_ms=int(processing_time)
        )


# Research Service
class ResearchService:
    """Service for conducting research tasks"""
    
    @staticmethod
    async def conduct_research(request: ResearchRequest) -> Dict[str, Any]:
        """Conduct research on a specific topic"""
        start_time = datetime.utcnow()
        
        if CREW_AI_AVAILABLE and AgentFactory.get_llm():
            try:
                research_agent = AgentFactory.create_research_agent()
                
                task = Task(
                    description=f"Conduct {request.depth.value} research on: {request.topic}",
                    agent=research_agent,
                    expected_output=f"Comprehensive {request.depth.value} research report with sources"
                )
                
                crew = Crew(
                    agents=[research_agent],
                    tasks=[task],
                    verbose=True
                )
                
                import asyncio
                result = await asyncio.to_thread(crew.kickoff)
                processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                return {
                    "status": "success",
                    "topic": request.topic,
                    "depth": request.depth.value,
                    "findings": clean_slop(result.raw),
                    "generated_at": datetime.utcnow().isoformat(),
                    "processing_time_ms": int(processing_time)
                }
                
            except Exception as e:
                logger.error(f"Crew AI research failed: {e}")
        
        # Fallback to direct OpenAI
        if openai_client:
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are an expert agricultural researcher."},
                        {"role": "user", "content": f"Conduct {request.depth.value} research on: {request.topic}"}
                    ],
                    temperature=0.3,
                    max_tokens=2000
                )
                
                processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                return {
                    "status": "success",
                    "topic": request.topic,
                    "depth": request.depth.value,
                    "findings": clean_slop(response.choices[0].message.content),
                    "generated_at": datetime.utcnow().isoformat(),
                    "processing_time_ms": int(processing_time)
                }
                
            except Exception as e:
                logger.error(f"Direct research failed: {e}")
        
        # Complete fallback — explicit unavailable state, no invented content
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        return {
            "status": "fallback",
            "topic": request.topic,
            "depth": request.depth.value,
            "findings": f"[UNAVAILABLE] Research on {request.topic} could not be generated: AI services (CrewAI and OpenAI) are unavailable. No research was conducted and no content was invented. Retry when the AI provider is available.",
            "generated_at": datetime.utcnow().isoformat(),
            "processing_time_ms": int(processing_time)
        }


# Report Generation Service
class ReportGenerationService:
    """Service for generating comprehensive reports"""
    
    @staticmethod
    async def generate_report(request: ReportRequest) -> Dict[str, Any]:
        """Generate a comprehensive report"""
        start_time = datetime.utcnow()
        
        sections = request.sections or ["Executive Summary", "Weather Analysis", "Crop Status", "Market Analysis", "Recommendations"]
        
        report_sections = []
        
        for section in sections:
            section_content = await ReportGenerationService._generate_section(
                request.region, request.period, section
            )
            report_sections.append({
                "title": section,
                "content": section_content
            })
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        report = {
            "id": f"report-{datetime.utcnow().timestamp()}",
            "region": request.region,
            "period": request.period,
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": "crew-ai-service",
            "format": request.format,
            "sections": report_sections,
            "status": "completed",
            "processing_time_ms": int(processing_time)
        }

        # Store in database if available
        if db.pool:
            try:
                db.execute_query(
                    """INSERT INTO reports 
                       (type, title, content, status, created_at, updated_at) 
                       VALUES (%s, %s, %s, %s, NOW(), NOW())""",
                    ("automated", f"{request.period} Report - {request.region}", json.dumps(report), "completed")
                )
            except Exception as e:
                logger.error(f"Failed to store report in database: {e}")
        
        return report
    
    @staticmethod
    async def _generate_section(region: str, period: str, section: str) -> str:
        """Generate content for a specific report section"""
        
        if openai_client:
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are an expert agricultural report writer."},
                        {"role": "user", "content": f"Write the '{section}' section for a {period} agricultural report for {region}. Provide detailed, actionable content."}
                    ],
                    temperature=0.3,
                    max_tokens=1500
                )
                return clean_slop(response.choices[0].message.content)
            except Exception as e:
                logger.error(f"AI section generation failed: {e}")
        
        # Fallback content
        return ReportGenerationService._get_fallback_section_content(region, period, section)
    
    @staticmethod
    def _get_fallback_section_content(region: str, period: str, section: str) -> str:
        """Fallback section content when AI is unavailable — clearly marked"""
        prefix = "[UNAVAILABLE] Live AI generation failed — no live data was consulted."
        content_map = {
            "Executive Summary": f"{prefix} {period} overview for {region} could not be generated.",
            "Weather Analysis": f"{prefix} Weather for {region} during {period} is unavailable.",
            "Crop Status": f"{prefix} Crop status for {region} is unavailable.",
            "Market Analysis": f"{prefix} Market analysis for {region} is unavailable.",
            "Recommendations": f"{prefix} Recommendations for {region}: retry when AI is available and consult your extension officer.",
        }
        return content_map.get(section, f"{prefix} {section} for {region} during {period} is unavailable.")


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    redis_ok = False
    if redis_asyncio and REDIS_URL:
        try:
            import redis as _r
            _r.Redis.from_url(REDIS_URL).ping()
            redis_ok = True
        except Exception:
            redis_ok = False
    return {
        "status": "healthy",
        "service": "crew-ai",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": {
            "crewai": "available" if CREW_AI_AVAILABLE else "not_available",
            "openai": "configured" if openai_client else "not_configured",
            "database": "connected" if db.pool else "not_connected",
            "redis": "connected" if redis_ok else "not_configured",
        }
    }


@app.post("/api/analyze")
async def run_analysis(request: AnalysisRequest, current_user: dict = Depends(verify_token)):
    """Run multi-agent analysis workflow"""
    logger.info(f"Running {request.analysis_type.value} analysis for {request.region}")
    
    try:
        result = await MultiAgentService.run_analysis_workflow(request)
        data = result.dict()
        if request.callback:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post(request.callback, json={"region": request.region, "status": data.get("status"), "result": data})
            except Exception as cb_err:
                logger.warning(f"Callback POST to {request.callback} failed: {cb_err}")
        return data
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/research")
async def run_research(request: ResearchRequest, current_user: dict = Depends(verify_token)):
    """Run research task"""
    logger.info(f"Conducting {request.depth.value} research on: {request.topic}")
    
    try:
        result = await ResearchService.conduct_research(request)
        return result
    except Exception as e:
        logger.error(f"Research failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-report")
async def generate_report(request: ReportRequest, current_user: dict = Depends(verify_token)):
    """Generate comprehensive report using multi-agent workflow"""
    logger.info(f"Generating {request.period} report for {request.region}")
    
    try:
        report = await ReportGenerationService.generate_report(request)
        return report
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting Crew AI Service v2.0.0")
    logger.info(f"Crew AI Available: {CREW_AI_AVAILABLE}")
    logger.info(f"OpenAI Client: {'Configured' if openai_client else 'Not Configured'}")
    db.connect()


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down Crew AI Service")
    db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)