/**
 * The PIN that unlocks SMS commands for officers and managers.
 *   GET /api/account/sms-pin   → { hasPin, locked, phone }
 *   PUT /api/account/sms-pin   { pin, currentPassword } → set or reset (also clears a lock)
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '@/services/databaseService';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validationMiddleware';
import { auditMiddleware } from '@/middleware/auditMiddleware';
import { SharedStateStore } from '@/middleware/rateLimitMiddleware';
import { verifyPassword } from '@/utils/password';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { isValidPin, setSmsPin } from '@/services/sms/officerSmsAccess';

const router = Router();
const staff = authorize(['regional_manager', 'extension_officer']);
const pinRateLimit = rateLimit({
    store: new SharedStateStore('rl:account:sms-pin:'),
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

const pinSchema = z.object({
    body: z.object({ pin: z.string().regex(/^\d{4}$/), currentPassword: z.string().min(1).max(128) }),
});

router.get('/sms-pin', staff, async (req: AuthRequest, res: Response) => {
    try {
        const { rows } = await query<{ has_pin: boolean; sms_pin_locked: boolean; phone: string | null }>(
            'SELECT sms_pin_hash IS NOT NULL AS has_pin, sms_pin_locked, phone FROM users WHERE id = $1',
            [req.user!.userId],
        );
        const row = rows[0];
        return res.json({ success: true, data: { hasPin: Boolean(row?.has_pin), locked: Boolean(row?.sms_pin_locked), phone: row?.phone ?? null } });
    } catch (error) {
        logger.error('SMS PIN status failed:', error);
        return safeError(res, 500, 'Could not load the SMS PIN status');
    }
});

router.put('/sms-pin', pinRateLimit, staff, validate(pinSchema), auditMiddleware('account.sms_pin_set'), async (req: AuthRequest, res: Response) => {
    const { pin, currentPassword } = req.body as { pin: string; currentPassword: string };
    if (!isValidPin(pin)) {
        return res.status(400).json({ success: false, error: 'Use 4 digits that are not all the same or in order.' });
    }
    try {
        const { rows } = await query<{ password_hash: string | null }>('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
        if (!rows[0]?.password_hash || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
            return res.status(400).json({ success: false, error: 'Current password is incorrect' });
        }
        await setSmsPin(req.user!.userId, pin);
        return res.json({ success: true, message: 'SMS PIN saved.' });
    } catch (error) {
        logger.error('SMS PIN update failed:', error);
        return safeError(res, 500, 'Could not save the SMS PIN');
    }
});

export default router;
