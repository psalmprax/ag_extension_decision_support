# Codebase Map

Generated: 2026-06-21T06:52:12Z | Files: 500 | Described: 0/500
<!-- gsd:codebase-meta {"generatedAt":"2026-06-21T06:52:12Z","fingerprint":"8643df7cb8d9eb7727fc79d76f470f49b3e9a128","fileCount":500,"truncated":true} -->
Note: Truncated to first 500 files. Run with higher --max-files to include all.

### (root)/
- `.env.example`
- `.gitignore`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `Jenkinsfile`
- `README.md`
- `REVIEW.md`

### .github/workflows/
- `.github/workflows/ci-cd.yml`
- `.github/workflows/deploy-all.yml`
- `.github/workflows/deploy-stage.yml`
- `.github/workflows/diagnostics-prod.yml`
- `.github/workflows/ssl-cert-fix.yml`

### .kilocode/
- `.kilocode/package-lock.json`
- `.kilocode/task_history.json`

### .kilocode/tasks/f359260b-60eb-4677-81d2-a58d784e6662/
- *(22 files: 22 .json)*

### ag-extension-browser-ext/
- `ag-extension-browser-ext/package-lock.json`
- `ag-extension-browser-ext/package.json`
- `ag-extension-browser-ext/postcss.config.js`
- `ag-extension-browser-ext/tailwind.config.js`
- `ag-extension-browser-ext/tsconfig.json`
- `ag-extension-browser-ext/wxt.config.ts`

### ag-extension-browser-ext/assets/
- `ag-extension-browser-ext/assets/index.css`

### ag-extension-browser-ext/entrypoints/background/
- `ag-extension-browser-ext/entrypoints/background/main.ts`

### ag-extension-browser-ext/entrypoints/content-scripts/
- `ag-extension-browser-ext/entrypoints/content-scripts/main.ts`

### ag-extension-browser-ext/entrypoints/popup/
- `ag-extension-browser-ext/entrypoints/popup/App.tsx`
- `ag-extension-browser-ext/entrypoints/popup/index.html`
- `ag-extension-browser-ext/entrypoints/popup/main.tsx`

### ag-extension-browser-ext/entrypoints/sidepanel/
- `ag-extension-browser-ext/entrypoints/sidepanel/App.tsx`
- `ag-extension-browser-ext/entrypoints/sidepanel/index.html`
- `ag-extension-browser-ext/entrypoints/sidepanel/main.tsx`

### ag-extension-browser-ext/entrypoints/sidepanel/components/
- `ag-extension-browser-ext/entrypoints/sidepanel/components/VisitLogger.tsx`

### ag-extension-browser-ext/shared/
- `ag-extension-browser-ext/shared/apiQueue.ts`
- `ag-extension-browser-ext/shared/config.ts`

### ag-extension-browser-ext/shared/components/
- `ag-extension-browser-ext/shared/components/ErrorBoundary.tsx`

### ag-extension-browser-ext/shared/hooks/
- `ag-extension-browser-ext/shared/hooks/usePersistence.ts`

### ag-extension-dashboard/
- `ag-extension-dashboard/.env.example`
- `ag-extension-dashboard/deploy.py`
- `ag-extension-dashboard/deploy.sh`
- `ag-extension-dashboard/DEPLOYMENT.md`
- `ag-extension-dashboard/docker-bake.hcl`
- `ag-extension-dashboard/docker-compose.agents.yml`
- `ag-extension-dashboard/docker-compose.dev.yml`
- `ag-extension-dashboard/docker-compose.prod.yml`
- `ag-extension-dashboard/docker-compose.staging.yml`
- `ag-extension-dashboard/docker-compose.yml`
- `ag-extension-dashboard/Dockerfile.db`

### ag-extension-dashboard/scripts/
- `ag-extension-dashboard/scripts/audit-locales.js`
- `ag-extension-dashboard/scripts/check-cert-expiry.sh`
- `ag-extension-dashboard/scripts/check-json-translations.js`
- `ag-extension-dashboard/scripts/check-translations.js`
- `ag-extension-dashboard/scripts/ci-manager.sh`
- `ag-extension-dashboard/scripts/db-backup.sh`
- `ag-extension-dashboard/scripts/deploy-apps.sh`
- `ag-extension-dashboard/scripts/generate-missing-translations.js`
- `ag-extension-dashboard/scripts/orchestrate-migration.sh`
- `ag-extension-dashboard/scripts/reembed.js`
- `ag-extension-dashboard/scripts/smart-deploy.sh`
- `ag-extension-dashboard/scripts/sync-locales.js`
- `ag-extension-dashboard/scripts/translation-audit-report.json`
- `ag-extension-dashboard/scripts/verify_deployment.sh`
- `ag-extension-dashboard/scripts/verify-real-translations.js`

### ag-extension-dashboard/src/agents/
- `ag-extension-dashboard/src/agents/crew_main.py`
- `ag-extension-dashboard/src/agents/Dockerfile.agent-zero`
- `ag-extension-dashboard/src/agents/Dockerfile.crew-ai`
- `ag-extension-dashboard/src/agents/main.py`
- `ag-extension-dashboard/src/agents/requirements.txt`

### ag-extension-dashboard/src/agents/tools/cloakbrowser/
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/__init__.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/cloak_facebook_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/cloak_instagram_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/cloak_linkedin_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/cloak_platform_config.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/cloak_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/cloak_tiktok_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/cloak_x_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/facebook_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/instagram_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/linkedin_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/models.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/scanner_base.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/tiktok_scanner.py`
- `ag-extension-dashboard/src/agents/tools/cloakbrowser/x_scanner.py`

### ag-extension-dashboard/src/backend/
- `ag-extension-dashboard/src/backend/.dockerignore`
- `ag-extension-dashboard/src/backend/.env.example`
- `ag-extension-dashboard/src/backend/.eslintrc.json`
- `ag-extension-dashboard/src/backend/.npmrc`
- `ag-extension-dashboard/src/backend/Dockerfile`
- `ag-extension-dashboard/src/backend/Dockerfile.production`
- `ag-extension-dashboard/src/backend/jest.config.js`
- `ag-extension-dashboard/src/backend/lint_output.txt`
- `ag-extension-dashboard/src/backend/package-lock.json`
- `ag-extension-dashboard/src/backend/package.json`
- `ag-extension-dashboard/src/backend/seed-db.ts`
- `ag-extension-dashboard/src/backend/seed.js`
- `ag-extension-dashboard/src/backend/test-fao.ts`
- `ag-extension-dashboard/src/backend/test-nasa.ts`
- `ag-extension-dashboard/src/backend/test-tool.ts`
- `ag-extension-dashboard/src/backend/translation_log.txt`
- `ag-extension-dashboard/src/backend/tsconfig.json`

### ag-extension-dashboard/src/backend/.husky/
- `ag-extension-dashboard/src/backend/.husky/pre-commit`

### ag-extension-dashboard/src/backend/migrations/
- `ag-extension-dashboard/src/backend/migrations/002_add_pgvector_support.sql`
- `ag-extension-dashboard/src/backend/migrations/003_convert_to_pgvector_native.sql`
- `ag-extension-dashboard/src/backend/migrations/add_alert_tracking_columns.sql`
- `ag-extension-dashboard/src/backend/migrations/add_language_preference.ts`
- `ag-extension-dashboard/src/backend/migrations/add_more_alert_columns.sql`
- `ag-extension-dashboard/src/backend/migrations/add_notifications_table.sql`
- `ag-extension-dashboard/src/backend/migrations/add_support_tickets_table.sql`
- `ag-extension-dashboard/src/backend/migrations/fix_missing_columns.sql`

### ag-extension-dashboard/src/backend/prisma/
- `ag-extension-dashboard/src/backend/prisma/fix-demo-user.sql`
- `ag-extension-dashboard/src/backend/prisma/schema.prisma`
- `ag-extension-dashboard/src/backend/prisma/seed-dashboard-data.sql`
- `ag-extension-dashboard/src/backend/prisma/seed-quality-data.sql`
- `ag-extension-dashboard/src/backend/prisma/seed.ts`

### ag-extension-dashboard/src/backend/prisma/migrations/
- `ag-extension-dashboard/src/backend/prisma/migrations/migration_lock.toml`

### ag-extension-dashboard/src/backend/prisma/migrations/20260310213744_init_usage/
- `ag-extension-dashboard/src/backend/prisma/migrations/20260310213744_init_usage/migration.sql`

### ag-extension-dashboard/src/backend/prisma/migrations/20260324164313_add_share_tables/
- `ag-extension-dashboard/src/backend/prisma/migrations/20260324164313_add_share_tables/migration.sql`

### ag-extension-dashboard/src/backend/prisma/migrations/20260324174107_add_order_fields/
- `ag-extension-dashboard/src/backend/prisma/migrations/20260324174107_add_order_fields/migration.sql`

### ag-extension-dashboard/src/backend/prisma/migrations/20260324180312_add_content_type/
- `ag-extension-dashboard/src/backend/prisma/migrations/20260324180312_add_content_type/migration.sql`

### ag-extension-dashboard/src/backend/prisma/migrations/20260614143047_sync_schema_to_prisma/
- `ag-extension-dashboard/src/backend/prisma/migrations/20260614143047_sync_schema_to_prisma/migration.sql`

### ag-extension-dashboard/src/backend/scripts/
- `ag-extension-dashboard/src/backend/scripts/ai-translate-all.ts`
- `ag-extension-dashboard/src/backend/scripts/check_db_from_app.ts`
- `ag-extension-dashboard/src/backend/scripts/extract-locales.ts`
- `ag-extension-dashboard/src/backend/scripts/seed_multimodal.ts`
- `ag-extension-dashboard/src/backend/scripts/verify_multimodal.ts`

### ag-extension-dashboard/src/backend/src/
- `ag-extension-dashboard/src/backend/src/app.ts`
- `ag-extension-dashboard/src/backend/src/index.ts`
- `ag-extension-dashboard/src/backend/src/test_phase1.ts`
- `ag-extension-dashboard/src/backend/src/test-alfa.ts`
- `ag-extension-dashboard/src/backend/src/test-fao-rag.ts`
- `ag-extension-dashboard/src/backend/src/test-rag-hybrid.ts`
- `ag-extension-dashboard/src/backend/src/test-rag.ts`
- `ag-extension-dashboard/src/backend/src/test-tool-flow.ts`
- `ag-extension-dashboard/src/backend/src/types.d.ts`

### ag-extension-dashboard/src/backend/src/__tests__/
- `ag-extension-dashboard/src/backend/src/__tests__/analyticsHelpers.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/billing.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/diagnostics.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/emailWorkflows.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/errorHandler.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/farmers_extended.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/farmers.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/fields.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/healthCheck.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/knowledgeService.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/ollama.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/ragV2.test.ts`
- `ag-extension-dashboard/src/backend/src/__tests__/toolRegistry.test.ts`

### ag-extension-dashboard/src/backend/src/config/
- `ag-extension-dashboard/src/backend/src/config/index.ts`

### ag-extension-dashboard/src/backend/src/middleware/
- `ag-extension-dashboard/src/backend/src/middleware/auditMiddleware.ts`
- `ag-extension-dashboard/src/backend/src/middleware/authorize.ts`
- `ag-extension-dashboard/src/backend/src/middleware/errorHandler.ts`
- `ag-extension-dashboard/src/backend/src/middleware/i18nUrlMiddleware.ts`
- `ag-extension-dashboard/src/backend/src/middleware/rateLimitMiddleware.ts`
- `ag-extension-dashboard/src/backend/src/middleware/securityGate.ts`
- `ag-extension-dashboard/src/backend/src/middleware/usageMiddleware.ts`
- `ag-extension-dashboard/src/backend/src/middleware/validate.ts`
- `ag-extension-dashboard/src/backend/src/middleware/validationMiddleware.ts`

### ag-extension-dashboard/src/backend/src/queues/
- `ag-extension-dashboard/src/backend/src/queues/connection.ts`
- `ag-extension-dashboard/src/backend/src/queues/emailQueue.ts`
- `ag-extension-dashboard/src/backend/src/queues/index.ts`

### ag-extension-dashboard/src/backend/src/routes/
- *(35 files: 35 .ts)*

### ag-extension-dashboard/src/backend/src/schemas/
- `ag-extension-dashboard/src/backend/src/schemas/index.ts`

### ag-extension-dashboard/src/backend/src/scripts/
- `ag-extension-dashboard/src/backend/src/scripts/ai-translate-all.ts`
- `ag-extension-dashboard/src/backend/src/scripts/ai-translate.ts`
- `ag-extension-dashboard/src/backend/src/scripts/audit-translations.ts`
- `ag-extension-dashboard/src/backend/src/scripts/seedPlans.ts`

### ag-extension-dashboard/src/backend/src/services/
- *(43 files: 43 .ts)*

### ag-extension-dashboard/src/backend/src/services/aiProvider/
- `ag-extension-dashboard/src/backend/src/services/aiProvider/aiProvider.ts`
- `ag-extension-dashboard/src/backend/src/services/aiProvider/assetLibrary.ts`
- `ag-extension-dashboard/src/backend/src/services/aiProvider/types.ts`

### ag-extension-dashboard/src/backend/src/services/aiProvider/providers/
- `ag-extension-dashboard/src/backend/src/services/aiProvider/providers/anthropic.ts`
- `ag-extension-dashboard/src/backend/src/services/aiProvider/providers/azureOpenAI.ts`
- `ag-extension-dashboard/src/backend/src/services/aiProvider/providers/googleVertex.ts`
- `ag-extension-dashboard/src/backend/src/services/aiProvider/providers/groq.ts`
- `ag-extension-dashboard/src/backend/src/services/aiProvider/providers/ollama.ts`
- `ag-extension-dashboard/src/backend/src/services/aiProvider/providers/openAI.ts`

### ag-extension-dashboard/src/backend/src/services/data/
- `ag-extension-dashboard/src/backend/src/services/data/faoKnowledgeService.ts`
- `ag-extension-dashboard/src/backend/src/services/data/faostatService.ts`
- `ag-extension-dashboard/src/backend/src/services/data/knowledgeSyncOrchestrator.ts`
- `ag-extension-dashboard/src/backend/src/services/data/nasaPowerService.ts`
- `ag-extension-dashboard/src/backend/src/services/data/soilGridsService.ts`
- `ag-extension-dashboard/src/backend/src/services/data/tropicalKnowledgeSources.ts`

### ag-extension-dashboard/src/backend/src/services/security/
- `ag-extension-dashboard/src/backend/src/services/security/aegisShield.ts`
- `ag-extension-dashboard/src/backend/src/services/security/credentialVault.ts`
- `ag-extension-dashboard/src/backend/src/services/security/skillVetter.ts`

### ag-extension-dashboard/src/backend/src/test/
- `ag-extension-dashboard/src/backend/src/test/setup.ts`

### ag-extension-dashboard/src/backend/src/tools/
- `ag-extension-dashboard/src/backend/src/tools/agentOrchestrationTools.ts`
- `ag-extension-dashboard/src/backend/src/tools/apiBudgetTool.ts`
- `ag-extension-dashboard/src/backend/src/tools/cropYieldForecastTool.ts`
- `ag-extension-dashboard/src/backend/src/tools/deepResearchTool.ts`
- `ag-extension-dashboard/src/backend/src/tools/diseaseAlertTool.ts`
- `ag-extension-dashboard/src/backend/src/tools/getDate.ts`
- `ag-extension-dashboard/src/backend/src/tools/marketPriceTool.ts`
- `ag-extension-dashboard/src/backend/src/tools/memoryTools.ts`
- `ag-extension-dashboard/src/backend/src/tools/nasaPowerTool.ts`
- `ag-extension-dashboard/src/backend/src/tools/plantDiseaseTools.ts`
- `ag-extension-dashboard/src/backend/src/tools/registerAlertTool.ts`
- `ag-extension-dashboard/src/backend/src/tools/registry.ts`
- `ag-extension-dashboard/src/backend/src/tools/researchTool.ts`
- `ag-extension-dashboard/src/backend/src/tools/satelliteNDVITool.ts`
- `ag-extension-dashboard/src/backend/src/tools/scheduleVisit.ts`
- `ag-extension-dashboard/src/backend/src/tools/translationTool.ts`
- `ag-extension-dashboard/src/backend/src/tools/types.ts`
- `ag-extension-dashboard/src/backend/src/tools/weatherTool.ts`

### ag-extension-dashboard/src/backend/src/utils/
- `ag-extension-dashboard/src/backend/src/utils/fallbackData.ts`
- `ag-extension-dashboard/src/backend/src/utils/generateFrontendTranslations.ts`
- `ag-extension-dashboard/src/backend/src/utils/logger.ts`
- `ag-extension-dashboard/src/backend/src/utils/privacy.ts`
- `ag-extension-dashboard/src/backend/src/utils/response.ts`
- `ag-extension-dashboard/src/backend/src/utils/retry.ts`
- `ag-extension-dashboard/src/backend/src/utils/safeResponse.ts`
- `ag-extension-dashboard/src/backend/src/utils/schemas.ts`
- `ag-extension-dashboard/src/backend/src/utils/startupValidation.ts`
- `ag-extension-dashboard/src/backend/src/utils/swagger.ts`
- `ag-extension-dashboard/src/backend/src/utils/telemetry.ts`
- `ag-extension-dashboard/src/backend/src/utils/translateAll.ts`
- `ag-extension-dashboard/src/backend/src/utils/translationGenerator.ts`
- `ag-extension-dashboard/src/backend/src/utils/translations.ts`
- `ag-extension-dashboard/src/backend/src/utils/translationSource.ts`

### ag-extension-dashboard/src/backend/src/workers/
- `ag-extension-dashboard/src/backend/src/workers/alertWorker.ts`
- `ag-extension-dashboard/src/backend/src/workers/emailWorker.ts`
- `ag-extension-dashboard/src/backend/src/workers/ingestionWorker.ts`

### ag-extension-dashboard/src/frontend/
- `ag-extension-dashboard/src/frontend/.dockerignore`
- `ag-extension-dashboard/src/frontend/.eslintrc.cjs`
- `ag-extension-dashboard/src/frontend/.gitignore`
- `ag-extension-dashboard/src/frontend/.prettierrc`
- `ag-extension-dashboard/src/frontend/audit_report.json`
- `ag-extension-dashboard/src/frontend/Dockerfile`
- `ag-extension-dashboard/src/frontend/Dockerfile.production`
- `ag-extension-dashboard/src/frontend/index.html`
- `ag-extension-dashboard/src/frontend/inject_translations_final.ts`
- `ag-extension-dashboard/src/frontend/nginx.conf`
- `ag-extension-dashboard/src/frontend/package-lock.json`
- `ag-extension-dashboard/src/frontend/package.json`
- `ag-extension-dashboard/src/frontend/playwright.config.ts`
- `ag-extension-dashboard/src/frontend/postcss.config.js`

### ag-extension-dashboard/src/frontend/.github/workflows/
- `ag-extension-dashboard/src/frontend/.github/workflows/playwright.yml`

### ag-extension-dashboard/src/frontend/.husky/
- `ag-extension-dashboard/src/frontend/.husky/pre-commit`

### ag-extension-dashboard/src/frontend/playwright-report/
- `ag-extension-dashboard/src/frontend/playwright-report/index.html`

### ag-extension-dashboard/src/frontend/public/
- `ag-extension-dashboard/src/frontend/public/mockServiceWorker.js`

### ag-extension-dashboard/src/frontend/public/locales/
- *(24 files: 24 .json)*

### ag-extension-dashboard/src/frontend/scripts/
- `ag-extension-dashboard/src/frontend/scripts/generate-icons.py`

### ag-extension-dashboard/src/frontend/src/
- `ag-extension-dashboard/src/frontend/src/App.tsx`
- `ag-extension-dashboard/src/frontend/src/index.css`
- `ag-extension-dashboard/src/frontend/src/main.tsx`

### ag-extension-dashboard/src/frontend/src/__tests__/
- `ag-extension-dashboard/src/frontend/src/__tests__/authService.test.ts`
- `ag-extension-dashboard/src/frontend/src/__tests__/billingService.test.ts`
- `ag-extension-dashboard/src/frontend/src/__tests__/client.test.ts`
- `ag-extension-dashboard/src/frontend/src/__tests__/farmerService.test.ts`
- `ag-extension-dashboard/src/frontend/src/__tests__/knowledgeService.test.ts`
- `ag-extension-dashboard/src/frontend/src/__tests__/LanguageContext.test.tsx`
- `ag-extension-dashboard/src/frontend/src/__tests__/storeActions.test.ts`
- `ag-extension-dashboard/src/frontend/src/__tests__/translationUtils.test.ts`
- `ag-extension-dashboard/src/frontend/src/__tests__/useAppStore.test.ts`
- `ag-extension-dashboard/src/frontend/src/__tests__/visitService.test.ts`
- `ag-extension-dashboard/src/frontend/src/__tests__/weatherService.test.ts`

### ag-extension-dashboard/src/frontend/src/api/
- *(30 files: 30 .ts)*

### ag-extension-dashboard/src/frontend/src/components/
- *(32 files: 32 .tsx)*

### ag-extension-dashboard/src/frontend/src/components/Cyber/
- `ag-extension-dashboard/src/frontend/src/components/Cyber/ActionableAI.tsx`
- `ag-extension-dashboard/src/frontend/src/components/Cyber/AlphaAgentOps.tsx`
- `ag-extension-dashboard/src/frontend/src/components/Cyber/AlphaAI.tsx`
- `ag-extension-dashboard/src/frontend/src/components/Cyber/CropCycleGantt.tsx`
- `ag-extension-dashboard/src/frontend/src/components/Cyber/IsometricFarmOverview.tsx`
- `ag-extension-dashboard/src/frontend/src/components/Cyber/SystemOverview.tsx`

### ag-extension-dashboard/src/frontend/src/components/KnowledgeBase/
- `ag-extension-dashboard/src/frontend/src/components/KnowledgeBase/index.tsx`
- `ag-extension-dashboard/src/frontend/src/components/KnowledgeBase/KnowledgeSidebar.tsx`
- `ag-extension-dashboard/src/frontend/src/components/KnowledgeBase/KnowledgeStats.tsx`
- `ag-extension-dashboard/src/frontend/src/components/KnowledgeBase/ReasoningVisuals.tsx`

### ag-extension-dashboard/src/frontend/src/components/__tests__/
- `ag-extension-dashboard/src/frontend/src/components/__tests__/BillingDashboard.test.tsx`

### ag-extension-dashboard/src/frontend/src/components/forms/
- `ag-extension-dashboard/src/frontend/src/components/forms/FarmerRegistrationForm.tsx`
- `ag-extension-dashboard/src/frontend/src/components/forms/VisitModal.tsx`
- `ag-extension-dashboard/src/frontend/src/components/forms/VisitSynthesisForm.tsx`

### ag-extension-dashboard/src/frontend/src/components/layout/
- `ag-extension-dashboard/src/frontend/src/components/layout/AppHeader.tsx`
- `ag-extension-dashboard/src/frontend/src/components/layout/AppSidebar.tsx`

### ag-extension-dashboard/src/frontend/src/components/ui/
- `ag-extension-dashboard/src/frontend/src/components/ui/Badge.tsx`
- `ag-extension-dashboard/src/frontend/src/components/ui/Button.tsx`
- `ag-extension-dashboard/src/frontend/src/components/ui/Dialog.tsx`
- `ag-extension-dashboard/src/frontend/src/components/ui/Input.tsx`
- `ag-extension-dashboard/src/frontend/src/components/ui/Select.tsx`
- `ag-extension-dashboard/src/frontend/src/components/ui/Textarea.tsx`

### ag-extension-dashboard/src/frontend/src/config/
- `ag-extension-dashboard/src/frontend/src/config/navItems.ts`

### ag-extension-dashboard/src/frontend/src/hooks/
- `ag-extension-dashboard/src/frontend/src/hooks/useAppAuth.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useAppBootstrap.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useAppChat.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useAppModalState.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useAppSearch.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useAppShortcuts.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useAppSync.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useAppTheme.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useBillingActions.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useBulkActions.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useThemeClasses.ts`
- `ag-extension-dashboard/src/frontend/src/hooks/useWebRTC.ts`

### ag-extension-dashboard/src/frontend/src/lib/
- `ag-extension-dashboard/src/frontend/src/lib/animations.ts`
- `ag-extension-dashboard/src/frontend/src/lib/cn.ts`
- `ag-extension-dashboard/src/frontend/src/lib/i18n.ts`
- `ag-extension-dashboard/src/frontend/src/lib/LanguageContext.tsx`
- `ag-extension-dashboard/src/frontend/src/lib/missing-translations-report.json`
- `ag-extension-dashboard/src/frontend/src/lib/realFirst.ts`
- `ag-extension-dashboard/src/frontend/src/lib/schemas.ts`
- `ag-extension-dashboard/src/frontend/src/lib/swRegistration.ts`
- `ag-extension-dashboard/src/frontend/src/lib/ThemeProvider.tsx`
- `ag-extension-dashboard/src/frontend/src/lib/translationUtils.ts`

### ag-extension-dashboard/src/frontend/src/pages/
- `ag-extension-dashboard/src/frontend/src/pages/Agents.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/AnalyticsPage.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/CropsFields.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/DashboardPage.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/DemoPage.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/DiseaseDiagnosis.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/EmailWorkflows.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/FarmerChatPage.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/ForgotPassword.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/LandingPage.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/Login.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/MCPTools.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/Memory.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/PortfolioPage.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/Register.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/ReportsPage.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/SMS.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/SystemHealth.tsx`
- `ag-extension-dashboard/src/frontend/src/pages/Telemetry.tsx`
