import { describe, expect, it } from 'vitest';
import { findFarmer, phoneKey } from '@/lib/farmerMatch';
import type { Farmer } from '@/types/dashboard';

const farmer = (id: string, firstName: string, lastName: string, phone?: string) =>
  ({ id, firstName, lastName, phone }) as Farmer;

const farmers = [
  farmer('f1', 'Wanjiku', 'Kamau', '+254 712 345 678'),
  farmer('f2', 'Otieno', 'Ochieng', '0722000111'),
  farmer('f3', 'Grace', 'Mwangi', '0733000222'),
  farmer('f4', 'Grace', 'Mwangi', '0744000333'),
];

describe('findFarmer (activity stream "Chat view" lookup)', () => {
  it('prefers the farmer id', () => {
    expect(findFarmer(farmers, { farmerId: 'f2', phone: '0712345678', farmerName: 'Wanjiku Kamau' })?.id).toBe('f2');
  });

  it('matches the same phone written with and without the country code', () => {
    expect(findFarmer(farmers, { phone: '0712345678' })?.id).toBe('f1');
    expect(findFarmer(farmers, { phone: '254722000111' })?.id).toBe('f2');
  });

  it('falls back to a unique name, ignoring case and extra spaces', () => {
    expect(findFarmer(farmers, { farmerName: '  otieno   OCHIENG ' })?.id).toBe('f2');
  });

  it('refuses an ambiguous name rather than opening the wrong chat', () => {
    expect(findFarmer(farmers, { farmerName: 'Grace Mwangi' })).toBeUndefined();
  });

  it('falls through a stale id to phone, and returns undefined when nothing matches', () => {
    expect(findFarmer(farmers, { farmerId: 'gone', phone: '0733000222' })?.id).toBe('f3');
    expect(findFarmer(farmers, { phone: '0700000000', farmerName: 'Nobody Here' })).toBeUndefined();
  });

  it('ignores phone fragments too short to identify anyone', () => {
    expect(phoneKey('123')).toBeNull();
    expect(phoneKey(undefined)).toBeNull();
  });
});
