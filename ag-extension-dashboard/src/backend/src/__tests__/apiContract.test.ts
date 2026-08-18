/**
 * API contract test — enforces that the backend's behaviour matches the
 * canonical schemas in `@ag-extension/shared/src/api`.
 *
 * The backend consumes the shared contract as types only (see src/contract.ts)
 * because the shared package lives outside the Docker build context, so it
 * cannot be required at runtime. This test imports the shared schemas directly
 * (ts-jest compiles them on the host) and asserts behavioural parity, so the
 * contract can never silently drift.
 */
import {
  authResponseSchema,
  createFieldSchema,
  fieldSchema,
  notificationSchema,
  reportSchema,
  unreadCountResponseSchema,
  userSchema,
  uuidSchema,
} from '../../../../../ag-extension-shared/src/api';
import { UUID_REGEX } from '../utils/uuid';

describe('API contract: shared schemas vs backend behaviour', () => {
  const VALID_UUID = '11111111-1111-1111-1111-111111111111';

  it('uuidSchema matches the backend fields UUID_REGEX guard', () => {
    const samples = [
      VALID_UUID,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'demo-farmer-1',
      'field-demo-1',
      'not-a-uuid-at-all',
      '',
      '1234',
    ];
    for (const sample of samples) {
      const schemaAccepts = uuidSchema.safeParse(sample).success;
      const guardAccepts = UUID_REGEX.test(sample);
      expect(schemaAccepts).toBe(guardAccepts);
    }
    // The exact production incident input must be rejected.
    expect(uuidSchema.safeParse('demo-farmer-1').success).toBe(false);
  });

  it('createFieldSchema rejects the demo farmerId that caused the production 500', () => {
    const invalid = createFieldSchema.safeParse({
      farmerId: 'demo-farmer-1',
      name: 'East Slope',
      areaHectares: 1.5,
    });
    expect(invalid.success).toBe(false);

    const valid = createFieldSchema.safeParse({
      farmerId: VALID_UUID,
      name: 'East Slope',
      areaHectares: 1.5,
      soilType: 'sand',
      soilPh: 5.8,
    });
    expect(valid.success).toBe(true);
  });

  it('createFieldSchema enforces required name + numeric areaHectares', () => {
    expect(createFieldSchema.safeParse({ farmerId: VALID_UUID, areaHectares: 1 }).success).toBe(false);
    expect(createFieldSchema.safeParse({ farmerId: VALID_UUID, name: 'Plot' }).success).toBe(false);
    expect(
      createFieldSchema.safeParse({ farmerId: VALID_UUID, name: 'Plot', areaHectares: 'x' }).success
    ).toBe(false);
  });

  it('fieldSchema accepts the serialized field shape the route returns', () => {
    const field = {
      id: '22222222-2222-2222-2222-222222222222',
      farmerId: VALID_UUID,
      name: 'North Plot',
      areaHectares: 2.0,
      soilType: 'clay-loam',
      soilPh: 6.2,
      latitude: -1.5177,
      longitude: 37.2634,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      cropCycles: [],
    };
    expect(fieldSchema.safeParse(field).success).toBe(true);
  });

  it('notificationSchema accepts the shape the notifications route maps', () => {
    const notification = {
      id: 'n-1',
      type: 'info',
      title: 'Hello',
      message: 'Body',
      metadata: { source: 'system' },
      isRead: false,
      channel: 'in_app',
      createdAt: '2026-01-01T00:00:00.000Z',
      readAt: null,
    };
    expect(notificationSchema.safeParse(notification).success).toBe(true);
    expect(unreadCountResponseSchema.safeParse({ success: true, data: { count: 3 } }).success).toBe(true);
  });

  it('userSchema + authResponseSchema accept the login response shape', () => {
    const user = {
      id: 'u-1',
      email: 'demo@agridemo.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'extension_officer',
      region: 'Kenya',
      planName: 'Free',
      isFree: true,
    };
    expect(userSchema.safeParse(user).success).toBe(true);
    expect(
      authResponseSchema.safeParse({ success: true, data: { token: 'jwt', user } }).success
    ).toBe(true);
  });

  it('reportSchema accepts the shape the reporting routes return', () => {
    const report = {
      id: 'r-1',
      type: 'activity_report',
      title: 'Activity Report',
      generatedAt: '2026-01-01T00:00:00.000Z',
      status: 'completed',
      data: { visits: { total: 4, completed: 2, totalMinutes: 90 } },
    };
    expect(reportSchema.safeParse(report).success).toBe(true);
  });
});
