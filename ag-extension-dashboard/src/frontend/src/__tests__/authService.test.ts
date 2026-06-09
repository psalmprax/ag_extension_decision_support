import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

import apiClient from '@/api/client';
import {
    login,
    demoLogin,
    register,
    fetchUserProfile,
    logout,
    requestPasswordReset,
    resetPassword,
} from '@/api/authService';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

const mockAuthResponse = {
    data: {
        success: true,
        data: {
            token: 'jwt-token-123',
            user: {
                id: '1',
                email: 'test@test.com',
                role: 'extension_officer' as const,
                firstName: 'Test',
                lastName: 'User',
                region: 'Lilongwe',
            },
        },
    },
};

describe('authService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ─── Login ──────────────────────────────────────────────────────────

    describe('login', () => {
        it('should send credentials and return auth response', async () => {
            mockPost.mockResolvedValue(mockAuthResponse);

            const result = await login({ email: 'test@test.com', password: 'password123' });

            expect(mockPost).toHaveBeenCalledWith('/auth/login', {
                email: 'test@test.com',
                password: 'password123',
            });
            expect(result.data.token).toBe('jwt-token-123');
            expect(result.data.user.email).toBe('test@test.com');
            expect(result.data.user.role).toBe('extension_officer');
        });

        it('should throw on invalid credentials', async () => {
            mockPost.mockRejectedValue(new Error('Invalid credentials'));

            await expect(
                login({ email: 'bad@test.com', password: 'wrong' })
            ).rejects.toThrow('Invalid credentials');
        });

        it('should throw on network failure', async () => {
            mockPost.mockRejectedValue(new Error('Network Error'));

            await expect(
                login({ email: 'test@test.com', password: 'pass' })
            ).rejects.toThrow('Network Error');
        });

        it('should handle server 500 error', async () => {
            mockPost.mockRejectedValue({
                response: { status: 500, data: { error: 'Server error' } },
            });

            await expect(
                login({ email: 'test@test.com', password: 'pass' })
            ).rejects.toBeDefined();
        });
    });

    // ─── Demo Login ─────────────────────────────────────────────────────

    describe('demoLogin', () => {
        it('should call demo endpoint with no arguments', async () => {
            mockPost.mockResolvedValue(mockAuthResponse);

            const result = await demoLogin();

            expect(mockPost).toHaveBeenCalledWith('/auth/demo');
            expect(result.data.token).toBe('jwt-token-123');
        });

        it('should throw when demo is disabled', async () => {
            mockPost.mockRejectedValue({
                response: { status: 404, data: { error: 'Demo access is not enabled' } },
            });

            await expect(demoLogin()).rejects.toBeDefined();
        });

        it('should throw on rate limit', async () => {
            mockPost.mockRejectedValue({
                response: { status: 429, data: { error: 'Too many demo attempts' } },
            });

            await expect(demoLogin()).rejects.toBeDefined();
        });
    });

    // ─── Register ───────────────────────────────────────────────────────

    describe('register', () => {
        it('should send registration data and return auth response', async () => {
            const registerResponse = {
                data: {
                    success: true,
                    data: {
                        token: 'new-token',
                        user: {
                            id: '2',
                            email: 'new@test.com',
                            role: 'farmer' as const,
                            firstName: 'New',
                            lastName: 'User',
                            region: 'Dedza',
                        },
                    },
                },
            };
            mockPost.mockResolvedValue(registerResponse);

            const result = await register({
                email: 'new@test.com',
                password: 'pass123',
                firstName: 'New',
                lastName: 'User',
                role: 'farmer',
                region: 'Dedza',
            });

            expect(mockPost).toHaveBeenCalledWith(
                '/auth/register',
                expect.objectContaining({
                    email: 'new@test.com',
                    firstName: 'New',
                    lastName: 'User',
                    role: 'farmer',
                    region: 'Dedza',
                })
            );
            expect(result.data.token).toBe('new-token');
            expect(result.data.user.email).toBe('new@test.com');
        });

        it('should accept registration without optional region', async () => {
            mockPost.mockResolvedValue({
                data: { success: true, data: { token: 't', user: { id: '3', email: 'a@b.com', role: 'extension_officer', firstName: 'A', lastName: 'B' } } },
            });

            const result = await register({
                email: 'a@b.com',
                password: 'pass',
                firstName: 'A',
                lastName: 'B',
                role: 'extension_officer',
            });

            expect(result.data.token).toBe('t');
        });

        it('should throw when email already exists', async () => {
            mockPost.mockRejectedValue({
                response: { status: 400, data: { error: 'Email already registered' } },
            });

            await expect(
                register({
                    email: 'existing@test.com',
                    password: 'pass123',
                    firstName: 'Existing',
                    lastName: 'User',
                    role: 'farmer',
                })
            ).rejects.toBeDefined();
        });

        it('should throw when trying to register as admin', async () => {
            mockPost.mockRejectedValue({
                response: { status: 403, data: { error: 'Role "admin" is not available for self-registration.' } },
            });

            await expect(
                register({
                    email: 'admin@test.com',
                    password: 'pass123',
                    firstName: 'Admin',
                    lastName: 'User',
                    role: 'admin',
                })
            ).rejects.toBeDefined();
        });
    });

    // ─── Fetch User Profile ─────────────────────────────────────────────

    describe('fetchUserProfile', () => {
        it('should fetch current user profile', async () => {
            mockGet.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        id: '1',
                        email: 'test@test.com',
                        role: 'extension_officer',
                        firstName: 'Test',
                        lastName: 'User',
                        region: 'Lilongwe',
                    },
                },
            });

            const result = await fetchUserProfile();

            expect(mockGet).toHaveBeenCalledWith('/auth/me');
            expect(result.data.email).toBe('test@test.com');
            expect(result.data.role).toBe('extension_officer');
        });

        it('should throw when not authenticated', async () => {
            mockGet.mockRejectedValue({
                response: { status: 401, data: { error: 'Unauthorized' } },
            });

            await expect(fetchUserProfile()).rejects.toBeDefined();
        });

        it('should throw on network error', async () => {
            mockGet.mockRejectedValue(new Error('Network Error'));

            await expect(fetchUserProfile()).rejects.toThrow('Network Error');
        });
    });

    // ─── Password Reset ─────────────────────────────────────────────────

    describe('requestPasswordReset', () => {
        it('should send password reset request with email', async () => {
            mockPost.mockResolvedValue({
                data: { success: true, message: 'Password reset email sent' },
            });

            const result = await requestPasswordReset('user@test.com');

            expect(mockPost).toHaveBeenCalledWith('/auth/forgot-password', {
                email: 'user@test.com',
            });
            expect(result.success).toBe(true);
            expect(result.message).toBe('Password reset email sent');
        });

        it('should throw on non-existent email', async () => {
            mockPost.mockRejectedValue({
                response: { status: 404, data: { error: 'User not found' } },
            });

            await expect(
                requestPasswordReset('nonexistent@test.com')
            ).rejects.toBeDefined();
        });

        it('should throw on server error', async () => {
            mockPost.mockRejectedValue(new Error('Server error'));

            await expect(
                requestPasswordReset('user@test.com')
            ).rejects.toThrow('Server error');
        });
    });

    describe('resetPassword', () => {
        it('should send new password with reset token', async () => {
            mockPost.mockResolvedValue({
                data: { success: true, message: 'Password reset successfully' },
            });

            const result = await resetPassword('reset-token-abc', 'newPassword123');

            expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', {
                token: 'reset-token-abc',
                newPassword: 'newPassword123',
            });
            expect(result.success).toBe(true);
        });

        it('should throw on invalid or expired token', async () => {
            mockPost.mockRejectedValue({
                response: { status: 400, data: { error: 'Invalid or expired reset token' } },
            });

            await expect(
                resetPassword('bad-token', 'newPassword123')
            ).rejects.toBeDefined();
        });

        it('should throw on weak password rejection', async () => {
            mockPost.mockRejectedValue({
                response: { status: 422, data: { error: 'Password does not meet minimum requirements' } },
            });

            await expect(
                resetPassword('valid-token', '123')
            ).rejects.toBeDefined();
        });
    });

    // ─── Logout ─────────────────────────────────────────────────────────

    describe('logout', () => {
        it('should call logout endpoint', async () => {
            mockPost.mockResolvedValue({ data: { success: true, message: 'Logged out' } });

            await logout();

            expect(mockPost).toHaveBeenCalledWith('/auth/logout');
        });

        it('should handle logout API failure gracefully (best-effort)', async () => {
            mockPost.mockRejectedValue(new Error('Network error'));

            await expect(logout()).resolves.not.toThrow();
        });

        it('should handle server 500 on logout gracefully', async () => {
            mockPost.mockRejectedValue({
                response: { status: 500, data: { error: 'Server error' } },
            });

            await expect(logout()).resolves.not.toThrow();
        });
    });

    // ─── Error Response Shape ──────────────────────────────────────────

    describe('error response handling', () => {
        it('should reject with Axios-style errors that have response data', async () => {
            expect.assertions(3);
            mockPost.mockRejectedValue({
                response: {
                    status: 400,
                    data: { error: 'Validation failed', details: { email: 'Invalid format' } },
                },
            });

            try {
                await login({ email: 'bad', password: 'pass' });
            } catch (error) {
                const err = error as Record<string, unknown>;
                const response = err.response as Record<string, unknown>;
                expect(response).toBeDefined();
                expect(response.status).toBe(400);
                const data = response.data as Record<string, unknown>;
                expect(data.error).toBe('Validation failed');
            }
        });

        it('should reject with plain errors (no response)', async () => {
            expect.assertions(2);
            mockPost.mockRejectedValue(new Error('Failed to fetch'));

            try {
                await login({ email: 'test@test.com', password: 'pass' });
            } catch (error) {
                const err = error as Error;
                expect(err.message).toBe('Failed to fetch');
                expect((error as unknown as Record<string, unknown>).response).toBeUndefined();
            }
        });
    });
});
