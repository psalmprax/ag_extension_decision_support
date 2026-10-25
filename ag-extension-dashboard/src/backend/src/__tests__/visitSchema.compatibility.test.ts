import { createVisitSchema } from '@/utils/schemas';

describe('createVisitSchema normalization', () => {
  const farmerId = '11111111-1111-4111-8111-111111111111';
  const scheduledAt = '2026-10-25T10:00:00Z';

  it('accepts canonical input without optional fields and applies defaults', () => {
    const { body } = createVisitSchema.parse({ body: { farmerId, scheduledAt } });
    expect(body).toMatchObject({ farmerId, scheduledAt, visitType: 'routine', status: 'scheduled' });
    expect(body.durationMinutes).toBeUndefined();
  });

  it('normalizes legacy aliases and preserves optional fields', () => {
    const { body } = createVisitSchema.parse({
      body: {
        farmer_id: farmerId,
        visit_type: 'follow_up',
        scheduled_at: scheduledAt,
        duration: 45,
        notes: 'Check maize',
      },
    });
    expect(body).toMatchObject({
      farmerId, scheduledAt, visitType: 'follow_up', status: 'scheduled',
      durationMinutes: 45, notes: 'Check maize',
    });
    expect(body).not.toHaveProperty('farmer_id');
  });

  it('prefers canonical values over aliases', () => {
    const { body } = createVisitSchema.parse({
      body: {
        farmerId, scheduledAt, visitType: 'routine', visit_type: 'emergency',
        durationMinutes: 30, duration: 45,
      },
    });
    expect(body).toMatchObject({ visitType: 'routine', durationMinutes: 30 });
  });

  it.each([
    {},
    { farmerId: 'invalid', scheduledAt },
    { farmerId, scheduledAt: 'tomorrow' },
    { farmer_id: farmerId, scheduled_at: scheduledAt, visit_type: 'invalid' },
    { farmerId, scheduledAt, locationLat: 91 },
    { farmerId, scheduledAt, attachmentIds: ['invalid'] },
  ])('rejects invalid visit input: %j', body => {
    expect(createVisitSchema.safeParse({ body }).success).toBe(false);
  });
});
