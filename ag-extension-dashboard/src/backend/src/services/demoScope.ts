/**
 * Demo records (`is_demo` on farmers and users) belong to the public demo
 * session only. Real accounts never see them, and background jobs, which act
 * for no one, treat them as invisible, so no campaign, advisory or alert can
 * reach a demo farmer's phone number.
 *
 * Use the helpers below wherever farmers, users or rows linked to a farmer are
 * read; pass the request's user (or nothing, for background jobs).
 */

/** Any request user (or nothing); only an explicit `isDemo: true` marks the demo session. */
export type DemoViewer = object;

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

function identifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new Error(`demoScope: invalid SQL identifier "${name}"`);
  return name;
}

const DEMO_ACCOUNT_EMAIL = 'demo@agridemo.com';

/** Whether verified token claims belong to the demo session (flag, or the demo account's email). */
export function tokenIsDemo(claims: { isDemo?: unknown; email?: unknown }): boolean {
  return claims.isDemo === true || (typeof claims.email === 'string' && claims.email.toLowerCase() === DEMO_ACCOUNT_EMAIL);
}

/** True only for the public demo session. */
export function viewerIsDemo(viewer?: DemoViewer | null): boolean {
  return (viewer as { isDemo?: unknown } | null | undefined)?.isDemo === true;
}

/** Prisma `where` fragment for the farmer or user models. */
export function demoWhere(viewer?: DemoViewer | null): { isDemo: boolean } {
  return { isDemo: viewerIsDemo(viewer) };
}

/** SQL condition on a `farmers` or `users` alias, e.g. `demoSql('f', req.user)`. */
export function demoSql(alias: string, viewer?: DemoViewer | null): string {
  return `COALESCE(${identifier(alias)}.is_demo, false) = ${viewerIsDemo(viewer)}`;
}

/**
 * SQL condition for rows linked to a farmer (visits, conversations, messages,
 * reports ...). Rows with no farmer count as real records.
 */
export function linkedDemoSql(alias: string, viewer?: DemoViewer | null, column = 'farmer_id'): string {
  const link = `${identifier(alias)}.${identifier(column)}`;
  const demoFarmer = `SELECT 1 FROM farmers demo_f WHERE demo_f.id = ${link} AND demo_f.is_demo = true`;
  return viewerIsDemo(viewer) ? `EXISTS (${demoFarmer})` : `NOT EXISTS (${demoFarmer})`;
}
