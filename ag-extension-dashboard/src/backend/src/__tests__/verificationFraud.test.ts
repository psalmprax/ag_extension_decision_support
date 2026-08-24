import { auditCropLossAnomaly } from '../services/verificationFraudService';

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
