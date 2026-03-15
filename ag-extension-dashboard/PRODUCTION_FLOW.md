# Production Architecture & Workflow

## High-Level Production Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGRICULTURAL EXTENSION DASHBOARD                     │
│                              PRODUCTION ENVIRONMENT                          │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Farmers  │   │ Extension │   │    Admins │
            │   (App)  │   │ Officers  │   │   (App)   │
            └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                  │               │               │
                  │   ┌───────────┴───────────┐   │
                  │   ▼                       ▼   │
                  │ ┌─────────────────────────┐ │
                  │ │     Frontend (React)    │ │
                  │ │    http://yourdomain    │ │
                  │ └────────────┬────────────┘ │
                  │              │              │
                  │    ┌─────────┴─────────┐    │
                  │    ▼                   ▼    │
                  │ ┌────────┐        ┌────────┐
                  │ │WebSocket│        │  REST  │
                  │ │Socket.io│        │  API   │
                  │ └────┬────┘        └────┬────┘
                  │      │                   │
                  └──────┼───────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend (Express + Node.js)                         │
│                            http://localhost:3010                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   Auth JWT      │  │  Rate Limiter   │  │    CORS / Helmet        │  │
│  │   Middleware    │  │                 │  │                         │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  │
│           │                     │                          │               │
│           ▼                     ▼                          ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         ROUTES                                       │   │
│  │  /api/auth    /api/farmers   /api/visits   /api/analytics         │   │
│  │  /api/chatbot /api/knowledge /api/reports  /api/agents             │   │
│  └────────┬────────────────────────────────────────────────────┬────────┘   │
│           │                                                     │            │
│           └──────────────────────┬────────────────────────────┘            │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    AI AGENT INTEGRATION LAYER                       │   │
│  │                                                                      │   │
│  │  ┌──────────────────┐        ┌──────────────────────────────┐     │   │
│  │  │  Agent Zero      │        │  Crew AI Service              │     │   │
│  │  │  (Port 8000)    │◄──────►│  (Port 8011)                 │     │   │
│  │  │                  │        │                              │     │   │
│  │  │ • Outreach      │        │  • Research Agent            │     │   │
│  │  │ • Analysis      │        │  • Analysis Agent            │     │   │
│  │  │ • Reports       │        │  • Report Writer Agent       │     │   │
│  │  │ • Alerts        │        │  • Multi-agent Workflows     │     │   │
│  │  └────────┬─────────┘        └──────────────┬───────────────┘     │   │
│  │           │                                  │                      │   │
│  └───────────┼──────────────────────────────────┼──────────────────────┘   │
│              │                                  │                          │
└──────────────┼──────────────────────────────────┼──────────────────────────┘
               │                                  │
    ┌──────────┴──────────┐           ┌──────────┴──────────┐
    │                     │           │                     │
    ▼                     ▼           ▼                     ▼
┌─────────────┐     ┌─────────────┐ ┌─────────────┐     ┌─────────────┐
│  PostgreSQL │     │    Redis    │ │  OpenAI     │     │  External   │
│  (app-db)   │     │  (Cache)    │ │  API        │     │  Services   │
│  Port 5432  │     │  Port 6379  │ │             │     │             │
└─────────────┘     └─────────────┘ └─────────────┘     └─────────────┘
      │                   │               │                     │
      │                   │               │                     │
      ▼                   ▼               ▼                     ▼
   ┌──────┐          ┌──────────┐    ┌──────────┐        ┌──────────┐
   │ Data │          │ Session  │    │   LLM    │        │ Weather  │
   │ Store│          │   Store  │    │  Models  │        │   API    │
   └──────┘          └──────────┘    └──────────┘        └──────────┘
```

---

## Production Workflows

### 1. Farmer Outreach Automation

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin     │     │   Backend   │     │Agent Zero   │     │   Farmer    │
│ Triggers   │────►│   Receives  │────►│  Processes  │────►│  Receives   │
│ Campaign   │     │   Request   │     │   Task      │     │   Message   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │                   ▼
                           │            ┌─────────────┐
                           │            │  Database   │
                           │            │  Logs Action│
                           │            └─────────────┘
                           ▼
                    ┌─────────────┐
                    │  WebSocket  │
                    │  Notifies   │
                    └─────────────┘
```

**Example Request:**
```bash
curl -X POST http://localhost:3011/api/agents/outreach \
  -H "Content-Type: application/json" \
  -d '{
    "farmers": [
      {"id": "123", "name": "John", "phone": "+254700000001"},
      {"id": "456", "name": "Mary", "phone": "+254700000002"}
    ],
    "message": "Rain expected tomorrow. Consider harvesting maize.",
    "channel": "sms"
  }'
```

### 2. Multi-Agent Analysis (Crew AI)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Extension  │     │   Backend   │     │  Crew AI    │     │   Frontend  │
│  Officer    │────►│   Routes    │────►│  Agents     │────►│  Dashboard  │
│  Requests   │     │  Validates  │     │  Execute    │     │  Displays   │
│  Analysis   │     │             │     │             │     │  Results    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Database   │     │  Research   │
                    │  Gets Data  │────►│   Agent     │
                    └─────────────┘     └─────────────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  Analysis   │
                                      │   Agent     │
                                      └─────────────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │   Report    │
                                      │   Writer    │
                                      └─────────────┘
```

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/agents/crew/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Nairobi",
    "farmer_data": [...],
    "analysis_type": "disease"
  }'
```

### 3. Report Generation Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Scheduled  │     │   Backend   │     │  Crew AI    │     │    PDF      │
│  (Cron)     │────►│   Triggers  │────►│  Pipeline   │────►│  Generated  │
│             │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │    Queue    │     │  Research   │
                    │  (Redis)    │────►│   Agent     │
                    └─────────────┘     └─────────────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  Analysis   │
                                      │   Agent     │
                                      └─────────────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │   Report    │
                                      │   Writer    │
                                      └─────────────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │   Email/    │
                                      │  Download   │
                                      └─────────────┘
```

---

## Deployment Checklist

### 1. Environment Setup
```bash
# Production environment variables
cp .env.example .env
# Edit .env with production values
```

```env
# .env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/ag_extension
REDIS_URL=redis://host:6379
JWT_SECRET=your-super-secret-key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AGENT_ZERO_URL=http://agent-zero:8000
CREW_AI_URL=http://crew-ai:8001
```

### 2. Build & Start
```bash
# Using docker-compose
docker-compose -f docker-compose.yml -f docker-compose.agents.yml up -d --build

# Check services
docker ps
curl http://localhost:3001/health
curl http://localhost:8000/health
curl http://localhost:8001/health
```

### 3. Production Services
| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | User Interface |
| Backend API | http://localhost:3001 | REST API |
| Agent Zero | http://localhost:8000 | Task Automation |
| Crew AI | http://localhost:8001 | Complex Analysis |
| PostgreSQL | localhost:5432 | Data Store |
| Redis | localhost:6379 | Cache/Queue |

---

## Monitoring & Logging

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f agent-zero
docker-compose logs -f crew-ai

# Monitor resources
docker stats

# Check specific service
docker-compose logs agent-zero --tail=100
```

---

## Scaling Considerations

### Horizontal Scaling
- Run multiple backend instances behind a load balancer (nginx)
- Use Redis for session sharing
- Database connection pooling

### Vertical Scaling
- Increase Docker resource limits
- Use larger VM instances for AI agents
- Enable GPU for Crew AI (optional)

### High Availability
- Run multiple replicas of each service
- Set up database replication
- Use managed Redis (AWS ElastiCache, etc.)
