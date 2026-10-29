import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions';
import { logger } from './logger';

// OTEL_EXPORTER_OTLP_ENDPOINT is a base URL (the exporter appends /v1/traces),
// while OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is the complete trace URL. Passing
// neither leaves the exporter on its own defaults.
const traceExporter = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  ? new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT })
  : new OTLPTraceExporter();

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'ag-extension-backend',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
  }),
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
    }),
  ],
});

let startup: Promise<void> | null = null;

/**
 * Starts the SDK once. The returned promise settles when the global tracer
 * provider is registered, so callers (and tests) can await a working pipeline
 * instead of racing the asynchronous start.
 */
export const initTelemetry = (): Promise<void> => {
  if (startup) return startup;

  const ready = (async () => {
    try {
      sdk.start();
      logger.info('OpenTelemetry SDK started successfully');
    } catch (error) {
      logger.error('Failed to start OpenTelemetry SDK', error);
    }
  })();
  startup = ready;
  return ready;
};

/**
 * Flushes pending spans and stops the SDK. Called from the application's own
 * graceful-shutdown sequence — telemetry must not install a SIGTERM handler that
 * exits the process before the HTTP server, database and queues are drained.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!startup) return;
  await startup;
  try {
    await sdk.shutdown();
    logger.info('OpenTelemetry SDK shut down successfully');
  } catch (error) {
    logger.error('Error shutting down OpenTelemetry SDK', error);
  }
}
