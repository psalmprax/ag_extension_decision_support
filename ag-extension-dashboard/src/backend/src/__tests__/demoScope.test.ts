import { demoSql, demoWhere, linkedDemoSql, tokenIsDemo, viewerIsDemo } from '@/services/demoScope';

describe('demo scope helpers', () => {
  it('treats only an explicit isDemo: true as the demo session', () => {
    expect(viewerIsDemo({ isDemo: true })).toBe(true);
    expect(viewerIsDemo({ isDemo: 'true' })).toBe(false);
    expect(viewerIsDemo({})).toBe(false);
    expect(viewerIsDemo(undefined)).toBe(false);
  });

  it('recognises demo tokens by flag or by the demo account email', () => {
    expect(tokenIsDemo({ isDemo: true })).toBe(true);
    expect(tokenIsDemo({ email: 'Demo@AgriDemo.com' })).toBe(true);
    expect(tokenIsDemo({ email: 'officer@example.com' })).toBe(false);
  });

  it('builds filters for real viewers, the demo session and background jobs', () => {
    expect(demoWhere({ isDemo: true })).toEqual({ isDemo: true });
    expect(demoWhere()).toEqual({ isDemo: false });
    expect(demoSql('f')).toBe('COALESCE(f.is_demo, false) = false');
    expect(demoSql('f', { isDemo: true })).toBe('COALESCE(f.is_demo, false) = true');
    expect(linkedDemoSql('v')).toBe('NOT EXISTS (SELECT 1 FROM farmers demo_f WHERE demo_f.id = v.farmer_id AND demo_f.is_demo = true)');
    expect(linkedDemoSql('v', { isDemo: true }, 'owner_farmer_id')).toContain('EXISTS (SELECT 1 FROM farmers demo_f WHERE demo_f.id = v.owner_farmer_id');
  });

  it('refuses anything but a plain SQL identifier', () => {
    expect(() => demoSql('f; DROP TABLE farmers')).toThrow('invalid SQL identifier');
    expect(() => linkedDemoSql('v', undefined, 'farmer_id OR 1=1')).toThrow('invalid SQL identifier');
  });
});
