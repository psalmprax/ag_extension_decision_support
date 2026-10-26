import { createHmac } from 'crypto';
import { config } from '@/config';

export function credentialVersion(passwordHash: string | null | undefined): string {
  return createHmac('sha256', config.jwt.secret as string)
    .update(passwordHash ?? '')
    .digest('hex');
}
