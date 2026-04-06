# Ag-Extension Decision Support - Environment Variables Setup

## Required Environment Variables for Production

### Core System Variables
```bash
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secret-jwt-key-change-in-production-make-it-long-and-random
CORS_ORIGIN=https://your-frontend-domain.onrender.com
```

### Database Configuration
```bash
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
```

### Redis Cache (Optional but recommended)
```bash
REDIS_URL=redis://username:password@hostname:6379
```

### AI Provider Configuration
Choose your primary AI provider and set the corresponding API keys:

#### Option 1: Azure OpenAI (Recommended)
```bash
AI_PRIMARY_PROVIDER=azure_openai
AI_PRIMARY_MODEL=gpt-4
AI_PRIMARY_REGION=eastus
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
```

#### Option 2: OpenAI Direct
```bash
AI_PRIMARY_PROVIDER=openai
AI_PRIMARY_MODEL=gpt-4
OPENAI_API_KEY=your-openai-api-key
```

#### Option 3: Google Vertex AI
```bash
AI_PRIMARY_PROVIDER=google_vertex
AI_PRIMARY_MODEL=gemini-pro
AI_PRIMARY_REGION=us-central1
GOOGLE_VERTEX_PROJECT_ID=your-google-cloud-project-id
```

#### Fallback AI Provider (different from primary)
```bash
AI_FALLBACK_PROVIDER=groq
AI_FALLBACK_MODEL=llama2-70b-4096
GROQ_API_KEY=your-groq-api-key
```

### Embeddings (for knowledge base)
```bash
AI_EMBEDDINGS_PROVIDER=openai
AI_EMBEDDINGS_MODEL=text-embedding-3-large
```

### Speech (Optional)
```bash
AI_SPEECH_PROVIDER=azure_speech
AI_SPEECH_VOICE=standard
```

### External APIs
```bash
WEATHER_API_KEY=your-weather-api-key
TAVILY_API_KEY=your-tavily-api-key
```

### Payment Processing (Optional)
```bash
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

## Render Deployment Instructions

1. Go to your Render dashboard: https://dashboard.render.com/
2. Select your Ag-Extension backend service
3. Go to Environment settings
4. Add all the required environment variables listed above
5. Trigger a manual deployment

## Minimal Setup for Testing

For a basic working deployment, set these minimum variables:

```bash
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secret-jwt-key-change-in-production-make-it-long-and-random
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
AI_PRIMARY_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
CORS_ORIGIN=https://your-frontend-domain.onrender.com
```

## Database Setup

1. Create a PostgreSQL database (Render, Supabase, or any PostgreSQL provider)
2. Set the DATABASE_URL to point to your database
3. The application will automatically create tables and seed initial data

## Troubleshooting

If the deployment still fails:

1. Check the deployment logs in Render dashboard
2. Verify DATABASE_URL is correct and accessible
3. Ensure JWT_SECRET is set and long enough
4. Check that at least one AI provider API key is set
5. Verify CORS_ORIGIN matches your frontend URL