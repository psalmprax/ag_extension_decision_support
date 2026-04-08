# 🚀 **AG Extension Decision Support - Production Deployment Guide**

## 📋 **Complete Production Readiness & Deployment Documentation**

*Version: 1.0.0 | Last Updated: 2026-03-24*

---

## 🎯 **Executive Summary**

This guide provides comprehensive instructions for deploying the AG Extension Decision Support platform to production. The platform includes:

- **Browser Extension**: AI-powered agricultural assistant with photo analysis and GPS
- **Web Dashboard**: Full-featured management interface with modern UX
- **Backend API**: Node.js/Express server with AI integrations
- **Database**: PostgreSQL with Prisma ORM

**Current Status**: ✅ All UI gaps closed, fully functional, ready for production deployment.

---

## 📋 **Pre-Deployment Checklist**

### ✅ **Development Completion Status**
- [x] Browser extension AI chat integration
- [x] Photo capture and disease analysis
- [x] GPS location services
- [x] Share functionality (Web Share API + clipboard)
- [x] Context menus and right-click interactions
- [x] Breadcrumb navigation
- [x] Bulk action buttons (SMS, CSV export)
- [x] Drag-and-drop file operations
- [x] Offline detection and sync status
- [x] Enhanced file upload capabilities

### 🔧 **Pre-Deployment Requirements**
- [ ] Domain name and DNS configuration
- [ ] SSL certificate (Let's Encrypt or commercial)
- [ ] Cloud hosting account (AWS, Google Cloud, Azure, DigitalOcean, etc.)
- [ ] Database hosting (PostgreSQL recommended)
- [ ] Email service (SendGrid, Mailgun, etc.)
- [ ] Payment processor setup (Stripe, PayPal)
- [ ] AI service API keys (OpenAI, Anthropic, etc.)
- [ ] Browser extension developer accounts (Chrome, Firefox, Edge)

---

## 1. **Infrastructure Setup** 🏗️

### **1.1 Domain & DNS Configuration**

```bash
# Example DNS records for yourdomain.com
# A Records
@     A     1.2.3.4        # Frontend
api   A     1.2.3.5        # Backend API

# CNAME Records (if using CDN)
www   CNAME yourdomain.com
cdn   CNAME cdn.yourdomain.com
```

### **1.2 SSL Certificate Setup**

```bash
# Option A: Let's Encrypt (Free, Recommended)
sudo apt update
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Option B: Cloud Provider Certificates
# AWS Certificate Manager
# Google Cloud Load Balancer
# Azure App Service Certificates
```

### **1.3 Database Setup**

```bash
# PostgreSQL Database (Recommended)
# Options: Supabase, PlanetScale, Neon, Railway, AWS RDS

# Create production database
createdb ag_extension_prod

# Environment variable
DATABASE_URL=postgresql://user:password@host:5432/ag_extension_prod
```

---

## 2. **Backend Deployment** 🖥️

### **2.1 Environment Configuration**

Create `.env.production` file:

```env
# Server Configuration
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@host:5432/ag_extension_prod

# Authentication
JWT_SECRET=your-super-secure-random-jwt-secret-here
JWT_EXPIRES_IN=7d

# AI Services
OPENAI_API_KEY=sk-prod-...
ANTHROPIC_API_KEY=sk-ant-prod-...
GOOGLE_VERTEX_PROJECT_ID=your-project-id
AZURE_OPENAI_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

# Payment Processing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret

# Email Service
SENDGRID_API_KEY=SG.your-sendgrid-key
EMAIL_FROM=noreply@yourdomain.com

# External APIs
WEATHER_API_KEY=your-weather-api-key
FAO_API_KEY=your-fao-api-key

# File Storage
AWS_S3_BUCKET=your-s3-bucket
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# CORS
FRONTEND_URL=https://yourdomain.com
EXTENSION_ID=your-chrome-extension-id
```

### **2.2 Deployment Options**

#### **Option A: Docker Compose (Recommended)**

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.production
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    ports:
      - "3001:3001"
    depends_on:
      - db
    volumes:
      - uploads:/app/uploads

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: ag_extension_prod
      POSTGRES_USER: your_user
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
  uploads:
```

```bash
# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run db:migrate
docker-compose -f docker-compose.prod.yml exec backend npm run db:seed
```

#### **Option B: Railway (Simple)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set DATABASE_URL=your-db-url
# ... set all other variables
```

#### **Option C: Vercel/Railway Combo**

```bash
# Backend on Railway
railway login
railway init ag-extension-backend
railway up

# Environment setup via Railway dashboard
# Add all environment variables from .env.production
```

### **2.3 Database Migration**

```bash
# Run Prisma migrations
cd ag-extension-dashboard/src/backend
npx prisma migrate deploy

# Seed initial data
npm run db:seed

# Generate Prisma client
npx prisma generate
```

---

## 3. **Frontend Deployment** 🌐

### **3.1 Build Configuration**

Create production environment file:

```env
# .env.production
VITE_API_URL=https://api.yourdomain.com
VITE_APP_ENV=production
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_PAYPAL_CLIENT_ID=your-paypal-client-id
```

### **3.2 Deployment Options**

#### **Option A: Vercel (Recommended)**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd ag-extension-dashboard/src/frontend
vercel --prod

# Configure build settings in vercel.json:
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "env": {
    "VITE_API_URL": "https://api.yourdomain.com"
  }
}
```

#### **Option B: Netlify**

```bash
# Build the application
npm run build

# Deploy via Netlify CLI
npx netlify-cli deploy --prod --dir=dist

# Or connect GitHub repository for automatic deployments
```

#### **Option C: Cloudflare Pages**

```bash
# Install Wrangler
npm install -g wrangler

# Configure and deploy
wrangler pages dev dist
wrangler pages publish dist
```

### **3.3 CDN Configuration**

```bash
# Cloudflare setup (recommended)
# 1. Add your domain to Cloudflare
# 2. Configure DNS records
# 3. Enable SSL/TLS
# 4. Set up caching rules

# Example Cloudflare Page Rules:
/api/* -> Cache Level: Bypass
/static/* -> Cache Level: Aggressive, Browser Cache TTL: 1 year
```

---

## 4. **Browser Extension Deployment** 📱

### **4.1 Build for Production**

```bash
cd ag-extension-browser-ext

# Build for all browsers
npm run build
npm run build:firefox

# Package extensions
npm run zip      # Chrome/Edge
npm run zip:firefox  # Firefox
```

### **4.2 Extension Stores Submission**

#### **Chrome Web Store**
1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
2. Create new item
3. Upload `ag-extension-browser-ext/dist/chrome-mv3-prod.zip`
4. Fill store listing:
   - Name: AG Extension Decision Support
   - Description: AI-powered agricultural assistant
   - Screenshots: 1280x800, 640x400 (min 3)
   - Category: Productivity
   - Languages: English + supported locales
5. Privacy Policy URL
6. Support website
7. Price: Free

#### **Firefox Add-ons**
1. Go to [Firefox Developer Hub](https://addons.mozilla.org/developers/)
2. Submit new add-on
3. Upload `ag-extension-browser-ext/dist/firefox-mv2-prod.zip`
4. Fill required information
5. Wait for review (usually 1-2 weeks)

#### **Microsoft Edge**
1. Go to [Microsoft Edge Developer](https://partner.microsoft.com/dashboard/microsoftedge/)
2. Submit extension
3. Use same package as Chrome
4. Fill store details

### **4.3 Extension Configuration**

Update extension manifest for production:

```json
// manifest.json (Chrome)
{
  "manifest_version": 3,
  "name": "AG Extension Decision Support",
  "version": "1.0.0",
  "host_permissions": [
    "https://api.yourdomain.com/*"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## 5. **Service Worker & Offline Support** ⚙️

### **5.1 Create Service Worker**

```javascript
// public/sw.js
const CACHE_NAME = 'ag-extension-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
```

### **5.2 Register Service Worker**

```javascript
// src/index.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
```

---

## 6. **Push Notifications Setup** 🔔

### **6.1 VAPID Key Generation**

```bash
# Generate VAPID keys
npm install -g web-push
web-push generate-vapid-keys

# Output:
# Public Key: your-public-key
# Private Key: your-private-key
```

### **6.2 Backend Configuration**

```javascript
// server/pushNotifications.js
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:your-email@yourdomain.com',
  'your-public-key',
  'your-private-key'
);

app.post('/api/push/send', (req, res) => {
  const { subscription, payload } = req.body;

  webpush.sendNotification(subscription, JSON.stringify(payload))
    .then(() => res.status(200).json({ message: 'Notification sent' }))
    .catch((error) => {
      console.error('Push notification error:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    });
});
```

### **6.3 Frontend Integration**

```javascript
// Request notification permission
async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    // Register push manager
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'your-public-key'
    });

    // Send subscription to backend
    await fetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

---

## 7. **Monitoring & Analytics** 📊

### **7.1 Error Tracking (Sentry)**

```javascript
// src/index.js (Frontend)
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
  integrations: [new BrowserTracing()],
  tracesSampleRate: 1.0,
});
```

```javascript
// Backend error tracking
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "your-backend-sentry-dsn",
  environment: "production",
  tracesSampleRate: 1.0,
});
```

### **7.2 Analytics Setup**

```javascript
// Google Analytics
// Replace with your GA4 measurement ID
gtag('config', 'GA-MEASUREMENT-ID');

// Custom events
gtag('event', 'ai_chat_started', {
  event_category: 'engagement',
  event_label: 'AI Assistant'
});
```

### **7.3 Performance Monitoring**

```javascript
// Web Vitals tracking
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

---

## 8. **Security Configuration** 🔐

### **8.1 Server Security Headers**

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com;" always;

    # Rate limiting
    limit_req zone=api burst=10 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### **8.2 API Security**

```javascript
// Rate limiting
const rateLimit = require('express-rate-limit');
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// CORS configuration
const cors = require('cors');
app.use(cors({
  origin: ['https://yourdomain.com', 'chrome-extension://your-extension-id'],
  credentials: true
}));
```

### **8.3 Database Security**

```sql
-- Create read-only user for analytics
CREATE USER analytics_user WITH PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE ag_extension_prod TO analytics_user;
GRANT USAGE ON SCHEMA public TO analytics_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_user;

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_policy ON users
  FOR ALL USING (auth.uid() = user_id);
```

---

## 9. **Backup & Recovery** 💾

### **9.1 Database Backups**

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U user -d ag_extension_prod > backup_$DATE.sql

# Upload to cloud storage
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/

# Clean old backups (keep 30 days)
find /backups -name "backup_*.sql" -mtime +30 -delete
```

### **9.2 File Backups**

```bash
# Backup uploaded files
rsync -av /app/uploads/ /backups/uploads/

# Cloud sync
aws s3 sync /backups/uploads/ s3://your-file-backup-bucket/
```

### **9.3 Recovery Testing**

```bash
# Test database restore
createdb ag_extension_test_restore
psql -d ag_extension_test_restore < backup_latest.sql

# Verify data integrity
psql -d ag_extension_test_restore -c "SELECT COUNT(*) FROM users;"
```

---

## 10. **Performance Optimization** ⚡

### **10.1 Frontend Optimization**

```javascript
// Code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Image optimization
import { lazyload } from 'react-lazyload';

// Bundle analysis
npm install --save-dev webpack-bundle-analyzer
```

### **10.2 Database Optimization**

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_visits_farmer_date ON visits(farmer_id, visit_date);
CREATE INDEX CONCURRENTLY idx_messages_conversation ON messages(conversation_id);

-- Query optimization
EXPLAIN ANALYZE SELECT * FROM farmers WHERE region = 'Nairobi';
```

### **10.3 CDN Configuration**

```javascript
// Image optimization with CDN
<img
  src={`https://cdn.yourdomain.com/image.jpg?w=800&h=600&fit=crop&auto=format`}
  loading="lazy"
  alt="Optimized image"
/>
```

---

## 11. **Go-Live Checklist** ✅

### **Pre-Launch**
- [ ] All environment variables configured
- [ ] SSL certificates valid and installed
- [ ] Domain DNS properly configured
- [ ] Database backups tested and verified
- [ ] API endpoints responding correctly
- [ ] Browser extension published to stores
- [ ] Service worker tested and working
- [ ] Push notifications configured
- [ ] Error tracking and monitoring active
- [ ] Performance benchmarks established

### **Launch Day**
- [ ] Deploy backend to production
- [ ] Deploy frontend to production
- [ ] Update DNS records if needed
- [ ] Verify SSL certificates
- [ ] Test all critical user flows
- [ ] Monitor error rates and performance
- [ ] Execute smoke tests
- [ ] Verify extension functionality

### **Post-Launch**
- [ ] Monitor application performance
- [ ] Check error logs and fix issues
- [ ] User feedback collection
- [ ] A/B testing for optimizations
- [ ] Regular security updates
- [ ] Performance monitoring and optimization

---

## 12. **Troubleshooting & Support** 🆘

### **Common Issues**

#### **API Connection Issues**
```bash
# Check backend logs
docker-compose logs backend

# Test API endpoints
curl -X GET https://api.yourdomain.com/health

# Check CORS configuration
curl -H "Origin: https://yourdomain.com" \
     -X GET https://api.yourdomain.com/api/users
```

#### **Extension Issues**
```javascript
// Check extension console
chrome://extensions/
→ Enable "Developer mode"
→ Click extension "background page"
→ Check console for errors
```

#### **Database Issues**
```bash
# Check database connections
psql -h localhost -U user -d ag_extension_prod -c "SELECT version();"

# Monitor slow queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

---

## 13. **Maintenance & Updates** 🔄

### **Regular Tasks**
- **Daily**: Monitor error rates and performance metrics
- **Weekly**: Database backups and security scans
- **Monthly**: Dependency updates and security patches
- **Quarterly**: Performance audits and user feedback review

### **Update Process**
```bash
# Rolling deployment strategy
# 1. Deploy to staging environment
# 2. Run automated tests
# 3. Deploy to 10% of production traffic
# 4. Monitor for issues
# 5. Gradually increase traffic to 100%
# 6. Monitor post-deployment

# Example with Docker
docker-compose up -d backend_new
# Wait for health checks
docker-compose stop backend_old
docker-compose rm backend_old
```

---

## 📞 **Support Contacts**

- **Technical Support**: dev@yourdomain.com
- **User Support**: support@yourdomain.com
- **Security Issues**: security@yourdomain.com
- **Emergency**: +1-XXX-XXX-XXXX

---

## 🎉 **Congratulations!**

Your AG Extension Decision Support platform is now successfully deployed to production. Monitor the initial weeks closely and gather user feedback to drive continuous improvements.

**Happy farming! 🌾🚜**