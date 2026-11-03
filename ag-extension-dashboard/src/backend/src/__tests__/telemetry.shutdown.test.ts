const mockStart = jest.fn();
const mockShutdown = jest.fn().mockResolvedValue(undefined);

jest.mock('@opentelemetry/sdk-node', () => ({
    NodeSDK: jest.fn().mockImplementation(() => ({
        start: mockStart,
        shutdown: mockShutdown,
    })),
}));

jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
    getNodeAutoInstrumentations: () => [],
}));

jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
    OTLPTraceExporter: jest.fn(),
}));

jest.mock('@opentelemetry/resources', () => ({
    resourceFromAttributes: (attributes: Record<string, unknown>) => attributes,
}));

jest.mock('@opentelemetry/semantic-conventions', () => ({
    ATTR_SERVICE_NAME: 'service.name',
    ATTR_DEPLOYMENT_ENVIRONMENT_NAME: 'deployment.environment.name',
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

type TelemetryModule = typeof import('../utils/telemetry');

function loadTelemetry(): TelemetryModule {
    let loaded: TelemetryModule | undefined;
    jest.isolateModules(() => {
        loaded = require('../utils/telemetry') as TelemetryModule;
    });
    return loaded!;
}

describe('telemetry lifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('starts the SDK once even when init is called repeatedly', async () => {
        const telemetry = loadTelemetry();

        await Promise.all([telemetry.initTelemetry(), telemetry.initTelemetry()]);
        await telemetry.initTelemetry();

        expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it('flushes and stops the SDK on shutdown', async () => {
        const telemetry = loadTelemetry();
        await telemetry.initTelemetry();

        await telemetry.shutdownTelemetry();

        expect(mockShutdown).toHaveBeenCalledTimes(1);
    });

    it('does not install its own SIGTERM handler', async () => {
        const before = process.listenerCount('SIGTERM');

        const telemetry = loadTelemetry();
        await telemetry.initTelemetry();

        expect(process.listenerCount('SIGTERM')).toBe(before);
    });

    it('is a no-op when shutdown runs before init', async () => {
        const telemetry = loadTelemetry();

        await telemetry.shutdownTelemetry();

        expect(mockShutdown).not.toHaveBeenCalled();
    });
});
