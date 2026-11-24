import request from 'supertest';
import app from '../app';
import { makeOfficerToken } from './helpers/setupMocks';

// Session lookup mock — fail-closed sessions require a valid row for authed requests.
jest.mock('../services/databaseService', () => ({
  getPool: jest.fn(() => null),
  query: jest.fn((text: string) => {
    if (typeof text === 'string' && text.includes('FROM user_sessions')) {
      return Promise.resolve({ rows: [{ is_revoked: false, is_active: true, expires_at: '2099-01-01T00:00:00Z' }] });
    }
    return Promise.resolve({ rows: [] });
  }),
}));

describe('Canadian Services API (/api/v1/canadian)', () => {
  const officerToken = makeOfficerToken();

  it('rejects unauthenticated access to governance services', async () => {
    const response = await request(app)
      .post('/api/v1/canadian/climate/assess')
      .send({ zone: 'prairie_drylands' });

    expect(response.status).toBe(401);
  });
  describe('POST /api/v1/canadian/ocap/consent', () => {
    it('should stamp OCAP metadata and enforce data access policy', async () => {
      const payload = {
        data: {
          field_name: 'Treaty 4 Land Plot',
          crop_health_score: 92,
          third_party_analytics: { tracker_id: 'xyz' },
        },
        policy: {
          communityId: 'FirstNation-Treaty4',
          ownershipClaimed: true,
          allowThirdPartySharing: false,
          accessTier: 'community_only',
          possessionMode: 'encrypted_cloud_canada',
          purposeScopes: ['community_internal'],
        },
      };

      const response = await request(app)
        .post('/api/v1/canadian/ocap/consent')
        .set('Authorization', `Bearer ${officerToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._ocap._ocap_stamped).toBe(true);
      expect(response.body.data._ocap._ownership).toBe('First Nations Owned');
      expect(response.body.data.third_party_analytics).toBeUndefined();
    });
  });

  describe('POST /api/v1/canadian/regulatory/check', () => {
    it('rejects malformed treatment payloads before invoking the regulatory engine', async () => {
      const response = await request(app)
        .post('/api/v1/canadian/regulatory/check')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ treatmentName: 'Fungicide Delta', dosagePerHectare: '150' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('leaves rates and buffer zones to the label, and points to it', async () => {
      const response = await request(app)
        .post('/api/v1/canadian/regulatory/check')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ treatmentName: 'Fungicide Delta', activeIngredient: 'azoxystrobin', province: 'Ontario', dosagePerHectare: 150 });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ isCompliant: true, registrationStatus: 'registered' });
      expect(response.body.data.bufferZoneMeters).toBeUndefined();
      expect(response.body.data.maximumDosagePerHectare).toBeUndefined();
      expect(response.body.data.warnings.join(' ')).toContain('pesticide-label-search');
    });

    it('flags an active with no Canadian registration', async () => {
      const response = await request(app)
        .post('/api/v1/canadian/regulatory/check')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ treatmentName: 'Old stock', activeIngredient: 'endosulfan', province: 'Quebec', dosagePerHectare: 1 });

      expect(response.body.data).toMatchObject({ isCompliant: false, registrationStatus: 'prohibited' });
    });
  });

  describe('POST /api/v1/canadian/climate/assess', () => {
    it('should return climate risk assessment for Prairie Drylands zone', async () => {
      const payload = {
        zone: 'prairie_drylands',
        temperatureCelsius: 1.5,
        consecutiveDryDays: 18,
      };

      const response = await request(app)
        .post('/api/v1/canadian/climate/assess')
        .set('Authorization', `Bearer ${officerToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.frostRiskLevel).toBe('severe');
      expect(response.body.data.recommendedAdaptations).toContain(
        'Deploy crop canopy frost protection blankets.'
      );
    });
  });
});
