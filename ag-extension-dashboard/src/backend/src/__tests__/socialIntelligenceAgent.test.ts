jest.mock('../services/agentOrchestrator', () => ({
    AgentOrchestrator: {
        getInstance: jest.fn(() => ({ registerAgent: jest.fn() })),
    },
}));

jest.mock('../services/tavilyService', () => ({
    tavilyService: {
        isConfigured: jest.fn(() => false),
        search: jest.fn(),
    },
}));

jest.mock('../services/aiProvider/aiProvider', () => ({
    AIProviderFactory: {
        getPrimaryProvider: jest.fn(),
    },
}));

jest.mock('../services/notificationService', () => ({
    notificationService: {
        send: jest.fn(),
    },
}));

import { SocialIntelligenceAgent } from '../services/socialIntelligenceAgent';
import { tavilyService } from '../services/tavilyService';
import { AIProviderFactory } from '../services/aiProvider/aiProvider';

const mockTavily = tavilyService as jest.Mocked<typeof tavilyService>;
const mockProviderFactory = AIProviderFactory as jest.Mocked<typeof AIProviderFactory>;

describe('SocialIntelligenceAgent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockTavily.isConfigured.mockReturnValue(false);
    });

    it('returns an explicit not_configured state instead of fabricated social posts', async () => {
        const result = await new SocialIntelligenceAgent().executeMonitoringPipeline();

        expect(result).toEqual({
            summary: 'No verified social intelligence source is configured.',
            hasCriticalAlerts: false,
            dataStatus: 'not_configured',
            sources: [],
        });
        expect(mockProviderFactory.getPrimaryProvider).not.toHaveBeenCalled();
        expect(mockTavily.search).not.toHaveBeenCalled();
    });
});
