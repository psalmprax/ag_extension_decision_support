import { assignableRoles } from '@/components/users/types';

describe('admin role assignment', () => {
  it('hides the admin role from an ordinary administrator', () => {
    expect(assignableRoles(false).map(role => role.value)).toEqual([
      'regional_manager',
      'extension_officer',
      'farmer',
    ]);
  });

  it('offers the admin role to a system administrator', () => {
    expect(assignableRoles(true).map(role => role.value)).toEqual([
      'admin',
      'regional_manager',
      'extension_officer',
      'farmer',
    ]);
  });

  it('treats an unknown flag as a non-system administrator', () => {
    expect(assignableRoles(undefined).some(role => role.value === 'admin')).toBe(false);
  });
});
