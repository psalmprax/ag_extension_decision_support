import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { signSessionToken } from '@/utils/sessionToken';

describe('signSessionToken', () => {
    it('gives two logins of one account in the same second different tokens', () => {
        const claims = { userId: 'user-1', email: 'officer@example.test', role: 'extension_officer' };
        const first = signSessionToken(claims);
        const second = signSessionToken(claims);

        // Sessions are stored by token hash: identical tokens made the second login fail.
        expect(first).not.toBe(second);
        const decoded = jwt.verify(first, config.jwt.secret as jwt.Secret) as jwt.JwtPayload;
        expect(decoded).toMatchObject(claims);
        expect(decoded.jti).toEqual(expect.any(String));
    });
});
