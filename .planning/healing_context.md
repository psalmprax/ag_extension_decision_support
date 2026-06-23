# 🚨 Self-Healing Diagnostics Context

The command `(cd ag-extension-dashboard/src/backend && npx jest src/__tests__/toolRegistry.test.ts)` failed with exit code 1 on 2026-06-20 17:02:25.

## 🔍 Critical Errors & Traces
```text
      at setupSwagger (src/utils/swagger.ts:50:13)
    ✓ should reject invalid inputs (69 ms)
    Attempted to log "prisma:error 
    Invalid `prisma.systemConfig.findUnique()` invocation:
      13 |         } catch (error) {
      14 |             logger.error(`Failed to get system config for key ${key}:`, error);
      at Object.zc (node_modules/@prisma/internals/src/logger.ts:13:11)
      at EventEmitter.<anonymous> (node_modules/@prisma/client/src/runtime/getPrismaClient.ts:430:24)
      at ei.handleAndLogRequestError (node_modules/@prisma/client/src/runtime/RequestHandler.ts:177:25)
      at ei.request (node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
      at a (node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
      at SystemConfigService.get (src/services/systemConfigService.ts:12:28)
      at SystemConfigService.getStripeKey (src/services/systemConfigService.ts:40:21)
      at PaymentService.initializeStripe (src/services/paymentService.ts:61:27)
    Attempted to log "prisma:error 
    Invalid `prisma.systemConfig.findUnique()` invocation:
      13 |         } catch (error) {
      14 |             logger.error(`Failed to get system config for key ${key}:`, error);
      at Object.zc (node_modules/@prisma/internals/src/logger.ts:13:11)
      at EventEmitter.<anonymous> (node_modules/@prisma/client/src/runtime/getPrismaClient.ts:430:24)
      at ei.handleAndLogRequestError (node_modules/@prisma/client/src/runtime/RequestHandler.ts:177:25)
      at ei.request (node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
      at a (node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
      at SystemConfigService.get (src/services/systemConfigService.ts:12:28)
      at SystemConfigService.getPayPalKey (src/services/systemConfigService.ts:44:21)
      at PaymentService.initializePayPal (src/services/paymentService.ts:97:32)
2026-06-20 17:02:25 [31merror[39m: Failed to get system config for key STRIPE_SECRET_KEY: 
Invalid `prisma.systemConfig.findUnique()` invocation:
  errorCode: [90mundefined[39m,
  name: [32m'PrismaClientInitializationError'[39m,
```

## 📋 Full Execution Output
```text
2026-06-20 17:02:21 [33mwarn[39m: CREDENTIAL_ENCRYPTION_KEY not set or too short — using runtime-generated key (not persistent across restarts)
2026-06-20 17:02:23 [33mwarn[39m: Email service not configured. Emails will be logged only.
2026-06-20 17:02:23 [33mwarn[39m: SMS service not configured - messages will be logged only
2026-06-20 17:02:24 [33mwarn[39m: VAPID keys not configured. Push notifications will not work.
2026-06-20 17:02:24 [33mwarn[39m: WhatsApp service not configured - messages will be logged only
  console.log
    Swagger API documentation available at /api-docs

      at setupSwagger (src/utils/swagger.ts:50:13)

PASS src/__tests__/toolRegistry.test.ts (9.566 s)
  Tool Registry
    ✓ should have all expected tools registered (8 ms)
    ✓ should have unique tool names (no duplicates) (1 ms)
    ✓ each tool should have required fields (65 ms)
    ✓ tool descriptions should be meaningful and agricultural-focused (3 ms)
    ✓ tool map should contain all tools for quick lookup (21 ms)
  NASA POWER Tool
    ✓ should have correct schema validation (9 ms)
    ✓ should reject invalid inputs (69 ms)
    ✓ should have NASA POWER registered in the tool registry (1 ms)
  FAO Knowledge Service
    ✓ should chunk text into segments on word boundaries (59 ms)
    ✓ should handle empty text gracefully (2 ms)
    ✓ should not split mid-word (chunks contain complete words) (1 ms)
  Health Check Endpoint
    ✓ should have health routes defined in app (2469 ms)
  Tool Execution Validation
    ✓ all tool schemas should be compilable (valid Zod schemas) (10 ms)
    ✓ weather tool should parse correctly (1 ms)
    ✓ schedule visit tool should validate correctly (1 ms)

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        9.98 s
Ran all test suites matching /src\/__tests__\/toolRegistry.test.ts/i.

  ●  Cannot log after tests are done. Did you forget to wait for something async in your test?
    Attempted to log "prisma:error 
    Invalid `prisma.systemConfig.findUnique()` invocation:


    Can't reach database server at `localhost:7501`

    Please make sure your database server is running at `localhost:7501`.".

      10 |                 where: { key },
      11 |             });
    > 12 |             return config ? config.value : null;
         |                            ^
      13 |         } catch (error) {
      14 |             logger.error(`Failed to get system config for key ${key}:`, error);
      15 |             return null;

      at console.log (node_modules/@jest/console/build/CustomConsole.js:141:10)
      at Object.zc (node_modules/@prisma/internals/src/logger.ts:13:11)
      at EventEmitter.<anonymous> (node_modules/@prisma/client/src/runtime/getPrismaClient.ts:430:24)
      at ei.handleAndLogRequestError (node_modules/@prisma/client/src/runtime/RequestHandler.ts:177:25)
      at ei.request (node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
      at a (node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
      at SystemConfigService.get (src/services/systemConfigService.ts:12:28)
      at SystemConfigService.getStripeKey (src/services/systemConfigService.ts:40:21)
      at PaymentService.initializeStripe (src/services/paymentService.ts:61:27)


  ●  Cannot log after tests are done. Did you forget to wait for something async in your test?
    Attempted to log "prisma:error 
    Invalid `prisma.systemConfig.findUnique()` invocation:


    Can't reach database server at `localhost:7501`

    Please make sure your database server is running at `localhost:7501`.".

      10 |                 where: { key },
      11 |             });
    > 12 |             return config ? config.value : null;
         |                            ^
      13 |         } catch (error) {
      14 |             logger.error(`Failed to get system config for key ${key}:`, error);
      15 |             return null;

      at console.log (node_modules/@jest/console/build/CustomConsole.js:141:10)
      at Object.zc (node_modules/@prisma/internals/src/logger.ts:13:11)
      at EventEmitter.<anonymous> (node_modules/@prisma/client/src/runtime/getPrismaClient.ts:430:24)
      at ei.handleAndLogRequestError (node_modules/@prisma/client/src/runtime/RequestHandler.ts:177:25)
      at ei.request (node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
      at a (node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
      at SystemConfigService.get (src/services/systemConfigService.ts:12:28)
      at SystemConfigService.getPayPalKey (src/services/systemConfigService.ts:44:21)
      at PaymentService.initializePayPal (src/services/paymentService.ts:97:32)

2026-06-20 17:02:25 [31merror[39m: Failed to get system config for key STRIPE_SECRET_KEY: 
Invalid `prisma.systemConfig.findUnique()` invocation:


Can't reach database server at `localhost:7501`

Please make sure your database server is running at `localhost:7501`. {
  clientVersion: [32m'6.19.2'[39m,
  errorCode: [90mundefined[39m,
  retryable: [90mundefined[39m,
  name: [32m'PrismaClientInitializationError'[39m,
  stack: [32m'PrismaClientInitializationError: \n'[39m +
    [32m'Invalid `prisma.systemConfig.findUnique()` invocation:\n'[39m +
    [32m'\n'[39m +
    [32m'\n'[39m +
    [32m"Can't reach database server at `localhost:7501`\n"[39m +
    [32m'\n'[39m +
    [32m'Please make sure your database server is running at `localhost:7501`.\n'[39m +
    [32m'    at ei.handleRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:242:13)\n'[39m +
    [32m'    at ei.handleAndLogRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)\n'[39m +
    [32m'    at ei.request (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)\n'[39m +
    [32m'    at a (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)\n'[39m +
    [32m'    at SystemConfigService.get (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:12:28)\n'[39m +
    [32m'    at SystemConfigService.getStripeKey (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:40:21)\n'[39m +
    [32m'    at PaymentService.initializeStripe (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/paymentService.ts:61:27)'[39m,
  [[32mSymbol(level)[39m]: [32m'error'[39m,
  [[32mSymbol(splat)[39m]: [
    PrismaClientInitializationError: 
    Invalid `prisma.systemConfig.findUnique()` invocation:
    
    
    Can't reach database server at `localhost:7501`
    
    Please make sure your database server is running at `localhost:7501`.
        at ei.handleRequestError [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39mnode_modules/[4m@prisma/client[24m/src/runtime/RequestHandler.ts:242:13[90m)[39m
        at ei.handleAndLogRequestError [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39mnode_modules/[4m@prisma/client[24m/src/runtime/RequestHandler.ts:174:12[90m)[39m
        at ei.request [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39mnode_modules/[4m@prisma/client[24m/src/runtime/RequestHandler.ts:143:12[90m)[39m
        at a [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39mnode_modules/[4m@prisma/client[24m/src/runtime/getPrismaClient.ts:833:24[90m)[39m
        at SystemConfigService.get [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39msrc/services/systemConfigService.ts:12:28[90m)[39m
        at SystemConfigService.getStripeKey [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39msrc/services/systemConfigService.ts:40:21[90m)[39m
        at PaymentService.initializeStripe [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39msrc/services/paymentService.ts:61:27[90m)[39m {
      clientVersion: [32m'6.19.2'[39m,
      errorCode: [90mundefined[39m,
      retryable: [90mundefined[39m
    }
  ],
  [[32mSymbol(message)[39m]: [32m'2026-06-20 17:02:25 [ERROR]: Failed to get system config for key STRIPE_SECRET_KEY: \n'[39m +
    [32m'Invalid `prisma.systemConfig.findUnique()` invocation:\n'[39m +
    [32m'\n'[39m +
    [32m'\n'[39m +
    [32m"Can't reach database server at `localhost:7501`\n"[39m +
    [32m'\n'[39m +
    [32m'Please make sure your database server is running at `localhost:7501`. {\n'[39m +
    [32m"  clientVersion: '6.19.2',\n"[39m +
    [32m'  errorCode: undefined,\n'[39m +
    [32m'  retryable: undefined,\n'[39m +
    [32m"  name: 'PrismaClientInitializationError',\n"[39m +
    [32m"  stack: 'PrismaClientInitializationError: \\n' +\n"[39m +
    [32m"    'Invalid `prisma.systemConfig.findUnique()` invocation:\\n' +\n"[39m +
    [32m"    '\\n' +\n"[39m +
    [32m"    '\\n' +\n"[39m +
    [32m'    "Can\'t reach database server at `localhost:7501`\\n" +\n'[39m +
    [32m"    '\\n' +\n"[39m +
    [32m"    'Please make sure your database server is running at `localhost:7501`.\\n' +\n"[39m +
    [32m"    '    at ei.handleRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:242:13)\\n' +\n"[39m +
    [32m"    '    at ei.handleAndLogRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)\\n' +\n"[39m +
    [32m"    '    at ei.request (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)\\n' +\n"[39m +
    [32m"    '    at a (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)\\n' +\n"[39m +
    [32m"    '    at SystemConfigService.get (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:12:28)\\n' +\n"[39m +
    [32m"    '    at SystemConfigService.getStripeKey (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:40:21)\\n' +\n"[39m +
    [32m"    '    at PaymentService.initializeStripe (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/paymentService.ts:61:27)',\n"[39m +
    [32m"  [Symbol(level)]: 'error',\n"[39m +
    [32m'  [Symbol(splat)]: [\n'[39m +
    [32m'    PrismaClientInitializationError: \n'[39m +
    [32m'    Invalid `prisma.systemConfig.findUnique()` invocation:\n'[39m +
    [32m'    \n'[39m +
    [32m'    \n'[39m +
    [32m"    Can't reach database server at `localhost:7501`\n"[39m +
    [32m'    \n'[39m +
    [32m'    Please make sure your database server is running at `localhost:7501`.\n'[39m +
    [32m'        at ei.handleRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:242:13)\n'[39m +
    [32m'        at ei.handleAndLogRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)\n'[39m +
    [32m'        at ei.request (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)\n'[39m +
    [32m'        at a (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)\n'[39m +
    [32m'        at SystemConfigService.get (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:12:28)\n'[39m +
    [32m'        at SystemConfigService.getStripeKey (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:40:21)\n'[39m +
    [32m'        at PaymentService.initializeStripe (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/paymentService.ts:61:27) {\n'[39m +
    [32m"      clientVersion: '6.19.2',\n"[39m +
    [32m'      errorCode: undefined,\n'[39m +
    [32m'      retryable: undefined\n'[39m +
    [32m'    }\n'[39m +
    [32m'  ],\n'[39m +
    [32m'  [Symbol(message)]: \'{"clientVersion":"6.19.2","level":"error","message":"Failed to get system config for key STRIPE_SECRET_KEY: \\\\nInvalid `prisma.systemConfig.findUnique()` invocation:\\\\n\\\\n\\\\nCan\\\'t reach database server at `localhost:7501`\\\\n\\\\nPlease make sure your database server is running at `localhost:7501`.","name":"PrismaClientInitializationError","stack":"PrismaClientInitializationError: \\\\nInvalid `prisma.systemConfig.findUnique()` invocation:\\\\n\\\\n\\\\nCan\\\'t reach database server at `localhost:7501`\\\\n\\\\nPlease make sure your database server is running at `localhost:7501`.\\\\n    at ei.handleRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:242:13)\\\\n    at ei.handleAndLogRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)\\\\n    at ei.request (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)\\\\n    at a (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)\\\\n    at SystemConfigService.get (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:12:28)\\\\n    at SystemConfigService.getStripeKey (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:40:21)\\\\n    at PaymentService.initializeStripe (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/paymentService.ts:61:27)","timestamp":"2026-06-20 17:02:25"}\'\n'[39m +
    [32m'}'[39m
}
2026-06-20 17:02:25 [31merror[39m: Failed to get system config for key PAYPAL_CLIENT_ID: 
Invalid `prisma.systemConfig.findUnique()` invocation:


Can't reach database server at `localhost:7501`

Please make sure your database server is running at `localhost:7501`. {
  clientVersion: [32m'6.19.2'[39m,
  errorCode: [90mundefined[39m,
  retryable: [90mundefined[39m,
  name: [32m'PrismaClientInitializationError'[39m,
  stack: [32m'PrismaClientInitializationError: \n'[39m +
    [32m'Invalid `prisma.systemConfig.findUnique()` invocation:\n'[39m +
    [32m'\n'[39m +
    [32m'\n'[39m +
    [32m"Can't reach database server at `localhost:7501`\n"[39m +
    [32m'\n'[39m +
    [32m'Please make sure your database server is running at `localhost:7501`.\n'[39m +
    [32m'    at ei.handleRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:242:13)\n'[39m +
    [32m'    at ei.handleAndLogRequestError (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)\n'[39m +
    [32m'    at ei.request (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)\n'[39m +
    [32m'    at a (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)\n'[39m +
    [32m'    at SystemConfigService.get (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:12:28)\n'[39m +
    [32m'    at SystemConfigService.getPayPalKey (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/systemConfigService.ts:44:21)\n'[39m +
    [32m'    at PaymentService.initializePayPal (/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/paymentService.ts:97:32)'[39m,
  [[32mSymbol(level)[39m]: [32m'error'[39m,
  [[32mSymbol(splat)[39m]: [
    PrismaClientInitializationError: 
    Invalid `prisma.systemConfig.findUnique()` invocation:
    
    
    Can't reach database server at `localhost:7501`
    
    Please make sure your database server is running at `localhost:7501`.
        at ei.handleRequestError [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39mnode_modules/[4m@prisma/client[24m/src/runtime/RequestHandler.ts:242:13[90m)[39m
        at ei.handleAndLogRequestError [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39mnode_modules/[4m@prisma/client[24m/src/runtime/RequestHandler.ts:174:12[90m)[39m
        at ei.request [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39mnode_modules/[4m@prisma/client[24m/src/runtime/RequestHandler.ts:143:12[90m)[39m
        at a [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39mnode_modules/[4m@prisma/client[24m/src/runtime/getPrismaClient.ts:833:24[90m)[39m
        at SystemConfigService.get [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39msrc/services/systemConfigService.ts:12:28[90m)[39m
        at SystemConfigService.getPayPalKey [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39msrc/services/systemConfigService.ts:44:21[90m)[39m
        at PaymentService.initializePayPal [90m(/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/[39msrc/services/paymentService.ts:97:32[90m)[39m {
      clientVersion: [32m'6.19.2'[39m,
      errorCode: [90mundefined[39m,
      retryable: [90mundefined[39m
    }
  ],
  [[32mSymbol(message)[39m]: [32m'2026-06-20 17:02:25 [ERROR]: Failed to get system config for key PAYPAL_CLIENT_ID: \n'[39m +
    [32m'Invalid `prisma.systemConfig.findUnique()` invocation:\n'[39m +
    [32m'\n'[39m +
    [32m'\n'[39m +
    [32m"Can't reach database server at `localhost:7501`\n"[39m +
    [32m'\n'[39m +
    [32m'Please make sure your database server is running at `localhost:7501`. {\n'[39m +
    [32m"  clientVersion: '6.19.2',\n"[39m +
    [32m'  errorCode: undefined,\n'[39m +
    [32m'  retryable: undefined,\n'[39m +
    [32m"  name: 'PrismaClientInitializationError',\n"[39m +
    [32m"  stack: 'PrismaClientInitializationError: \\n' +\n"[39m +
    [32m"    'Invalid `prisma.systemConfig.findUnique()` invocation:\\n' +\n"[39m +
    [32m"    '\\n' +\n"[39m +
    [32m"    '\\n' +\n"[39m +
    [32m'    "Can\'t reach database server at `localhost:7501`\\n" +\n'[39m +
```

---
*Created automatically by agent-helper heal.*
