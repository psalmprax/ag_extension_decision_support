import bcrypt from 'bcryptjs';
import { verifyPassword } from '@/utils/password';

describe('verifyPassword', () => {
    const plain = 'correct-horse-9-battery';
    const hash = bcrypt.hashSync(plain, 4);

    it('returns true for a matching password', async () => {
        await expect(verifyPassword(plain, hash)).resolves.toBe(true);
    });

    it('returns false for a wrong password', async () => {
        await expect(verifyPassword('wrong-password-1', hash)).resolves.toBe(false);
    });

    it.each([null, undefined, '', 123, {}, []])('returns false instead of throwing for hash %p', async (storedHash) => {
        await expect(verifyPassword(plain, storedHash)).resolves.toBe(false);
    });

    it('returns false instead of throwing for a malformed hash', async () => {
        await expect(verifyPassword(plain, 'not-a-bcrypt-hash')).resolves.toBe(false);
    });

    it.each([null, undefined, '', 123])('returns false for non-string password %p', async (password) => {
        await expect(verifyPassword(password, hash)).resolves.toBe(false);
    });
});
