import { describe, it, expect } from 'vitest';
import { getApiErrorMessage } from '@/lib/apiError';

describe('getApiErrorMessage', () => {
  const fallback = 'Something went wrong';

  it('passes string errors through', () => {
    expect(getApiErrorMessage({ response: { data: { error: 'Invalid email or password' } } }, fallback)).toBe(
      'Invalid email or password'
    );
  });

  it('extracts message from the global errorHandler object shape { message, type }', () => {
    const err = {
      response: {
        status: 500,
        data: {
          success: false,
          error: { message: 'Internal Server Error', type: 'INTERNAL_ERROR' },
        },
      },
    };
    expect(getApiErrorMessage(err, fallback)).toBe('Internal Server Error');
  });

  it('falls back to the axios error message when there is no response payload', () => {
    expect(getApiErrorMessage({ message: 'Network Error' }, fallback)).toBe('Network Error');
  });

  it('returns the fallback for empty or unusable payloads', () => {
    expect(getApiErrorMessage({ response: { data: { success: false } } }, fallback)).toBe(fallback);
    expect(getApiErrorMessage(null, fallback)).toBe(fallback);
    expect(getApiErrorMessage(undefined, fallback)).toBe(fallback);
    expect(getApiErrorMessage({ response: { data: { error: '   ' } } }, fallback)).toBe(fallback);
  });

  it('picks the first usable message from validation detail arrays', () => {
    const err = {
      response: { data: { error: 'Validation failed', details: [{ path: 'email', message: 'Invalid email format' }] } },
    };
    expect(getApiErrorMessage(err, fallback)).toBe('Validation failed');
  });

  it('always returns a string (never an object React cannot render)', () => {
    const shapes = [
      { response: { data: { error: { message: 'x', type: 'y', code: 'z' } } } },
      { error: { message: 'nested' } },
      { message: 'plain' },
      'raw string',
      500,
    ];
    for (const shape of shapes) {
      expect(typeof getApiErrorMessage(shape, fallback)).toBe('string');
    }
  });
});
