import { pageLimit, pageOffset } from '@/utils/pagination';

describe('page size and offset from a query string', () => {
  it('caps a huge page and falls back on values that are not whole positive numbers', () => {
    expect(pageLimit('1000000', 50, 500)).toBe(500);
    expect(pageLimit('120', 50, 500)).toBe(120);
    expect(pageLimit('abc', 50)).toBe(50);
    expect(pageLimit('0', 50)).toBe(50);
    expect(pageLimit(undefined, 20)).toBe(20);
  });

  it('never goes below zero or past the ceiling', () => {
    expect(pageOffset('-5')).toBe(0);
    expect(pageOffset('abc')).toBe(0);
    expect(pageOffset('1000')).toBe(1000);
    expect(pageOffset('99999999')).toBe(100_000);
  });
});
