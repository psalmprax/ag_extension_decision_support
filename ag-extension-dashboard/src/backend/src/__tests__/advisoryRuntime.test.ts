import { AdvisoryTimeoutError, withAdvisoryTimeout } from '@/services/knowledge/advisoryRuntime';
import { callAdvisoryTool, getAdvisoryTools } from '@/services/knowledge/advisoryTools';
import { mcpAdapter } from '@/services/mcpAdapter';

jest.mock('@/services/mcpAdapter', () => ({
    mcpAdapter: {
        convertToMCPTools: jest.fn(() => [
            { name: 'get_current_date' }, { name: 'memory_recall' },
            { name: 'schedule_visit' }, { name: 'calculate_lime_requirement' },
        ]),
        callTool: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: '2026-11-07' }] }),
    },
}));

describe('Advisory runtime boundaries', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('clears successful request timers', async () => {
        jest.useFakeTimers();
        await expect(withAdvisoryTimeout(async () => 'answer', 1000, 'test')).resolves.toBe('answer');
        expect(jest.getTimerCount()).toBe(0);
    });

    it('rejects stalled operations at the deadline and clears timers', async () => {
        jest.useFakeTimers();
        const result = withAdvisoryTimeout(() => new Promise<never>(() => {}), 1000, 'test');
        const assertion = expect(result).rejects.toBeInstanceOf(AdvisoryTimeoutError);
        await jest.advanceTimersByTimeAsync(1000);
        await assertion;
        expect(jest.getTimerCount()).toBe(0);
    });

    it('does not start operations after their deadline', async () => {
        const operation = jest.fn();
        await expect(withAdvisoryTimeout(operation, 0, 'test')).rejects.toBeInstanceOf(AdvisoryTimeoutError);
        expect(operation).not.toHaveBeenCalled();
    });

    it('offers only audited public evidence tools', () => {
        expect(getAdvisoryTools().map(tool => tool.name)).toEqual(['get_current_date']);
    });

    it.each(['memory_recall', 'schedule_visit', 'calculate_lime_requirement', 'unknown'])(
        'rejects unscoped or prescription tool %s before execution', async name => {
            await expect(callAdvisoryTool(name, {})).rejects.toThrow('not permitted');
            expect(mcpAdapter.callTool).not.toHaveBeenCalled();
        }
    );

    it('rejects invalid tool arguments before execution', async () => {
        await expect(callAdvisoryTool('get_current_date', '{bad json')).rejects.toThrow();
        expect(mcpAdapter.callTool).not.toHaveBeenCalled();
    });
});
