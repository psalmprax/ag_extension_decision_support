const mockQuery = jest.fn();
const mockCanSee = jest.fn();
const mockPost = jest.fn();
const mockLink = jest.fn();
const mockUpsert = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/dataGovernanceService', () => ({ getPrincipalTenantId: jest.fn().mockResolvedValue('tenant-1') }));
jest.mock('@/services/access/farmerScope', () => ({ canSeeFarmer: (...args: unknown[]) => mockCanSee(...args) }));
jest.mock('@/services/chat/channelThread', () => ({ farmerThreadFor: jest.fn().mockResolvedValue('conversation-1') }));
jest.mock('@/services/chat/threadPost', () => ({ postOfficerReply: (...args: unknown[]) => mockPost(...args) }));
jest.mock('@/services/uploadAttachments', () => ({ linkAttachments: (...args: unknown[]) => mockLink(...args) }));
jest.mock('@/services/vectorService', () => ({ VectorService: { upsertDocument: (...args: unknown[]) => mockUpsert(...args) } }));

import { reviewRecording, sendRecording, isValidRecordingSignature, recordingUrl } from '@/services/partners/recordingLibrary';

const RECORDING = {
    id: 'rec-1', partner_id: 'p-1', partner_name: 'Farm Radio Trust', title: 'Fall armyworm scouting', speaker: 'Dr. Wanjiru',
    language: 'sw', crops: ['maize'], regions: [], topic: 'pests', licence: 'CC BY 4.0', licence_expires_at: null,
    transcript: 'Kagua shamba lako kila wiki kuona viwavi jeshi kwenye majani ya mahindi.', transcript_status: 'transcribed',
    review_status: 'pending_review', knowledge_article_id: null, created_at: '2026-11-21', deliveries: '0', storage_key: 'k',
};
const officer = { userId: 'officer-1', role: 'extension_officer' };
const manager = { userId: 'manager-1', role: 'regional_manager' };

beforeEach(() => {
    mockQuery.mockReset();
    mockCanSee.mockReset();
    mockPost.mockReset();
    mockLink.mockReset();
    mockUpsert.mockReset().mockResolvedValue(undefined);
});

describe('reviewing partner recordings', () => {
    it('lets only administrators and regional managers approve', async () => {
        await expect(reviewRecording(officer, 'rec-1', { decision: 'approve' })).rejects.toMatchObject({ status: 403 });
    });

    it('will not approve without a checked transcript', async () => {
        mockQuery.mockResolvedValue({ rows: [{ ...RECORDING, transcript: null }] });
        await expect(reviewRecording(manager, 'rec-1', { decision: 'approve' })).rejects.toThrow(/transcript/);
    });

    it('publishes an approved recording as a credited knowledge article', async () => {
        mockQuery.mockImplementation((sql: string) => Promise.resolve(
            sql.includes('INSERT INTO knowledge_articles') ? { rows: [{ id: 'article-1' }] } : { rows: [{ ...RECORDING }] }));
        await reviewRecording(manager, 'rec-1', { decision: 'approve' });
        const insert = mockQuery.mock.calls.find(call => String(call[0]).includes('INSERT INTO knowledge_articles'));
        expect(insert?.[1]).toEqual(expect.arrayContaining(['Farm Radio Trust · Dr. Wanjiru', ['maize']]));
        expect(insert?.[1][7]).toBe('Farm Radio Trust · Dr. Wanjiru');
        expect(mockQuery.mock.calls.some(call => String(call[0]).includes("review_status = 'approved'"))).toBe(true);
    });
});

describe('sending partner recordings', () => {
    it('sends only approved recordings, only to farmers the sender serves, and logs each send', async () => {
        mockQuery.mockImplementation((sql: string) => Promise.resolve(
            sql.includes('SELECT upload_id') ? { rows: [{ upload_id: 'upload-1' }] } : { rows: [{ ...RECORDING, review_status: 'approved' }] }));
        mockCanSee.mockImplementation((_p: unknown, farmerId: string) => Promise.resolve(farmerId === 'farmer-mine'));
        mockPost.mockResolvedValue({ id: 'message-1' });

        const result = await sendRecording(officer, 'rec-1', ['farmer-mine', 'farmer-other']);

        expect(result).toEqual({ sent: 1, skipped: 1 });
        expect(mockPost).toHaveBeenCalledWith('conversation-1', expect.stringContaining('Fall armyworm scouting (Dr. Wanjiru, Farm Radio Trust)'), 'officer-1');
        expect(mockLink).toHaveBeenCalledWith('chat', 'message-1', ['upload-1']);
        const log = mockQuery.mock.calls.find(call => String(call[0]).includes('INSERT INTO recording_deliveries'));
        expect(log?.[1]).toEqual(['rec-1', 'farmer-mine', 'officer-1']);
    });

    it('refuses a recording that has not been approved', async () => {
        mockQuery.mockResolvedValue({ rows: [{ ...RECORDING }] });
        await expect(sendRecording(officer, 'rec-1', ['farmer-mine'])).rejects.toThrow(/approved/);
    });

    it('signs the play link so it cannot be guessed for another recording', () => {
        const sig = new URL(recordingUrl('rec-1')).searchParams.get('sig');
        expect(isValidRecordingSignature('rec-1', sig)).toBe(true);
        expect(isValidRecordingSignature('rec-2', sig)).toBe(false);
    });
});
