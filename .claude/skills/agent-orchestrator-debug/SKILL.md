---
name: agent-orchestrator-debug
description: Debug and troubleshoot the agent orchestration system, self-healing service, and agent task dispatch. Use when investigating agent task failures, handoff issues, health monitoring, or agent registration problems.
---

# Agent Orchestrator Debugging

## Quick Diagnostics

```bash
# Check agent health via health endpoint
curl http://localhost:7500/health | jq '.services.agent_orchestrator'

# Check diagnostics
curl http://localhost:7500/api/v1/system/diagnostics | jq '.agents'

# Check self-healing status
curl http://localhost:7500/api/v1/system/health | jq '.selfHealing'
```

## Architecture

### AgentOrchestrator

Singleton that manages agent task lifecycle:

```
Task Request
  -> AgentOrchestrator.dispatchTask()
    -> selectBestAgent(taskType, agentId)
    -> Execute task via agent
    -> Handle success/failure/handoff
    -> Retry on failure (maxRetries: 3)
```

### Task Lifecycle

```
pending -> running -> completed
pending -> running -> failed (after maxRetries)
pending -> running -> handed_off -> (re-dispatched to another agent)
```

### SelfHealingService

```
startMonitoring(intervalMs: 60000)
  -> runHealthChecks() every interval
  -> Track consecutiveFailures per component
  -> After 3 failures: trigger recovery action
  -> Recovery log for audit
```

### Agent Registration

Agents register with:
- `agentId`: unique identifier
- `name`: display name
- `capabilities`: array of task types
- `maxConcurrentTasks`: load limit (default 5)

## Key Files

| File | Purpose |
|---|---|
| src/backend/src/services/agentOrchestrator.ts | Task dispatch, agent registry, handoff logic |
| src/backend/src/services/agentTelemetry.ts | Agent telemetry and metrics |
| src/backend/src/services/selfHealing.ts | Health monitoring and auto-recovery |
| src/backend/src/routes/agents.ts | Agent API routes |
| src/backend/src/routes/systemHealth.ts | System health routes |
| src/backend/src/routes/diagnostics.ts | Diagnostic routes |
| src/agents/main.py | Agent Zero FastAPI service |
| src/agents/crew_main.py | CrewAI multi-agent orchestration |

## Common Issues

### No available agent for task type

`selectBestAgent()` fails if:
1. No agent registered with matching capability
2. All matching agents are at maxConcurrentTasks
3. All matching agents are offline

Check agent registration in logs.

### Agent health degrading

`SelfHealingService` tracks `consecutiveFailures`. After 3, it marks component unhealthy and may trigger recovery.

Check: `GET /api/v1/system/health`

### Task stuck in "running"

If agent crashes mid-task, task stays "running" forever. No automatic timeout. Check `activeTasks` map in orchestrator.

### Handoff not working

`handoffLog` tracks all handoffs. If handoff fails:
1. Target agent may not have the required capability
2. Target agent may be at capacity
3. Handoff logic in `dispatchTask()` may have a bug

### Agent Zero (Python) vs Node.js agents

Two separate agent systems:
- **Agent Zero** (Python, FastAPI): CloakBrowser, stealth scraping
- **AgentOrchestrator** (Node.js): Task dispatch, health monitoring

They communicate via HTTP. If Agent Zero is down, Node.js orchestrator doesn't know — it just gets empty responses from `StealthScraperService`.

### Self-healing recovery not triggering

Check `maxConsecutiveFailures` (default: 3). Check if component is registered:
```typescript
selfHealingService.registerComponent('my-component');
```
