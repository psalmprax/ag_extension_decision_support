import {
  parseDeviceFromUserAgent,
  recordLoginAttempt,
  getLoginHistory,
  getLoginStats,
} from '../services/loginHistoryService';
import { query } from '../services/databaseService';

jest.mock('../services/databaseService', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockQuery = query as jest.Mock;

describe('loginHistoryService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('parseDeviceFromUserAgent', () => {
    it('returns "Unknown Device" when user agent is missing', () => {
      expect(parseDeviceFromUserAgent(null)).toBe('Unknown Device');
      expect(parseDeviceFromUserAgent(undefined)).toBe('Unknown Device');
    });

    it('identifies Chrome on Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(parseDeviceFromUserAgent(ua)).toBe('Chrome on Windows');
    });

    it('identifies Safari on iOS', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      expect(parseDeviceFromUserAgent(ua)).toBe('Safari on iOS');
    });

    it('identifies Firefox on Linux', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
      expect(parseDeviceFromUserAgent(ua)).toBe('Firefox on Linux');
    });

    it('identifies Edge on macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      expect(parseDeviceFromUserAgent(ua)).toBe('Edge on macOS');
    });
  });

  describe('recordLoginAttempt', () => {
    it('records a successful login attempt and updates users.last_login_at', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // insert into login_history
      mockQuery.mockResolvedValueOnce({ rows: [] }); // update users

      await recordLoginAttempt({
        userId: 'user-123',
        email: 'officer@example.com',
        status: 'success',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Linux; x86_64) Firefox/120.0',
      });

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO login_history');
      expect(mockQuery.mock.calls[0][1]).toEqual([
        'user-123',
        'officer@example.com',
        'success',
        null,
        '192.168.1.1',
        'Mozilla/5.0 (Linux; x86_64) Firefox/120.0',
        'Firefox on Linux',
        null,
      ]);
      expect(mockQuery.mock.calls[1][0]).toContain('UPDATE users');
      expect(mockQuery.mock.calls[1][1]).toEqual(['user-123']);
    });

    it('records a failed login attempt without updating users.last_login_at', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // insert into login_history

      await recordLoginAttempt({
        userId: 'user-123',
        email: 'officer@example.com',
        status: 'failed',
        failureReason: 'invalid_password',
        ipAddress: '192.168.1.1',
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO login_history');
      expect(mockQuery.mock.calls[0][1][2]).toBe('failed');
      expect(mockQuery.mock.calls[0][1][3]).toBe('invalid_password');
    });
  });

  describe('getLoginHistory', () => {
    it('retrieves paginated login history for a user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'log-1',
            userId: 'user-123',
            email: 'officer@example.com',
            status: 'success',
            failureReason: null,
            ipAddress: '127.0.0.1',
            userAgent: 'curl',
            device: 'cURL on Unknown OS',
            location: null,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
        ],
      });

      const result = await getLoginHistory({ userId: 'user-123', limit: 10, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].email).toBe('officer@example.com');
      expect(result.items[0].status).toBe('success');
    });
  });

  describe('getLoginStats', () => {
    it('computes login stats from login history', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total: 25, successful: 22 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ failed_24h: 3 }] });
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_at: '2026-09-01T01:00:00.000Z', ip_address: '10.0.0.1' }],
      });

      const stats = await getLoginStats({ userId: 'user-123' });

      expect(stats.totalLogins).toBe(25);
      expect(stats.successfulLogins).toBe(22);
      expect(stats.failedAttempts24h).toBe(3);
      expect(stats.lastLoginAt).toBe('2026-09-01T01:00:00.000Z');
      expect(stats.lastLoginIp).toBe('10.0.0.1');
    });
  });
});
