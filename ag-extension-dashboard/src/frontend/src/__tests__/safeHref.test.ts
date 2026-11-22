import { describe, expect, it } from 'vitest';
import { safeHref } from '@/lib/safeHref';

describe('safeHref', () => {
  it('keeps web, mail and phone links and paths on this site', () => {
    expect(safeHref('https://www.fao.org/fall-armyworm')).toBe('https://www.fao.org/fall-armyworm');
    expect(safeHref('mailto:extension@example.org')).toBe('mailto:extension@example.org');
    expect(safeHref('tel:+265991000001')).toBe('tel:+265991000001');
    expect(safeHref('/api/v1/upload/file/a.pdf')).toBe('/api/v1/upload/file/a.pdf');
  });

  it('drops script, data and protocol-relative links, and empty values', () => {
    expect(safeHref('javascript:alert(document.cookie)')).toBeUndefined();
    expect(safeHref(' JavaScript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeHref('//evil.example/path')).toBeUndefined();
    expect(safeHref('')).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
  });
});
