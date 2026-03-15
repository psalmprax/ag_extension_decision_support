# AI Agent Integration Plan for Ag Extension Dashboard

This document outlines how to integrate OpenClaw, Agent Zero, Crew AI, and Goose into the Agricultural Extension Decision Support System.

## Overview

| Agent | Primary Use | Integration Type |
|-------|-------------|-----------------|
| OpenClaw (OpenHands) | Code generation, bug fixes, refactoring | Development Workflow |
| Agent Zero | Autonomous task execution, tool calling | Backend Service |
| Crew AI | Multi-agent workflows, complex reasoning | API/Routes |
| Goose | Interactive CLI assistant | Developer Tooling |

---

## 1. OpenClaw (OpenHands)

### What it is
An open-source AI coding assistant that can autonomously perform coding tasks, bug fixes, and refactoring.

### Integration for this project

**Use Cases:**
- Automated code generation, bug fixes, and refactoring
- Code refactoring suggestions
- Test generation
- Documentation improvements

**Setup:**
```bash
# Install OpenHands
pip install openhands

# Or use the CLI
npm install -g openhands
```

**Example workflow:**
```bash
# Run OpenHands on the project
openhands --dir ./ag-extension-dashboard --task "fix all TypeScript errors and add unit tests"
```

**Configuration file: `.openhands.yaml`**
```yaml
model: gpt-4
temperature: 0.2
max_iterations: 50
workspace: ./ag-extension-dashboard
commands:
  - npm run lint
  - npm run type-check
  - npm test
exclude:
  - node_modules
  - dist
  - logs
```

---

## 2. Agent Zero

### What it is
A general-purpose AI agent framework that excels at autonomous task execution with tool calling capabilities.

### Integration for this project

**Use Cases:**
- Automated farmer outreach
- Data collection and analysis
- Report generation workflow
- Weather alert monitoring and notifications

**Backend Integration:**

```typescript
// src/services/agentZeroService.ts
import axios from 'axios';

interface AgentTask {
  id: string;
  type: 'outreach' | 'analysis' | 'report' | 'alert';
  params: Record<string, any>;
  callback?: string;
}

class AgentZeroService {
  private baseUrl = process.env.AGENT_ZERO_URL || 'http://localhost:8000';
  private apiKey = process.env.AGENT_ZERO_API_KEY;

  async executeTask(task: AgentTask): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/execute`, {
        agent: 'agent-zero',
        task: task.type,
        parameters: task.params,
        tools: [
          'send_email',
          'query_database', 
          'generate_report',
          'fetch_weather'
        ]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.data;
    } catch (error) {
      console.error('Agent Zero execution failed:', error);
      throw error;
    }
  }

  // Example: Automated farmer outreach
  async scheduleOutreach(farmers: any[], message: string) {
    return this.executeTask({
      id: `outreach-${Date.now()}`,
      type: 'outreach',
      params: { farmers, message }
    });
  }

  // Example: Generate weekly report
  async generateWeeklyReport(region: string) {
    return this.executeTask({
      id: `report-${Date.now()}`,
      type: 'report',
      params: { region, period: 'weekly' }
    });
  }
}

export const agentZeroService = new AgentZeroService();
```

**Add to routes:**
```typescript
// src/routes/agents.ts
import { Router } from 'express';
import { agentZeroService } from '../services/agentZeroService';

const router = Router();

router.post('/execute', async (req, res) => {
  try {
    const result = await agentZeroService.executeTask(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Agent execution failed' });
  }
});

router.post('/outreach', async (req, res) => {
  const { farmers, message } = req.body;
  const result = await agentZeroService.scheduleOutreach(farmers, message);
  res.json(result);
});

router.post('/report', async (req, res) => {
  const { region } = req.body;
  const result = await agentZeroService.generateWeeklyReport(region);
  res.json(result);
});

export default router;
```

---

## 3. Crew AI

### What it is
A multi-agent framework that orchestrates multiple AI agents to work together on complex tasks.

### Integration for this project

**Use Cases:**
- Research → Analyze → Report pipeline
- Farmer case investigation workflow
- Crop disease diagnosis workflow
- Market analysis automation

**Install:**
```bash
pip install crewai crewai-tools
```

**Create agents:**

```python
# backend/agents/research_agent.py
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4", temperature=0.7)

# Research Agent - Gathers data from various sources
research_agent = Agent(
    role="Agricultural Research Specialist",
    goal="Collect comprehensive data about farming practices, weather, and market conditions",
    backstory="""You are an expert in agricultural research with deep knowledge
    of farming practices, crop diseases, and market trends across Africa.""",
    verbose=True,
    llm=llm
)

# Analysis Agent - Analyzes data and provides insights
analysis_agent = Agent(
    role="Agricultural Data Analyst",
    goal="Analyze collected data and provide actionable insights for farmers",
    backstory="""You are a data scientist specializing in agricultural analytics.
    You excel at identifying patterns and trends in farming data.""",
    verbose=True,
    llm=llm
)

# Report Agent - Generates reports and recommendations
report_agent = Agent(
    role="Agricultural Report Writer",
    goal="Create comprehensive reports with clear recommendations for farmers",
    backstory="""You are an expert at translating complex agricultural data
    into clear, actionable recommendations.""",
    verbose=True,
    llm=llm
)

# Define tasks
research_task = Task(
    description="Research current weather conditions, soil health, and market prices for {region}",
    agent=research_agent,
    expected_output="Comprehensive data summary"
)

analysis_task = Task(
    description="Analyze the research data and identify risks and opportunities",
    agent=analysis_agent,
    expected_output="Analysis with key insights"
)

report_task = Task(
    description="Create a farmer-friendly report with specific recommendations",
    agent=report_agent,
    expected_output="Final report document"
)

# Create crew
farm_crew = Crew(
    agents=[research_agent, analysis_agent, report_agent],
    tasks=[research_task, analysis_task, report_task],
    verbose=True
)
```

**Backend API wrapper:**

```typescript
// src/services/crewAiService.ts
import { spawn } from 'child_process';

class CrewAiService {
  async runFarmAnalysis(region: string, farmerData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const python = spawn('python', [
        '-c',
        `
import sys
sys.path.insert(0, './backend')
from agents.research_agent import farm_crew

result = farm_crew.kickoff(inputs={
  'region': '${region}',
  'farmer_data': ${JSON.stringify(farmerData)}
})
print(result)
`
      ]);

      let output = '';
      python.stdout.on('data', (data) => { output += data.toString(); });
      python.stderr.on('data', (data) => { console.error(data.toString()); });
      python.on('close', (code) => {
        if (code === 0) resolve(JSON.parse(output));
        else reject(new Error('Crew AI execution failed'));
      });
    });
  }
}

export const crewAiService = new CrewAiService();
```

---

## 4. Goose

### What it is
An AI assistant that works in your terminal, helpful for development tasks and quick queries.

### Integration for this project

**Install:**
```bash
# Install Goose
curl -sSL https://get goose.techne.lol | sh

# Or via pip
pip install goose-v4
```

**Configuration:**
```yaml
# .goose/config.yaml
provider: openai
model: gpt-4
context:
  max_tokens: 100000
  project_path: ./ag-extension-dashboard

commands:
  - name: test
    prompt: "Run the test suite and summarize results"
    command: "npm test"
  
  - name: analyze
    prompt: "Analyze code for potential bugs and security issues"
    command: "npm run lint"

  - name: deploy
    prompt: "Build and prepare for deployment"
    command: "npm run build"

extensions:
  - github
  - docker
  - npm
```

**Usage Examples:**
```bash
# Analyze codebase
goose "What are the main components of this application?"

# Generate code
goose "Create a new service for handling SMS notifications"

# Debug issues
goose "Why is the weather API returning stale data?"

# Refactor
goose "Refactor the chatbot service to use TypeScript properly"
```

---

## 5. Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Ag Extension Dashboard                   │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                              │
│  ├── User Interface                                         │
│  ├── State Management                                       │
│  └── API Client                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express)                       │
├─────────────────────────────────────────────────────────────┤
│  Routes: /api/agents/*                                      │
│  ├── POST /execute (Agent Zero)                             │
│  ├── POST /outreach (Agent Zero)                            │
│  ├── POST /analyze (Crew AI)                                │
│  └── WebSocket notifications                               │
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌────────────┐      ┌────────────┐      ┌────────────┐
   │ Agent Zero │      │  Crew AI   │      │  OpenClaw │
   │  (Python)  │      │  (Python)  │      │ (Dev Tool)│
   └────────────┘      └────────────┘      └────────────┘
          │                    │
          ▼                    ▼
   ┌────────────┐      ┌────────────┐
   │  Tools:    │      │  Agents:   │
   │ - Email    │      │ - Research │
   │ - Database │      │ - Analysis │
   │ - Reports  │      │ - Report   │
   │ - Weather   │      └────────────┘
   └────────────┘
```

---

## 6. Quick Start

### Step 1: Install dependencies
```bash
# Python dependencies for Agent Zero and Crew AI
pip install crewai crewai-tools openai fastapi uvicorn

# Node dependencies for backend integration
npm install axios
```

### Step 2: Environment variables
```env
# .env
AGENT_ZERO_API_KEY=your_agent_zero_key
OPENAI_API_KEY=your_openai_key
CREWAI_API_KEY=your_crewai_key

# Agent Zero URL (if using hosted version)
AGENT_ZERO_URL=https://api.agentzero.io
```

### Step 3: Run backend
```bash
cd ag-extension-dashboard/src/backend
npm run dev
```

---

## 7. Recommended Workflow

1. **Development**: Use OpenClaw/Goose for code generation and debugging
2. **Automation**: Use Agent Zero for scheduled tasks (outreach, reports)
3. **Complex Analysis**: Use Crew AI for multi-step analysis workflows
4. **Monitoring**: Set up webhooks to receive agent results in dashboard

---

## 8. Docker Containerization

### Quick Start with Docker

```bash
# Start all services including agents
docker-compose -f docker-compose.yml -f docker-compose.agents.yml up -d

# Or start agents only
docker-compose -f docker-compose.agents.yml up -d
```

### Individual Agent Services

**Agent Zero:**
```bash
cd ag-extension-dashboard/src/agents
docker build -f Dockerfile.agent-zero -t ag-agent-zero .
docker run -p 8000:8000 --env-file .env ag-agent-zero
```

**Crew AI:**
```bash
cd ag-extension-dashboard/src/agents
docker build -f Dockerfile.crew-ai -t ag-crew-ai .
docker run -p 8001:8001 --env-file .env ag-crew-ai
```

### Environment Variables

```env
# .env
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=ag_extension
```

### Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| Agent Zero | http://localhost:8000 | Autonomous task execution |
| Crew AI | http://localhost:8001 | Multi-agent workflows |
| Health Check | /health | Service health status |

---

## 9. Example: Complete Workflow

```typescript
// Example: Farmer outreach campaign
async function runOutreachCampaign(farmerIds: string[]) {
  // 1. Get farmer data
  const farmers = await db.farmers.findMany({
    where: { id: { in: farmerIds } }
  });

  // 2. Use Agent Zero to personalize messages
  const messages = await agentZeroService.scheduleOutreach(
    farmers,
    "Your crops are ready for harvest. Here are today's market prices..."
  );

  // 3. Use Crew AI to analyze response patterns
  const analysis = await crewAiService.runFarmAnalysis(
    farmers[0].region,
    farmers
  );

  // 4. Results sent via webhook to dashboard
  return { messages, analysis };
}
```

---

This integration plan provides a comprehensive roadmap for adding AI agent capabilities to the Agricultural Extension Decision Support System.
