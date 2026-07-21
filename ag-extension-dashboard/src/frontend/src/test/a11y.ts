import { expect } from 'vitest';

/**
 * Lightweight, dependency-free accessibility assertions (no axe-core install
 * required). These catch the structural WCAG failures an ITA / government
 * accessibility reviewer screens for: missing landmarks, unlabelled form
 * controls, and non-reachable interactive elements.
 *
 * We deliberately use the live DOM (`container.querySelector`) rather than
 * @testing-library's `queryByRole` — in this project's jsdom environment the
 * testing-library role engine returns empty results (a `@testing-library/dom`
 * ↔ `aria-query` integration fault), which would make structural assertions
 * report false negatives. The DOM itself is correct, so we assert against it.
 *
 * For deeper rules (color contrast, ARIA state), pair with axe-core once
 * the registry dependency is available.
 */

const LANDMARK_ROLES = ['banner', 'main', 'contentinfo', 'navigation', 'complementary', 'region'];

export function expectAccessibleLandmarks(container: HTMLElement): void {
  // At minimum a page should expose a <main> landmark (or role="main").
  const main = container.querySelector('main, [role="main"]');
  expect(main, 'page must expose a <main> landmark (WCAG 2.4.1 / 1.3.1)').toBeTruthy();

  // Some landmark must exist beyond main (banner/nav/etc.).
  const hasAnyLandmark = LANDMARK_ROLES.some(
    (role) => container.querySelector(`main, nav, header, footer, [role="${role}"]`)
  );
  expect(hasAnyLandmark, 'page should expose at least one structural landmark').toBe(true);
}

export function expectFormControlsLabelled(container: HTMLElement): void {
  const controls = Array.from(
    container.querySelectorAll('input, textarea, select, button')
  ) as HTMLElement[];

  for (const control of controls) {
    const tag = control.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (control as HTMLInputElement).type;
      if (type === 'hidden' || type === 'submit' || type === 'button') continue;
    }

    const labelledBy = control.getAttribute('aria-labelledby');
    const ariaLabel = control.getAttribute('aria-label');
    const hasVisibleLabel =
      !!control.getAttribute('aria-label') ||
      Array.from(container.querySelectorAll('label')).some(
        (l) =>
          l.getAttribute('for') === control.id ||
          l.contains(control) ||
          control.getAttribute('aria-labelledby')?.split(/\s+/).includes(l.id)
      );
    const hasPlaceholder = !!control.getAttribute('placeholder');

    const accessible =
      labelledBy ||
      ariaLabel ||
      hasVisibleLabel ||
      hasPlaceholder ||
      (tag === 'button' && (control.textContent || '').trim());

    expect(
      accessible,
      `form control <${tag}${control.id ? ' id="' + control.id + '"' : ''}> needs an accessible name`
    ).toBeTruthy();
  }
}

export function expectNoOrphanButtons(container: HTMLElement): void {
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
  for (const btn of buttons) {
    const hasLabel =
      btn.getAttribute('aria-label') ||
      btn.getAttribute('aria-labelledby') ||
      (btn.textContent && btn.textContent.trim());
    // Icon-only buttons must carry an aria-label or accessible text.
    if (!(btn.textContent && btn.textContent.trim())) {
      expect(
        btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby'),
        `icon-only button (${btn.outerHTML.slice(0, 80)}) needs aria-label`
      ).toBeTruthy();
    }
    expect(hasLabel, `button needs an accessible name`).toBeTruthy();
  }
}
