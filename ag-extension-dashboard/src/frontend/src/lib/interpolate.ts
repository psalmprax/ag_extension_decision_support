/** Fills `{name}` placeholders in a translation; `defaultValue` and empty values are left alone. */
export function interpolate(template: string, params: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'defaultValue' && value !== undefined && value !== null) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
  }
  return result;
}
