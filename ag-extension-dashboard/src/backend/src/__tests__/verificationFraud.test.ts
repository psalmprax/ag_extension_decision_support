import { auditCropLossAnomaly, verifyParcelDwellTime } from '../services/verificationFraudService';

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
