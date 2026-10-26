import { config } from '../config';
import { setAuthCookie } from '../middleware/authCookie';

describe('auth cookies in deployed environments', () => {
    const originalNodeEnv = config.nodeEnv;
    const response = { cookie: jest.fn() } as unknown as Parameters<typeof setAuthCookie>[0];

    afterEach(() => {
        config.nodeEnv = originalNodeEnv;
        jest.clearAllMocks();
    });

    it('marks auth and CSRF cookies Secure in staging', () => {
        config.nodeEnv = 'staging';
        setAuthCookie(response, 'test-session-token');

        expect(response.cookie).toHaveBeenNthCalledWith(
            1,
            'ag_token',
            'test-session-token',
            expect.objectContaining({ secure: true, httpOnly: true })
        );
        expect(response.cookie).toHaveBeenNthCalledWith(
            2,
            'ag_csrf',
            expect.any(String),
            expect.objectContaining({ secure: true })
        );
    });
});
