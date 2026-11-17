import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { tokenIsDemo } from './demoScope';

export function validateRecordScope(req: Request, res: Response, next: NextFunction): void {
    const dataset = req.query.dataset ?? 'live';
    if (dataset !== 'live' && dataset !== 'demo') {
        res.status(400).json({ success: false, error: 'dataset must be live or demo' });
        return;
    }
    if (req.user && tokenIsDemo(req.user)) {
        res.status(403).json({ success: false, error: 'Demo accounts cannot access operational record lists' });
        return;
    }
    if (dataset === 'demo' && req.user?.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Only administrators can inspect demo records' });
        return;
    }
    next();
}

export function farmerRecordFilter(demo: boolean): Prisma.FarmerWhereInput {
    const demoRecords: Prisma.FarmerWhereInput = {
        OR: [
            { isDemo: true },
            { user: { is: { isDemo: true } } },
            { assignedOfficer: { is: { isDemo: true } } },
        ],
    };
    return demo ? demoRecords : { NOT: demoRecords };
}
