type Translate = (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => string;

/**
 * Dashboard subtitle: a personal greeting when the user's first name is known.
 * `dashboard_welcome` contains a `{name}` placeholder in every locale, so it is
 * only used when a name can fill it — never rendered with a raw `{name}`.
 */
export function dashboardGreeting(t: Translate, userName: string | undefined): string {
  const name = userName?.trim();
  return name
    ? t('dashboard_welcome', { name, defaultValue: 'Welcome back, {name}.' })
    : t('dashboard_overview', { defaultValue: 'Dashboard overview' });
}
