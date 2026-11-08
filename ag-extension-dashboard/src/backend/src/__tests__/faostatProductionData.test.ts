import { FaostatService, type FaostatCropRecord } from '@/services/data/faostatService';

jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('FAOSTAT production summaries', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date('2026-11-08T00:00:00Z'));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('requests a rolling six-year window and labels each metric with its own year', async () => {
        const service = new FaostatService();
        const record = (elementName: string, value: number, year: number): FaostatCropRecord => ({
            areaName: 'Malawi', areaCode: '109', itemName: 'Maize', itemCode: '056',
            elementName, elementCode: '', year, unit: '', value,
        });
        const fetchCropData = jest.spyOn(service, 'fetchCropData').mockResolvedValue([
            record('Production', 0, 2025),
            record('Production', 100, 2024),
            record('Area harvested', 30, 2023),
            record('Yield', 200, 2022),
            record('Yield', Number.NaN, 2025),
        ]);
        const summaryPromise = service.fetchCountryCropSummary('109', 'Malawi');
        await jest.runAllTimersAsync();
        const summary = await summaryPromise;

        expect(fetchCropData).toHaveBeenCalledWith('056', '109', 2020, 2025);
        expect(summary).toContain('Maize: 0 tonnes (2025) 30 ha harvested (2023) yield 200 hg/ha (2022)');
        expect(summary).not.toContain('NaN');
    });

    it('uses the provider item name rather than labeling data with the requested code mapping', async () => {
        const service = new FaostatService();
        jest.spyOn(service, 'fetchCropData').mockResolvedValue([{
            areaName: 'Malawi', areaCode: '109', itemName: 'Provider crop', itemCode: '056',
            elementName: 'Production', elementCode: '5510', year: 2024, unit: 't', value: 42,
        }]);
        const summaryPromise = service.fetchCountryCropSummary('109', 'Malawi');
        await jest.runAllTimersAsync();
        const summary = await summaryPromise;
        expect(summary).toContain('Provider crop: 42 tonnes (2024)');
        expect(summary).not.toContain('Maize: 42 tonnes');
    });
});
