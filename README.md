# Ag-Extension Decision Support Dashboard

An AI-powered agricultural extension platform providing farmers with real-time insights, disease monitoring, market data, and personalized recommendations.

## Features

- **AI-Powered Chat**: Conversational AI assistant for agricultural queries
- **Weather Forecasting**: Localized weather predictions with farming advice
- **Disease Monitoring**: AI-powered plant disease detection and alerts
- **Market Intelligence**: Real-time agricultural commodity prices
- **Visit Scheduling**: Automated farmer visit coordination
- **Multi-Agent Orchestration**: Specialized AI agents for different agricultural domains
- **MCP Protocol Support**: 21+ agricultural tools available via Model Context Protocol

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **AI Providers**: OpenAI, Groq, Azure OpenAI, Google Vertex, Anthropic
- **Frontend**: React, Tailwind CSS, Vite
- **Development**: Docker Compose

## Local Development Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (via Docker)

### Quick Start

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd ag-extension-dashboard
   ```

2. **Start services:**
   ```bash
   docker-compose up -d app-db redis
   ```

3. **Install dependencies:**
   ```bash
   cd src/backend
   npm install
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

5. **Run development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

### Required for Development

```bash
# AI Provider (choose one)
OPENAI_API_KEY=your-openai-key
# or
GROQ_API_KEY=your-groq-key

# Database (auto-configured with Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:7501/ag_extension
REDIS_URL=redis://localhost:7502
```

### Production Deployment

For production deployment, ensure these environment variables are set:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
AI_PRIMARY_PROVIDER=groq  # or openai, azure_openai, google_vertex, anthropic
GROQ_API_KEY=your-groq-api-key  # or appropriate API key for chosen provider
JWT_SECRET=your-very-long-random-secret-key
CORS_ORIGIN=https://your-production-domain.com
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/mcp/tools` - List available MCP tools
- `POST /api/mcp/tools/call` - Execute MCP tools
- `POST /api/chatbot/message` - AI chat interface
- `GET /api/farmers` - Farmer management
- `GET /api/market-prices` - Agricultural market data

## MCP Tools Available

The platform provides 21+ specialized agricultural AI tools:

- Weather forecasting with farming advice
- Plant disease diagnosis
- Market price analysis
- Crop yield prediction
- Satellite NDVI analysis
- Agricultural research
- Multi-language translation
- Memory management
- Agent task orchestration

## Architecture

See [ag-extension-dashboard-architecture.md](ag-extension-dashboard-architecture.md) for detailed system architecture.

### CI/CD Pipeline

The platform is deployed via an automated GitHub Actions pipeline. See the [Deploy Workflow Reference](docs/DEPLOY_WORKFLOW.md) for triggers, jobs, build caching, secrets, and troubleshooting.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[License information]
