const mockQuery = jest.fn();
jest.mock('../services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));

import { auditCropLossAnomaly, boundingBox, checkFarmerSpatialConflict, verifyParcelDwellTime } from '../services/verificationFraudService';

describe('auditCropLossAnomaly', () => {
  const baseParams = {
    farmerLat: -1.28,
    farmerLng: 36.82,
    reportedLossSeverity: 'TOTAL_FAILURE' as const,
  };

  it('requires supervisor review when no canopy observation is supplied', async () => {
    const result = await auditCropLossAnomaly(baseParams);

    expect(result.recommendedAction).toBe('REQUIRES_SUPERVISOR_AUDIT');
    expect(result.evidenceSource).toBe('NO_CANOPY_OBSERVATION');
    expect(result.flagReason).toContain('No trusted canopy observation');
  });

  it('flags severe loss against caller-supplied healthy canopy evidence', async () => {
    const result = await auditCropLossAnomaly({ ...baseParams, observedCanopyScore: 0.8 });

    expect(result.anomalyDetected).toBe(true);
    expect(result.recommendedAction).toBe('FLAGGED_HIGH_RISK');
    expect(result.evidenceSource).toBe('CALLER_OBSERVATION');
    expect(result.flagReason).toContain('supplied high canopy observation');
  });

  it('rejects canopy scores outside the normalized range', async () => {
    await expect(auditCropLossAnomaly({ ...baseParams, observedCanopyScore: 1.1 })).rejects.toThrow(
      'observedCanopyScore must be between 0 and 1',
    );
  });
});

describe('verifyParcelDwellTime (AD-002 / CE-003)', () => {
  it('prioritizes identical-location spoofing over the short-interval check', () => {
    const result = verifyParcelDwellTime({
      durationMinutes: 15,
      officerId: 'off-1',
      farmerId: 'farm-2',
      completedAt: '2026-09-16T10:20:00Z',
      locationLat: 0,
      locationLng: 0,
      priorVisit: {
        farmerId: 'farm-1',
        completedAt: '2026-09-16T10:19:00Z',
        locationLat: 0,
        locationLng: 0,
      },
    });
    expect(result.status).toBe('STATIONARY_SPOOFING_DETECTED');
    expect(result.riskScore).toBe(90);
    expect(result.details).toContain('identical coordinates');
  });

  it('enforces short intervals even when the consecutive visits are for the same farmer', () => {
    const result = verifyParcelDwellTime({
      durationMinutes: 15,
      officerId: 'off-1',
      farmerId: 'farm-1',
      completedAt: '2026-09-16T10:20:00Z',
      priorVisit: { farmerId: 'farm-1', completedAt: '2026-09-16T10:19:00Z' },
    });
    expect(result.status).toBe('STATIONARY_SPOOFING_DETECTED');
    expect(result.riskScore).toBe(95);
  });

  it('uses a finite supplied duration before considering malformed timestamps', () => {
    const result = verifyParcelDwellTime({ durationMinutes: 10, startedAt: 'invalid', completedAt: 'invalid' });
    expect(result.status).toBe('VERIFIED');
    expect(result.dwellTimeMinutes).toBe(10);
  });

  it('rejects malformed timestamps before attempting prior-visit checks', () => {
    const result = verifyParcelDwellTime({
      durationMinutes: NaN,
      startedAt: 'invalid',
      completedAt: '2026-09-16T10:20:00Z',
      officerId: 'off-1',
      farmerId: 'farm-2',
      locationLat: 0,
      locationLng: 0,
      priorVisit: { farmerId: 'farm-1', locationLat: 0, locationLng: 0 },
    });
    expect(result.status).toBe('INVALID_TIMESTAMPS');
  });

  it('accepts visit with verified dwell time >= 10 minutes', () => {
    const res = verifyParcelDwellTime({
      durationMinutes: 15,
      officerId: 'off-1',
      farmerId: 'farm-1',
    });

    expect(res.isValid).toBe(true);
    expect(res.status).toBe('VERIFIED');
    expect(res.riskScore).toBe(5);
    expect(res.dwellTimeMinutes).toBe(15);
    expect(res.integrityHash).toBeDefined();
  });

  it('rejects visit with insufficient dwell time (< 10 minutes)', () => {
    const res = verifyParcelDwellTime({
      durationMinutes: 4,
      officerId: 'off-1',
      farmerId: 'farm-1',
    });

    expect(res.isValid).toBe(false);
    expect(res.status).toBe('INSUFFICIENT_DWELL_TIME');
    expect(res.riskScore).toBeGreaterThanOrEqual(80);
    expect(res.details).toContain('below the mandatory 10-minute');
  });

  it('computes dwell time from startedAt and completedAt timestamps', () => {
    const res = verifyParcelDwellTime({
      startedAt: '2026-09-16T10:00:00Z',
      completedAt: '2026-09-16T10:12:00Z',
      officerId: 'off-1',
      farmerId: 'farm-1',
    });

    expect(res.isValid).toBe(true);
    expect(res.dwellTimeMinutes).toBe(12);
    expect(res.status).toBe('VERIFIED');
  });

  it('rejects inverted or invalid timestamps', () => {
    const res = verifyParcelDwellTime({
      startedAt: '2026-09-16T10:30:00Z',
      completedAt: '2026-09-16T10:10:00Z', // Inverted
      officerId: 'off-1',
      farmerId: 'farm-1',
    });

    expect(res.isValid).toBe(false);
    expect(res.status).toBe('INVALID_TIMESTAMPS');
  });

  it('detects stationary spoofing when consecutive visits for different farmers are logged within < 10 minutes', () => {
    const res = verifyParcelDwellTime({
      durationMinutes: 15,
      officerId: 'off-1',
      farmerId: 'farm-2',
      startedAt: '2026-09-16T10:05:00Z',
      completedAt: '2026-09-16T10:20:00Z',
      priorVisit: {
        farmerId: 'farm-1',
        completedAt: '2026-09-16T10:16:00Z', // Only 4 minutes before current visit completedAt
      },
    });

    expect(res.isValid).toBe(false);
    expect(res.status).toBe('STATIONARY_SPOOFING_DETECTED');
    expect(res.riskScore).toBe(95);
    expect(res.details).toContain('Stationary spoofing detected');
  });

  it('detects stationary armchair visit when distinct farmers are logged from identical coordinates (< 50m)', () => {
    const res = verifyParcelDwellTime({
      durationMinutes: 15,
      officerId: 'off-1',
      farmerId: 'farm-2',
      locationLat: -13.9626,
      locationLng: 33.7741,
      priorVisit: {
        farmerId: 'farm-1',
        completedAt: '2026-09-16T08:00:00Z', // 2 hours ago
        locationLat: -13.9626001,
        locationLng: 33.7741001, // ~0.1 meter away
      },
    });

    expect(res.isValid).toBe(false);
    expect(res.status).toBe('STATIONARY_SPOOFING_DETECTED');
    expect(res.riskScore).toBe(90);
    expect(res.details).toContain('Stationary armchair visit detected');
  });
});

describe('duplicate parcel check', () => {
  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const r = 6_371_000; const rad = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(a));
  };

  it('keeps every point within the radius inside the box, at the equator, mid-latitudes and near a pole', () => {
    for (const [lat, lng] of [[0.5, 33.1], [-13.98, 33.78], [59.9, 10.7], [78.2, 15.6]]) {
      const box = boundingBox(lat, lng, 50);
      for (let bearing = 0; bearing < 360; bearing += 15) {
        const b = (bearing * Math.PI) / 180;
        const pLat = lat + (49 * Math.cos(b)) / 111_320;
        const pLng = lng + (49 * Math.sin(b)) / (111_320 * Math.cos((lat * Math.PI) / 180));
        expect(haversine(lat, lng, pLat, pLng)).toBeLessThanOrEqual(50);
        expect(pLat).toBeGreaterThanOrEqual(box.minLat);
        expect(pLat).toBeLessThanOrEqual(box.maxLat);
        expect(pLng).toBeGreaterThanOrEqual(box.minLng);
        expect(pLng).toBeLessThanOrEqual(box.maxLng);
      }
    }
  });

  it('spans every longitude when the parcel sits on the 180° meridian', () => {
    expect(boundingBox(-17.8, 179.9999, 50)).toMatchObject({ minLng: -180, maxLng: 180 });
  });

  it('reads only farmers inside the box, then checks the exact distance', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { id: 'near', first_name: 'Chikondi', last_name: 'Banda', village: 'Kasungu', location_lat: '-13.98010', location_lng: '33.78010' },
      { id: 'corner', first_name: 'Tiyamike', last_name: 'Phiri', village: null, location_lat: '-13.98045', location_lng: '33.78045' },
    ] });
    const result = await checkFarmerSpatialConflict({ targetLat: -13.98, targetLng: 33.78, tenantId: 't1' });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('location_lat BETWEEN $1 AND $2 AND location_lng BETWEEN $3 AND $4');
    expect(params).toHaveLength(5);
    expect(result.conflictingFarmers.map(f => f.id)).toEqual(['near']);
  });
});

