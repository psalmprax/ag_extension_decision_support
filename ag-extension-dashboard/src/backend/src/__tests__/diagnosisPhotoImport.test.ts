import { zipSync, strToU8 } from 'fflate';

const mockSave = jest.fn();
const mockAdd = jest.fn();
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/uploadService', () => ({ saveUpload: (...args: unknown[]) => mockSave(...args) }));
jest.mock('@/services/diagnosisTests/testSet', () => ({ addTestImage: (...args: unknown[]) => mockAdd(...args) }));

import { importLabelledPhotos } from '@/services/diagnosisTests/bulkImport';

describe('importing a labelled photo set', () => {
    it('takes the crop and label from the folders and reports photos outside them', async () => {
        mockSave.mockResolvedValue({ id: 'upload-1' });
        mockAdd.mockResolvedValue({ id: 'image-1' });
        const archive = Buffer.from(zipSync({
            'set/maize/fall_armyworm/IMG_1.jpg': strToU8('x'),
            'loose.jpg': strToU8('x'),
            'set/maize/healthy/readme.txt': strToU8('x'),
        }));
        const report = await importLabelledPhotos({ userId: 'manager-1', role: 'regional_manager' }, archive, 'Kenya');
        expect(report.imported).toBe(1);
        expect(report.skipped).toHaveLength(2);
        expect(mockAdd).toHaveBeenCalledWith(expect.anything(), { uploadId: 'upload-1', crop: 'maize', label: 'fall_armyworm', country: 'Kenya' });
    });
});
