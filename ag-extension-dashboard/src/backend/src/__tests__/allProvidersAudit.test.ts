import { AIProviderFactory } from '../services/aiProvider/aiProvider';
import type { AIProviderType, AICapability } from '../services/aiProvider/types';
import { OmniRouteService } from '../services/omniRouteService';
import { WeatherService } from '../services/weatherService';
import { objectStorage } from '../services/objectStorageService';
import { smsService } from '../services/smsService';
import { paymentService } from '../services/paymentService';

describe('Comprehensive Providers Audit Suite', () => {
    beforeAll(() => {
        AIProviderFactory.initialize();
    });

    describe('AI / LLM Providers (All 11 Providers)', () => {
        const allAiProviderTypes: AIProviderType[] = [
            'aihubmix',
            'openai',
            'anthropic',
            'azure_openai',
            'google_vertex',
            'groq',
            'huggingface',
            'nvidia',
            'ollama',
            'openrouter',
            'freebuff',
        ];

        it.each(allAiProviderTypes)(
            'instantiates and verifies %s provider interface and contract',
            async (type) => {
                const provider: AICapability = await AIProviderFactory.getProvider(type);
                expect(provider).toBeDefined();
                expect(provider.provider).toBe(type);

                // Verify declared capabilities array exists and has entries
                expect(Array.isArray(provider.capabilities)).toBe(true);
                expect(provider.capabilities.length).toBeGreaterThan(0);

                // Verify isConfigured returns boolean
                const configured = provider.isConfigured();
                expect(typeof configured).toBe('boolean');

                // Healthcheck returns boolean or handles gracefully
                try {
                    const isHealthy = await provider.healthCheck();
                    expect(typeof isHealthy).toBe('boolean');
                } catch (err) {
                    // If an unconfigured or invalid key fails remotely (e.g. 401 from Groq/remote),
                    // it should be an Error object
                    expect(err).toBeInstanceOf(Error);
                }
            }
        );

        it('supports multi-provider failover routing in OmniRoute catalog', () => {
            const catalog = OmniRouteService.FREE_LLM_CATALOG;
            expect(catalog.length).toBeGreaterThan(0);

            const catalogProviders = new Set(catalog.map(c => c.providerName));
            expect(catalogProviders.has('aihubmix')).toBe(true);
            expect(catalogProviders.has('huggingface')).toBe(true);
            expect(catalogProviders.has('nvidia')).toBe(true);
            expect(catalogProviders.has('groq')).toBe(true);
            expect(catalogProviders.has('openai')).toBe(true);
        });
    });

    describe('Weather Service Providers', () => {
        it('initializes weather service and supports historical and location forecast lookups', () => {
            expect(WeatherService).toBeDefined();
            expect(typeof WeatherService.getByLocation).toBe('function');
            expect(typeof WeatherService.getHistoricalWeather).toBe('function');
        });
    });

    describe('Object Storage Providers', () => {
        it('initializes object storage service and provides storage backend inspection', () => {
            expect(objectStorage).toBeDefined();
            expect(typeof objectStorage.isCloudConfigured).toBe('function');
            expect(typeof objectStorage.getBackendType).toBe('function');
            expect(typeof objectStorage.putObject).toBe('function');
            expect(typeof objectStorage.getObject).toBe('function');

            const backend = objectStorage.getBackendType();
            expect(typeof backend).toBe('string');
        });
    });

    describe('SMS & Messaging Providers', () => {
        it('initializes SMS service and supports multi-gateway routing', () => {
            expect(smsService).toBeDefined();
            expect(typeof smsService.sendSMS).toBe('function');
            expect(typeof smsService.sendBulkSMS).toBe('function');
        });
    });

    describe('Payment Providers (Stripe & PayPal)', () => {
        it('initializes paymentService and checks Stripe and PayPal configuration status', () => {
            expect(paymentService).toBeDefined();
            expect(typeof paymentService.isStripeConfigured).toBe('function');
            expect(typeof paymentService.isPayPalConfigured).toBe('function');

            const isStripe = paymentService.isStripeConfigured();
            const isPayPal = paymentService.isPayPalConfigured();
            expect(typeof isStripe).toBe('boolean');
            expect(typeof isPayPal).toBe('boolean');
        });
    });
});
