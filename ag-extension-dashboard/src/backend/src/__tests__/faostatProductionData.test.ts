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
            elementName, elementCode: ({ Production: '5510', 'Area harvested': '5312', Yield: '5419' } as Record<string, string>)[elementName],
            year, unit: ({ Production: 't', 'Area harvested': 'ha', Yield: 'hg/ha' } as Record<string, string>)[elementName], value,
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

    it('does not relabel an unexpected metric unit as tonnes', async () => {
        const service = new FaostatService();
        jest.spyOn(service, 'fetchCropData').mockResolvedValue([{
            areaName: 'Malawi', areaCode: '109', itemName: 'Maize', itemCode: '056',
            elementName: 'Production', elementCode: '5510', year: 2024, unit: 'kg', value: 42,
        }]);
        const summaryPromise = service.fetchCountryCropSummary('109', 'Malawi');
        await jest.runAllTimersAsync();
        expect(await summaryPromise).not.toContain('42 tonnes');
    });

    it('rejects country-name mismatches instead of attaching them to a different country', async () => {
        const service = new FaostatService();
        jest.spyOn(service, 'fetchCropData').mockResolvedValue([{
            areaName: 'Kenya', areaCode: '109', itemName: 'Maize', itemCode: '056',
            elementName: 'Production', elementCode: '5510', year: 2024, unit: 't', value: 42,
        }]);
        const summaryPromise = service.fetchCountryCropSummary('109', 'Malawi');
        const assertion = expect(summaryPromise).rejects.toThrow('area name did not match');
        await jest.runAllTimersAsync();
        await assertion;
    });

    it('rejects responses with unexpected item or country codes', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true, json: async () => ({ data: [{
                area: 'Malawi', area_code: '114', item: 'Maize', item_code: '056',
                element: 'Production', element_code: '5510', year: '2024', unit: 't', value: '42',
            }] }),
        } as Response);
        await expect(new FaostatService().fetchCropData('056', '109', 2020, 2025)).rejects.toThrow('mismatched observation');
    });

    it('accepts matching provider codes with leading zeros and keeps numeric zero', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true, json: async () => ({ data: [{
                area: 'Malawi', area_code: 109, item: 'Maize', item_code: 56,
                element: 'Production', element_code: 5510, year: 2024, unit: 't', value: '0',
            }] }),
        } as Response);
        const records = await new FaostatService().fetchCropData('056', '109', 2020, 2025);
        expect(records[0]).toMatchObject({ areaName: 'Malawi', itemName: 'Maize', value: 0, year: 2024 });
    });

    it('does not silently coerce an empty provider value to zero', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true, json: async () => ({ data: [{
                area: 'Malawi', area_code: 109, item: 'Maize', item_code: 56,
                element: 'Production', element_code: 5510, year: 2024, unit: 't', value: '',
            }] }),
        } as Response);
        await expect(new FaostatService().fetchCropData('056', '109', 2020, 2025)).rejects.toThrow('invalid observation');
    });

    it('rejects unexpected units and nonnumeric values from the provider', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValueOnce({
            ok: true, json: async () => ({ data: [{
                area: 'Malawi', area_code: 109, item: 'Maize', item_code: 56,
                element: 'Production', element_code: 5510, year: 2024, unit: 'kg', value: '42',
            }] }),
        } as Response).mockResolvedValueOnce({
            ok: true, json: async () => ({ data: [{
                area: 'Malawi', area_code: 109, item: 'Maize', item_code: 56,
                element: 'Production', element_code: 5510, year: 2024, unit: 't', value: true,
            }] }),
        } as Response);
        const service = new FaostatService();
        await expect(service.fetchCropData('056', '109', 2020, 2025)).rejects.toThrow('unexpected element or unit');
        await expect(service.fetchCropData('056', '109', 2020, 2025)).rejects.toThrow('invalid observation');
    });

    it('surfaces provider and malformed-response errors', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ error: 'invalid' }) } as Response);
        await expect(new FaostatService().fetchCropData('056', '109', 2020, 2025)).rejects.toThrow('no data array');
    });

    it('rejects an unrecognized provider response shape instead of attributing it to a country', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true, json: async () => ({ data: [{ area_code: '109', area_label: 'Malawi', quantity: 42 }] }),
        } as Response);
        await expect(new FaostatService().fetchCropData('056', '109', 2020, 2025)).rejects.toThrow('mismatched observation');
    });
});
