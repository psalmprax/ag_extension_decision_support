import { Router, Response } from 'express';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { apiClientService } from '@/services/apiClientService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

const DEFAULT_MONTHLY_QUOTA = 1000;

router.post('/clients', async (req: AuthRequest, res: Response) => {
    try {
        const { name, monthlyQuota, keyName = 'Default key' } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'name is required' });
        // Only an administrator sets a quota (as when changing one later); everyone else
        // starts on the standard allowance.
        const requested = Number(monthlyQuota);
        const quota = req.user!.role === 'admin' && Number.isInteger(requested) && requested > 0 ? requested : DEFAULT_MONTHLY_QUOTA;

        const result = await apiClientService.createClient(req.user!.userId, name, quota, keyName);
        res.status(201).json({
            success: true,
            data: result,
            message: 'Store the API key token now. It will not be shown again.'
        });
    } catch (error) {
        logger.error('Create API client failed:', error);
        safeError(res, 500, 'Failed to create API client');
    }
});

router.get('/clients', async (req: AuthRequest, res: Response) => {
    try {
        const ownerFilter = req.user!.role === 'admin' ? undefined : req.user!.userId;
        const clients = await apiClientService.listClients(ownerFilter);
        res.json({ success: true, data: clients });
    } catch (error) {
        logger.error('List API clients failed:', error);
        safeError(res, 500, 'Failed to list API clients');
    }
});

router.post('/clients/:clientId/keys', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId } = req.params;
        const { name = 'API key', expiresAt } = req.body;
        const clients = await apiClientService.listClients(req.user!.role === 'admin' ? undefined : req.user!.userId);
        if (!clients.some((client) => client.id === clientId)) {
            return res.status(404).json({ success: false, error: 'API client not found' });
        }

        const key = await apiClientService.createKey(clientId, name, expiresAt);
        res.status(201).json({
            success: true,
            data: key,
            message: 'Store the API key token now. It will not be shown again.'
        });
    } catch (error) {
        logger.error('Create API key failed:', error);
        safeError(res, 500, 'Failed to create API key');
    }
});

router.get('/clients/:clientId/keys', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId } = req.params;
        const clients = await apiClientService.listClients(req.user!.role === 'admin' ? undefined : req.user!.userId);
        if (!clients.some((client) => client.id === clientId)) {
            return res.status(404).json({ success: false, error: 'API client not found' });
        }

        const keys = await apiClientService.listKeys(clientId);
        res.json({ success: true, data: keys });
    } catch (error) {
        logger.error('List API keys failed:', error);
        safeError(res, 500, 'Failed to list API keys');
    }
});

router.post('/keys/:keyId/revoke', async (req: AuthRequest, res: Response) => {
    try {
        const key = await apiClientService.revokeKey(req.params.keyId, req.user!.role === 'admin' ? undefined : req.user!.userId);
        if (!key) return res.status(404).json({ success: false, error: 'API key not found' });
        res.json({ success: true, data: key });
    } catch (error) {
        logger.error('Revoke API key failed:', error);
        safeError(res, 500, 'Failed to revoke API key');
    }
});

export default router;
