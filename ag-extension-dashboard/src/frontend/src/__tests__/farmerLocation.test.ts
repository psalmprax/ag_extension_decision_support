import { describe, it, expect } from 'vitest';
import { farmerCoordinates } from '@/lib/farmerLocation';

describe('farmerCoordinates', () => {
  it('reads the API decimal strings', () => {
    expect(farmerCoordinates({ locationLat: '-0.2833', locationLng: '36.0667' })).toEqual({ lat: -0.2833, lng: 36.0667 });
  });

  it('reads numeric demo coordinates', () => {
    expect(farmerCoordinates({ latitude: -1.5, longitude: 37 })).toEqual({ lat: -1.5, lng: 37 });
  });

  it('returns null rather than inventing a position', () => {
    expect(farmerCoordinates({})).toBeNull();
    expect(farmerCoordinates({ locationLat: '', locationLng: '36' })).toBeNull();
    expect(farmerCoordinates({ locationLat: 'abc', locationLng: '36' })).toBeNull();
    expect(farmerCoordinates({ locationLat: '95', locationLng: '36' })).toBeNull();
  });
});
