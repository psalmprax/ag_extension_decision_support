"""
Crew AI Service
Multi-agent system for complex agricultural analysis workflows.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
from datetime import datetime

app = FastAPI(title="Crew AI Service", version="1.0.0")

# Import crewai
try:
    from crewai import Agent, Task, Crew
    from langchain_openai import ChatOpenAI
    CREW_AI_AVAILABLE = True
except ImportError:
    CREW_AI_AVAILABLE = False

# Environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


class AnalysisRequest(BaseModel):
    region: str
    farmer_data: Optional[List[Dict[str, Any]]] = None
    analysis_type: str = "general"  # general, disease, market, weather


class ResearchRequest(BaseModel):
    topic: str
    depth: str = "medium"  # brief, medium, comprehensive


class ReportRequest(BaseModel):
    region: str
    period: str
    sections: Optional[List[str]] = None


def create_agents():
    """Create the crew AI agents"""
    if not CREW_AI_AVAILABLE:
        return None
    
    llm = ChatOpenAI(model="gpt-4", temperature=0.7)
    
    # Research Agent
    research_agent = Agent(
        role="Agricultural Research Specialist",
        goal="Collect comprehensive data about farming practices, weather, and market conditions",
        backstory="""You are an expert in agricultural research with deep knowledge
        of farming practices, crop diseases, and market trends across Africa.
        You have access to multiple data sources and can synthesize information
        from various channels.""",
        verbose=True,
        llm=llm
    )
    
    # Analysis Agent
    analysis_agent = Agent(
        role="Agricultural Data Analyst",
        goal="Analyze collected data and provide actionable insights for farmers",
        backstory="""You are a data scientist specializing in agricultural analytics.
        You excel at identifying patterns and trends in farming data.
        You can interpret complex datasets and provide clear recommendations.""",
        verbose=True,
        llm=llm
    )
    
    # Report Agent
    report_agent = Agent(
        role="Agricultural Report Writer",
        goal="Create comprehensive reports with clear recommendations for farmers",
        backstory="""You are an expert at translating complex agricultural data
        into clear, actionable recommendations. Your reports are known for
        being practical and easy to understand for farmers.""",
        verbose=True,
        llm=llm
    )
    
    return {
        "research": research_agent,
        "analysis": analysis_agent,
        "report": report_agent
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "crew-ai",
        "crew_ai_available": CREW_AI_AVAILABLE,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/analyze")
async def run_analysis(request: AnalysisRequest):
    """Run multi-agent analysis workflow"""
    if not CREW_AI_AVAILABLE:
        # Return mock data if crewai not installed
        return {
            "status": "mock",
            "region": request.region,
            "analysis_type": request.analysis_type,
            "findings": [
                "Weather conditions are favorable for the next 7 days",
                "Market prices for maize are stable",
                "Consider fertilizing maize crops this week"
            ],
            "recommendations": [
                "Monitor soil moisture levels",
                "Check for early signs of crop disease",
                "Plan harvest for maize in 2 weeks"
            ]
        }
    
    try:
        agents = create_agents()
        
        # Define tasks
        research_task = Task(
            description=f"Research current agricultural conditions for {request.region}",
            agent=agents["research"],
            expected_output="Comprehensive data summary"
        )
        
        analysis_task = Task(
            description="Analyze the research data and identify risks and opportunities",
            agent=agents["analysis"],
            expected_output="Analysis with key insights"
        )
        
        report_task = Task(
            description="Create a farmer-friendly report with specific recommendations",
            agent=agents["report"],
            expected_output="Final report document"
        )
        
        # Create crew
        farm_crew = Crew(
            agents=[agents["research"], agents["analysis"], agents["report"]],
            tasks=[research_task, analysis_task, report_task],
            verbose=True
        )
        
        # Execute
        result = farm_crew.kickoff(inputs={
            "region": request.region,
            "analysis_type": request.analysis_type
        })
        
        return {
            "status": "success",
            "region": request.region,
            "result": str(result)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/research")
async def run_research(request: ResearchRequest):
    """Run research task"""
    if not CREW_AI_AVAILABLE:
        return {
            "topic": request.topic,
            "depth": request.depth,
            "findings": f"Research on {request.topic} completed (mock)"
        }
    
    try:
        agents = create_agents()
        
        research_task = Task(
            description=f"Research {request.topic} in depth",
            agent=agents["research"],
            expected_output=f"Comprehensive {request.depth} research report"
        )
        
        crew = Crew(
            agents=[agents["research"]],
            tasks=[research_task],
            verbose=True
        )
        
        result = crew.kickoff()
        
        return {
            "topic": request.topic,
            "result": str(result)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-report")
async def generate_report(request: ReportRequest):
    """Generate comprehensive report using multi-agent workflow"""
    if not CREW_AI_AVAILABLE:
        return {
            "region": request.region,
            "period": request.period,
            "sections": ["Executive Summary", "Weather", "Crops", "Market", "Recommendations"],
            "content": "Report generated (mock)"
        }
    
    try:
        agents = create_agents()
        
        # Create tasks for each section
        tasks = []
        
        if not request.sections:
            request.sections = ["Executive Summary", "Weather", "Crops", "Market", "Recommendations"]
        
        for section in request.sections:
            task = Task(
                description=f"Write the {section} section for {request.region} {request.period} report",
                agent=agents["report"],
                expected_output=f"Completed {section} section"
            )
            tasks.append(task)
        
        crew = Crew(
            agents=[agents["report"]],
            tasks=tasks,
            verbose=True
        )
        
        result = crew.kickoff()
        
        return {
            "region": request.region,
            "period": request.period,
            "sections": request.sections,
            "content": str(result)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
