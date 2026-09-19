---
id: "1f42f844-84db-4370-8c43-6e70edaacd7f"
title: "Git lesson from fe1fdbd8f0cc"
kind: lesson
created: 2026-09-14
updated: 2026-09-14
review_after: 2026-10-14
status: proposed
tags: ["git", "lesson"]
filenames: ["ag-extension-dashboard/src/backend/src/app.ts", "ag-extension-dashboard/src/backend/src/middleware/rateLimitMiddleware.ts", "ag-extension-dashboard/src/backend/src/routes/chatbot/index.ts"]
created_at: "2026-09-14T20:33:50.907686395+00:00"
content_hash: "c8f986751ac7de0c23b77d3db70909d4b43448e7e900e412964505119e7c8f38"
source_tool: "buddy_memory_lifecycle:git"
source_confidence: 0.860
source_commit: "fe1fdbd8f0cc471f149a3afd3b5d828d1f7590dd"
source_content_hash: "c8f986751ac7de0c23b77d3db70909d4b43448e7e900e412964505119e7c8f38"
---

Git lesson from fe1fdbd8f0cc

Source commit: fe1fdbd8f0cc
Paths: ag-extension-dashboard/src/backend/src/app.ts, ag-extension-dashboard/src/backend/src/middleware/rateLimitMiddleware.ts, ag-extension-dashboard/src/backend/src/routes/chatbot/index.ts
Summary: fix(security): dedicated rate-limit bucket for AI/LLM endpoints AI routes (chat completions, messages, public demo, /ai synthesis/speech/ vision/agents, /ai/diseases, /ai/memories) shared one 1000req/15min bucket with cheap CRUD traffic, letting a single user drain the entire AI budget. Add aiRateLimiter (Redis-backed,