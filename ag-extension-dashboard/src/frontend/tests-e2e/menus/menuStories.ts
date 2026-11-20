import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { apiAs } from '../helpers/journey';

/** JSON `data` from an API call as one account, asserting it succeeded. */
export async function apiData<T>(request: APIRequestContext, email: string, path: string): Promise<T> {
  const api = await apiAs(request, email);
  const response = await api.get(path);
  expect(response.ok(), `${path} → ${response.status()}`).toBeTruthy();
  return (await response.json()).data as T;
}

/** The value shown in a stat tile, found by its label. */
export function statTile(page: Page, label: string | RegExp) {
  return page.getByRole('group', { name: label });
}

/** Text that only an AI answer that never reached the AI would show. */
export const CANNED_AI = /fertili[sz]er rate|apply \d+(\.\d+)?\s*(kg|l|t)\/ha|consult your local agronomist for best results/i;

/** The honest message when the AI is down, which is acceptable instead of an answer. */
export const AI_UNAVAILABLE = /not available right now|could not answer|try again later/i;
